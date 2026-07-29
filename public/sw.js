// Retire older push-enabled registrations and subscriptions.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
