/* BD Train Track — Web Push Service Worker Handler */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'BD Train Track',
    body: 'ট্রেনের লাইভ স্টেশন আপডেট পাওয়া গেছে।',
    tag: 'bd-train-track-alert',
    url: '/',
    trainId: '',
    stationId: '',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = { ...payload, ...parsed };
      }
    }
  } catch {
    try {
      const txt = event.data ? event.data.text() : '';
      if (txt) payload.body = txt;
    } catch {
      // Keep default payload
    }
  }

  const options = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'bd-train-track-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || '/',
      trainId: payload.trainId || '',
      stationId: payload.stationId || '',
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
