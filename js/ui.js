/* ═══════════════════════════════════════════════════════════════
   ui.js — screens, sheets, and the glue.
   ═══════════════════════════════════════════════════════════════ */

import {
  PEOPLE, METHODS, uid, totals, purposeStats, latestRate,
  monthlyTotals, byCategory, rateSeries, feed, monthKey, monthLabel,
  inr, gbp, prettyDate, today, emptyLedger,
} from './store.js';
import { cfg, local, sync, commit, verifyAccess, pendingCount } from './github.js';
import { renderMonthlyChart, renderRateChart } from './charts.js';

/* ─────────────────────────── icons ─────────────────────────── */

const F = 'fill="currentColor" stroke="none"';
const ICONS = {
  sparkle: '<path d="M12 3.2 13.9 9 19.8 11 13.9 13 12 18.8 10.1 13 4.2 11 10.1 9z"/>',
  gift:    '<path d="M20 12v8H4v-8"/><rect x="2.5" y="8" width="19" height="4" rx="1.2"/><path d="M12 20V8"/><path d="M12 8S10.6 4.2 8.4 4.2a2.1 2.1 0 0 0 0 4.2H12Z"/><path d="M12 8s1.4-3.8 3.6-3.8a2.1 2.1 0 0 1 0 4.2H12Z"/>',
  home:    '<path d="M3 10.5 12 3.4l9 7.1"/><path d="M5.6 9.6V20h12.8V9.6"/>',
  heart:   '<path d="M12 20s-7.2-4.5-7.2-9.4A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7.2 2.4C19.2 15.5 12 20 12 20Z"/>',
  book:    '<path d="M4.5 4.8A1.8 1.8 0 0 1 6.3 3H19.5v18H6.3a1.8 1.8 0 0 1-1.8-1.8z"/><path d="M19.5 17.2H6.6"/>',
  plane:   '<path d="M10.8 3.6a1.3 1.3 0 0 1 2.6 0l.2 5.5 6.4 3.4v1.9l-6.4-1.6-.3 4.6 2.3 1.6v1.3L12 19.6l-3.6.7v-1.3l2.3-1.6-.3-4.6L4 14.4v-1.9L10.5 9z"/>',
  cup:     '<path d="M4.2 8.4h12.9v5.8a4.8 4.8 0 0 1-4.8 4.8H9a4.8 4.8 0 0 1-4.8-4.8z"/><path d="M17.1 10.3h1.7a2.1 2.1 0 0 1 0 4.2h-1.7"/><path d="M7.4 3.4v2M11.2 3.4v2"/>',
  bolt:    '<path d="M13.2 3.2 5.4 13.4h5.9L10.6 20.8 18.6 10.6h-5.9z"/>',
  bank:    '<path d="M3.2 9.6 12 4.2l8.8 5.4"/><path d="M5.6 10.4v7.8M9.9 10.4v7.8M14.1 10.4v7.8M18.4 10.4v7.8"/><path d="M3.2 19.8h17.6"/>',
  dots:    `<circle cx="5.8" cy="12" r="1.6" ${F}/><circle cx="12" cy="12" r="1.6" ${F}/><circle cx="18.2" cy="12" r="1.6" ${F}/>`,
  in:      '<path d="M12 4.4v10.8"/><path d="m7.6 10.9 4.4 4.4 4.4-4.4"/><path d="M5.2 19.6h13.6"/>',
  out:     '<path d="M12 19.6V8.8"/><path d="m7.6 13.1 4.4-4.4 4.4 4.4"/><path d="M5.2 4.4h13.6"/>',
  flag:    '<path d="M6 21V3.8"/><path d="M6 4.2h12.4l-2.5 3.9 2.5 3.9H6z"/>',
  wallet:  '<path d="M3.2 7.6A2.4 2.4 0 0 1 5.6 5.2H18v2.4"/><rect x="3.2" y="7.6" width="17.6" height="11.6" rx="2.6"/><circle cx="16.6" cy="13.4" r="1.3" ' + F + '/>',
  gear:    '<path d="M4 7.4h8.2M17.2 7.4h2.8M4 16.6h3.8M12.8 16.6H20"/><circle cx="14.8" cy="7.4" r="2.4"/><circle cx="10.2" cy="16.6" r="2.4"/>',
  chev:    '<path d="m9.2 5.4 6.6 6.6-6.6 6.6"/>',
  trash:   '<path d="M4.2 7h15.6"/><path d="M9.2 7V4.9a.9.9 0 0 1 .9-.9h3.8a.9.9 0 0 1 .9.9V7"/><path d="M6.6 7 7.5 20h9L17.4 7"/>',
  pencil:  '<path d="M4.2 19.8h4L19 9a2.1 2.1 0 0 0-3-3L5.2 16.8z"/>',
  down:    '<path d="M12 3.4v11.4"/><path d="m7.6 10.4 4.4 4.4 4.4-4.4"/><path d="M4.4 20.2h15.2"/>',
  power:   '<path d="M12 3.2v8.9"/><path d="M7.2 6.4a7.4 7.4 0 1 0 9.6 0"/>',
  back:    '<path d="M10 5.2h9a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2h-9L3.2 12z"/><path d="m13.8 9.6 4.6 4.8M18.4 9.6l-4.6 4.8"/>',
  search:  '<circle cx="11" cy="11" r="6.2"/><path d="m15.6 15.6 4.6 4.6"/>',
  plus:    '<path d="M12 5.2v13.6"/><path d="M5.2 12h13.6"/>',
  check:   '<path d="m5 12.6 4.6 4.6L19 7.4"/>',
};

const icon = (name, cls = '') =>
  `<svg viewBox="0 0 24 24" class="ico ${cls}" aria-hidden="true">${
    Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : ICONS.dots}</svg>`;

/* ─────────────────────────── tiny helpers ─────────────────────────── */

const $  = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Colour keys reach us from ledger.json, which is hand-editable and written by
   two devices. They land inside style="…", where a stray quote would escape the
   attribute entirely — so nothing but a known slot is ever interpolated. */
const ckey = k => (/^c[1-9]$/.test(k) ? k : 'c9');

const tint = key => `--tint:color-mix(in oklab, var(--${ckey(key)}) 17%, transparent);--tint-ink:var(--${ckey(key)})`;
const dotOf = key => `background:var(--${ckey(key)})`;

