/* Loads the real .gs and exercises its pure functions against the fixture. */
const fs = require('fs');
const { HTML, SUBJECT, RAW } = require('./fixture.js');

const src = fs.readFileSync(require('path').join(__dirname, '..', 'setu-revolut.gs'), 'utf8');
eval(src);   // no top-level Apps Script calls, so this is safe to load in node

let failed = 0;
const is = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`}`);
};

console.log('— parsing the real email —');
const p = parseTransferEmail(HTML, SUBJECT);
is('sender',    p.sender,    'Aishwaryya');
is('amountINR', p.amountINR, 70000);
is('date',      p.date,      '2026-09-09');
is('reference', p.reference, 'Sent from Revolut');
is('no error',  p.error,     undefined);

console.log('\n— the CSS in <head> names the same classes; it must not leak in —');
is('cells found', Object.keys(detailCells(stripHead(HTML))),
   ['Sender', 'Recipient', 'Reference', 'Amount', 'Sent on', 'Expected by']);

console.log('\n— authenticity —');
is('genuine mail passes', isAuthentic(RAW), true);
is('forged From: fails', isAuthentic(RAW.replace(/\nAuthentication-Results:[^\n]*/,
   '\nAuthentication-Results: mx.google.com; dkim=none; spf=fail; dmarc=fail header.from=revolut.com')), false);
is('no headers at all fails', isAuthentic(HTML), false);
is('ARC header alone is not enough', isAuthentic(RAW.replace(/\nAuthentication-Results:[^\n]*/, '')), false);

console.log('\n— fallbacks, for when Revolut redesigns the table —');
const noTable = HTML.replace(/class="detailsCells-(title|value)"/g, 'class="x"');
const f = parseTransferEmail(noTable, SUBJECT);
is('sender from the <h1>', f.sender, 'Aishwaryya');
is('amount from the prose', f.amountINR, 70000);
is('date falls back to empty', f.date, '');

const noBody = parseTransferEmail('<h1>Aishwaryya has sent you a transfer</h1>', SUBJECT);
is('amount from the subject', noBody.amountINR, 70000);

console.log('\n— things that must be refused —');
const gbp = HTML.replaceAll('₹70,000', '£600.00');
is('a pounds amount is refused', /not rupees/.test(parseTransferEmail(gbp, 'You\'ve been sent £600.00').error), true);
is('an empty email is refused', !!parseTransferEmail('<p>hello</p>', 'hi').error, true);
is('a euro amount is refused', /not rupees/.test(parseTransferEmail(HTML.replaceAll('₹70,000', '€800'), 'x').error), true);
is('cells beat the prose', /not rupees/.test(parseTransferEmail(HTML.replace('>₹70,000<', '>£600.00<'), SUBJECT).error), true);

console.log('\n— amounts and dates —');
is('lakh grouping',    parseMoney('₹1,20,000'),  120000);
is('paise',            parseMoney('₹70,000.50'), 70000.5);
is('entity rupee',     parseMoney('&#8377;5,000'), 5000);
is('US date',          parseDate('September 9, 2026'),  '2026-09-09');
is('UK date',          parseDate('9 September 2026'),   '2026-09-09');
is('short month',      parseDate('Sep 9, 2026'),        '2026-09-09');
is('ordinal',          parseDate('9th October 2026'),   '2026-10-09');
is('junk date',        parseDate('Today'),              '');
is('december',         parseDate('December 31, 2026'),  '2026-12-31');
is('march not may',    parseDate('March 1, 2026'),      '2026-03-01');
is('june not july',    parseDate('June 2, 2026'),       '2026-06-02');
is('january',          parseDate('January 5, 2027'),    '2027-01-05');

console.log('\n— commit message formatting —');
is('indian grouping', groupIndian(70000), '70,000');
is('lakhs',           groupIndian(1200000), '12,00,000');
is('small',           groupIndian(500), '500');
is('single commit', commitMessage([{ receivedINR: 70000, date: '2026-09-09' }]),
   'Transfer ₹70,000 received · 2026-09-09 — via Revolut email');
is('batch commit', commitMessage([{}, {}]), '2 transfers imported — via Revolut email');

console.log('\n— the entry the app will receive —');
const entry = (() => {
  const msg = {
    getId: () => '199f2a1b3c4d5e6f',
    getDate: () => new Date('2026-09-09T17:00:11Z'),
  };
  // buildTransfer calls Utilities.formatDate only when parsed.date is empty
  return buildTransfer('t_gm_' + msg.getId(), msg, p);
})();
is('id is derived from the message', entry.id, 't_gm_199f2a1b3c4d5e6f');
is('date', entry.date, '2026-09-09');
is('receivedINR', entry.receivedINR, 70000);
is('sentGBP left for her to fill', entry.sentGBP, 0);
is('method', entry.method, 'Revolut');
is('source marks it as automatic', entry.source, 'revolut-email');
is('allocations', entry.allocations, []);
console.log('        ' + JSON.stringify(entry, null, 2).split('\n').join('\n        '));


console.log('\n— hardening —');
is('prototype key as a month', parseDate('constructor 9, 2026'), '');
is('__proto__ as a month',     parseDate('__proto__ 9, 2026'),   '');
is('day out of range',         parseDate('September 45, 2026'),  '');
is('year out of range',        parseDate('September 9, 1026'),   '');
is('a cell titled constructor is inert',
   typeof detailCells('class="detailsCells-title" ><div >constructor</div>' +
                      'class="detailsCells-value" ><div >x</div>')['Amount'], 'undefined');
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
