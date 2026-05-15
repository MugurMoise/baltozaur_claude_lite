import { supabase } from './supabase';

// ── VAPID public key (set in .env) ────────────────────────────────────────────
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

// ── Register Service Worker ───────────────────────────────────────────────────
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (e) {
    console.error('[Push] SW registration failed:', e);
    return null;
  }
}

// ── Request push permission + subscribe ──────────────────────────────────────
export async function subscribeToPush(
  preferences: { counties: string[]; max_distance_km: number | null }
): Promise<{ success: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: 'VAPID key not configured' };
  }

  if (!('Notification' in window)) {
    return { success: false, error: 'Browserul nu suportă notificări' };
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Permisiunea pentru notificări a fost refuzată' };
  }

  // Get or create SW registration
  const reg = await registerServiceWorker();
  if (!reg) {
    return { success: false, error: 'Service Worker indisponibil' };
  }

  // Wait for SW to be ready
  await navigator.serviceWorker.ready;

  // Subscribe to push
  let pushSub: PushSubscription;
  try {
    pushSub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (e) {
    return { success: false, error: 'Nu s-a putut activa push: ' + String(e) };
  }

  const subJson = pushSub.toJSON();

  if (!supabase) {
    return { success: false, error: 'Supabase neconfigurat' };
  }

  // Save to Supabase — upsert by endpoint
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint:        subJson.endpoint,
      p256dh:          subJson.keys?.p256dh,
      auth:            subJson.keys?.auth,
      counties:        preferences.counties,
      max_distance_km: preferences.max_distance_km,
      updated_at:      new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[Push] Supabase upsert error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Unsubscribe ───────────────────────────────────────────────────────────────
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  if (supabase) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}

// ── Check current subscription state ─────────────────────────────────────────
export async function getSubscriptionState(): Promise<{
  subscribed: boolean;
  preferences: { counties: string[]; max_distance_km: number | null } | null;
}> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { subscribed: false, preferences: null };
  }

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return { subscribed: false, preferences: null };

  const sub = await reg.pushManager.getSubscription();
  if (!sub || !supabase) return { subscribed: false, preferences: null };

  const { data } = await supabase
    .from('push_subscriptions')
    .select('counties, max_distance_km')
    .eq('endpoint', sub.endpoint)
    .single();

  if (!data) return { subscribed: false, preferences: null };

  return {
    subscribed: true,
    preferences: { counties: data.counties ?? [], max_distance_km: data.max_distance_km },
  };
}
