/* ═══════════════════════════════════════════════════════════════
   store.js — the ledger, its mutations, and every derived figure.

   Mutations are modelled as *ops* rather than direct edits. An op can be
   replayed onto a freshly fetched ledger, which is what makes conflict
   resolution work: if Aishwaryya saved while you were offline, we re-fetch her
   version and replay your op on top instead of overwriting her.
   ═══════════════════════════════════════════════════════════════ */

export const LS = {
  repo:  'setu.repo',
  token: 'setu.token',
  me:    'setu.me',
  cache: 'setu.cache',
  sha:   'setu.sha',
  queue: 'setu.queue',
};

export const PEOPLE = ['Adithya', 'Aishwaryya'];
export const METHODS = ['Wise', 'Remitly', 'Revolut', 'Bank', 'Other'];

/* Category colours use the validated categorical slots in fixed order.
   The colour follows the category (a stable entity), never its rank — so a
   category keeps the same hue everywhere in the app, forever. */
export const SEED_CATEGORIES = [
  { id: 'c_festival',  name: 'Festival',  icon: 'sparkle',  color: 'c5' },
  { id: 'c_gifts',     name: 'Gifts',     icon: 'gift',     color: 'c2' },
  { id: 'c_household', name: 'Household', icon: 'home',     color: 'c1' },
  { id: 'c_medical',   name: 'Medical',   icon: 'heart',    color: 'c8' },
  { id: 'c_education', name: 'Education', icon: 'book',     color: 'c7' },
  { id: 'c_travel',    name: 'Travel',    icon: 'plane',    color: 'c3' },
  { id: 'c_food',      name: 'Food',      icon: 'cup',      color: 'c4' },
  { id: 'c_bills',     name: 'Bills',     icon: 'bolt',     color: 'c6' },
  { id: 'c_savings',   name: 'Savings',   icon: 'bank',     color: 'c1' },
  { id: 'c_other',     name: 'Other',     icon: 'dots',     color: 'c9' },
];

/* Deliberately empty. A purpose is something you decide on, not something the
   app guesses at — a new ledger starts with none and you add what you need. */
export const SEED_PURPOSES = [];

export function emptyLedger() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    purposes: structuredClone(SEED_PURPOSES),
    categories: structuredClone(SEED_CATEGORIES),
    transfers: [],
    expenses: [],
  };
}

/* Fills in anything a hand-edited or older ledger.json might be missing. */
export function normalise(l) {
  const out = Object.assign(emptyLedger(), l || {});
  for (const k of ['purposes', 'categories', 'transfers', 'expenses']) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  if (!out.categories.length) out.categories = structuredClone(SEED_CATEGORIES);
  for (const t of out.transfers) {
    if (!Array.isArray(t.allocations)) t.allocations = [];
    t.sentGBP     = num(t.sentGBP);
    t.receivedINR = num(t.receivedINR);
  }
  for (const e of out.expenses) e.amountINR = num(e.amountINR);
  return out;
}

const num = v => (typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0);

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ─────────────────────────── ops ─────────────────────────── */

const COLLECTION = {
  transfer: 'transfers',
  expense:  'expenses',
  purpose:  'purposes',
  category: 'categories',
};

export function applyOp(ledger, op) {
  const l = structuredClone(ledger);
  const key = COLLECTION[op.entity];
  if (!key) return l;
  const list = l[key];

  if (op.type === 'upsert') {
    const i = list.findIndex(x => x.id === op.data.id);
    if (i >= 0) list[i] = { ...list[i], ...op.data };
    else list.push(op.data);
  }

  if (op.type === 'delete') {
    const i = list.findIndex(x => x.id === op.id);
    if (i >= 0) list.splice(i, 1);

    // Deleting a purpose must not orphan the things pointing at it.
    if (op.entity === 'purpose') {
      for (const e of l.expenses) if (e.purposeId === op.id) e.purposeId = null;
      for (const t of l.transfers) {
        t.allocations = (t.allocations || []).filter(a => a.purposeId !== op.id);
      }
    }
    if (op.entity === 'category') {
      for (const e of l.expenses) if (e.categoryId === op.id) e.categoryId = 'c_other';
    }
  }

  l.updatedAt = new Date().toISOString();
  return l;
}

export function applyOps(ledger, ops) {
  return (ops || []).reduce(applyOp, ledger);
}

/* A readable commit message, so the repo's history is a usable audit log. */
export function describeOp(op, ledger) {
  const money = n => '₹' + Math.round(n).toLocaleString('en-IN');
  if (op.entity === 'transfer' && op.type === 'upsert') {
    const t = op.data;
    return `Transfer ${money(t.receivedINR)} received${t.sentGBP ? ` (£${t.sentGBP})` : ''} · ${t.date}`;
  }
  if (op.entity === 'expense' && op.type === 'upsert') {
    const c = ledger.categories.find(c => c.id === op.data.categoryId);
    return `Spend ${money(op.data.amountINR)}${c ? ` on ${c.name}` : ''} · ${op.data.date}`;
  }
  if (op.type === 'delete') return `Delete ${op.entity} ${op.id}`;
  if (op.entity === 'purpose')  return `Update purpose ${op.data?.name || ''}`.trim();
  if (op.entity === 'category') return `Update category ${op.data?.name || ''}`.trim();
  return 'Update ledger';
}

