import { createClient } from '@supabase/supabase-js';
import type { LakeScore } from '../types/lake';
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
} as const;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function normaliseFeedingWindows(raw: unknown): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[')) {
      try { return JSON.parse(t) as string[]; } catch { /* fall through */ }
    }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return null;
}

// ── Sample fallback data using real lake names ───────────────────────────────
const SAMPLE_DAYS = [0, 1, 2, 3, 4].map((offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return getLocalDateKey(d);
});

export const SAMPLE_LAKES: LakeScore[] = SAMPLE_DAYS.flatMap((day, di) => [
  { id: `${di}-1`, lake_id: '2707f05e', name: 'Varlaam Lake',        county: 'Giurgiu',  distance_km: 45, lat: 44.318, lon: 25.986, score: 70 + di * 3,   temperature: 13.3, temperature_delta: -0.4, pressure: 1006.1, pressure_delta: 0.4,  wind_speed: 1.5, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-2`, lake_id: '5660d421', name: 'Hermes Peris',        county: 'Ilfov',    distance_km: 35, lat: 44.684, lon: 26.016, score: 68 + di * 2,   temperature: 12.3, temperature_delta: -0.3, pressure: 1006.3, pressure_delta: 0.3,  wind_speed: 5.3, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-3`, lake_id: '799d73ad', name: 'Lacul Peris',         county: 'Ilfov',    distance_km: 35, lat: 44.666, lon: 26.000, score: 65 - di,       temperature: 12.3, temperature_delta: -0.3, pressure: 1006.3, pressure_delta: 0.3,  wind_speed: 5.3, feeding_windows: ['4:00-8:00'],             calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-4`, lake_id: 'dde0b1b6', name: 'Balta Gruiu',         county: 'Ilfov',    distance_km: 40, lat: 44.718, lon: 26.233, score: 72 + di,       temperature: 12.4, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 4.2, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-5`, lake_id: 'a6dbf2df', name: 'Balta Piteasca 2',   county: 'Ilfov',    distance_km: 28, lat: 44.450, lon: 26.320, score: 75 - di * 2,   temperature: 12.7, temperature_delta: -0.4, pressure: 1006.1, pressure_delta: 0.2,  wind_speed: 3.5, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-6`, lake_id: '9c3a6e76', name: 'Cozieni',             county: 'Ilfov',    distance_km: 25, lat: 44.515, lon: 26.266, score: 80 + di,       temperature: 12.8, temperature_delta: -0.4, pressure: 1006.2, pressure_delta: 0.3,  wind_speed: 3.9, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-7`, lake_id: '8b9d540d', name: 'Pasarea Tunari',      county: 'Ilfov',    distance_km: 18, lat: 44.566, lon: 26.180, score: 78 - di,       temperature: 12.5, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 4.8, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-8`, lake_id: 'dccf2d04', name: 'Delta Gruiu',         county: 'Ilfov',    distance_km: 42, lat: 44.731, lon: 26.221, score: 60 + di * 4,   temperature: 12.4, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 5.5, feeding_windows: ['4:00-8:00', '17:00-21:00'], calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-9`, lake_id: 'af310fb2', name: 'Corata',              county: 'Calarasi', distance_km: 55, lat: 44.432, lon: 26.612, score: 45 + di * 3,   temperature: 13.5, temperature_delta: -0.1, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 0.8, feeding_windows: ['17:00-21:00'],            calculated_at: `${day}T10:00:00Z` },
  { id: `${di}-10`,lake_id: '0b6c2369', name: 'Balta Corata',        county: 'Calarasi', distance_km: 44, lat: 44.382, lon: 26.598, score: 55 - di * 2,   temperature: 13.5, temperature_delta: -0.3, pressure: 1006.2, pressure_delta: 0.2,  wind_speed: 2.2, feeding_windows: null,                        calculated_at: `${day}T10:00:00Z` },
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

  const { data, error } = await supabase
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
    .order('score', { ascending: false });

  if (error) {
    console.error('[Baltozaur] fetchLakeScoresForDay error:', error.message);
    return SAMPLE_LAKES.filter((l) => l.calculated_at.startsWith(day));
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Flatten the joined lakes object into the LakeScore shape
  return (data as any[]).map((row) => ({
    id: row.id,
    lake_id: row.lake_id,
    score: row.score,
    pressure: row.pressure,
    wind_speed: row.wind_speed,
    temperature: row.temperature,
    calculated_at: row.calculated_at,
    pressure_delta: row.pressure_delta ?? 0,
    temperature_delta: row.temperature_delta ?? 0,
    feeding_windows: normaliseFeedingWindows(row.feeding_windows),
    name: row[tables.lakes]?.name ?? 'Unknown',
    county: row[tables.lakes]?.county ?? '—',
    distance_km: row[tables.lakes]?.distance_km ?? 0,
    lat: row[tables.lakes]?.lat ?? 0,
    lon: row[tables.lakes]?.lon ?? 0,
  } as LakeScore));
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
    pressure_delta: row.pressure_delta ?? 0,
    temperature_delta: row.temperature_delta ?? 0,
    feeding_windows: normaliseFeedingWindows(row.feeding_windows),
  }));
}
