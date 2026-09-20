/* ═══════════════════════════════════════════════════════════════
   setu-revolut.gs — Revolut's “You've been sent ₹…” emails → ledger.json

   Runs on a timer inside your own Google account, so nothing here needs an
   OAuth app, a Cloud project, or a third party holding a copy of your mail.

   Each run: find Revolut's transfer emails, check they really came from
   revolut.com (DKIM + DMARC, not just a From: line anyone can type), read the
   amount and date out of the HTML, and append a transfer to ledger.json in the
   private repo — the same file the phone app reads and writes.

   Idempotency is by *message id*, never by label: an entry's id is derived
   from the Gmail message it came from, so re-reading the same mail a hundred
   times can only ever produce the same one entry. That means the search window
   can safely overlap, and a thread that Gmail decides to group with another
   one can't cause a transfer to be silently skipped.

   What it cannot know: the £ she sent. Revolut only tells the recipient what
   lands. So sentGBP is left at 0 and the app shows “Add £” on the entry until
   someone fills it in — see automation/README.md.
   ═══════════════════════════════════════════════════════════════ */

const CONFIG = {
  /* Only transfers showing this Revolut sender name are imported. Anything
     else is left for you to look at rather than quietly credited to her. */
  sender: 'Aishwaryya',

  /* How the imported entry appears in the app. */
  method:  'Revolut',
  addedBy: 'Revolut',

  /* How far back each run looks. Re-scanning is free (see idempotency above),
     so this is generous on purpose: it lets the script catch up by itself
     after a spell of being broken or switched off. */
  window: '90d',

  /* Used only when an email somehow has no “Sent on” date to read. */
  timezone: 'Asia/Kolkata',

  /* Hour of the day the import runs, in the *project's* time zone — see
     Project Settings in the editor. Google starts it somewhere inside that
     hour rather than exactly on it. */
  runAtHour: 9,

  labelImported: 'setu/imported',
  labelReview:   'setu/review',
};

const GH_API = 'https://api.github.com';
const FILE   = 'ledger.json';

/* The two independent markers Revolut's transfer mail carries. Matching either
   means a subject-line rewording on their side can't silently stop imports. */
const QUERY = 'from:no-reply@revolut.com (subject:"been sent" OR "has sent you a transfer")';

/* ═══════════════════════ the things you run by hand ═══════════════════════ */

/** Trigger target. Safe to run by hand at any time. */
function importTransfers() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;            // a previous run is still going
  try {
    run(false);
  } catch (err) {
    alertThrottled('failure', 'Setu: the Revolut importer is failing', String(err && err.message || err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** Reads and parses everything, writes nothing. Run this first. */
function dryRun() {
  run(true);
}

/**
 * Confirms the script can reach the repo, that the repo is *private*, and that
 * the token can write to it. Run it once after setting the two properties.
 *
 * Those properties are set in the editor — Project Settings (the gear) →
 * Script Properties — and deliberately never in this file. A token pasted into
 * code is one careless commit away from being public, and this file lives in a
 * public repo.
 */
function checkSetup() {
  assertRepoPrivate();
  Logger.log('%s is private, and the token can write to it. Now run dryRun().', repo());
}

/**
 * The ledger must never be written into a public repo. Nothing else here can
 * tell the difference, and the mistake is irreversible — git keeps the figures
 * even after the file is deleted. Checked on every run, not just at setup,
 * because a repo can be flipped to public long after it was connected.
 */
function assertRepoPrivate() {
  const meta = JSON.parse(gh('GET', '/repos/' + repo()).text);

  if (meta.private !== true) {
    throw new Error(repo() + ' is a PUBLIC repository. Refusing to write the ledger to it — ' +
      'everything in it would be readable by anyone. Make the repo private.');
  }
  if (!(meta.permissions && meta.permissions.push)) {
    throw new Error('The token can read ' + repo() + ' but not write to it. Set Contents to Read and write.');
  }
}

/** Installs (or reinstalls) the once-a-day trigger. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'importTransfers')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('importTransfers').timeBased().everyDays(1).atHour(CONFIG.runAtHour).create();
  Logger.log('Trigger installed — importTransfers() will run once a day, around %s:00.', CONFIG.runAtHour);
}

/* ═══════════════════════════ the run itself ═══════════════════════════ */

function run(dry) {
  assertRepoPrivate();

  const threads = GmailApp.search(`${QUERY} newer_than:${CONFIG.window}`, 0, 50);
  if (!threads.length) {
    Logger.log('No Revolut transfer emails in the last %s.', CONFIG.window);
    return;
  }

  /* One cheap read up front, purely so we can skip the expensive
     authenticity check on mail that is already in the ledger. */
  const known = {};
  readLedger().ledger.transfers.forEach(t => { known[t.id] = true; });

  const fresh    = [];
  const problems = [];

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      if (!looksLikeTransferMail(msg)) return;        // a statement, an ad — not ours

      const id = 't_gm_' + msg.getId();
      if (known[id]) return;

      const verdict = examine(msg);
      if (verdict.error) {
        problems.push({ thread: thread, msg: msg, why: verdict.error });
        return;
      }

      known[id] = true;
      fresh.push({ thread: thread, entry: buildTransfer(id, msg, verdict) });
    });
  });

  fresh.forEach(f => Logger.log('%s  %s  ₹%s  (%s)',
    dry ? 'would import' : 'importing', f.entry.date, groupIndian(f.entry.receivedINR), f.entry.id));

  if (dry) {
    problems.forEach(p => Logger.log('would flag: %s — %s', p.msg.getSubject(), p.why));
    Logger.log('Dry run: %s to import, %s to flag. Nothing was written.', fresh.length, problems.length);
    return;
  }

  if (fresh.length) {
    const written = pushTransfers(fresh.map(f => f.entry));
    const label = getLabel(CONFIG.labelImported);
    fresh.forEach(f => f.thread.addLabel(label));
    Logger.log('Wrote %s transfer(s) to %s.', written, repo());
  }

  flagProblems(problems);
}

