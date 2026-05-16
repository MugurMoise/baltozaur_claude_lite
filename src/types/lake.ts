import type { Lang } from '../i18n';
import { getLocale, t } from '../i18n';

export interface LakeScore {
  id: string;
  lake_id: string;
  score: number;
  pressure: number;
  wind_speed: number;
  temperature: number;
  calculated_at: string;
  pressure_delta: number | null;
  temperature_delta: number | null;
  feeding_windows: string[] | null;
  name: string;
  county: string;
  distance_km: number;
  lat: number;
  lon: number;
}

export type ScoreLevel = 'excellent' | 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor';

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'veryGood';
  if (score >= 55) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 25) return 'poor';
  return 'veryPoor';
}

export function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

export function getScoreBg(score: number): string {
  if (score >= 70) return 'bg-green-500/20 border-green-500/40 text-green-400';
  if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
  return 'bg-red-500/20 border-red-500/40 text-red-400';
}

export function getScoreGradient(score: number): string {
  if (score >= 70) return 'from-green-500/30 to-green-600/10';
  if (score >= 40) return 'from-yellow-500/30 to-yellow-600/10';
  return 'from-red-500/30 to-red-600/10';
}

export function getScoreLabel(score: number, lang: Lang): string {
  return t[lang].scoreLabels[getScoreLevel(score)];
}

export function getRecommendation(score: number, lang: Lang): string {
  return t[lang].recommendation[getScoreLevel(score)];
}

export function getConditionTags(lake: LakeScore, lang: Lang): string[] {
  const tr = t[lang].conditions;
  const tags: string[] = [];
  if (lake.temperature >= 16 && lake.temperature <= 24) tags.push(tr.tempGood);
  else tags.push(tr.tempBad);
  if (lake.wind_speed >= 8 && lake.wind_speed <= 20) tags.push(tr.windGood);
  else if (lake.wind_speed > 20) tags.push(tr.windBad);
  else tags.push(tr.windCalm);
  if ((lake.pressure_delta ?? 0) < -0.5) tags.push(tr.pressureGood);
  else tags.push(tr.pressureBad);
  return tags;
}

export function formatDay(dateStr: string, lang: Lang): { label: string; sub: string; iso: string } {
  const locale = getLocale(lang);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const todayIso    = today.toISOString().slice(0, 10);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const sub = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  if (dateStr === todayIso)    return { label: t[lang].today,    sub, iso: dateStr };
  if (dateStr === tomorrowIso) return { label: t[lang].tomorrow, sub, iso: dateStr };
  const label = date.toLocaleDateString(locale, { weekday: 'long' });
  return { label: label.charAt(0).toUpperCase() + label.slice(1), sub, iso: dateStr };
}
