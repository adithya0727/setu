/* ═══════════════════════════════════════════════════════════════
   sw.js — offline support for the app shell.

   Only the shell is cached. Ledger data is never cached here: it comes from
   the GitHub API, which must always hit the network so two phones can't drift
   apart. Offline edits are queued in localStorage by github.js instead.
   ═══════════════════════════════════════════════════════════════ */

const VERSION = 'setu-v10';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/ui.js',
  './js/store.js',
  './js/github.js',
  './js/charts.js',
  './js/statement.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      /* `cache: 'reload'` is load-bearing. addAll otherwise goes through the
         browser's HTTP cache, and GitHub Pages asks it to keep files for ten
         minutes — so a newly installed version could precache the previous
         version's files and then serve them as though they were current. */
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

/* Lets the app show which version is actually serving it, so "did the update
   land?" has an answer that isn't guesswork. */
self.addEventListener('message', e => {
  if (e.data === 'version') e.ports[0]?.postMessage(VERSION);
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

  /* Network first, falling back to the cached shell when offline. Sub-resources
     go past the HTTP cache for the same reason as above: a file deployed a
     minute ago must not be shadowed by the copy Pages told the browser to hold
     on to. Navigations can't carry a cache mode, so they go as they are. */
  const fromNetwork = e.request.mode === 'navigate'
    ? fetch(e.request)
    : fetch(e.request, { cache: 'reload' });

  e.respondWith(
    fromNetwork
      .then(res => {
        // Never cache a failure. A transient 404 or 502 from Pages would
        // otherwise be served from the cache until the next version bump.
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
