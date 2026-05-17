import { createClient } from '@supabase/supabase-js';
import type { LakeScore } from '../types/lake';
import type { SocialLakeOption, SocialPostAnalysis, SocialPostInput, SocialPostWithAnalysis } from '../types/social';
import { getLocalDateKey } from './date';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const appEnv = (import.meta.env.VITE_APP_ENV as string | undefined) ?? 'prod';
const tablePrefix = appEnv === 'dev' ? 'dev_' : '';

export const isDevEnvironment = appEnv === 'dev';
export const tables = {
  lakes: `${tablePrefix}lakes`,
  lakeScores: `${tablePrefix}lake_scores`,
  latestLakeScores: `${tablePrefix}latest_lake_scores`,
  pushSubscriptions: `${tablePrefix}push_subscriptions`,
  socialPosts: `${tablePrefix}social_posts`,
  socialPostAnalysis: `${tablePrefix}social_post_analysis`,
  lakeSuggestions: `${tablePrefix}lake_suggestions`,
} as const;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function normaliseFeedingWindows(raw: unknown): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return expandFeedingSlots(raw as string[]);
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[')) {
      try { return expandFeedingSlots(JSON.parse(t) as string[]); } catch { /* fall through */ }
    }
    return expandFeedingSlots(t.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return null;
}

const DAILY_FEEDING_SLOTS = [
  { start: 6, end: 10, label: '06:00-10:00' },
  { start: 10, end: 14, label: '10:00-14:00' },
  { start: 14, end: 18, label: '14:00-18:00' },
  { start: 18, end: 30, label: '18:00-06:00' },
];

function parseWindowHours(window: string): { start: number; end: number } | null {
  const match = window.match(/(\d{1,2})(?::\d{2})?\s*-\s*(\d{1,2})(?::\d{2})?/);
  if (!match) return null;
  return {
    start: Math.max(0, Math.min(24, Number(match[1]))),
    end: Math.max(0, Math.min(24, Number(match[2]))),
  };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  const normalisedB = b.end <= b.start ? { start: b.start, end: b.end + 24 } : b;
  return a.start < normalisedB.end && normalisedB.start < a.end;
}

function expandFeedingSlots(windows: string[]): string[] | null {
  if (windows.length === 0) return null;
  if (windows.length === 4 && windows.every((window) => window.includes(':00-'))) return windows;

  const legacyWindows = windows
    .map(parseWindowHours)
    .filter((window): window is { start: number; end: number } => Boolean(window));

  if (legacyWindows.length === 0) return windows;

  return DAILY_FEEDING_SLOTS.map((slot) => {
    const isRecommended = legacyWindows.some((window) => overlaps(slot, window));
    return `${slot.label} · ${isRecommended ? 'bun' : 'slab'}`;
  });
}

function getRainPenalty(rainHours: number, rainyWindHours: number, precipitation: number): number {
  if (rainyWindHours > 0) return 70;
  if (rainHours > 2) return 50;
  if (precipitation > 0) return 16;
  return 0;
}

async function fetchLiveRainForLake(lake: LakeScore, day: string) {
  if (!lake.lat || !lake.lon) return null;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lake.lat));
  url.searchParams.set('longitude', String(lake.lon));
  url.searchParams.set('timezone', 'Europe/Bucharest');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('hourly', 'precipitation,rain,showers,wind_speed_10m');
  url.searchParams.set('daily', 'precipitation_sum,rain_sum,showers_sum');

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();

    const dayIndex = (data.daily?.time ?? []).indexOf(day);
    if (dayIndex < 0) return null;

    const hourlyTimes: string[] = data.hourly?.time ?? [];
    const hourlyPrecip: number[] = data.hourly?.precipitation ?? [];
    const hourlyWind: number[] = data.hourly?.wind_speed_10m ?? [];
    const dayHourIndexes = hourlyTimes
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => time.startsWith(day))
      .map(({ index }) => index);

    const rainHours = dayHourIndexes.filter((index) => (hourlyPrecip[index] ?? 0) >= 0.1).length;
    const rainyWindHours = dayHourIndexes.filter((index) => (
      (hourlyPrecip[index] ?? 0) >= 0.1 && (hourlyWind[index] ?? 0) >= 20
    )).length;
    const precipitation = data.daily?.precipitation_sum?.[dayIndex]
      ?? dayHourIndexes.reduce((sum, index) => sum + (hourlyPrecip[index] ?? 0), 0);

    return { precipitation, rainHours, rainyWindHours };
  } catch (error) {
    console.warn('[Baltozaur] live rain fetch failed:', lake.name, error);
    return null;
  }
}

