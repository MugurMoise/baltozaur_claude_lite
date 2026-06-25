export type MockScoreLabel = 'weak' | 'fair' | 'good' | 'very_good' | 'excellent';

export interface MockScoreComponent {
  key: string;
  label: string;
  score0100: number;
  defaultWeight: number;
  reliability01: number;
  effectiveWeight: number;
  note: string;
}

export interface MockFishingScoreResult {
  score0100: number;
  baseScore0100: number;
  confidence0100: number;
  baitModifierPoints: number;
  label: MockScoreLabel;
  breakdown: MockScoreComponent[];
  missingDataFlags: string[];
  algorithmVersion: string;
}

export interface MockFishingScoreInput {
  pressureMslHpa?: number;
  pressureMsl3hAgoHpa?: number;
  airTempC?: number;
  windSpeedMs?: number;
  precipRateMmH?: number;
  precip12hMm?: number;
  moonIllumination01?: number;
  hourLocal: number;
  month: number;
  baitMatch01?: number;
  baitConfidence01?: number;
  userActivity01?: number;
  userActivityReliability01?: number;
}

export interface MockLegacyScoreInput {
  pressure: number;
  pressureDelta: number;
  windSpeedKmh: number;
  temperature: number;
  temperatureDelta: number;
  cloudCover: number;
  precipitation: number;
  rainHours: number;
  rainyWindHours: number;
}

const DEFAULT_WEIGHTS = {
  pressureTrend: 4,
  temperature: 10,
  wind: 7,
  precipitation: 4,
  moon: 9,
  timeOfDay: 12,
  season: 8,
  userReportedActivity: 16,
} as const;

function clamp(x: number, lo: number, hi: number) {
  return Math.min(Math.max(x, lo), hi);
}

function gauss01(x: number, mu: number, sigma: number) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function trapezoid01(x: number, a: number, b: number, c: number, d: number) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

function pressureTrendScore(now: number, threeHoursAgo: number) {
  const dp3 = now - threeHoursAgo;
  if (dp3 <= -6) return 20;
  if (dp3 < -2) return 20 + 13.75 * (dp3 + 6);
  if (dp3 <= 0.5) return 75 + 2 * (dp3 + 2);
  if (dp3 <= 4) return 80 - 12.857142857 * (dp3 - 0.5);
  return 15;
}

function labelFromScore(score: number): MockScoreLabel {
  if (score >= 85) return 'excellent';
  if (score >= 72) return 'very_good';
  if (score >= 55) return 'good';
  if (score >= 40) return 'fair';
  return 'weak';
}

