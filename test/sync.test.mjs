/* Saving is instant; pushing is not. This guards the gap between the two —
   an entry added while an earlier one is still being written to GitHub must
   not be dropped when that write completes.

   Run: node test/sync.test.mjs */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
let remote = { version: 1, updatedAt: '', purposes: [], categories: [], transfers: [], expenses: [] };
let sha = 'sha1';
let releaseWrite;                        // lets the test hold the PUT open

globalThis.fetch = async (url, opts = {}) => {
  const ok = body => ({ ok: true, status: 200, json: async () => body });
  if (opts.method === 'PUT') {
    await new Promise(r => { releaseWrite = r; });
    remote = JSON.parse(Buffer.from(JSON.parse(opts.body).content, 'base64').toString('utf8'));
    sha = 'sha2';
    return ok({ content: { sha } });
  }
  if (url.includes('/contents/')) return ok({ content: b64(remote), sha });
  return ok({ private: true, permissions: { push: true }, full_name: 'o/r' });
};

const gh = await import(new URL('../js/github.js', import.meta.url));
gh.cfg.set('o/r', 'tok', 'Adithya');

const entry = id => ({
  type: 'upsert', entity: 'expense',
  data: { id, date: '2026-09-20', amountINR: 100, categoryId: 'c_other', purposeId: null, note: id },
});

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
};

// First entry saved, push starts and stalls mid-flight.
await gh.commit(entry('e1'), remote);
const flight = gh.sync();
await new Promise(r => setTimeout(r, 30));

// Second entry saved while the first is still being written.
await gh.commit(entry('e2'), gh.local.ledger);
check('both are queued while in flight', gh.pendingCount(), 2);

releaseWrite();
const result = await flight;

check('e2 is still queued after the push', gh.local.queue.map(o => o.data.id), ['e2']);
check('returned ledger keeps both entries', result.expenses.map(e => e.id), ['e1', 'e2']);
check('cached ledger keeps both entries', gh.local.ledger.expenses.map(e => e.id), ['e1', 'e2']);

// And the next sync pushes the straggler rather than losing it.
const second = gh.sync();
await new Promise(r => setTimeout(r, 30));
releaseWrite();
await second;
check('e2 reached the remote', remote.expenses.map(e => e.id), ['e1', 'e2']);
check('queue drained', gh.pendingCount(), 0);

console.log(bad ? `\n${bad} FAILED` : '\nall passed');
process.exit(bad ? 1 : 0);