async function enrichWithLiveRain(lakes: LakeScore[], day: string): Promise<LakeScore[]> {
  const enriched = await Promise.all(lakes.map(async (lake) => {
    const liveRain = await fetchLiveRainForLake(lake, day);
    if (!liveRain) return lake;

    const previousPrecipitation = lake.precipitation ?? 0;
    const previousRainHours = lake.rain_hours ?? 0;
    const shouldApplyPenalty = previousPrecipitation === 0 && previousRainHours === 0;
    const penalty = shouldApplyPenalty
      ? getRainPenalty(liveRain.rainHours, liveRain.rainyWindHours, liveRain.precipitation)
      : 0;

    return {
      ...lake,
      score: Math.max(0, lake.score - penalty),
      precipitation: Number(liveRain.precipitation.toFixed(1)),
      rain_hours: liveRain.rainHours,
    };
  }));

  return enriched.sort((a, b) => b.score - a.score);
}

async function enrichWithProdLakeDetails(lakes: LakeScore[]): Promise<LakeScore[]> {
  if (!supabase || !isDevEnvironment || lakes.length === 0) return lakes;

  const missingDetails = lakes.filter((lake) => (
    !lake.rules ||
    !lake.price ||
    !lake.website_url ||
    !lake.facebook_url ||
    !lake.phone
  ));
  if (missingDetails.length === 0) return lakes;

  const { data, error } = await supabase
    .from('lakes')
    .select('id, rules, price, website_url, facebook_url, phone')
    .in('id', missingDetails.map((lake) => lake.lake_id));

  if (error || !data) {
    console.warn('[Baltozaur] prod lake details fallback failed:', error?.message);
    return lakes;
  }

  const detailsByLake = new Map(
    (data as {
      id: string;
      rules: string | null;
      price: string | null;
      website_url: string | null;
      facebook_url: string | null;
      phone: string | null;
    }[])
      .map((lake) => [lake.id, lake])
  );

  return lakes.map((lake) => {
    const details = detailsByLake.get(lake.lake_id);
    if (!details) return lake;
    return {
      ...lake,
      rules: lake.rules ?? details.rules ?? null,
      price: lake.price ?? details.price ?? null,
      website_url: lake.website_url ?? details.website_url ?? null,
      facebook_url: lake.facebook_url ?? details.facebook_url ?? null,
      phone: lake.phone ?? details.phone ?? null,
    };
  });
}

// ── Sample fallback data using real lake names ───────────────────────────────
const SAMPLE_DAYS = [0, 1, 2, 3, 4].map((offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return getLocalDateKey(d);
});

const sampleContact = {
  precipitation: 0,
  rain_hours: 0,
  website_url: null,
  facebook_url: null,
  phone: null,
  description: null,
  rules: null,
  price: null,
};