function haptic() { try { navigator.vibrate?.(8); } catch { /* not supported */ } }

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('on');
    setTimeout(() => { t.hidden = true; }, 260);
  }, bad ? 4200 : 2100);
}

/* ─────────────────────────── state ─────────────────────────── */

const S = {
  ledger: emptyLedger(),
  tab: 'home',
  filter: 'all',
  query: '',
  syncing: false,
  error: null,
};

const cat = id => S.ledger.categories.find(c => c.id === id);
const purpose = id => S.ledger.purposes.find(p => p.id === id);

/* ─────────────────────────── boot ─────────────────────────── */

function boot() {
  if (!cfg.ready) return showSetup();
  S.ledger = local.ledger || emptyLedger();
  $('#app').hidden = false;
  wireTabs();
  wirePullToRefresh();
  render();
  refresh();
}

async function refresh({ silent = false } = {}) {
  if (S.syncing) return;
  S.syncing = true;
  if (!silent) $('#refresh-hint').classList.add('on');
  try {
    S.ledger = await sync();
    S.error = null;
  } catch (err) {
    S.error = err;
    if (err.code !== 'offline') toast(err.message, true);
  } finally {
    S.syncing = false;
    $('#refresh-hint').classList.remove('on');
    render();
  }
}

/** Save a change: apply it locally at once, then push in the background. */
async function save(op) {
  S.ledger = await commit(op, S.ledger);
  render();
  haptic();
  try {
    S.ledger = await sync();
    S.error = null;
    render();
  } catch (err) {
    S.error = err;
    toast(err.code === 'offline'
      ? 'Saved on this device — will sync when you\'re back online.'
      : err.message, err.code !== 'offline');
    render();
  }
}

/* ─────────────────────────── setup screen ─────────────────────────── */

function showSetup() {
  const wrap = $('#setup');
  wrap.hidden = false;

  const who = $('#in-who');
  let chosen = PEOPLE[0];
  who.innerHTML = PEOPLE.map((p, i) =>
    `<button type="button" role="radio" aria-checked="${i === 0}" data-p="${esc(p)}">${esc(p)}</button>`).join('');
  who.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    chosen = b.dataset.p;
    [...who.children].forEach(c => c.setAttribute('aria-checked', c === b));
  });

  $('#setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#setup-go');
    const err = $('#setup-error');
    const repo = $('#in-repo').value.trim().replace(/^https?:\/\/github\.com\//i, '');
    const token = $('#in-token').value.trim();

    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      err.textContent = 'Write the repository as owner/name — for example adithya0727/setu-data.';
      err.hidden = false;
      return;
    }

    err.hidden = true;
    btn.classList.add('busy');
    btn.disabled = true;
    try {
      await verifyAccess(repo, token);
      cfg.set(repo, token, chosen);
      wrap.hidden = true;
      boot();
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
    } finally {
      btn.classList.remove('busy');
      btn.disabled = false;
    }
  });
}

/* ─────────────────────────── tabs & pull-to-refresh ─────────────────────────── */

function wireTabs() {
  $('#tabbar').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    haptic();
    if (b.dataset.tab === 'add') return openEntrySheet();
    S.tab = b.dataset.tab;
    S.query = '';
    render();
    $('#screen').scrollTo({ top: 0 });
  });
}

function wirePullToRefresh() {
  const screen = $('#screen');
  let y0 = null;
  screen.addEventListener('touchstart', e => {
    y0 = screen.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  screen.addEventListener('touchmove', e => {
    if (y0 === null) return;
    if (e.touches[0].clientY - y0 > 78) { y0 = null; haptic(); refresh(); }
  }, { passive: true });
  screen.addEventListener('touchend', () => { y0 = null; }, { passive: true });
}

/* ─────────────────────────── render router ─────────────────────────── */

function render() {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === S.tab));
  const view = { home: viewHome, activity: viewActivity, purposes: viewPurposes, insights: viewInsights }[S.tab];
  $('#screen').innerHTML = view();
  afterRender();
}

function afterRender() {
  $('#screen').querySelectorAll('[data-open-entry]').forEach(n =>
    n.addEventListener('click', () => openDetailSheet(n.dataset.openEntry, n.dataset.kind)));
  $('#screen').querySelectorAll('[data-open-purpose]').forEach(n =>
    n.addEventListener('click', () => openPurposeSheet(n.dataset.openPurpose)));
  $('#screen').querySelector('[data-settings]')?.addEventListener('click', openSettingsSheet);
  $('#screen').querySelector('[data-new-purpose]')?.addEventListener('click', () => openPurposeEditSheet(null));
  $('#screen').querySelector('[data-goto-activity]')?.addEventListener('click', () => {
    S.tab = 'activity'; render();
  });

  $('#screen').querySelectorAll('[data-filter]').forEach(n =>
    n.addEventListener('click', () => { S.filter = n.dataset.filter; render(); }));

  const q = $('#screen').querySelector('#q');
  if (q) {
    q.value = S.query;
    q.addEventListener('input', () => {
      S.query = q.value;
      const list = $('#screen').querySelector('#feed-list');
      if (list) list.innerHTML = feedMarkup(filteredFeed());
      afterFeed();
    });
  }
  afterFeed();

  const mc = $('#screen').querySelector('#chart-monthly');
  if (mc) renderMonthlyChart(mc, monthlyTotals(S.ledger, 6));
  const rc = $('#screen').querySelector('#chart-rate');
  if (rc) renderRateChart(rc, rateSeries(S.ledger));
}

function afterFeed() {
  $('#screen').querySelectorAll('#feed-list [data-open-entry]').forEach(n =>
    n.addEventListener('click', () => openDetailSheet(n.dataset.openEntry, n.dataset.kind)));
}

/* ─────────────────────────── shared markup ─────────────────────────── */

function syncBadge() {
  const pending = pendingCount();
  if (pending) return `<span class="sync-dot pending"></span>${pending} waiting to sync`;
  if (S.error) return `<span class="sync-dot bad"></span>${S.error.code === 'offline' ? 'Offline' : 'Sync problem'}`;
  return `<span class="sync-dot"></span>All synced`;
}

