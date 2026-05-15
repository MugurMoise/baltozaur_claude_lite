// Baltozaur Service Worker — Web Push handler

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Baltozaur', body: event.data.text(), url: '/' };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/fish-icon.png',
    badge: '/fish-badge.png',
    tag: data.tag || 'baltozaur-forecast',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '🎣 Deschide Baltozaur' },
      { action: 'dismiss', title: 'Închide' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Baltozaur 🦕', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
