/* A stylesheet can lose a rule and still look fine to a brace counter — which
   is exactly how the global box-sizing reset went missing once, taking every
   layout in the app with it. Counting braces is not enough, so this checks the
   structure holds and that the rules everything else leans on are still there.

   Run: node test/css.test.mjs */

import { readFileSync } from 'fs';

const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

let bad = 0;
const check = (label, ok, detail = '') => {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  — ${detail}`}`);
};

/* ── structure ── */

let depth = 0, minDepth = 0, semisOutside = 0;
for (const ch of bare) {
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; minDepth = Math.min(minDepth, depth); }
  else if (ch === ';' && depth === 0) semisOutside++;
}
check('braces close out evenly', depth === 0, `ends at depth ${depth}`);
check('never closes more than it opens', minDepth === 0, `reached ${minDepth}`);
check('no declaration sits outside a rule', semisOutside === 0, `${semisOutside} stray`);

/* ── the rules other rules depend on ── */

const mustExist = [
  ['global box-sizing reset', /\*,\s*\*::before,\s*\*::after\s*\{[^}]*box-sizing:\s*border-box/],
  ['dark palette on :root', /:root\s*\{[\s\S]*?--bg:/],
  ['light palette', /:root\[data-theme="light"\]\s*\{[\s\S]*?--bg:/],
  ['light follows the device too', /prefers-color-scheme:\s*light/],
  ['hidden actually hides', /\[hidden\]\s*\{[^}]*display:\s*none/],
  ['tab bar is pinned', /\.tabbar\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/],
  ['sheet is pinned', /\.sheet\s*\{[^}]*position:\s*fixed/],
  ['sheet slides away when closed', /\.sheet\s*\{[^}]*transform:\s*translateY\(100%\)/],
  ['sheet body scrolls', /\.sheet-body\s*\{[^}]*overflow-y:\s*auto/],
  ['scrim exists', /\.scrim\s*\{/],
  ['icons are constrained', /\.ico\s*\{[^}]*width:/],
  ['keypad centres its keys', /\.keypad button\s*\{[^}]*justify-content:\s*center/],
  ['screen clears the tab bar', /\.screen\s*\{[\s\S]*?--tab-inset/],
];
for (const [label, re] of mustExist) check(label, re.test(css));

/* ── tokens referenced must be defined somewhere ── */

// Set per element from JS, as inline style attributes, never in this file.
const atRuntime = new Set(['--tint', '--tint-ink']);

const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
const undefinedVars = [...used].filter(v => !defined.has(v) && !atRuntime.has(v));
check('every var() has a definition', undefinedVars.length === 0, undefinedVars.join(', '));

console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