function entryRow(item) {
  const isIn = item.kind === 'in';
  if (isIn) {
    const p = (item.allocations || [])[0];
    const pu = p && purpose(p.purposeId);
    return `
      <button class="row" data-open-entry="${esc(item.id)}" data-kind="in">
        <span class="row-icon" style="${tint('c3')}">${icon('in')}</span>
        <span class="row-main">
          <span class="row-title">${esc(item.method || 'Transfer')}${pu ? ` · ${esc(pu.name)}` : ''}</span>
          <span class="row-meta">${prettyDate(item.date)}${item.sentGBP ? ` · ${gbp(item.sentGBP)} sent` : ''}${item.note ? ` · ${esc(item.note)}` : ''}</span>
        </span>
        <span class="row-right">
          <span class="row-amount is-in num">+${inr(item.receivedINR)}</span>
          ${item.sentGBP
            ? `<span class="row-side num">₹${(item.receivedINR / item.sentGBP).toFixed(1)}/£</span>`
            // An auto-imported transfer has no £ side yet — the email never carries it.
            // Hand-entered ones stay unmarked: leaving the £ out was a choice there.
            : item.source ? '<span class="row-side needs">Add £</span>' : ''}
        </span>
      </button>`;
  }
  const c = cat(item.categoryId);
  const pu = purpose(item.purposeId);
  // With no note the category becomes the title, so don't repeat it underneath.
  const meta = [prettyDate(item.date), item.note ? c?.name : null, pu?.name]
    .filter(Boolean).map(esc).join(' · ');
  return `
    <button class="row" data-open-entry="${esc(item.id)}" data-kind="out">
      <span class="row-icon" style="${tint(c?.color || 'c9')}">${icon(c?.icon || 'dots')}</span>
      <span class="row-main">
        <span class="row-title">${esc(item.note || c?.name || 'Spent')}</span>
        <span class="row-meta">${meta}</span>
      </span>
      <span class="row-right">
        <span class="row-amount is-out num">−${inr(item.amountINR)}</span>
      </span>
    </button>`;
}

function emptyState(iconName, title, body) {
  return `<div class="empty">
    <div class="empty-mark">${icon(iconName)}</div>
    <h3>${esc(title)}</h3><p>${esc(body)}</p>
  </div>`;
}

function ring(pct, colorKey) {
  const r = 14, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, pct));
  return `<svg class="ring" viewBox="0 0 34 34" aria-hidden="true">
    <circle cx="17" cy="17" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="4"/>
    <circle cx="17" cy="17" r="${r}" fill="none" stroke="var(--${ckey(colorKey)})" stroke-width="4"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}"
      transform="rotate(-90 17 17)"/>
  </svg>`;
}

/* ─────────────────────────── Home ─────────────────────────── */

function viewHome() {
  const t = totals(S.ledger);
  const rate = latestRate(S.ledger);
  const mk = monthKey(today());
  const inMonth  = S.ledger.transfers.filter(x => monthKey(x.date) === mk)
    .reduce((n, x) => n + x.receivedINR, 0);
  const outMonth = S.ledger.expenses.filter(x => monthKey(x.date) === mk)
    .reduce((n, x) => n + x.amountINR, 0);

  const recent = feed(S.ledger).slice(0, 8);
  const active = S.ledger.purposes.filter(p => !p.archived);

  return `
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <h1 class="page-title">Setu</h1>
        <p class="page-sub">${syncBadge()}</p>
      </div>
      <button class="row-icon" data-settings aria-label="Settings"
              style="${tint('c9')};margin-top:4px">${icon('gear')}</button>
    </div>

    <section class="hero">
      <div class="hero-label">Available balance</div>
      <div class="hero-amount num">${inr(t.balance)}</div>
      <p class="hero-sub">${rate
        ? `≈ ${gbp(t.balance / rate)} at ₹${rate.toFixed(2)} to the pound`
        : 'Add a transfer to start tracking.'}</p>
      <div class="hero-foot">
        <div class="hero-stat is-in">
          <div class="hero-stat-k">In this month</div>
          <div class="hero-stat-v num">${inr(inMonth)}</div>
        </div>
        <div class="hero-stat is-out">
          <div class="hero-stat-k">Out this month</div>
          <div class="hero-stat-v num">${inr(outMonth)}</div>
        </div>
      </div>
    </section>

    ${active.length ? `
      <div class="section-head">
        <span class="section-title">Purposes</span>
      </div>
      <div class="chip-scroll">
        ${active.map(p => {
          const st = purposeStats(S.ledger, p.id);
          const pct = st.allocated ? st.spent / st.allocated : 0;
          return `<button class="purpose-chip" data-open-purpose="${esc(p.id)}">
            <span class="purpose-chip-top">
              ${ring(pct, p.color)}
              <span class="purpose-chip-name">${esc(p.name)}</span>
            </span>
            <div class="purpose-chip-left num">${inr(st.remaining)}</div>
            <div class="purpose-chip-of">${st.allocated ? `left of ${inr(st.allocated)}` : 'nothing set aside'}</div>
          </button>`;
        }).join('')}
      </div>` : ''}

    <div class="section-head">
      <span class="section-title">Recent</span>
      ${recent.length ? '<button class="section-action" data-goto-activity>See all</button>' : ''}
    </div>
    ${recent.length
      ? `<div class="card"><div class="rows">${recent.map(entryRow).join('')}</div></div>`
      : `<div class="card">${emptyState('wallet', 'Nothing yet',
          'Tap the <b>+</b> button to record the first transfer.')}</div>`}
  `;
}

/* ─────────────────────────── Activity ─────────────────────────── */

function filteredFeed() {
  let items = feed(S.ledger);
  if (S.filter === 'in')  items = items.filter(i => i.kind === 'in');
  if (S.filter === 'out') items = items.filter(i => i.kind === 'out');
  if (S.filter.startsWith('p:')) {
    const id = S.filter.slice(2);
    items = items.filter(i => i.kind === 'out'
      ? i.purposeId === id
      : (i.allocations || []).some(a => a.purposeId === id));
  }
  const q = S.query.trim().toLowerCase();
  if (q) {
    items = items.filter(i => {
      const c = i.kind === 'out' ? cat(i.categoryId)?.name : i.method;
      return `${i.note || ''} ${c || ''}`.toLowerCase().includes(q);
    });
  }
  return items;
}

