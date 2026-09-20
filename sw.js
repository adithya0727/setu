/* ═══════════════════════════════════════════════════════════════
   sw.js — offline support for the app shell.

   Only the shell is cached. Ledger data is never cached here: it comes from
   the GitHub API, which must always hit the network so two phones can't drift
   apart. Offline edits are queued in localStorage by github.js instead.
   ═══════════════════════════════════════════════════════════════ */

const VERSION = 'setu-v4';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/ui.js',
  './js/store.js',
  './js/github.js',
  './js/charts.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never touch the API — stale money figures are worse than no figures.
  if (url.hostname === 'api.github.com') return;
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Network first, falling back to the cached shell when offline.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
