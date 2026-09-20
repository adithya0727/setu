/* ═══════════════════════════════════════════════════════════════
   charts.js — hand-drawn inline SVG. No chart library.

   Follows the dataviz method: form first, colour by job, validated palette,
   thin marks with rounded data-ends anchored to the baseline, recessive
   grid, a legend whenever two series are on screen, and a hover/tap layer
   on every plot.
   ═══════════════════════════════════════════════════════════════ */

import { inr, inrShort, prettyDate } from './store.js';

const NS = 'http://www.w3.org/2000/svg';

/* Tooltips are built with innerHTML, and some of what goes in them comes from
   ledger.json rather than from this file. */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function el(name, attrs = {}) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/** A bar with rounded top corners, square-footed on the baseline. */
function barPath(x, y, w, h, r = 4) {
  r = Math.max(0, Math.min(r, w / 2, h));
  if (h <= 0) return '';
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} `
       + `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** Ticks that land on human numbers rather than wherever the data ends. */
function niceTicks(max, count = 3) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].find(m => m * mag >= raw) * mag;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

function tooltip(wrap) {
  let tip = wrap.querySelector('.viz-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'viz-tip';
    tip.hidden = true;
    wrap.appendChild(tip);
  }
  return tip;
}

function placeTip(tip, wrap, xFrac) {
  // Keep the tooltip inside the card instead of letting it hang off an edge.
  tip.hidden = false;
  const w = wrap.clientWidth;
  const tw = tip.offsetWidth;
  let left = xFrac * w - tw / 2;
  left = Math.max(4, Math.min(left, w - tw - 4));
  tip.style.left = left + 'px';
}

/* ═════════════════ monthly in vs out — grouped bars ═════════════════ */