function feedMarkup(items) {
  if (!items.length) {
    return `<div class="card">${emptyState('search', 'Nothing matches',
      'Try a different filter or search term.')}</div>`;
  }
  const groups = new Map();
  for (const i of items) {
    const k = monthKey(i.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }
  return [...groups.entries()].map(([k, list]) => {
    const net = list.reduce((n, i) => n + (i.kind === 'in' ? i.receivedINR : -i.amountINR), 0);
    return `
      <div class="month-head">
        <b>${monthLabel(k)}</b>
        <span class="num">${net >= 0 ? '+' : '−'}${inr(Math.abs(net))} net</span>
      </div>
      <div class="card"><div class="rows">${list.map(entryRow).join('')}</div></div>`;
  }).join('');
}

function viewActivity() {
  const active = S.ledger.purposes.filter(p => !p.archived);
  const items = filteredFeed();
  return `
    <div class="page-head">
      <h1 class="page-title">Activity</h1>
      <p class="page-sub">${S.ledger.transfers.length} transfers · ${S.ledger.expenses.length} expenses</p>
    </div>

    <div style="position:relative;margin-bottom:12px">
      <span style="position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--ink-3)">
        ${icon('search')}
      </span>
      <input id="q" class="f-input" placeholder="Search notes and categories"
             style="padding-left:40px" autocapitalize="none" autocorrect="off">
    </div>

    <div class="chip-scroll">
      <button class="pill ${S.filter === 'all' ? 'on' : ''}" data-filter="all">All</button>
      <button class="pill ${S.filter === 'in' ? 'on' : ''}" data-filter="in">Money in</button>
      <button class="pill ${S.filter === 'out' ? 'on' : ''}" data-filter="out">Spent</button>
      ${active.map(p => `<button class="pill ${S.filter === 'p:' + p.id ? 'on' : ''}"
        data-filter="p:${esc(p.id)}">${esc(p.name)}</button>`).join('')}
    </div>

    <div id="feed-list">${feedMarkup(items)}</div>
  `;
}

/* ─────────────────────────── Purposes ─────────────────────────── */

function viewPurposes() {
  const t = totals(S.ledger);
  const list = S.ledger.purposes.filter(p => !p.archived);

  return `
    <div class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <h1 class="page-title">Purposes</h1>
        <p class="page-sub">Money set aside for something specific</p>
      </div>
      <button class="row-icon" data-new-purpose aria-label="New purpose"
              style="${tint('c7')};margin-top:4px">${icon('plus')}</button>
    </div>

    <div class="card card-pad">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
        <div>
          <div class="stat-k">General pool</div>
          <div class="stat-v num">${inr(t.general)}</div>
        </div>
        <div style="text-align:right">
          <div class="stat-k">Earmarked</div>
          <div class="stat-v num">${inr(t.allocated - sumSpentTagged())}</div>
        </div>
      </div>
      <p class="set-note" style="padding-left:0">Unassigned money you can spend on anything, alongside what is currently reserved.</p>
    </div>

    ${list.length ? `<div class="stack-12" style="margin-top:12px">${list.map(p => {
      const st = purposeStats(S.ledger, p.id);
      const pct = st.allocated ? Math.min(1, st.spent / st.allocated) : 0;
      return `
        <button class="card card-pad" data-open-purpose="${esc(p.id)}" style="display:block;width:100%;text-align:left">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:13px">
            <span class="cat-dot" style="${dotOf(p.color)};width:11px;height:11px;border-radius:4px"></span>
            <span style="font-size:16px;font-weight:620;letter-spacing:-.02em;flex:1">${esc(p.name)}</span>
            <span class="num" style="font-size:16px;font-weight:650">${inr(st.remaining)}</span>
          </div>
          <div class="bar" style="--tint:var(--${ckey(p.color)})"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px;color:var(--ink-3)">
            <span class="num">${inr(st.spent)} spent</span>
            <span class="num">${inr(st.allocated)} set aside</span>
          </div>
        </button>`;
    }).join('')}</div>`
    : `<div class="card" style="margin-top:12px">${emptyState('flag', 'No purposes yet',
        'When Aishwaryya says “this is for Rakhi”, make a purpose and tag the transfer to it.')}</div>`}
  `;
}

function sumSpentTagged() {
  return S.ledger.expenses.filter(e => e.purposeId).reduce((n, e) => n + e.amountINR, 0);
}

/* ─────────────────────────── Insights ─────────────────────────── */

function viewInsights() {
  const t = totals(S.ledger);
  const series = rateSeries(S.ledger);
  const cats = byCategory(S.ledger);
  const maxCat = cats[0]?.value || 1;
  const best = series.length ? series.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const avg = S.ledger.transfers.length ? t.received / S.ledger.transfers.length : 0;

  return `
    <div class="page-head">
      <h1 class="page-title">Insights</h1>
      <p class="page-sub">Everything since the beginning</p>
    </div>

    <div class="stat-grid">
      <div class="stat-tile">
        <div class="stat-k">Total received</div>
        <div class="stat-v num" style="color:var(--in-text)">${inr(t.received)}</div>
        <div class="stat-s num">${t.sentGBP ? `from ${gbp(t.sentGBP)} sent` : '—'}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-k">Total spent</div>
        <div class="stat-v num">${inr(t.spent)}</div>
        <div class="stat-s">${S.ledger.expenses.length} entries</div>
      </div>
      <div class="stat-tile">
        <div class="stat-k">Average transfer</div>
        <div class="stat-v num">${inr(avg)}</div>
        <div class="stat-s">${S.ledger.transfers.length} transfers</div>
      </div>
      <div class="stat-tile">
        <div class="stat-k">Best rate</div>
        <div class="stat-v num">${best ? '₹' + best.rate.toFixed(2) : '—'}</div>
        <div class="stat-s">${best ? `per £ · ${esc(best.method)}` : 'per £'}</div>
      </div>
    </div>

    <div class="section-head"><span class="section-title">Last six months</span></div>
    <div class="card chart-card chart-wrap">
      <div class="chart-head">
        <div class="chart-title">Received and spent</div>
        <div class="chart-note">Tap a month for exact figures</div>
      </div>
      <div id="chart-monthly"></div>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch" style="background:var(--in)"></span>Received</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--out)"></span>Spent</span>
      </div>
    </div>

    ${series.length > 1 ? `
      <div class="section-head"><span class="section-title">Exchange rate</span></div>
      <div class="card chart-card chart-wrap">
        <div class="chart-head">
          <div class="chart-title">Rupees per pound</div>
          <div class="chart-note">What each transfer actually landed at, after fees</div>
        </div>
        <div id="chart-rate"></div>
      </div>` : ''}

    <div class="section-head"><span class="section-title">Where it went</span></div>
    <div class="card card-pad">
      ${cats.length ? cats.map(c => `
        <div class="cat-row">
          <div class="cat-top">
            <span class="cat-name">
              <span class="cat-dot" style="${dotOf(c.color)}"></span>${esc(c.name)}
            </span>
            <span class="cat-val num">${inr(c.value)}<span class="cat-pct num">${
              ((c.value / (t.spent || 1)) * 100).toFixed(0)}%</span></span>
          </div>
          <div class="bar" style="--tint:var(--${ckey(c.color)})">
            <i style="width:${((c.value / maxCat) * 100).toFixed(1)}%"></i>
          </div>
        </div>`).join('')
        : emptyState('bolt', 'No spending yet', 'Categories will appear here once you log an expense.')}
    </div>
  `;
}

/* ─────────────────── deleting things ───────────────────
   Both live in two places each — the detail sheet you land on from any list,
   and the edit sheet behind it — so the wording and the op stay in one place. */

function confirmDeleteEntry(id, kind, close) {
  if (!confirm('Delete this entry? The change is recorded in the repo history, so it can be recovered.')) return;
  save({ type: 'delete', entity: kind === 'in' ? 'transfer' : 'expense', id });
  close();
  toast('Entry deleted');
}

function confirmDeletePurpose(id, name, close) {
  if (!confirm(`Delete “${name}”? Entries tagged to it move back to the general pool — none of them are deleted.`)) return;
  save({ type: 'delete', entity: 'purpose', id });
  close();
  toast('Purpose deleted');
}

/* ═══════════════════════════ sheets ═══════════════════════════ */

let closeSheetFn = null;
let teardown = null;   // the pending hide from the sheet that is animating out
let sheetGen = 0;      // which sheet currently owns the shared element

/**
 * One sheet element is reused for every sheet, so opening a second one while
 * the first is still animating out needs care: the outgoing sheet's teardown
 * would otherwise fire ~120ms later and hide the incoming one. That is what
 * made “Edit” look like it opened and instantly closed again.
 */
function openSheet(html, onMount) {
  const sheet = $('#sheet'), scrim = $('#scrim'), body = $('#sheet-body');

  clearTimeout(teardown);
  teardown = null;

  const gen = ++sheetGen;

  body.innerHTML = html;
  body.scrollTop = 0;
  sheet.hidden = false; scrim.hidden = false;
  sheet.style.transform = '';
  requestAnimationFrame(() => { sheet.classList.add('on'); scrim.classList.add('on'); });

  const close = () => {
    // A close captured by the previous sheet's handlers must not close this one.
    if (gen !== sheetGen) return;

    sheet.classList.remove('on'); scrim.classList.remove('on');
    clearTimeout(teardown);
    teardown = setTimeout(() => {
      teardown = null;
      if (gen !== sheetGen) return;        // something else opened in the meantime
      sheet.hidden = true; scrim.hidden = true; body.innerHTML = '';
      sheet.style.transform = '';
    }, 380);

    scrim.removeEventListener('click', close);
    closeSheetFn = null;
  };
  closeSheetFn = close;
  scrim.addEventListener('click', close);
  onMount?.(close);
  return close;
}

/* drag-to-dismiss on the grab handle */
(function wireSheetDrag() {
  const grab = $('#sheet-grab'), sheet = $('#sheet');
  let y0 = 0, dy = 0, on = false;
  grab.addEventListener('pointerdown', e => {
    on = true; y0 = e.clientY; dy = 0;
    sheet.classList.add('dragging');
    grab.setPointerCapture(e.pointerId);
  });
  grab.addEventListener('pointermove', e => {
    if (!on) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!on) return;
    on = false;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (dy > 110) closeSheetFn?.();
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
})();

/* ─────────────────── add / edit entry ─────────────────── */

function openEntrySheet(existing = null, kind = 'in') {
  const d = existing ? draftFrom(existing, kind) : {
    kind, id: null, inr: '', gbp: '', alloc: '',
    active: 'inr', date: today(), method: 'Wise',
    categoryId: 'c_household', purposeId: null, note: '',
  };

  openSheet(`
    <h2 class="sheet-title">${existing ? 'Edit entry' : 'New entry'}</h2>
    ${existing ? '' : `
      <div class="seg seg-io" id="io">
        <button type="button" data-kind="in"  class="${d.kind === 'in' ? 'on' : ''}">Money in</button>
        <button type="button" data-kind="out" class="${d.kind === 'out' ? 'on' : ''}">Spent</button>
      </div>`}
    <div id="entry-body"></div>
  `, close => {
    const body = $('#entry-body');

    const paint = () => { body.innerHTML = entryBody(d); wireEntryBody(d, paint, close, existing); };
    paint();

    $('#io')?.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      d.kind = b.dataset.kind;
      d.active = 'inr';
      [...b.parentNode.children].forEach(c => c.classList.toggle('on', c === b));
      haptic();
      paint();
    });
  });
}