export const SAMPLE_LAKES: LakeScore[] = SAMPLE_DAYS.flatMap((day, di) => [
  { id: `${di}-1`, lake_id: '2707f05e', name: 'Varlaam Lake',        county: 'Giurgiu',  distance_km: 45, lat: 44.318, lon: 25.986, score: 70 + di * 3,   temperature: 13.3, temperature_delta: -0.4, pressure: 1006.1, pressure_delta: 0.4,  wind_speed: 1.5, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-2`, lake_id: '5660d421', name: 'Hermes Peris',        county: 'Ilfov',    distance_km: 35, lat: 44.684, lon: 26.016, score: 68 + di * 2,   temperature: 12.3, temperature_delta: -0.3, pressure: 1006.3, pressure_delta: 0.3,  wind_speed: 5.3, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-3`, lake_id: '799d73ad', name: 'Lacul Peris',         county: 'Ilfov',    distance_km: 35, lat: 44.666, lon: 26.000, score: 65 - di,       temperature: 12.3, temperature_delta: -0.3, pressure: 1006.3, pressure_delta: 0.3,  wind_speed: 5.3, feeding_windows: ['4:00-8:00'],             calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-4`, lake_id: 'dde0b1b6', name: 'Balta Gruiu',         county: 'Ilfov',    distance_km: 40, lat: 44.718, lon: 26.233, score: 72 + di,       temperature: 12.4, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 4.2, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-5`, lake_id: 'a6dbf2df', name: 'Balta Piteasca 2',   county: 'Ilfov',    distance_km: 28, lat: 44.450, lon: 26.320, score: 75 - di * 2,   temperature: 12.7, temperature_delta: -0.4, pressure: 1006.1, pressure_delta: 0.2,  wind_speed: 3.5, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-6`, lake_id: '9c3a6e76', name: 'Cozieni',             county: 'Ilfov',    distance_km: 25, lat: 44.515, lon: 26.266, score: 80 + di,       temperature: 12.8, temperature_delta: -0.4, pressure: 1006.2, pressure_delta: 0.3,  wind_speed: 3.9, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-7`, lake_id: '8b9d540d', name: 'Pasarea Tunari',      county: 'Ilfov',    distance_km: 18, lat: 44.566, lon: 26.180, score: 78 - di,       temperature: 12.5, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 4.8, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-8`, lake_id: 'dccf2d04', name: 'Delta Gruiu',         county: 'Ilfov',    distance_km: 42, lat: 44.731, lon: 26.221, score: 60 + di * 4,   temperature: 12.4, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 5.5, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-9`, lake_id: 'af310fb2', name: 'Corata',              county: 'Calarasi', distance_km: 55, lat: 44.432, lon: 26.612, score: 45 + di * 3,   temperature: 13.5, temperature_delta: -0.1, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 0.8, feeding_windows: ['17:00-21:00'],            calculated_at: `${day}T10:00:00Z`, ...sampleContact },
  { id: `${di}-10`,lake_id: '0b6c2369', name: 'Balta Corata',        county: 'Calarasi', distance_km: 44, lat: 44.382, lon: 26.598, score: 55 - di * 2,   temperature: 13.5, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 2.2, feeding_windows: null,                        calculated_at: `${day}T10:00:00Z`, ...sampleContact },
]);

// ── Fetch all available days from lake_scores ────────────────────────────────
export async function fetchAvailableDays(): Promise<string[]> {
  if (!supabase) {
    return SAMPLE_DAYS;
  }

  // Get distinct calendar days from calculated_at
  const { data, error } = await supabase
    .from(tables.lakeScores)
    .select('calculated_at')
    .order('calculated_at', { ascending: true });

  if (error || !data) {
    console.error('[Baltozaur] fetchAvailableDays error:', error?.message);
    return SAMPLE_DAYS;
  }

  // Deduplicate by calendar date
  const seen = new Set<string>();
  for (const row of data as { calculated_at: string }[]) {
    const day = row.calculated_at.slice(0, 10);
    seen.add(day);
  }

  const today = getLocalDateKey();
  seen.add(today);

  const days = Array.from(seen)
    .filter((day) => day >= today)
    .sort();

  return days.length > 0 ? days : SAMPLE_DAYS;
}