/* ─────────────────────────── derived figures ───────────────────────────
   Nothing below is ever stored. Totals cannot drift out of sync with the
   entries they come from, because they are recomputed from scratch.        */

export function totals(l) {
  const received = sum(l.transfers, t => t.receivedINR);
  const sentGBP  = sum(l.transfers, t => t.sentGBP);
  const spent    = sum(l.expenses,  e => e.amountINR);
  const allocated = sum(l.transfers, t => sum(t.allocations || [], a => a.amountINR));
  const spentTagged = sum(l.expenses.filter(e => e.purposeId), e => e.amountINR);

  return {
    received, sentGBP, spent,
    balance: received - spent,
    allocated,
    // What's free to spend on anything: unallocated money, less untagged spending.
    general: (received - allocated) - (spent - spentTagged),
    rate: sentGBP > 0 ? received / sentGBP : 0,
  };
}

export function purposeStats(l, purposeId) {
  const allocated = sum(l.transfers, t =>
    sum((t.allocations || []).filter(a => a.purposeId === purposeId), a => a.amountINR));
  const spent = sum(l.expenses.filter(e => e.purposeId === purposeId), e => e.amountINR);
  return { allocated, spent, remaining: allocated - spent };
}

/** The rate of the most recent transfer that has both sides recorded. */
export function latestRate(l) {
  const t = [...l.transfers]
    .filter(t => t.sentGBP > 0 && t.receivedINR > 0)
    .sort((a, b) => cmpDate(b, a))[0];
  return t ? t.receivedINR / t.sentGBP : 0;
}

export function monthKey(dateStr) { return (dateStr || '').slice(0, 7); }

export function monthlyTotals(l, months = 6) {
  const keys = [];
  const d = new Date();
  d.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys.map(k => ({
    key: k,
    label: new Date(k + '-01').toLocaleDateString('en-GB', { month: 'short' }),
    in:  sum(l.transfers.filter(t => monthKey(t.date) === k), t => t.receivedINR),
    out: sum(l.expenses.filter(e => monthKey(e.date) === k), e => e.amountINR),
  }));
}

export function byCategory(l, sinceKey) {
  const rows = new Map();
  for (const e of l.expenses) {
    if (sinceKey && monthKey(e.date) < sinceKey) continue;
    rows.set(e.categoryId, (rows.get(e.categoryId) || 0) + e.amountINR);
  }
  return [...rows.entries()]
    .map(([id, value]) => {
      const c = l.categories.find(c => c.id === id);
      return { id, value, name: c?.name || 'Unknown', color: c?.color || 'c9', icon: c?.icon || 'dots' };
    })
    .sort((a, b) => b.value - a.value);
}

export function rateSeries(l) {
  return l.transfers
    .filter(t => t.sentGBP > 0 && t.receivedINR > 0)
    .slice()
    .sort((a, b) => cmpDate(a, b))
    .map(t => ({ date: t.date, rate: t.receivedINR / t.sentGBP, method: t.method || 'Other', id: t.id }));
}

/** Transfers and expenses merged into one reverse-chronological feed. */
export function feed(l) {
  const items = [
    ...l.transfers.map(t => ({ kind: 'in',  ...t })),
    ...l.expenses.map(e  => ({ kind: 'out', ...e })),
  ];
  return items.sort((a, b) => cmpDate(b, a));
}

function cmpDate(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
}

function sum(arr, f) {
  let n = 0;
  for (const x of arr) n += f(x) || 0;
  return n;
}

/* ─────────────────────────── formatting ─────────────────────────── */

const inrFmt  = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbpFmt  = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const inr  = n => '₹' + inrFmt.format(Math.round(n || 0));
export const inr2 = n => '₹' + inrFmt2.format(n || 0);
export const gbp  = n => '£' + gbpFmt.format(n || 0);

/** Compact form for chart axes, where space is tight: ₹28.4k, ₹1.2L */
export function inrShort(n) {
  const v = Math.abs(n || 0);
  const s = n < 0 ? '-' : '';
  if (v >= 1e7)  return `${s}₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5)  return `${s}₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1000) return `${s}₹${(v / 1000).toFixed(v >= 1e4 ? 0 : 1)}k`;
  return `${s}₹${Math.round(v)}`;
}

export const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local

export function prettyDate(d) {
  if (!d) return '';
  const t = today();
  if (d === t) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d === y.toLocaleDateString('en-CA')) return 'Yesterday';
  const dt = new Date(d + 'T00:00:00');
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString('en-GB',
    sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthLabel(key) {
  return new Date(key + '-01T00:00:00')
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