function draftFrom(item, kind) {
  if (kind === 'in') {
    const a = (item.allocations || [])[0];
    return {
      kind: 'in', id: item.id,
      inr: String(item.receivedINR || ''),
      gbp: item.sentGBP ? String(item.sentGBP) : '',
      alloc: a ? String(a.amountINR) : '',
      active: 'inr', date: item.date, method: item.method || 'Wise',
      categoryId: 'c_household', purposeId: a?.purposeId || null,
      note: item.note || '', createdAt: item.createdAt, addedBy: item.addedBy,
    };
  }
  return {
    kind: 'out', id: item.id,
    inr: String(item.amountINR || ''), gbp: '', alloc: '',
    active: 'inr', date: item.date, method: 'Wise',
    categoryId: item.categoryId || 'c_other', purposeId: item.purposeId || null,
    note: item.note || '', createdAt: item.createdAt, addedBy: item.addedBy,
  };
}

const fmtBuf = (s, currency) => {
  if (!s) return '0';
  const [i, f] = s.split('.');
  const whole = new Intl.NumberFormat(currency === 'gbp' ? 'en-GB' : 'en-IN')
    .format(parseInt(i || '0', 10));
  return f !== undefined ? `${whole}.${f}` : whole;
};

function entryBody(d) {
  const isIn = d.kind === 'in';
  const activeCur = d.active === 'gbp' ? 'gbp' : 'inr';
  const label = d.active === 'gbp' ? 'Sent from the UK'
    : d.active === 'alloc' ? 'Set aside for this purpose'
    : isIn ? 'Received in India' : 'Amount spent';
  const buf = d[d.active] || '';

  const rate = (parseFloat(d.inr) > 0 && parseFloat(d.gbp) > 0)
    ? parseFloat(d.inr) / parseFloat(d.gbp) : 0;

  const purposes = S.ledger.purposes.filter(p => !p.archived);

  return `
    <div class="amount-display ${buf ? '' : 'zero'}">
      <div class="amount-label">${label}</div>
      <div><span class="cur">${activeCur === 'gbp' ? '£' : '₹'}</span><span class="val num">${fmtBuf(buf, activeCur)}</span><span class="caret"></span></div>
    </div>
    <div class="amount-note">${isIn && rate ? `Effective rate ₹${rate.toFixed(2)} to the pound` : '&nbsp;'}</div>

    ${isIn ? `
      <div class="amt-rows">
        <button type="button" class="amt-row ${d.active === 'inr' ? 'on' : ''}" data-field="inr">
          <div class="amt-row-k">Received ₹</div>
          <div class="amt-row-v num">${d.inr ? inr(parseFloat(d.inr)) : '—'}</div>
        </button>
        <button type="button" class="amt-row ${d.active === 'gbp' ? 'on' : ''}" data-field="gbp">
          <div class="amt-row-k">Sent £</div>
          <div class="amt-row-v num">${d.gbp ? gbp(parseFloat(d.gbp)) : '—'}</div>
        </button>
      </div>` : ''}

    <div class="keypad" id="keypad">
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}
      <button type="button" class="util" data-k=".">.</button>
      <button type="button" data-k="0">0</button>
      <button type="button" class="util" data-k="del" aria-label="Delete">${icon('back')}</button>
    </div>

    ${!isIn ? `
      <div class="f-block">
        <div class="f-label">Category</div>
        <div class="grid-pick" id="cats">
          ${S.ledger.categories.map(c => `
            <button type="button" class="pick ${d.categoryId === c.id ? 'on' : ''}"
                    data-cat="${esc(c.id)}" style="--tint:var(--${ckey(c.color)})">
              ${icon(c.icon)}<span>${esc(c.name)}</span>
            </button>`).join('')}
        </div>
      </div>` : `
      <div class="f-block">
        <div class="f-label">Sent via</div>
        <div class="seg" id="methods">
          ${METHODS.map(m => `<button type="button" class="${d.method === m ? 'on' : ''}"
             data-method="${m}" style="font-size:13px">${m}</button>`).join('')}
        </div>
      </div>`}

    <div class="f-block">
      <div class="f-label">
        ${isIn ? 'Earmark for' : 'Spend from'}
        <span class="opt">optional</span>
      </div>
      <div class="grid-pick" id="purposes">
        <button type="button" class="pick ${!d.purposeId ? 'on' : ''}" data-purpose=""
                style="--tint:var(--c9)">${icon('wallet')}<span>General</span></button>
        ${purposes.map(p => `
          <button type="button" class="pick ${d.purposeId === p.id ? 'on' : ''}"
                  data-purpose="${esc(p.id)}" style="--tint:var(--${ckey(p.color)})">
            ${icon('flag')}<span>${esc(p.name)}</span>
          </button>`).join('')}
      </div>
      ${isIn && d.purposeId ? `
        <button type="button" class="amt-row ${d.active === 'alloc' ? 'on' : ''}"
                data-field="alloc" style="width:100%;margin-top:9px">
          <div class="amt-row-k">Amount set aside</div>
          <div class="amt-row-v num">${d.alloc ? inr(parseFloat(d.alloc))
            : (d.inr ? `${inr(parseFloat(d.inr))} — all of it` : '—')}</div>
        </button>` : ''}
    </div>

    <div class="f-block">
      <div class="f-label">Date</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button type="button" class="pill ${d.date === today() ? 'on' : ''}" data-date="today">Today</button>
        <button type="button" class="pill ${d.date === yesterday() ? 'on' : ''}" data-date="yest">Yesterday</button>
        <input type="date" id="date-in" class="f-input" value="${esc(d.date)}"
               style="flex:1;padding:9px 11px;font-size:14px" max="${today()}">
      </div>
    </div>

    <div class="f-block">
      <div class="f-label">Note <span class="opt">optional</span></div>
      <input type="text" class="f-input" id="note-in" value="${esc(d.note)}"
             placeholder="${isIn ? 'e.g. birthday money' : 'e.g. sweets and thali'}" maxlength="120">
    </div>

    <div class="sheet-actions">
      ${d.id ? `<button type="button" class="btn-ghost btn-danger" id="del-entry">Delete</button>`
             : `<button type="button" class="btn-ghost" id="cancel-entry">Cancel</button>`}
      <button type="button" class="btn-primary" id="save-entry">${d.id ? 'Save changes' : 'Add entry'}</button>
    </div>
  `;
}

