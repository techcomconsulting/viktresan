// Gör att appen startar snabbt och kan installeras på hemskärmen.
// Byt versionen när du laddar upp en ny version av appen.
const VERSION = 'viktresan-v54';
const FILES = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/install.js', './js/brand.js', './js/invite.js', './js/blood.js', './js/report.js', './js/pdf.js', './js/milestones.js', './js/challenges.js', './js/views/badges.js', './js/views/admin.js', './js/views/challenges.js', './js/views/report.js', './js/views/blood.js', './js/tips.js', './js/views/tips.js', './js/food.js', './js/ai.js', './js/feedback.js', './js/meds.js', './js/push.js', './js/scanner.js', './js/views/kost.js', './data/livsmedel.json', './js/config.js', './js/firebase.js', './js/data.js', './js/ui.js',
  './js/views/auth.js', './js/views/overview.js', './js/views/measure.js', './js/views/history.js',
  './js/views/photos.js', './js/views/treatment.js', './js/views/sharing.js', './js/views/profile.js',
  './js/views/notifications.js', './js/views/legal.js', './js/views/landing.js', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Nätet först, sparad kopia om nätet saknas.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

// Påminnelser i telefonen.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Viktresan', {
    body: d.body || '', icon: './icons/icon-192.png?v=2', badge: './icons/favicon-32.png?v=2',
    tag: d.tag || 'viktresan', renotify: true, data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