/** Cheap pre-filter, so replies and Revolut's other mail are skipped silently. */
function looksLikeTransferMail(msg) {
  if (!/no-reply@revolut\.com/i.test(msg.getFrom())) return false;
  return /been sent/i.test(msg.getSubject()) || /has sent you a transfer/i.test(msg.getBody());
}

/** Authenticity, then content, then “is this actually from her”. */
function examine(msg) {
  if (!isAuthentic(msg.getRawContent())) {
    return { error: 'did not pass DKIM/DMARC for revolut.com — anyone can put Revolut in a From: line' };
  }
  const parsed = parseTransferEmail(msg.getBody(), msg.getSubject());
  if (parsed.error) return parsed;

  if (parsed.sender.toLowerCase() !== CONFIG.sender.toLowerCase()) {
    return { error: 'sender reads “' + parsed.sender + '”, not ' + CONFIG.sender };
  }
  return parsed;
}

function buildTransfer(id, msg, parsed) {
  return {
    id: id,
    date: parsed.date || Utilities.formatDate(msg.getDate(), CONFIG.timezone, 'yyyy-MM-dd'),
    sentGBP: 0,                               // Revolut never tells the recipient this
    receivedINR: parsed.amountINR,
    method: CONFIG.method,
    allocations: [],
    note: '',
    addedBy: CONFIG.addedBy,
    createdAt: msg.getDate().toISOString(),
    source: 'revolut-email',
    sourceMessageId: msg.getId(),
  };
}

/* ═══════════════════════════ is it really Revolut ═══════════════════════
   Gmail has already done the cryptography; we read its verdict out of the
   headers it stamped on the message. ARC-Authentication-Results is a relayed
   claim rather than Gmail's own finding, so the anchor deliberately excludes
   it. A forged “From: Revolut” fails this, which is the whole point — nothing
   should be able to inject money into the ledger by sending you an email.   */

function isAuthentic(raw) {
  const m = /\nAuthentication-Results:((?:[^\n]|\n[ \t])*)/.exec('\n' + raw);
  if (!m) return false;

  const h = m[1].replace(/\s+/g, ' ').toLowerCase();
  const dkim  = /dkim=pass/.test(h) && /header\.(i=@|d=)revolut\.com/.test(h);
  const dmarc = /dmarc=pass/.test(h) && /header\.from=revolut\.com/.test(h);
  return dkim && dmarc;
}