const yesterday = () => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return y.toLocaleDateString('en-CA');
};

function wireEntryBody(d, paint, close, existing) {
  const body = $('#entry-body');

  body.querySelector('#keypad').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    let v = d[d.active] || '';
    if (k === 'del') v = v.slice(0, -1);
    else if (k === '.') { if (!v.includes('.')) v = (v || '0') + '.'; }
    else {
      const [, f] = v.split('.');
      if (f !== undefined && f.length >= 2) return;    // two decimal places is plenty
      if (v.replace('.', '').length >= 11) return;      // stop runaway input
      v = v === '0' ? k : v + k;
    }
    d[d.active] = v;
    haptic();
    paint();
  });

  body.querySelectorAll('[data-field]').forEach(n => n.addEventListener('click', () => {
    d.active = n.dataset.field; paint();
  }));
  body.querySelectorAll('[data-cat]').forEach(n => n.addEventListener('click', () => {
    d.categoryId = n.dataset.cat; haptic(); paint();
  }));
  body.querySelectorAll('[data-method]').forEach(n => n.addEventListener('click', () => {
    d.method = n.dataset.method; haptic(); paint();
  }));
  body.querySelectorAll('[data-purpose]').forEach(n => n.addEventListener('click', () => {
    d.purposeId = n.dataset.purpose || null;
    if (!d.purposeId) d.alloc = '';
    if (d.active === 'alloc' && !d.purposeId) d.active = 'inr';
    haptic(); paint();
  }));
  body.querySelectorAll('[data-date]').forEach(n => n.addEventListener('click', () => {
    d.date = n.dataset.date === 'today' ? today() : yesterday(); haptic(); paint();
  }));
  body.querySelector('#date-in').addEventListener('change', e => {
    if (e.target.value) { d.date = e.target.value; paint(); }
  });
  body.querySelector('#note-in').addEventListener('input', e => { d.note = e.target.value; });

  body.querySelector('#cancel-entry')?.addEventListener('click', close);

  body.querySelector('#del-entry')?.addEventListener('click',
    () => confirmDeleteEntry(d.id, d.kind, close));

  body.querySelector('#save-entry').addEventListener('click', () => {
    const amount = parseFloat(d.inr) || 0;
    if (amount <= 0) return toast('Enter an amount first', true);

    if (d.kind === 'in') {
      const allocAmount = d.purposeId
        ? Math.min(parseFloat(d.alloc) || amount, amount)
        : 0;
      const data = {
        id: d.id || uid('t'),
        date: d.date,
        sentGBP: parseFloat(d.gbp) || 0,
        receivedINR: amount,
        method: d.method,
        allocations: d.purposeId ? [{ purposeId: d.purposeId, amountINR: allocAmount }] : [],
        note: d.note.trim(),
        addedBy: d.addedBy || cfg.me,
        createdAt: d.createdAt || new Date().toISOString(),
      };
      save({ type: 'upsert', entity: 'transfer', data });
    } else {
      const data = {
        id: d.id || uid('e'),
        date: d.date,
        amountINR: amount,
        categoryId: d.categoryId,
        purposeId: d.purposeId,
        note: d.note.trim(),
        addedBy: d.addedBy || cfg.me,
        createdAt: d.createdAt || new Date().toISOString(),
      };
      save({ type: 'upsert', entity: 'expense', data });
    }
    close();
    toast(existing ? 'Entry updated' : 'Entry added');
  });
}

