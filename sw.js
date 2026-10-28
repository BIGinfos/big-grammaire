/* BIG-Infos Grammaire : service worker (hors connexion) */
const VERSION = 'big-grammaire-v3';
const SHELL = [
  './', './index.html', './manifest-v3.webmanifest',
  './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png'
];
const RUNTIME = VERSION + '-libs';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages : réseau d'abord (mises à jour), cache si hors connexion
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Manifeste : toujours la version en ligne (réglages à jour)
  if (url.origin === self.location.origin && url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fetch(req, {cache: 'no-store'}).catch(() => caches.match(req)));
    return;
  }

  // Fichiers de l'application : cache d'abord
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // Bibliothèques externes (PDF, reconnaissance de texte) : gardées après 1re utilisation
  e.respondWith(
    caches.open(RUNTIME).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; });
      return hit || net;
    }))
  );
});