export function renderMonthlyChart(wrap, months) {
  wrap.innerHTML = '';
  const W = 340, H = 168;
  const pad = { t: 10, r: 4, b: 26, l: 38 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const max = Math.max(...months.flatMap(m => [m.in, m.out]), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || max;
  const y = v => pad.t + plotH - (v / top) * plotH;

  const svg = el('svg', {
    class: 'chart-svg', viewBox: `0 0 ${W} ${H}`,
    role: 'img', 'aria-label': 'Money received and spent, by month',
  });

  // recessive grid
  for (const t of ticks) {
    svg.appendChild(el('line', {
      x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t),
      stroke: 'var(--hairline)', 'stroke-width': 1,
    }));
    const lab = el('text', {
      x: pad.l - 7, y: y(t) + 3.5, 'text-anchor': 'end',
      class: 'viz-axis',
    });
    lab.textContent = t === 0 ? '0' : inrShort(t);
    svg.appendChild(lab);
  }

  const slot = plotW / months.length;
  const barW = Math.min(13, (slot - 10) / 2);
  const gap = 2; // the 2px surface gap between adjacent marks

  months.forEach((m, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const xIn  = cx - barW - gap / 2;
    const xOut = cx + gap / 2;

    for (const [x, v, color, key] of [
      [xIn,  m.in,  'var(--in)',  'in'],
      [xOut, m.out, 'var(--out)', 'out'],
    ]) {
      const h = v > 0 ? Math.max(3, (v / top) * plotH) : 0;
      if (!h) continue;
      svg.appendChild(el('path', {
        d: barPath(x, pad.t + plotH - h, barW, h),
        fill: color, 'data-i': i, 'data-k': key,
      }));
    }

    const lab = el('text', {
      x: cx, y: H - 8, 'text-anchor': 'middle', class: 'viz-axis',
    });
    lab.textContent = m.label;
    svg.appendChild(lab);

    // generous, invisible hit target — the bars themselves are too thin to tap
    svg.appendChild(el('rect', {
      x: pad.l + slot * i, y: pad.t, width: slot, height: plotH,
      fill: 'transparent', 'data-hit': i, style: 'cursor:pointer',
    }));
  });

  wrap.appendChild(svg);

  const tip = tooltip(wrap);
  const clear = () => {
    tip.hidden = true;
    svg.querySelectorAll('path[data-i]').forEach(p => p.style.opacity = '');
  };

  const show = i => {
    const m = months[i];
    svg.querySelectorAll('path[data-i]').forEach(p => {
      p.style.opacity = +p.dataset.i === i ? '1' : '.3';
    });
    tip.innerHTML =
      `<b>${esc(m.label)}</b>` +
      `<span><i style="background:var(--in)"></i>Received<em>${inr(m.in)}</em></span>` +
      `<span><i style="background:var(--out)"></i>Spent<em>${inr(m.out)}</em></span>`;
    placeTip(tip, wrap, (slot * i + slot / 2 + pad.l) / W);
  };

  svg.addEventListener('pointermove', e => {
    const hit = e.target.closest('[data-hit]');
    if (hit) show(+hit.dataset.hit); else clear();
  });
  svg.addEventListener('pointerleave', clear);
  svg.addEventListener('pointerdown', e => {
    const hit = e.target.closest('[data-hit]');
    if (hit) show(+hit.dataset.hit);
  });
}

/* ═════════════════ exchange-rate trend — single line ═════════════════ */

export function renderRateChart(wrap, series) {
  wrap.innerHTML = '';
  const W = 340, H = 150;
  const pad = { t: 14, r: 10, b: 24, l: 42 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const rates = series.map(s => s.rate);
  let lo = Math.min(...rates), hi = Math.max(...rates);
  if (hi - lo < 0.5) { lo -= 1; hi += 1; }          // don't magnify noise into drama
  const padY = (hi - lo) * 0.18;
  lo -= padY; hi += padY;

  const x = i => series.length === 1 ? pad.l + plotW / 2 : pad.l + (i / (series.length - 1)) * plotW;
  const y = v => pad.t + plotH - ((v - lo) / (hi - lo)) * plotH;

  const svg = el('svg', {
    class: 'chart-svg', viewBox: `0 0 ${W} ${H}`,
    role: 'img', 'aria-label': 'Rupees received per pound sent, over time',
  });

  for (const v of [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1]) {
    svg.appendChild(el('line', {
      x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v),
      stroke: 'var(--hairline)', 'stroke-width': 1,
    }));
    const lab = el('text', { x: pad.l - 7, y: y(v) + 3.5, 'text-anchor': 'end', class: 'viz-axis' });
    lab.textContent = '₹' + v.toFixed(0);
    svg.appendChild(lab);
  }

  // soft fill under the line, then the line, then the markers
  if (series.length > 1) {
    const area = series.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.rate)}`).join(' ')
      + ` L${x(series.length - 1)},${pad.t + plotH} L${x(0)},${pad.t + plotH} Z`;
    const grad = el('linearGradient', { id: 'rateFill', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0%',   'stop-color': 'var(--series-line)', 'stop-opacity': '.22' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': 'var(--series-line)', 'stop-opacity': '0' }));
    const defs = el('defs'); defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(el('path', { d: area, fill: 'url(#rateFill)' }));
    svg.appendChild(el('path', {
      d: series.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.rate)}`).join(' '),
      fill: 'none', stroke: 'var(--series-line)', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
  }

  const cross = el('line', {
    y1: pad.t, y2: pad.t + plotH, stroke: 'var(--hairline-2)', 'stroke-width': 1, opacity: 0,
  });
  svg.appendChild(cross);

  series.forEach((s, i) => {
    svg.appendChild(el('circle', {
      cx: x(i), cy: y(s.rate), r: 4.5,
      fill: 'var(--series-line)',
      stroke: 'var(--surface)', 'stroke-width': 2,   // 2px surface ring
      'data-p': i,
    }));
  });

  // Direct-label the endpoints only, never every point.
  if (series.length) {
    const last = series[series.length - 1];
    const t = el('text', {
      x: Math.min(x(series.length - 1) + 7, W - 2), y: y(last.rate) - 9,
      'text-anchor': series.length > 1 ? 'end' : 'middle', class: 'viz-label',
    });
    t.textContent = '₹' + last.rate.toFixed(1);
    svg.appendChild(t);
  }

  svg.appendChild(el('rect', {
    x: pad.l - 10, y: pad.t, width: plotW + 20, height: plotH,
    fill: 'transparent', 'data-plot': '1', style: 'cursor:crosshair',
  }));

  wrap.appendChild(svg);

  const tip = tooltip(wrap);
  const clear = () => {
    tip.hidden = true;
    cross.setAttribute('opacity', 0);
    svg.querySelectorAll('circle[data-p]').forEach(c => c.setAttribute('r', 4.5));
  };

  const at = clientX => {
    const box = svg.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    let best = 0, bd = Infinity;
    series.forEach((s, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bd) { bd = d; best = i; }
    });
    const s = series[best];
    cross.setAttribute('x1', x(best));
    cross.setAttribute('x2', x(best));
    cross.setAttribute('opacity', 1);
    svg.querySelectorAll('circle[data-p]').forEach(c => {
      c.setAttribute('r', +c.dataset.p === best ? 6.5 : 4.5);
    });
    tip.innerHTML =
      `<b>${prettyDate(s.date)}</b>` +
      `<span>Rate<em>₹${s.rate.toFixed(2)} / £</em></span>` +
      `<span>Via<em>${esc(s.method)}</em></span>`;
    placeTip(tip, wrap, x(best) / W);
  };

  svg.addEventListener('pointermove', e => {
    if (e.target.closest('[data-plot]') || e.target.closest('circle')) at(e.clientX);
  });
  svg.addEventListener('pointerdown', e => at(e.clientX));
  svg.addEventListener('pointerleave', clear);
}