// ── Fetch lake scores for a specific day, joined with lake metadata ──────────
export async function fetchLakeScoresForDay(day: string): Promise<LakeScore[]> {
  if (!supabase) {
    return SAMPLE_LAKES.filter((l) => l.calculated_at.startsWith(day));
  }

  // Query lake_scores for the chosen day, join lakes for name/coords
  const startOf = `${day}T00:00:00`;
  const endOf   = `${day}T23:59:59`;

  let data: any[] | null = null;
  let error: { message: string } | null = null;

  const primary = await supabase
    .from(tables.lakeScores)
    .select(`
      id,
      lake_id,
      score,
      pressure,
      wind_speed,
      temperature,
      precipitation,
      rain_hours,
      calculated_at,
      pressure_delta,
      temperature_delta,
      feeding_windows,
      ${tables.lakes} (
        name,
        county,
        distance_km,
        website_url,
        facebook_url,
        phone,
        description,
        rules,
        price,
        lat,
        lon
      )
    `)
    .gte('calculated_at', startOf)
    .lte('calculated_at', endOf)
    .order('calculated_at', { ascending: false });

  data = primary.data as any[] | null;
  error = primary.error;

  if (error) {
    const fallbackWithDescription = await supabase
      .from(tables.lakeScores)
      .select(`
        id,
        lake_id,
        score,
        pressure,
        wind_speed,
        precipitation,
        rain_hours,
        temperature,
        calculated_at,
        pressure_delta,
        temperature_delta,
        feeding_windows,
        ${tables.lakes} (
          name,
          county,
          distance_km,
          website_url,
          facebook_url,
          phone,
          description,
          lat,
          lon
        )
      `)
      .gte('calculated_at', startOf)
      .lte('calculated_at', endOf)
      .order('calculated_at', { ascending: false });

    data = fallbackWithDescription.data as any[] | null;
    error = fallbackWithDescription.error;
  }

  if (error) {
    const fallback = await supabase
      .from(tables.lakeScores)
      .select(`
        id,
        lake_id,
        score,
        pressure,
        wind_speed,
        temperature,
        calculated_at,
        pressure_delta,
        temperature_delta,
        feeding_windows,
        ${tables.lakes} (
          name,
          county,
          distance_km,
          lat,
          lon
        )
      `)
      .gte('calculated_at', startOf)
      .lte('calculated_at', endOf)
      .order('calculated_at', { ascending: false });

    data = fallback.data as any[] | null;
    error = fallback.error;
  }

  if (error) {
    console.error('[Baltozaur] fetchLakeScoresForDay error:', error.message);
    return SAMPLE_LAKES.filter((l) => l.calculated_at.startsWith(day));
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Flatten the joined lakes object into the LakeScore shape
  const latestByLake = new Map<string, any>();
  for (const row of data as any[]) {
    if (!latestByLake.has(row.lake_id)) latestByLake.set(row.lake_id, row);
  }

  const lakes = Array.from(latestByLake.values()).map((row) => ({
    id: row.id,
    lake_id: row.lake_id,
    score: row.score,
    pressure: row.pressure,
    wind_speed: row.wind_speed,
    temperature: row.temperature,
    precipitation: row.precipitation ?? null,
    rain_hours: row.rain_hours ?? null,
    calculated_at: row.calculated_at,
    pressure_delta: row.pressure_delta ?? 0,
    temperature_delta: row.temperature_delta ?? 0,
    feeding_windows: normaliseFeedingWindows(row.feeding_windows),
    name: row[tables.lakes]?.name ?? 'Unknown',
    county: row[tables.lakes]?.county ?? '—',
    distance_km: row[tables.lakes]?.distance_km ?? null,
    website_url: row[tables.lakes]?.website_url ?? null,
    facebook_url: row[tables.lakes]?.facebook_url ?? null,
    phone: row[tables.lakes]?.phone ?? null,
    description: row[tables.lakes]?.description ?? null,
    rules: row[tables.lakes]?.rules ?? null,
    price: row[tables.lakes]?.price ?? null,
    lat: row[tables.lakes]?.lat ?? 0,
    lon: row[tables.lakes]?.lon ?? 0,
  } as LakeScore)).sort((a, b) => b.score - a.score);

  return enrichWithLiveRain(await enrichWithProdLakeDetails(lakes), day);
}

// ── Legacy: fetch latest scores (used as today fallback) ────────────────────
export async function fetchLakeScores(): Promise<LakeScore[]> {
  if (!supabase) {
    const today = getLocalDateKey();
    return SAMPLE_LAKES.filter((l) => l.calculated_at.startsWith(today));
  }

  const { data, error } = await supabase
    .from(tables.latestLakeScores)
    .select('*')
    .order('score', { ascending: false });

  if (error || !data || data.length === 0) {
    console.error('[Baltozaur] fetchLakeScores error:', error?.message);
    const today = getLocalDateKey();
    return SAMPLE_LAKES.filter((l) => l.calculated_at.startsWith(today));
  }

  return (data as LakeScore[]).map((row) => ({
    ...row,
    precipitation: row.precipitation ?? null,
    rain_hours: row.rain_hours ?? null,
    website_url: row.website_url ?? null,
    facebook_url: row.facebook_url ?? null,
    phone: row.phone ?? null,
    description: row.description ?? null,
    rules: row.rules ?? null,
    price: row.price ?? null,
    pressure_delta: row.pressure_delta ?? 0,
    temperature_delta: row.temperature_delta ?? 0,
    feeding_windows: normaliseFeedingWindows(row.feeding_windows),
  }));
}

export async function fetchSocialLakeOptions(): Promise<SocialLakeOption[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(tables.lakes)
    .select('id, name, county')
    .order('name', { ascending: true });

  if (error || !data) {
    console.error('[Baltozaur] fetchSocialLakeOptions error:', error?.message);
    return [];
  }

  return data as SocialLakeOption[];
}

function extractWeightKg(text: string): number | null {
  const match = text.match(/(\d{1,2}(?:[,.]\d{1,2})?)\s*(?:kg|kile|kilograme)/i);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function analyzeSocialPostDraft(input: SocialPostInput, lakeName: string | null) {
  const text = `${input.caption ?? ''} ${input.author_handle ?? ''}`.toLowerCase();
  const views = input.view_count ?? 0;
  const likes = input.like_count ?? 0;
  const estimatedWeight = extractWeightKg(text);

  const mentionsNoBites = includesAny(text, [
    'nici o trasatura',
    'nicio trasatura',
    'fara trasaturi',
    'fara peste',
    'n-am prins',
    'nu am prins',
    'blank',
    'ratata',
  ]);
  const mentionsRain = includesAny(text, ['ploaie', 'ploua', 'turnat', 'furtuna']);
  const mentionsWind = includesAny(text, ['vant', 'vânt', 'rafale']);
  const mentionsBadWeather = mentionsRain || mentionsWind || includesAny(text, ['frig', 'noroi', 'presiune']);
  const mentionsCapture = includesAny(text, ['captura', 'crap', 'somn', 'caras', 'salonta', 'oglinda', 'prins']);
  const isPopular = views >= 10_000 || likes >= 500;

  let eventType = 'informatie_balta';
  if (mentionsNoBites) eventType = 'partida_ratata';
  else if (mentionsBadWeather && !mentionsCapture) eventType = 'conditii_proaste';
  else if ((estimatedWeight ?? 0) >= 10) eventType = 'captura_mare';
  else if (mentionsCapture) eventType = 'captura_confirmata';
  else if (isPopular) eventType = 'popularitate_ridicata';
  else if (!text.trim()) eventType = 'irelevant';

  const confidence = Math.min(
    0.95,
    0.35
      + (lakeName ? 0.15 : 0)
      + (input.caption ? 0.2 : 0)
      + (mentionsCapture || mentionsNoBites || mentionsBadWeather ? 0.2 : 0)
      + (estimatedWeight ? 0.05 : 0)
  );
  const popularityScore = Math.min(100, Math.round((views / 1000) + (likes / 50)));
  const sentiment = mentionsNoBites || mentionsBadWeather ? 'negativ' : mentionsCapture ? 'pozitiv' : 'neutru';
  const fishType = includesAny(text, ['crap', 'salonta', 'oglinda'])
    ? 'crap'
    : includesAny(text, ['somn'])
      ? 'somn'
      : includesAny(text, ['caras'])
        ? 'caras'
        : null;

  const summaryParts = [
    lakeName ? `Semnal pentru ${lakeName}.` : 'Balta nu este confirmata.',
    eventType === 'captura_mare' ? `Captura mare estimata la ${estimatedWeight} kg.` : null,
    eventType === 'captura_confirmata' ? 'Postarea indica o captura.' : null,
    eventType === 'partida_ratata' ? 'Postarea indica o partida slaba sau fara trasaturi.' : null,
    eventType === 'conditii_proaste' ? 'Postarea mentioneaza conditii meteo slabe.' : null,
    isPopular ? 'Postarea are tractiune ridicata.' : null,
  ].filter(Boolean);

  return {
    event_type: eventType,
    lake_guess: lakeName,
    fish_type: fishType,
    estimated_weight_kg: estimatedWeight,
    confidence: Number(confidence.toFixed(2)),
    popularity_score: popularityScore,
    sentiment,
    mentions_bad_weather: mentionsBadWeather,
    mentions_no_bites: mentionsNoBites,
    mentions_rain: mentionsRain,
    mentions_wind: mentionsWind,
    summary: summaryParts.join(' '),
    raw_result: {
      analyzer: 'local-rule-mvp',
      signals: { mentionsCapture, mentionsNoBites, mentionsRain, mentionsWind, isPopular },
    },
  };
}

function isMissingSocialTableError(message: string | undefined): boolean {
  return Boolean(message?.includes('dev_social_posts') || message?.includes('social_posts'));
}

function getLocalSocialPosts(): SocialPostWithAnalysis[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem('baltozaur_social_posts') ?? '[]') as SocialPostWithAnalysis[];
  } catch {
    return [];
  }
}