/* ─────────────────── entry detail ─────────────────── */

function openDetailSheet(id, kind) {
  const item = kind === 'in'
    ? S.ledger.transfers.find(t => t.id === id)
    : S.ledger.expenses.find(e => e.id === id);
  if (!item) return;

  const isIn = kind === 'in';
  const c = isIn ? null : cat(item.categoryId);
  const a = isIn ? (item.allocations || [])[0] : null;
  const pu = purpose(isIn ? a?.purposeId : item.purposeId);
  const rate = isIn && item.sentGBP ? item.receivedINR / item.sentGBP : 0;

  openSheet(`
    <div class="detail-hero">
      <div class="detail-amount num ${isIn ? 'is-in' : ''}">
        ${isIn ? '+' : '−'}${inr(isIn ? item.receivedINR : item.amountINR)}
      </div>
      <div class="detail-sub">${isIn ? `Received via ${esc(item.method || 'transfer')}` : esc(c?.name || 'Spent')}</div>
    </div>

    <dl style="margin:0">
      <div class="kv"><dt>Date</dt><dd>${prettyDate(item.date)}</dd></div>
      ${isIn && item.sentGBP ? `
        <div class="kv"><dt>Sent</dt><dd class="num">${gbp(item.sentGBP)}</dd></div>
        <div class="kv"><dt>Effective rate</dt><dd class="num">₹${rate.toFixed(2)} per £</dd></div>`
      : isIn && item.source ? `
        <div class="kv"><dt>Sent</dt><dd class="needs">Not recorded — tap Edit to add it</dd></div>` : ''}
      ${pu ? `<div class="kv"><dt>${isIn ? 'Earmarked for' : 'Spent from'}</dt>
        <dd>${esc(pu.name)}${isIn && a ? ` · ${inr(a.amountINR)}` : ''}</dd></div>` : ''}
      ${!isIn ? `<div class="kv"><dt>Category</dt><dd>${esc(c?.name || 'Other')}</dd></div>` : ''}
      ${item.note ? `<div class="kv"><dt>Note</dt><dd>${esc(item.note)}</dd></div>` : ''}
      <div class="kv"><dt>Added by</dt><dd>${esc(item.addedBy || '—')}</dd></div>
    </dl>

    <div class="sheet-actions">
      <button type="button" class="btn-ghost" id="d-close">Close</button>
      <button type="button" class="btn-primary" id="d-edit">Edit</button>
    </div>
    <button type="button" class="btn-ghost btn-danger btn-wide" id="d-del">Delete entry</button>
  `, close => {
    $('#d-close').addEventListener('click', close);
    $('#d-edit').addEventListener('click', () => {
      close();
      setTimeout(() => openEntrySheet(item, kind), 260);
    });
    $('#d-del').addEventListener('click', () => confirmDeleteEntry(item.id, kind, close));
  });
}

/* ─────────────────── purpose detail & editor ─────────────────── */

function openPurposeSheet(id) {
  const p = purpose(id);
  if (!p) return;
  const st = purposeStats(S.ledger, id);
  const pct = st.allocated ? Math.min(1, st.spent / st.allocated) : 0;

  const items = feed(S.ledger).filter(i => i.kind === 'out'
    ? i.purposeId === id
    : (i.allocations || []).some(a => a.purposeId === id));

  openSheet(`
    <div class="detail-hero">
      <div class="detail-amount num">${inr(st.remaining)}</div>
      <div class="detail-sub">${esc(p.name)} · ${st.allocated ? `${inr(st.spent)} of ${inr(st.allocated)} used` : 'nothing set aside yet'}</div>
    </div>

    <div class="bar" style="--tint:var(--${ckey(p.color)})"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>

    <div class="f-block">
      <div class="f-label">Activity <span class="opt">${items.length}</span></div>
      ${items.length
        ? `<div class="card"><div class="rows">${items.map(entryRow).join('')}</div></div>`
        : `<div class="card">${emptyState('flag', 'Nothing tagged yet',
            'Tag a transfer or an expense to this purpose and it will show up here.')}</div>`}
    </div>

    <div class="sheet-actions">
      <button type="button" class="btn-ghost" id="p-close">Close</button>
      <button type="button" class="btn-primary" id="p-edit">Edit purpose</button>
    </div>
    <button type="button" class="btn-ghost btn-danger btn-wide" id="pd-del">Delete purpose</button>
  `, close => {
    $('#p-close').addEventListener('click', close);
    $('#pd-del').addEventListener('click', () => confirmDeletePurpose(id, p.name, close));
    $('#p-edit').addEventListener('click', () => {
      close();
      setTimeout(() => openPurposeEditSheet(id), 260);
    });
    $('#sheet-body').querySelectorAll('[data-open-entry]').forEach(n =>
      n.addEventListener('click', () => {
        close();
        setTimeout(() => openDetailSheet(n.dataset.openEntry, n.dataset.kind), 260);
      }));
  });
}

