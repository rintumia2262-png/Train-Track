import { useCallback, useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSubscribeOptions {
  trainId: string;
  stationId: string;
  alertOnArrival: boolean;
  alertOnDelay: boolean;
  lang: 'bn' | 'en';
}

export interface PushNotificationState {
  supported: boolean;
  serverConfigured: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  endpoint: string | null;
  busy: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
}

export function usePushNotifications(lang: 'bn' | 'en') {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    supported ? Notification.permission : 'unsupported'
  );
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch('/api/push/public-key')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean; publicKey?: string | null } | null) => {
        if (!active || !data) return;
        setServerConfigured(Boolean(data.configured && data.publicKey));
        setPublicKey(data.publicKey ?? null);
      })
      .catch(() => {
        // Offline / server unavailable
      });

    if (supported) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!active) return;
          setEndpoint(sub?.endpoint ?? null);
        })
        .catch(() => {
          // Service worker not ready yet
        });
    }

    return () => {
      active = false;
    };
  }, [supported]);

  const ensureServiceWorkerRegistration = useCallback(async () => {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      await navigator.serviceWorker.ready;
      return existing;
    }
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return navigator.serviceWorker.ready;
  }, []);

  const subscribe = useCallback(
    async (opts: PushSubscribeOptions): Promise<string | null> => {
      setErrorMessage(null);
      setStatusMessage(null);

      if (!supported) {
        setErrorMessage(
          lang === 'bn'
            ? 'এই ব্রাউজারে পুশ নোটিফিকেশন সমর্থিত নয়।'
            : 'Web Push notifications are not supported in this browser.'
        );
        return null;
      }

      if (!serverConfigured || !publicKey) {
        setErrorMessage(
          lang === 'bn'
            ? 'সার্ভারে VAPID পুশ সার্ভিস সক্রিয় নেই।'
            : 'Server VAPID push service is not configured.'
        );
        return null;
      }

      setBusy(true);
      try {
        let nextPerm: NotificationPermission = Notification.permission;
        if (nextPerm === 'default') {
          nextPerm = await Notification.requestPermission();
        }
        setPermission(nextPerm);

        if (nextPerm !== 'granted') {
          const inIframe = window.self !== window.top;
          setErrorMessage(
            inIframe
              ? lang === 'bn'
                ? 'প্রিভিউ ফ্রেমে ব্রাউজার নোটিফিকেশন ব্লক থাকতে পারে। নতুন ট্যাবে খুলে বা ব্রাউজার সেটিংস থেকে Allow করুন।'
                : 'Browser notifications may be blocked inside the preview iframe. Open in a new tab or allow notifications in browser site settings.'
              : lang === 'bn'
                ? 'নোটিফিকেশন অনুমতি (Allow) না দিলে পুশ অ্যালার্ট পাঠানো যাবে না।'
                : 'Notification permission was denied. Please enable it in site settings.'
          );
          return null;
        }

        const reg = await ensureServiceWorkerRegistration();
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        const subJson = sub.toJSON();
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subJson,
            trainId: opts.trainId,
            stationId: opts.stationId,
            alertOnArrival: opts.alertOnArrival,
            alertOnDelay: opts.alertOnDelay,
            lang: opts.lang,
          }),
        });

        if (!res.ok) {
          throw new Error('Subscription sync failed');
        }

        setEndpoint(sub.endpoint);
        setStatusMessage(
          lang === 'bn'
            ? 'পুশ নোটিফিকেশন সার্ভিস সফলভাবে চালু হয়েছে!'
            : 'Push notification service enabled successfully!'
        );
        return sub.endpoint;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(
          lang === 'bn'
            ? `পুশ সাবস্ক্রিপশন সম্পন্ন হয়নি (${msg})`
            : `Failed to enable push notifications (${msg})`
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [supported, serverConfigured, publicKey, lang, ensureServiceWorkerRegistration]
  );

  const unsubscribe = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusy(true);
    try {
      let activeEndpoint = endpoint;
      if (supported) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          activeEndpoint = sub.endpoint;
          await sub.unsubscribe();
        }
      }

      if (activeEndpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: activeEndpoint }),
        }).catch(() => {});
      }

      setEndpoint(null);
      setStatusMessage(
        lang === 'bn' ? 'পুশ নোটিফিকেশন বন্ধ করা হয়েছে।' : 'Push notifications disabled.'
      );
    } finally {
      setBusy(false);
    }
  }, [endpoint, supported, lang]);

  const sendTestPush = useCallback(
    async (opts: { trainId: string; stationId: string; lang: 'bn' | 'en' }) => {
      setErrorMessage(null);
      setStatusMessage(null);
      if (!endpoint) {
        setErrorMessage(
          lang === 'bn'
            ? 'আগে পুশ নোটিফিকেশন চালু করুন।'
            : 'Please enable push notifications first.'
        );
        return false;
      }

      setBusy(true);
      try {
        const res = await fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint,
            trainId: opts.trainId,
            stationId: opts.stationId,
            lang: opts.lang,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          expired?: boolean;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          if (data.expired) setEndpoint(null);
          setErrorMessage(
            data.error ||
              (lang === 'bn'
                ? 'টেস্ট পুশ পাঠানো যায়নি।'
                : 'Could not send test push notification.')
          );
          return false;
        }

        setStatusMessage(
          lang === 'bn'
            ? 'টেস্ট পুশ নোটিফিকেশন পাঠানো হয়েছে!'
            : 'Test push notification dispatched!'
        );
        return true;
      } catch {
        setErrorMessage(
          lang === 'bn'
            ? 'নেটওয়ার্ক সমস্যার কারণে টেস্ট পুশ পাঠানো যায়নি।'
            : 'Network error while sending test push.'
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [endpoint, lang]
  );

  return {
    state: {
      supported,
      serverConfigured,
      permission,
      isSubscribed: Boolean(endpoint),
      endpoint,
      busy,
      statusMessage,
      errorMessage,
    } satisfies PushNotificationState,
    subscribe,
    unsubscribe,
    sendTestPush,
  };
}
