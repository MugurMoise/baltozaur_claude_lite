import { appEnv, supabase } from './supabase';

type AnalyticsValue = string | number | boolean | null;
type AnalyticsMetadata = Record<string, AnalyticsValue>;

interface Acquisition {
  source: string;
  medium: string;
  campaign: string | null;
  referrerDomain: string | null;
}

interface VisitorContext {
  country: string | null;
  region: string | null;
  city: string | null;
  excluded: boolean;
}

const MAX_METADATA_FIELDS = 12;
const MAX_METADATA_STRING_LENGTH = 160;
const sessionId = createSessionId();
const acquisition = detectAcquisition();
const landingPath = safePath(window.location.pathname);
let visitorContextPromise: Promise<VisitorContext> | null = null;

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function safePath(value: string) {
  const path = value.startsWith('/') ? value : `/${value}`;
  return path.slice(0, 160);
}

function normaliseSource(value: string) {
  const source = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  if (source.includes('tiktok')) return 'tiktok';
  if (source.includes('instagram')) return 'instagram';
  if (source.includes('facebook') || source === 'fb') return 'facebook';
  if (source.includes('google')) return 'google';
  if (source.includes('youtube')) return 'youtube';
  return source.slice(0, 80) || 'direct';
}

function hostnameFromReferrer() {
  if (!document.referrer) return null;
  try {
    const hostname = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase();
    return hostname === window.location.hostname.replace(/^www\./, '').toLowerCase() ? null : hostname.slice(0, 120);
  } catch {
    return null;
  }
}

function detectAcquisition(): Acquisition {
  const params = new URLSearchParams(window.location.search);
  const userAgent = navigator.userAgent.toLowerCase();
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const campaign = params.get('utm_campaign')?.slice(0, 120) || null;
  const referrerDomain = hostnameFromReferrer();

  if (utmSource) {
    return {
      source: normaliseSource(utmSource),
      medium: (utmMedium?.trim().toLowerCase() || 'campaign').slice(0, 80),
      campaign,
      referrerDomain,
    };
  }

  if (params.has('ttclid')) return { source: 'tiktok', medium: 'paid_social', campaign, referrerDomain };
  if (params.has('fbclid')) return { source: 'facebook', medium: 'paid_social', campaign, referrerDomain };
  if (params.has('gclid')) return { source: 'google', medium: 'paid_search', campaign, referrerDomain };
  if (/tiktok|musical_ly|bytedancewebview/.test(userAgent)) {
    return { source: 'tiktok', medium: 'in_app_social', campaign, referrerDomain };
  }
  if (/instagram/.test(userAgent)) {
    return { source: 'instagram', medium: 'in_app_social', campaign, referrerDomain };
  }
  if (/(fban|fbav)/.test(userAgent)) {
    return { source: 'facebook', medium: 'in_app_social', campaign, referrerDomain };
  }

  if (!referrerDomain) return { source: 'direct', medium: 'none', campaign, referrerDomain: null };
  if (referrerDomain.includes('tiktok')) return { source: 'tiktok', medium: 'organic_social', campaign, referrerDomain };
  if (referrerDomain.includes('instagram')) return { source: 'instagram', medium: 'organic_social', campaign, referrerDomain };
  if (referrerDomain.includes('facebook') || referrerDomain === 'l.facebook.com') {
    return { source: 'facebook', medium: 'organic_social', campaign, referrerDomain };
  }
  if (referrerDomain.includes('youtube') || referrerDomain === 'youtu.be') {
    return { source: 'youtube', medium: 'organic_social', campaign, referrerDomain };
  }
  if (referrerDomain.includes('google.')) return { source: 'google', medium: 'organic_search', campaign, referrerDomain };
  if (referrerDomain.includes('bing.')) return { source: 'bing', medium: 'organic_search', campaign, referrerDomain };

  return { source: referrerDomain, medium: 'referral', campaign, referrerDomain };
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

function detectDeviceType() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(userAgent)) return 'tablet';
  if (/android/.test(userAgent) && !/mobile/.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android/.test(userAgent)) return 'mobile';
  return 'desktop';
}

async function loadVisitorContext(): Promise<VisitorContext> {
  try {
    const response = await fetch('/api/visitor-context', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return { country: null, region: null, city: null, excluded: false };
    }

    const raw = await response.json() as Partial<VisitorContext>;
    return {
      country: typeof raw.country === 'string' ? raw.country.slice(0, 2).toUpperCase() : null,
      region: typeof raw.region === 'string' ? raw.region.slice(0, 80) : null,
      city: typeof raw.city === 'string' ? raw.city.slice(0, 120) : null,
      excluded: raw.excluded === true,
    };
  } catch {
    return { country: null, region: null, city: null, excluded: false };
  }
}

function getVisitorContext() {
  visitorContextPromise ??= loadVisitorContext();
  return visitorContextPromise;
}

function cleanMetadata(metadata: AnalyticsMetadata): AnalyticsMetadata {
  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, MAX_METADATA_FIELDS)
      .map(([key, value]) => [
        key.replace(/[^a-z0-9_]/gi, '_').slice(0, 40),
        typeof value === 'string' ? value.slice(0, MAX_METADATA_STRING_LENGTH) : value,
      ])
  );
}

export function trackEvent(eventName: string, metadata: AnalyticsMetadata = {}) {
  const analyticsClient = supabase;
  if (!analyticsClient || window.location.pathname.startsWith('/admin')) return;

  const name = eventName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
  if (!name) return;

  void getVisitorContext().then(async (visitorContext) => {
    if (visitorContext.excluded) return;

    const { error } = await analyticsClient.rpc('track_analytics_event', {
      p_event_name: name,
      p_session_id: sessionId,
      p_app_environment: appEnv,
      p_source: acquisition.source,
      p_medium: acquisition.medium,
      p_campaign: acquisition.campaign,
      p_referrer_domain: acquisition.referrerDomain,
      p_landing_path: landingPath,
      p_page_path: safePath(window.location.pathname),
      p_platform: detectPlatform(),
      p_device_type: detectDeviceType(),
      p_language: navigator.language.slice(0, 16),
      p_metadata: cleanMetadata({
        geo_country: visitorContext.country,
        geo_region: visitorContext.region,
        geo_city: visitorContext.city,
        ...metadata,
      }),
    });

    if (error && import.meta.env.DEV) {
      console.warn('[Baltozaur] analytics event was not recorded:', error.message);
    }
  });
}

export function trackPageView() {
  trackEvent('page_view', {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
  });
}