export function computeFishingScoreV2Mock(input: MockFishingScoreInput): MockFishingScoreResult {
  const components: MockScoreComponent[] = [];
  const missingDataFlags: string[] = [];

  const add = (
    key: keyof typeof DEFAULT_WEIGHTS,
    label: string,
    score0100: number | null,
    reliability01: number,
    note: string,
  ) => {
    if (score0100 == null || reliability01 <= 0) {
      missingDataFlags.push(`missing:${key}`);
      return;
    }
    const defaultWeight = DEFAULT_WEIGHTS[key];
    const effectiveWeight = defaultWeight * reliability01;
    components.push({
      key,
      label,
      score0100: Math.round(clamp(score0100, 0, 100)),
      defaultWeight,
      reliability01,
      effectiveWeight,
      note,
    });
  };

  add(
    'pressureTrend',
    'Presiune',
    input.pressureMslHpa != null && input.pressureMsl3hAgoHpa != null
      ? pressureTrendScore(input.pressureMslHpa, input.pressureMsl3hAgoHpa)
      : null,
    1,
    'usor descendent',
  );
  add(
    'temperature',
    'Temperatura',
    input.airTempC == null ? null : 50 + 0.6 * (100 * gauss01(input.airTempC, 20, 10) - 50),
    input.airTempC == null ? 0 : 0.6,
    'aer favorabil',
  );
  add(
    'wind',
    'Vant',
    input.windSpeedMs == null ? null : 40 + 60 * trapezoid01(input.windSpeedMs, 0.5, 1.5, 4.5, 8.5),
    input.windSpeedMs == null ? 0 : 1,
    'moderat',
  );
  add(
    'precipitation',
    'Ploaie',
    input.precipRateMmH == null || input.precip12hMm == null
      ? null
      : clamp(80 - 9 * Math.sqrt(input.precipRateMmH) - Math.min(input.precip12hMm, 20), 10, 80),
    input.precipRateMmH == null || input.precip12hMm == null ? 0 : 1,
    'risc redus',
  );
  add(
    'moon',
    'Luna',
    input.moonIllumination01 == null ? null : 35 + 30 * Math.abs(2 * input.moonIllumination01 - 1),
    input.moonIllumination01 == null ? 0 : 0.45,
    'semnal partial',
  );
  add(
    'timeOfDay',
    'Ora',
    clamp(45 + 30 * gauss01(input.hourLocal, 19, 2.2) + (input.hourLocal >= 21 || input.hourLocal <= 5 ? 15 : 0), 20, 95),
    1,
    'aproape de seara',
  );
  add(
    'season',
    'Sezon',
    20 + 80 * gauss01(input.month, 8.5, 2.2),
    1,
    'perioada buna',
  );
  add(
    'userReportedActivity',
    'Rapoarte',
    input.userActivity01 == null ? null : 100 * input.userActivity01,
    input.userActivityReliability01 ?? 0,
    'activitate recenta',
  );

  const totalDefaultWeight = Object.values(DEFAULT_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const totalEffectiveWeight = components.reduce((sum, component) => sum + component.effectiveWeight, 0);
  const rawBase = totalEffectiveWeight === 0
    ? 50
    : components.reduce((sum, component) => sum + component.score0100 * component.effectiveWeight, 0) / totalEffectiveWeight;
  const coverage = totalEffectiveWeight / totalDefaultWeight;
  const baseScore0100 = clamp(50 + (rawBase - 50) * (0.35 + 0.65 * coverage), 0, 100);
  const baitModifierPoints = input.baitMatch01 == null || input.baitConfidence01 == null
    ? 0
    : clamp(10 * (2 * input.baitMatch01 - 1) * input.baitConfidence01, -8, 8);
  const score0100 = clamp(baseScore0100 + baitModifierPoints, 0, 100);

  return {
    score0100: Math.round(score0100),
    baseScore0100: Math.round(baseScore0100),
    confidence0100: Math.round(100 * coverage),
    baitModifierPoints: Math.round(baitModifierPoints),
    label: labelFromScore(score0100),
    breakdown: components.sort((a, b) => b.effectiveWeight - a.effectiveWeight),
    missingDataFlags,
    algorithmVersion: 'fishing-score-v2-mock',
  };
}

export function computeLegacyCarpScoreMock(weather: MockLegacyScoreInput) {
  let score = 55;

  if (weather.temperature >= 18 && weather.temperature <= 26) score += 22;
  else if (weather.temperature >= 14 && weather.temperature < 18) score += 12;
  else if (weather.temperature > 26 && weather.temperature <= 30) score += 8;
  else if (weather.temperature < 10) score -= 18;
  else if (weather.temperature > 32) score -= 18;

  if (weather.pressure >= 1000 && weather.pressure <= 1012) score += 16;
  else if (weather.pressure > 1012 && weather.pressure <= 1018) score += 8;
  else if (weather.pressure < 995) score += 6;
  else if (weather.pressure > 1022) score -= 12;

  if (weather.pressureDelta <= -0.5 && weather.pressureDelta >= -6) score += 14;
  else if (weather.pressureDelta < -6) score += 6;
  else if (weather.pressureDelta > -0.5 && weather.pressureDelta < 1.5) score += 6;
  else if (weather.pressureDelta >= 1.5 && weather.pressureDelta < 4) score -= 8;
  else if (weather.pressureDelta >= 4) score -= 18;

  if (weather.windSpeedKmh >= 4 && weather.windSpeedKmh <= 18) score += 12;
  else if (weather.windSpeedKmh > 18 && weather.windSpeedKmh <= 25) score += 5;
  else if (weather.windSpeedKmh < 4) score += 2;
  else if (weather.windSpeedKmh > 30) score -= 18;

  if (weather.cloudCover >= 30 && weather.cloudCover <= 90) score += 8;
  else if (weather.cloudCover < 15) score -= 5;

  if (weather.temperatureDelta > 0.5 && weather.temperatureDelta <= 4) score += 6;
  else if (weather.temperatureDelta < -3) score -= 8;

  if (weather.rainyWindHours > 0) score -= 70;
  else if (weather.rainHours > 2) score -= 50;
  else if (weather.precipitation > 0) score -= 16;

  return Math.max(0, Math.min(Math.round(score), 100));
}
