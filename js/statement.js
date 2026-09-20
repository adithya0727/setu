/* ═══════════════════════════════════════════════════════════════
   statement.js — the ledger as something you'd actually want to read.

   `ledger.json` is the backup: exact, restorable, and unreadable. This is the
   other half — one self-contained HTML file with every figure laid out, no
   network, no scripts, nothing to install. It opens anywhere and prints onto
   A4 without a stylesheet fighting it.

   Everything interpolated here comes out of the ledger, which is hand-editable
   and written by two devices, so all of it is escaped on the way in.
   ═══════════════════════════════════════════════════════════════ */

import {
  totals, purposeStats, feed, monthKey, monthLabel,
  inr, gbp, prettyDate,
} from './store.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOTS = {
  c1: '#3987E5', c2: '#D95926', c3: '#199E70', c4: '#C98500', c5: '#D55181',
  c6: '#3FA13F', c7: '#9085E9', c8: '#E66767', c9: '#7A8494',
};
const slot = k => SLOTS[k] || SLOTS.c9;

export function statementFilename(dateStr) {
  return `setu-statement-${dateStr}.html`;
}

export function buildStatement(l, { generated }) {
  const t = totals(l);
  const items = feed(l);

  const dates = items.map(i => i.date).filter(Boolean).sort();
  const span = dates.length
    ? (dates[0] === dates[dates.length - 1]
        ? prettyDate(dates[0])
        : `${prettyDate(dates[0])} — ${prettyDate(dates[dates.length - 1])}`)
    : 'No entries yet';

  const cats = new Map(l.categories.map(c => [c.id, c]));
  const purposes = new Map(l.purposes.map(p => [p.id, p]));

  /* Months, newest first, each with its own running totals. */
  const months = [];
  for (const i of items) {
    const key = monthKey(i.date);
    if (!months.length || months[months.length - 1].key !== key) {
      months.push({ key, rows: [], in: 0, out: 0 });
    }
    const m = months[months.length - 1];
    m.rows.push(i);
    if (i.kind === 'in') m.in += i.receivedINR; else m.out += i.amountINR;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setu statement · ${esc(span)}</title>
<style>
  :root {
    --bg:#F4F5F8; --card:#FFFFFF; --ink:#0F1319; --ink-2:#5C6674; --ink-3:#8A93A1;
    --line:rgba(15,19,25,.09); --in:#0A7F57; --out:#C24715; --accent:#5A54D8;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#0B0D10; --card:#15181D; --ink:#F4F6FA; --ink-2:#A2AAB7; --ink-3:#6E7683;
      --line:rgba(255,255,255,.09); --in:#34D399; --out:#FB9A6B; --accent:#818CF8;
    }
  }
  * { box-sizing:border-box; }
  body {
    margin:0; padding:32px 20px 64px; background:var(--bg); color:var(--ink);
    font:16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap { max-width:760px; margin:0 auto; }
  .num { font-variant-numeric:tabular-nums; }

  header { margin-bottom:28px; }
  .mark { display:flex; align-items:center; gap:10px; }
  .mark b { font-size:20px; font-weight:700; letter-spacing:-.03em; }
  .mark svg { width:26px; height:26px; }
  h1 { margin:18px 0 4px; font-size:29px; font-weight:700; letter-spacing:-.035em; }
  .sub { color:var(--ink-2); font-size:14px; }

  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:24px 0 32px; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 18px; }
  .tile .k { font-size:11.5px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-3); }
  .tile .v { font-size:25px; font-weight:700; letter-spacing:-.03em; margin-top:7px; }
  .tile .v.in { color:var(--in); } .tile .v.out { color:var(--out); }
  .tile .n { font-size:12.5px; color:var(--ink-3); margin-top:3px; }

  h2 { font-size:12.5px; font-weight:650; letter-spacing:.07em; text-transform:uppercase;
       color:var(--ink-3); margin:34px 0 12px; }

  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .row { display:flex; align-items:center; gap:14px; padding:13px 18px; }
  .row + .row { border-top:1px solid var(--line); }
  .row .main { flex:1; min-width:0; }
  .row .t { font-weight:550; }
  .row .s { font-size:12.5px; color:var(--ink-3); margin-top:2px; }
  .row .amt { font-weight:650; white-space:nowrap; }
  .row .amt.in { color:var(--in); } .row .amt.out { color:var(--ink); }
  .row .rate { font-size:12px; color:var(--ink-3); text-align:right; margin-top:2px; }
  .dot { width:9px; height:9px; border-radius:3px; flex:none; }

  .mhead { display:flex; justify-content:space-between; align-items:baseline;
           padding:11px 18px; background:var(--bg); border-top:1px solid var(--line); }
  .mhead:first-child { border-top:0; }
  .mhead b { font-size:13.5px; font-weight:650; }
  .mhead span { font-size:12px; color:var(--ink-3); }

  .bar { height:7px; border-radius:4px; background:var(--line); overflow:hidden; margin-top:9px; }
  .bar i { display:block; height:100%; border-radius:4px; }

  footer { margin-top:40px; color:var(--ink-3); font-size:12.5px; line-height:1.6; }
  .empty { padding:26px 18px; color:var(--ink-3); text-align:center; }
  .note { margin:-18px 0 0; color:var(--ink-3); font-size:12.5px; }

  @media print {
    :root { --bg:#fff; --card:#fff; --ink:#111; --ink-2:#444; --ink-3:#666; --line:#ddd;
            --in:#0A7F57; --out:#C24715; }
    body { padding:0; font-size:12px; }
    .tile, .card { break-inside:avoid; }
    .row, .mhead { break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="mark">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M8 31c0-9 7.2-16 16-16s16 7 16 16" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="24" cy="31" r="3.4" fill="url(#g)"/>
        <defs><linearGradient id="g" x1="8" y1="15" x2="40" y2="31" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5EEAD4"/><stop offset="1" stop-color="#818CF8"/>
        </linearGradient></defs>
      </svg>
      <b>Setu</b>
    </div>
    <h1>Statement</h1>
    <div class="sub">${esc(span)} · ${items.length} ${items.length === 1 ? 'entry' : 'entries'}
      · prepared ${esc(prettyDate(generated))}</div>
  </header>

  <div class="tiles">
    <div class="tile">
      <div class="k">Received</div>
      <div class="v in num">${esc(inr(t.received))}</div>
      ${t.sentGBP ? `<div class="n num">from ${esc(gbp(t.sentGBP))} sent</div>` : ''}
    </div>
    <div class="tile">
      <div class="k">Spent</div>
      <div class="v out num">${esc(inr(t.spent))}</div>
    </div>
    <div class="tile">
      <div class="k">Balance</div>
      <div class="v num">${esc(inr(t.balance))}</div>
      <div class="n num">${esc(inr(t.general))} unallocated</div>
    </div>
    ${t.rate ? `
    <div class="tile">
      <div class="k">Average rate</div>
      <div class="v num">₹${t.rate.toFixed(2)}</div>
      <div class="n num">across ${esc(gbp(t.pairedGBP))} sent</div>
    </div>` : ''}
  </div>

  ${t.unpaired ? `<p class="note">${t.unpaired} transfer${t.unpaired > 1 ? 's have' : ' has'} no £
    amount recorded, so ${t.unpaired > 1 ? 'they are' : 'it is'} counted in the totals but not in
    the rate.</p>` : ''}

  ${l.purposes.length ? `
  <h2>Purposes</h2>
  <div class="card">
    ${l.purposes.map(p => {
      const st = purposeStats(l, p.id);
      const pct = st.allocated ? Math.min(100, (st.spent / st.allocated) * 100) : 0;
      return `
      <div class="row" style="display:block">
        <div style="display:flex;align-items:center;gap:11px">
          <span class="dot" style="background:${slot(p.color)}"></span>
          <span class="t" style="flex:1">${esc(p.name)}</span>
          <span class="amt num">${esc(inr(st.remaining))} left</span>
        </div>
        <div class="bar"><i style="width:${pct.toFixed(1)}%;background:${slot(p.color)}"></i></div>
        <div class="s num">${esc(inr(st.spent))} spent of ${esc(inr(st.allocated))} set aside</div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <h2>Activity</h2>
  <div class="card">
    ${months.length ? months.map(m => `
      <div class="mhead">
        <b>${esc(monthLabel(m.key))}</b>
        <span class="num">+${esc(inr(m.in))} · −${esc(inr(m.out))}</span>
      </div>
      ${m.rows.map(i => row(i, cats, purposes)).join('')}
    `).join('') : '<div class="empty">Nothing recorded yet.</div>'}
  </div>

  <footer>
    Every change to this ledger is a commit in a private repository, so the full
    history — including anything since deleted — is kept there. This file is a
    snapshot for reading, not the record itself.
  </footer>

</div>
</body>
</html>`;
}

function row(i, cats, purposes) {
  if (i.kind === 'in') {
    const a = (i.allocations || [])[0];
    const pu = a && purposes.get(a.purposeId);
    const rate = i.sentGBP ? i.receivedINR / i.sentGBP : 0;
    return `
      <div class="row">
        <span class="dot" style="background:var(--in)"></span>
        <div class="main">
          <div class="t">${esc(i.method || 'Transfer')}${pu ? ` · ${esc(pu.name)}` : ''}</div>
          <div class="s">${esc(prettyDate(i.date))}${i.sentGBP ? ` · ${esc(gbp(i.sentGBP))} sent` : ''}${
            i.note ? ` · ${esc(i.note)}` : ''}${i.addedBy ? ` · ${esc(i.addedBy)}` : ''}</div>
        </div>
        <div style="text-align:right">
          <div class="amt in num">+${esc(inr(i.receivedINR))}</div>
          ${rate ? `<div class="rate num">₹${rate.toFixed(2)}/£</div>` : ''}
        </div>
      </div>`;
  }

  const c = cats.get(i.categoryId);
  const pu = purposes.get(i.purposeId);
  return `
    <div class="row">
      <span class="dot" style="background:${slot(c?.color)}"></span>
      <div class="main">
        <div class="t">${esc(i.note || c?.name || 'Spent')}</div>
        <div class="s">${esc(prettyDate(i.date))}${c ? ` · ${esc(c.name)}` : ''}${
          pu ? ` · ${esc(pu.name)}` : ''}${i.addedBy ? ` · ${esc(i.addedBy)}` : ''}</div>
      </div>
      <div class="amt out num">−${esc(inr(i.amountINR))}</div>
    </div>`;
}