/* ═══════════════════════════ reading the email ═══════════════════════════
   Revolut's mail is HTML only — there is no plain-text part to lean on. The
   figures live in a two-column “details” table whose cells are tagged
   detailsCells-title / detailsCells-value, so the cells are read in document
   order and paired off. Everything has a fallback in the prose above the
   table, and the amount has a second one in the subject line.              */

function parseTransferEmail(html, subject) {
  const body = stripHead(html);
  const cells = detailCells(body);

  const sender = cells['Sender'] || matchOne(body, /<h1[^>]*>([\s\S]*?)\s+has sent you a transfer/i);
  if (!sender) return { error: 'could not find who sent it' };

  const rawAmount = cells['Amount']
    || matchOne(body, /sent you\s*((?:₹|&#8377;|INR)\s*[\d.,]+)/i)
    || matchOne(subject || '', /been sent\s*((?:₹|&#8377;|INR)\s*[\d.,]+)/i);
  if (!rawAmount) return { error: 'could not find the amount' };

  if (!/₹|&#8377;|INR/i.test(rawAmount)) {
    return { error: 'the amount is “' + rawAmount + '”, which is not rupees' };
  }

  const amountINR = parseMoney(rawAmount);
  if (!(amountINR > 0)) return { error: 'could not read “' + rawAmount + '” as an amount' };

  return {
    sender: clean(sender),
    amountINR: amountINR,
    date: parseDate(cells['Sent on'] || ''),     // '' → caller falls back to the email's own date
    reference: cells['Reference'] || '',
  };
}

/** <head> holds CSS that names the same classes; drop it before matching. */
function stripHead(html) {
  return String(html || '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function detailCells(body) {
  const re = /class="detailsCells-(title|value)"[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>/g;
  const out = Object.create(null);   // cell titles come from the email; don't let one be "constructor"
  let pending = null;
  let m;

  while ((m = re.exec(body)) !== null) {
    const text = clean(m[2]);
    if (m[1] === 'title') {
      pending = text;
    } else if (pending) {
      out[pending] = text;
      pending = null;
    }
  }
  return out;
}

function clean(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function matchOne(text, re) {
  const m = re.exec(String(text || ''));
  return m ? clean(m[1]) : '';
}

/** “₹70,000” → 70000. Indian grouping (1,20,000) falls out of this too. */
function parseMoney(s) {
  const digits = clean(s).replace(/[^\d.]/g, '');
  const n = parseFloat(digits);
  return isFinite(n) ? n : 0;
}

/** “September 9, 2026” or “9 September 2026” → “2026-09-09”. */
function parseDate(s) {
  const t = clean(s);
  if (!t) return '';

  const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const monthOf = name => MONTHS[String(name).toLowerCase().slice(0, 9)]
    || MONTHS[Object.keys(MONTHS).filter(k => k.indexOf(String(name).toLowerCase().slice(0, 3)) === 0)[0]];

  let d, mo, y;
  let m = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(t);
  if (m) { mo = monthOf(m[1]); d = Number(m[2]); y = Number(m[3]); }

  if (!m) {
    m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(t);
    if (m) { d = Number(m[1]); mo = monthOf(m[2]); y = Number(m[3]); }
  }

  // A date read out of an email is untrusted input: check it really is one
  // rather than trusting that the regex implies it.
  if (!m || typeof mo !== 'number') return '';
  if (!(d >= 1 && d <= 31) || !(y >= 2000 && y <= 2999)) return '';
  return y + '-' + pad(mo) + '-' + pad(d);
}

const pad = n => (n < 10 ? '0' : '') + n;

/* ═══════════════════════ the ledger, over the GitHub API ═══════════════════
   Byte-for-byte the same shape the app writes (two-space JSON, trailing
   newline), so a commit from here and a commit from the phone produce the
   same kind of diff.                                                        */

function repo() {
  const r = required('SETU_REPO');
  if (!/^[\w.-]+\/[\w.-]+$/.test(r)) {
    throw new Error('SETU_REPO should look like owner/name — got “' + r + '”.');
  }
  return r;
}
function token() { return required('SETU_TOKEN'); }

function required(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Script property ' + key + ' is not set — run setUp() first.');
  return v;
}

function pushTransfers(entries) {
  for (let attempt = 0; ; attempt++) {
    const state = readLedger();
    const ledger = state.ledger;

    const have = {};
    ledger.transfers.forEach(t => { have[t.id] = true; });
    const add = entries.filter(e => !have[e.id]);
    if (!add.length) return 0;

    ledger.transfers = ledger.transfers.concat(add);
    ledger.updatedAt = new Date().toISOString();

    try {
      writeLedger(ledger, state.sha, commitMessage(add));
      return add.length;
    } catch (err) {
      // A phone saved between our read and our write. Re-read and replay.
      if (err.conflict && attempt < 3) continue;
      throw err;
    }
  }
}

function commitMessage(add) {
  if (add.length > 1) return add.length + ' transfers imported — via Revolut email';
  return 'Transfer ₹' + groupIndian(add[0].receivedINR) + ' received · ' + add[0].date + ' — via Revolut email';
}

function readLedger() {
  const res = gh('GET', '/repos/' + repo() + '/contents/' + FILE + '?t=' + Date.now());

  if (res.status === 404) {
    throw new Error('ledger.json does not exist yet in ' + repo() +
      '. Open the Setu app once and let it sync, then run this again.');
  }
  const json = JSON.parse(res.text);

  // The contents API inlines content only below 1MB; above that, go via the blob.
  const b64 = json.content || JSON.parse(gh('GET', '/repos/' + repo() + '/git/blobs/' + json.sha).text).content;
  const raw = Utilities.newBlob(Utilities.base64Decode(String(b64).replace(/\s/g, ''))).getDataAsString('UTF-8');

  const ledger = JSON.parse(raw);
  if (!Array.isArray(ledger.transfers)) ledger.transfers = [];
  return { ledger: ledger, sha: json.sha };
}

function writeLedger(ledger, sha, message) {
  const payload = {
    message: message,
    content: Utilities.base64Encode(JSON.stringify(ledger, null, 2) + '\n', Utilities.Charset.UTF_8),
    sha: sha,
  };
  gh('PUT', '/repos/' + repo() + '/contents/' + FILE, payload);
}

function gh(method, path, payload) {
  const options = {
    method: method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token(),
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const res  = UrlFetchApp.fetch(GH_API + path, options);
  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code >= 200 && code < 300) return { status: code, text: text };
  if (code === 404 && method === 'GET') return { status: 404, text: text };

  const detail = safeMessage(text);
  if (code === 401) throw new Error('GitHub rejected the token — it has probably expired. Generate a new one and run setUp() again. (' + detail + ')');
  if (code === 403) throw new Error('The token lacks Contents: Read and write on ' + repo() + '. (' + detail + ')');

  const err = new Error('GitHub returned ' + code + ': ' + detail);
  err.conflict = (code === 409 || code === 422);
  throw err;
}

function safeMessage(text) {
  try { return JSON.parse(text).message || text; } catch (e) { return text; }
}

/* ═══════════════════════════ telling you about it ═══════════════════════ */

/** Labels anything that looked like a transfer but wasn't importable, and
    emails you once per thread — the label is what stops it repeating. */
function flagProblems(problems) {
  if (!problems.length) return;

  const label = getLabel(CONFIG.labelReview);
  const lines = [];

  problems.forEach(p => {
    const already = p.thread.getLabels().some(l => l.getName() === CONFIG.labelReview);
    if (already) return;
    p.thread.addLabel(label);
    lines.push('• ' + p.msg.getSubject() + '\n  ' + p.why);
  });

  if (!lines.length) return;
  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    'Setu: ' + lines.length + ' Revolut email(s) need a look',
    'These were not added to the ledger. They are labelled ' + CONFIG.labelReview + ' in Gmail.\n\n' +
    lines.join('\n\n') +
    '\n\nAdd them by hand in the app if they are real.\n'
  );
}

/** For failures that repeat every run — and if you run it by hand a few times. */
function alertThrottled(key, subject, body) {
  const props = PropertiesService.getScriptProperties();
  const k = 'alert.' + key;
  const last = Number(props.getProperty(k) || 0);
  if (Date.now() - last < 6 * 60 * 60 * 1000) return;

  props.setProperty(k, String(Date.now()));
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject,
    body + '\n\nThe importer will try again on its next run.\n');
}

function getLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/** 70000 → “70,000”; 1200000 → “12,00,000”. */
function groupIndian(n) {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
}