const PURPOSE_COLORS = ['c5', 'c4', 'c1', 'c3', 'c7', 'c2', 'c8', 'c6'];

function openPurposeEditSheet(id) {
  const existing = id ? purpose(id) : null;
  const d = {
    name: existing?.name || '',
    color: existing?.color || PURPOSE_COLORS[S.ledger.purposes.length % PURPOSE_COLORS.length],
  };

  openSheet(`
    <h2 class="sheet-title">${existing ? 'Edit purpose' : 'New purpose'}</h2>

    <div class="f-block" style="margin-top:0">
      <div class="f-label">Name</div>
      <input type="text" class="f-input" id="p-name" value="${esc(d.name)}"
             placeholder="e.g. Rakhi, Pooja, Mum's medicines" maxlength="40">
    </div>

    <div class="f-block">
      <div class="f-label">Colour</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap" id="p-colors">
        ${PURPOSE_COLORS.map(c => `
          <button type="button" data-color="${c}" aria-label="${c}"
            style="width:38px;height:38px;border-radius:12px;background:var(--${ckey(c)});
                   border:2.5px solid ${c === d.color ? 'var(--ink)' : 'transparent'}"></button>`).join('')}
      </div>
    </div>

    <p class="set-note" style="padding-left:0">
      Money is only reserved for a purpose when you tag a transfer to it. Deleting a purpose
      never deletes the entries — they simply move back to the general pool.
    </p>

    <div class="sheet-actions">
      ${existing ? `<button type="button" class="btn-ghost btn-danger" id="p-del">Delete</button>`
                 : `<button type="button" class="btn-ghost" id="p-cancel">Cancel</button>`}
      <button type="button" class="btn-primary" id="p-save">${existing ? 'Save' : 'Create'}</button>
    </div>
  `, close => {
    const nameEl = $('#p-name');
    $('#p-colors').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      d.color = b.dataset.color;
      [...b.parentNode.children].forEach(c =>
        c.style.borderColor = c === b ? 'var(--ink)' : 'transparent');
      haptic();
    });
    $('#p-cancel')?.addEventListener('click', close);
    $('#p-del')?.addEventListener('click',
      () => confirmDeletePurpose(id, existing.name, close));
    $('#p-save').addEventListener('click', () => {
      const name = nameEl.value.trim();
      if (!name) return toast('Give the purpose a name', true);
      save({
        type: 'upsert', entity: 'purpose',
        data: { id: id || uid('p'), name, color: d.color, archived: false },
      });
      close();
      toast(existing ? 'Purpose updated' : 'Purpose created');
    });
    setTimeout(() => nameEl.focus(), 420);
  });
}

/* ─────────────────── settings ─────────────────── */

function openSettingsSheet() {
  const t = totals(S.ledger);
  openSheet(`
    <h2 class="sheet-title">Settings</h2>

    <div class="f-block" style="margin-top:0">
      <div class="f-label">This device is</div>
      <div class="seg" id="s-who">
        ${PEOPLE.map(p => `<button type="button" class="${cfg.me === p ? 'on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>
      <p class="set-note" style="padding-left:0">Stamped on every entry added from this phone.</p>
    </div>

    <div class="f-block">
      <div class="f-label">Sync</div>
      <div class="card">
        <div class="set-row">
          <div class="set-row-main">
            <div class="set-row-t">${syncBadge()}</div>
            <div class="set-row-s">${esc(cfg.repo)}</div>
          </div>
        </div>
        <button type="button" class="set-row" id="s-sync">
          <div class="set-row-main"><div class="set-row-t">Sync now</div></div>
          ${icon('chev', 'chev')}
        </button>
        <button type="button" class="set-row" id="s-export">
          <div class="set-row-main">
            <div class="set-row-t">Export a copy</div>
            <div class="set-row-s">Download ledger.json to this device</div>
          </div>
          ${icon('chev', 'chev')}
        </button>
      </div>
      <p class="set-note">Every save is a commit in the private repo, so the full history is
        already backed up there and any change can be undone.</p>
    </div>

    <div class="f-block">
      <div class="f-label">Ledger</div>
      <div class="card">
        <div class="set-row">
          <div class="set-row-main"><div class="set-row-t">Transfers</div></div>
          <div class="set-row-v num">${S.ledger.transfers.length}</div>
        </div>
        <div class="set-row">
          <div class="set-row-main"><div class="set-row-t">Expenses</div></div>
          <div class="set-row-v num">${S.ledger.expenses.length}</div>
        </div>
        <div class="set-row">
          <div class="set-row-main"><div class="set-row-t">Lifetime received</div></div>
          <div class="set-row-v num">${inr(t.received)}</div>
        </div>
      </div>
    </div>

    <div class="f-block">
      <div class="card">
        <button type="button" class="set-row" id="s-out">
          <div class="set-row-main">
            <div class="set-row-t" style="color:var(--out-text)">Disconnect this device</div>
            <div class="set-row-s">Erases the token from this phone. The ledger itself is untouched.</div>
          </div>
        </button>
      </div>
    </div>

    <div class="sheet-actions">
      <button type="button" class="btn-ghost" id="s-close">Done</button>
    </div>
  `, close => {
    $('#s-who').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      cfg.setMe(b.dataset.p);
      [...b.parentNode.children].forEach(c => c.classList.toggle('on', c === b));
      haptic();
      toast(`Entries will be marked as ${b.dataset.p}`);
    });

    $('#s-sync').addEventListener('click', async () => {
      await refresh();
      if (!S.error) toast('Up to date');
    });

    $('#s-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(S.ledger, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `setu-ledger-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    $('#s-out').addEventListener('click', () => {
      const pending = pendingCount();
      const warn = pending
        ? `${pending} change${pending > 1 ? 's have' : ' has'} not synced yet and will be lost. `
        : '';
      if (!confirm(warn + 'Disconnect this device?')) return;
      cfg.clear();
      location.reload();
    });

    $('#s-close').addEventListener('click', close);
  });
}

/* ─────────────────────────── go ─────────────────────────── */

window.addEventListener('online', () => refresh({ silent: true }));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && cfg.ready) refresh({ silent: true });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ }));
}

boot();
