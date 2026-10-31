type AnalyticsValue = string | number | boolean | null;
type AnalyticsMetadata = Record<string, AnalyticsValue>;

interface AnalyticsCount {
  metric: 'page_view' | 'source' | 'platform' | 'action' | 'lake_interest';
  bucket: string;
  count: number;
}

interface ActivityEntry {
  visitor_id: string;
  event_name: 'page_view' | string;
  page_path: string;
  details: AnalyticsMetadata;
}

const FLUSH_DELAY_MS = 8_000;
const RETRY_DELAY_MS = 15_000;
const MAX_BATCH_BUCKETS = 40;
const MAX_BATCH_ACTIVITIES = 40;
const VISITOR_ID_KEY = 'baltozaur_analytics_visitor_id';
const trackedActions = new Set([
  'lake_details_opened',
  'shared_lake_opened',
  'navigation_clicked',
  'share_link_copied',
  'website_clicked',
  'phone_clicked',
  'search_used',
  'filter_changed',
  'map_opened',
  'location_requested',
  'location_granted',
  'location_denied',
  'data_refreshed',
  'forecast_day_selected',
  'language_changed',
  'list_opened',
  'view_mode_changed',
]);
const lakeActions = new Set([
  'lake_details_opened',
  'shared_lake_opened',
  'navigation_clicked',
  'share_link_copied',
  'website_clicked',
  'phone_clicked',
]);
const pendingCounts = new Map<string, AnalyticsCount>();
const pendingActivities: ActivityEntry[] = [];
const acquisitionSource = detectAcquisitionSource();
const platform = detectPlatform();
const visitorId = getVisitorId();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;

function knownSource(value: string | null) {
  const source = value?.trim().toLowerCase() ?? '';
  if (source.includes('tiktok')) return 'tiktok';
  if (source.includes('instagram')) return 'instagram';
  if (source.includes('facebook') || source === 'fb') return 'facebook';
  if (source.includes('google')) return 'google';
  if (source.includes('youtube') || source.includes('youtu.be')) return 'youtube';
  if (source.includes('bing')) return 'bing';
  return source ? 'other' : 'direct';
}

function detectAcquisitionSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return knownSource(utmSource);
  if (params.has('ttclid')) return 'tiktok';
  if (params.has('fbclid')) return 'facebook';
  if (params.has('gclid')) return 'google';

  const userAgent = navigator.userAgent.toLowerCase();
  if (/tiktok|musical_ly|bytedancewebview/.test(userAgent)) return 'tiktok';
  if (/instagram/.test(userAgent)) return 'instagram';
  if (/(fban|fbav)/.test(userAgent)) return 'facebook';

  if (!document.referrer) return 'direct';
  try {
    const referrer = new URL(document.referrer);
    if (referrer.hostname === window.location.hostname) return 'direct';
    return knownSource(referrer.hostname);
  } catch {
    return 'other';
  }
}

function detectPlatform() {
  const capacitor = (window as Window & {
    Capacitor?: { getPlatform?: () => string };
  }).Capacitor;
  const nativePlatform = capacitor?.getPlatform?.();
  if (nativePlatform === 'ios') return 'ios_app';
  if (nativePlatform === 'android') return 'android_app';
  return 'web';
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const next = createUuid();
    localStorage.setItem(VISITOR_ID_KEY, next);
    return next;
  } catch {
    return createUuid();
  }
}

function activityDetails(metadata: AnalyticsMetadata) {
  const allowedKeys = new Set(['lake_name', 'language', 'view_mode', 'filter', 'day_offset', 'reason', 'source', 'platform']);
  return Object.fromEntries(Object.entries(metadata)
    .filter(([key, value]) => allowedKeys.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value]));
}

function addActivity(eventName: string, metadata: AnalyticsMetadata = {}) {
  pendingActivities.push({
    visitor_id: visitorId,
    event_name: eventName,
    page_path: window.location.pathname.slice(0, 200) || '/',
    details: activityDetails(metadata),
  });
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, delay);
}

function addCount(metric: AnalyticsCount['metric'], bucket: string, count = 1) {
  const cleanBucket = bucket.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
  if (!cleanBucket) return;

  const key = `${metric}\u0000${cleanBucket}`;
  const current = pendingCounts.get(key);
  if (current) {
    current.count = Math.min(1000, current.count + count);
  } else {
    pendingCounts.set(key, { metric, bucket: cleanBucket, count });
  }

  if (pendingCounts.size >= MAX_BATCH_BUCKETS || pendingActivities.length >= MAX_BATCH_ACTIVITIES) {
    void flushAnalytics();
  } else {
    scheduleFlush();
  }
}

function restoreBatch(counts: AnalyticsCount[], activities: ActivityEntry[]) {
  for (const count of counts) {
    addCount(count.metric, count.bucket, count.count);
  }
  pendingActivities.unshift(...activities);
}

async function sendBatch(counts: AnalyticsCount[], activities: ActivityEntry[], keepalive: boolean) {
  const response = await fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ counts, activities }),
    keepalive,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export function flushAnalytics(keepalive = false) {
  if (flushPromise || (pendingCounts.size === 0 && pendingActivities.length === 0)) return flushPromise ?? Promise.resolve();

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = Array.from(pendingCounts.values()).slice(0, MAX_BATCH_BUCKETS);
  const activityBatch = pendingActivities.splice(0, MAX_BATCH_ACTIVITIES);
  for (const count of batch) {
    pendingCounts.delete(`${count.metric}\u0000${count.bucket}`);
  }

  flushPromise = sendBatch(batch, activityBatch, keepalive)
    .catch((error: unknown) => {
      restoreBatch(batch, activityBatch);
      scheduleFlush(RETRY_DELAY_MS);
      if (import.meta.env.DEV) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[Baltozaur] analytics batch was not recorded:', message);
      }
    })
    .finally(() => {
      flushPromise = null;
      if ((pendingCounts.size > 0 || pendingActivities.length > 0) && !flushTimer) scheduleFlush();
    });

  return flushPromise;
}

export function trackEvent(eventName: string, metadata: AnalyticsMetadata = {}) {
  if (window.location.pathname.startsWith('/admin')) return;

  const action = eventName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
  if (!trackedActions.has(action)) return;

  addCount('action', action);
  addActivity(action, metadata);
  const lakeName = metadata.lake_name;
  if (lakeActions.has(action) && typeof lakeName === 'string') {
    addCount('lake_interest', lakeName);
  }
}

export function trackPageView() {
  if (window.location.pathname.startsWith('/admin')) return;
  addCount('page_view', 'all');
  addCount('source', acquisitionSource);
  addCount('platform', platform);
  addActivity('page_view', { source: acquisitionSource, platform });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAnalytics(true);
  });
  window.addEventListener('pagehide', () => {
    void flushAnalytics(true);
  });
}
