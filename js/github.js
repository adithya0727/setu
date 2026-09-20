/* ═══════════════════════════════════════════════════════════════
   github.js — the private repo as a database.

   ledger.json lives in a private repo. Every save is a commit, so the repo's
   history doubles as a free, timestamped audit log of the whole ledger.

   Concurrency: GitHub's contents API is optimistically concurrent. We send the
   `sha` of the blob we read; if the file moved on underneath us (Aishwaryya saved
   first) GitHub replies 409 and we re-fetch, replay our queued ops on top of
   her version, and try again. Nobody's entry is lost.
   ═══════════════════════════════════════════════════════════════ */

import { LS, normalise, emptyLedger, applyOps, describeOp } from './store.js';

const API  = 'https://api.github.com';
const FILE = 'ledger.json';

/* ─────────────────────────── config ─────────────────────────── */

export const cfg = {
  get repo()  { return localStorage.getItem(LS.repo) || ''; },
  get token() { return localStorage.getItem(LS.token) || ''; },
  get me()    { return localStorage.getItem(LS.me) || 'Adithya'; },
  set(repo, token, me) {
    localStorage.setItem(LS.repo, repo.trim().replace(/^\/+|\/+$/g, ''));
    localStorage.setItem(LS.token, token.trim());
    localStorage.setItem(LS.me, me);
  },
  setMe(me) { localStorage.setItem(LS.me, me); },
  get ready() { return !!(this.repo && this.token); },
  clear() {
    for (const k of Object.values(LS)) localStorage.removeItem(k);
  },
};

/* ─────────────────────────── base64 (unicode-safe) ─────────────────────────── */

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob((b64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ─────────────────────────── transport ─────────────────────────── */

async function call(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('offline', 'No connection. Your changes are saved on this device and will sync later.');
  }

  if (res.ok) return res.status === 204 ? null : res.json();

  let detail = '';
  try { detail = (await res.json())?.message || ''; } catch { /* body wasn't JSON */ }

  if (res.status === 401) throw new SyncError('auth', 'That token was rejected. It may have expired — generate a new one on GitHub.');
  if (res.status === 403 && /rate limit/i.test(detail)) throw new SyncError('rate', 'GitHub rate limit hit. Try again in a few minutes.');
  if (res.status === 403) throw new SyncError('scope', 'The token lacks permission. It needs Contents: Read and write on this repo.');
  if (res.status === 404) throw new SyncError('missing', 'Repository not found. Check the owner/name, and that the token can reach it.');
  if (res.status === 409 || res.status === 422) throw new SyncError('conflict', detail || 'The file changed while saving.');
  throw new SyncError('http', detail || `GitHub returned ${res.status}.`);
}

export class SyncError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = 'SyncError'; }
}

/* ─────────────────────────── read / write ─────────────────────────── */

/** @returns {{ledger: object, sha: string|null}} — sha is null if the file doesn't exist yet. */
export async function readLedger() {
  try {
    const json = await call(`/repos/${cfg.repo}/contents/${FILE}?t=${Date.now()}`);
    // The contents API inlines content only below 1MB; above that it hands back
    // an empty string and expects you to go via the blob.
    const raw = json.content
      ? b64decode(json.content)
      : b64decode((await call(`/repos/${cfg.repo}/git/blobs/${json.sha}`)).content);
    return { ledger: normalise(JSON.parse(raw)), sha: json.sha };
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new SyncError('corrupt', 'ledger.json could not be read as JSON. Check the file in the repo.');
    }
    // The repo exists but has no ledger yet — that's a first run, not a failure.
    if (err.code === 'missing') {
      await call(`/repos/${cfg.repo}`);          // throws again if the repo is truly unreachable
      return { ledger: emptyLedger(), sha: null };
    }
    throw err;
  }
}

async function writeLedger(ledger, sha, message) {
  const body = {
    message,
    content: b64encode(JSON.stringify(ledger, null, 2) + '\n'),
    ...(sha ? { sha } : {}),
  };
  const res = await call(`/repos/${cfg.repo}/contents/${FILE}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.content.sha;
}

/** Confirms the repo is reachable and writable before we let someone in. */
export async function verifyAccess(repo, token) {
  const prev = { r: cfg.repo, t: cfg.token };
  localStorage.setItem(LS.repo, repo.trim().replace(/^\/+|\/+$/g, ''));
  localStorage.setItem(LS.token, token.trim());
  try {
    const meta = await call(`/repos/${cfg.repo}`);
    if (!meta.permissions?.push) {
      throw new SyncError('scope', 'This token can read the repo but not write to it. Set Contents to “Read and write”.');
    }
    return true;
  } catch (err) {
    localStorage.setItem(LS.repo, prev.r);
    localStorage.setItem(LS.token, prev.t);
    throw err;
  }
}

/* ─────────────────────────── local cache + queue ─────────────────────────── */

export const local = {
  get ledger() {
    try { return normalise(JSON.parse(localStorage.getItem(LS.cache))); }
    catch { return null; }
  },
  set ledger(l) { localStorage.setItem(LS.cache, JSON.stringify(l)); },

  get sha() { return localStorage.getItem(LS.sha) || null; },
  set sha(s) { s ? localStorage.setItem(LS.sha, s) : localStorage.removeItem(LS.sha); },

  get queue() {
    try { return JSON.parse(localStorage.getItem(LS.queue)) || []; }
    catch { return []; }
  },
  set queue(q) { localStorage.setItem(LS.queue, JSON.stringify(q)); },
};

/* ─────────────────────────── sync ─────────────────────────── */

/**
 * Pull the remote ledger, replay anything queued locally, and push if needed.
 * Returns the ledger that is now authoritative.
 */
export async function sync({ push = true } = {}) {
  let attempt = 0;

  while (true) {
    const { ledger: remote, sha } = await readLedger();
    const queue = local.queue;

    if (!queue.length || !push) {
      local.ledger = remote;
      local.sha = sha;
      return remote;
    }

    const merged = applyOps(remote, queue);
    const message = queue.length === 1
      ? `${describeOp(queue[0], merged)} — via ${cfg.me}`
      : `${queue.length} changes — via ${cfg.me}`;

    try {
      const newSha = await writeLedger(merged, sha, message);
      local.ledger = merged;
      local.sha = newSha;
      local.queue = [];
      return merged;
    } catch (err) {
      // Someone saved between our read and our write. Re-read and replay.
      if (err.code === 'conflict' && attempt++ < 3) continue;
      throw err;
    }
  }
}

/** Queue a change, apply it locally at once, and try to push it. */
export async function commit(op, ledger) {
  local.queue = [...local.queue, op];
  const optimistic = applyOps(ledger, [op]);
  local.ledger = optimistic;
  return optimistic;
}

export const pendingCount = () => local.queue.length;
