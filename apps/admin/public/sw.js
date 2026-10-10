// Service worker do admin: só mostra as notificações do servidor (Web Push).
// Sem cache offline — o admin é sempre online.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = { title: 'FotoRAW', body: 'Novidade no FotoRAW', url: '/' };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    if (event.data) dados.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: '/icone.png',
      badge: '/icone.png',
      vibrate: [200, 100, 200],
      tag: `fotoraw-${Date.now()}`,
      data: { url: dados.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate?.(url);
          return janela.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
