// Layers Lab · service worker
// A propósito NO guarda la app en caché: novedades, precios y piezas disponibles
// cambian seguido. Solo sirve para avisos push y para una pantalla mínima sin conexión.

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · Layers Lab</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1C1F4A;color:#FDF8EC;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px}h1{font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:32px;margin:0 0 8px}p{color:#8EC4B4;margin:0 0 20px}button{height:48px;padding:0 20px;border:0;border-radius:10px;background:#8EC4B4;color:#1C1F4A;font:600 15px Inter,system-ui,sans-serif}</style></head><body><div><h1>Sin conexión</h1><p>Vuelve a intentarlo cuando tengas internet.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Layers Lab', body: event.data && event.data.text() }; }
  const title = data.title || 'Layers Lab';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.location.origin));
      if (win) { win.navigate(url); return win.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