function setLocalSocialPosts(posts: SocialPostWithAnalysis[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('baltozaur_social_posts', JSON.stringify(posts));
}

function createLocalSocialPost(input: SocialPostInput, lakeName: string | null) {
  const now = new Date().toISOString();
  const postId = crypto.randomUUID();
  const analysisDraft = analyzeSocialPostDraft(input, lakeName);
  const analysis: SocialPostAnalysis = {
    id: crypto.randomUUID(),
    post_id: postId,
    ...analysisDraft,
    event_type: analysisDraft.event_type as SocialPostAnalysis['event_type'],
    analyzed_at: now,
  };
  const post: SocialPostWithAnalysis = {
    id: postId,
    platform: 'tiktok',
    source_url: input.source_url,
    lake_id: input.lake_id,
    author_handle: input.author_handle,
    caption: input.caption,
    posted_at: null,
    view_count: input.view_count,
    like_count: input.like_count,
    created_at: now,
    updated_at: now,
    analysis,
    lake_name: lakeName,
  };

  const existing = getLocalSocialPosts().filter((item) => item.source_url !== input.source_url);
  setLocalSocialPosts([post, ...existing].slice(0, 50));
}

export async function createSocialPostWithAnalysis(
  input: SocialPostInput,
  lakeName: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const { data: post, error: postError } = await supabase
    .from(tables.socialPosts)
    .upsert({
      platform: 'tiktok',
      source_url: input.source_url,
      lake_id: input.lake_id,
      author_handle: input.author_handle,
      caption: input.caption,
      view_count: input.view_count,
      like_count: input.like_count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source_url' })
    .select('id')
    .single();

  if (postError || !post) {
    console.error('[Baltozaur] createSocialPost error:', postError?.message);
    if (isMissingSocialTableError(postError?.message)) {
      createLocalSocialPost(input, lakeName);
      return { ok: true };
    }
    return { ok: false, error: postError?.message ?? 'Postarea nu a putut fi salvata.' };
  }

  const analysis = analyzeSocialPostDraft(input, lakeName);
  const { error: analysisError } = await supabase
    .from(tables.socialPostAnalysis)
    .upsert({
      post_id: post.id,
      ...analysis,
      analyzed_at: new Date().toISOString(),
    }, { onConflict: 'post_id' });

  if (analysisError) {
    console.error('[Baltozaur] createSocialPostAnalysis error:', analysisError.message);
    if (isMissingSocialTableError(analysisError.message)) {
      createLocalSocialPost(input, lakeName);
      return { ok: true };
    }
    return { ok: false, error: analysisError.message };
  }

  return { ok: true };
}

export async function fetchSocialPosts(): Promise<SocialPostWithAnalysis[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(tables.socialPosts)
    .select(`
      *,
      ${tables.socialPostAnalysis} (*),
      ${tables.lakes} (name)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) {
    console.error('[Baltozaur] fetchSocialPosts error:', error?.message);
    if (isMissingSocialTableError(error?.message)) {
      return getLocalSocialPosts();
    }
    return [];
  }

  return (data as any[]).map((row) => ({
    ...row,
    analysis: row[tables.socialPostAnalysis] ?? null,
    lake_name: row[tables.lakes]?.name ?? null,
  })) as SocialPostWithAnalysis[];
}
