import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Record<string, unknown> = {};
  try {
    body = req.method === "GET" ? {} : await req.json();
  } catch {
    body = {};
  }

  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing Supabase service role key" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey
  );
  const url = new URL(req.url);
  const mode = String(body.env ?? url.searchParams.get("env") ?? "prod");
  const lakeId = typeof body.lake_id === "string"
    ? body.lake_id
    : url.searchParams.get("lake_id");
  const limitParam = Number(body.limit ?? url.searchParams.get("limit") ?? "0");
  const offsetParam = Number(body.offset ?? url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), 10)
    : null;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0
    ? Math.floor(offsetParam)
    : 0;
  const tables = {
    lakes: "lakes",
    lakeScores: "lake_scores",
  };
  const RAIN_INTERVAL_MM = 0.1;
  const MIN_RAIN_MINUTES_FOR_PENALTY = 30;
  const MIN_PRECIPITATION_MM_FOR_PENALTY = 1;
  const HEAVY_PRECIPITATION_MM = 3;
  const MINUTELY_INTERVAL_MINUTES = 15;
  const RAINY_WIND_SPEED_KMH = 20;
  const STRONG_WIND_KMH = 14;
  const HARD_WIND_KMH = 18;
  const VERY_HARD_WIND_KMH = 25;
  const DEFAULT_SCORE_SETTINGS = {
    baseScore: 55,
    idealTempMin: 18,
    idealTempMax: 26,
    idealTempBonus: 22,
    coolTempBonus: 12,
    hotTempBonus: 8,
    coldTempPenalty: 18,
    extremeHeatPenalty: 18,
    idealPressureMin: 1000,
    idealPressureMax: 1012,
    idealPressureBonus: 16,
    moderatePressureBonus: 8,
    lowPressureBonus: 6,
    highPressurePenalty: 12,
    fallingPressureBonus: 14,
    stablePressureBonus: 6,
    risingPressurePenalty: 8,
    hardRisingPressurePenalty: 18,
    goodWindMin: 4,
    goodWindMax: 14,
    goodWindBonus: 12,
    calmWindBonus: 2,
    hardWindPenalty: 8,
    veryHardWindPenalty: 18,
    cloudBonus: 8,
    lightRainPenalty: 16,
    longRainPenalty: 50,
    rainyWindPenalty: 70,
  };

  type ScoreSettings = typeof DEFAULT_SCORE_SETTINGS;

  function errorMessage(err: unknown) {
    if (err instanceof Error) return err.message;

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  async function loadScoreSettings(): Promise<ScoreSettings> {
    const { data, error } = await supabase
      .from("admin_score_settings")
      .select("settings")
      .eq("id", "default")
      .maybeSingle();

    if (error || !data?.settings || typeof data.settings !== "object") {
      return DEFAULT_SCORE_SETTINGS;
    }

    const settings = { ...DEFAULT_SCORE_SETTINGS };
    for (const key of Object.keys(DEFAULT_SCORE_SETTINGS) as (keyof ScoreSettings)[]) {
      const value = (data.settings as Partial<ScoreSettings>)[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        (settings as Record<keyof ScoreSettings, number>)[key] = value;
      }
    }
    return settings;
  }

  function calculateCarpScore(weather: {
    pressure: number;
    pressureDelta: number;
    wind_speed: number;
    temperature: number;
    temperatureDelta: number;
    cloud_cover: number;
    precipitation: number;
    rainMinutes: number;
    rainyWindMinutes: number;
  }, settings: ScoreSettings) {
    let score = settings.baseScore;

    if (weather.temperature >= settings.idealTempMin && weather.temperature <= settings.idealTempMax) score += settings.idealTempBonus;
    else if (weather.temperature >= 14 && weather.temperature < settings.idealTempMin) score += settings.coolTempBonus;
    else if (weather.temperature > settings.idealTempMax && weather.temperature <= 30) score += settings.hotTempBonus;
    else if (weather.temperature < 10) score -= settings.coldTempPenalty;
    else if (weather.temperature > 32) score -= settings.extremeHeatPenalty;

    if (weather.pressure >= settings.idealPressureMin && weather.pressure <= settings.idealPressureMax) score += settings.idealPressureBonus;
    else if (weather.pressure > settings.idealPressureMax && weather.pressure <= 1018) score += settings.moderatePressureBonus;
    else if (weather.pressure < 995) score += settings.lowPressureBonus;
    else if (weather.pressure > 1022) score -= settings.highPressurePenalty;

    if (weather.pressureDelta <= -0.5 && weather.pressureDelta >= -6) score += settings.fallingPressureBonus;
    else if (weather.pressureDelta < -6) score += settings.lowPressureBonus;
    else if (weather.pressureDelta > -0.5 && weather.pressureDelta < 1.5) score += settings.stablePressureBonus;
    else if (weather.pressureDelta >= 1.5 && weather.pressureDelta < 4) score -= settings.risingPressurePenalty;
    else if (weather.pressureDelta >= 4) score -= settings.hardRisingPressurePenalty;

    if (weather.wind_speed >= settings.goodWindMin && weather.wind_speed <= settings.goodWindMax) score += settings.goodWindBonus;
    else if (weather.wind_speed > STRONG_WIND_KMH && weather.wind_speed <= HARD_WIND_KMH) score += 2;
    else if (weather.wind_speed > HARD_WIND_KMH && weather.wind_speed <= VERY_HARD_WIND_KMH) score -= settings.hardWindPenalty;
    else if (weather.wind_speed < settings.goodWindMin) score += settings.calmWindBonus;
    else if (weather.wind_speed > VERY_HARD_WIND_KMH) score -= settings.veryHardWindPenalty;

    if (weather.cloud_cover >= 30 && weather.cloud_cover <= 90) score += settings.cloudBonus;
    else if (weather.cloud_cover < 15) score -= 5;

    if (weather.temperatureDelta > 0.5 && weather.temperatureDelta <= 4) score += 6;
    else if (weather.temperatureDelta < -3) score -= 8;

    if (weather.precipitation >= MIN_PRECIPITATION_MM_FOR_PENALTY) {
      if (weather.rainyWindMinutes >= MIN_RAIN_MINUTES_FOR_PENALTY && weather.precipitation >= HEAVY_PRECIPITATION_MM) score -= settings.rainyWindPenalty;
      else if (weather.rainMinutes > 120 && weather.precipitation >= HEAVY_PRECIPITATION_MM) score -= settings.longRainPenalty;
      else if (weather.rainMinutes >= 60) score -= settings.lightRainPenalty;
    }

    return Math.max(0, Math.min(Math.round(score), 100));
  }

  function getRainMetricsForDay(args: {
    dateStr: string;
    minutely?: { time?: string[]; precipitation?: number[]; wind_speed_10m?: number[] };
    hourlyPrecip: number[];
    hourlyWind: number[];
    dailyPrecipitation?: number;
    currentPrecipitation?: number;
  }) {
    const minutelyTimes = args.minutely?.time ?? [];
    const minutelyPrecip = args.minutely?.precipitation ?? [];
    const minutelyWind = args.minutely?.wind_speed_10m ?? [];
    const minuteIndexes = minutelyTimes
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => time.startsWith(args.dateStr))
      .map(({ index }) => index);

    if (minuteIndexes.length > 0) {
      const rainyIndexes = minuteIndexes.filter((index) => (minutelyPrecip[index] ?? 0) >= RAIN_INTERVAL_MM);
      const rainMinutes = rainyIndexes.length * MINUTELY_INTERVAL_MINUTES;
      const isEffectiveRain = rainMinutes >= MIN_RAIN_MINUTES_FOR_PENALTY;

      if (!isEffectiveRain) {
        return { precipitation: 0, rainHours: 0, rainMinutes: 0, rainyWindMinutes: 0 };
      }

      const precipitation = minuteIndexes.reduce((sum, index) => sum + (minutelyPrecip[index] ?? 0), 0);
      const rainyWindMinutes = rainyIndexes.filter((index) => (
        (minutelyWind[index] ?? 0) >= RAINY_WIND_SPEED_KMH
      )).length * MINUTELY_INTERVAL_MINUTES;
      const effectivePrecipitation = precipitation >= MIN_PRECIPITATION_MM_FOR_PENALTY ? precipitation : 0;

      return {
        precipitation: effectivePrecipitation,
        rainHours: effectivePrecipitation > 0 ? rainMinutes / 60 : 0,
        rainMinutes: effectivePrecipitation > 0 ? rainMinutes : 0,
        rainyWindMinutes: effectivePrecipitation > 0 ? rainyWindMinutes : 0,
      };
    }

    const rainHours = args.hourlyPrecip.filter((value: number) => value >= RAIN_INTERVAL_MM).length;
    const rainMinutes = rainHours * 60;
    const rainyWindMinutes = args.hourlyPrecip.filter((value: number, index: number) => (
      value >= RAIN_INTERVAL_MM && (args.hourlyWind[index] ?? 0) >= RAINY_WIND_SPEED_KMH
    )).length * 60;

    if (rainMinutes < MIN_RAIN_MINUTES_FOR_PENALTY) {
      return { precipitation: 0, rainHours: 0, rainMinutes: 0, rainyWindMinutes: 0 };
    }

    const precipitation = args.dailyPrecipitation ?? args.currentPrecipitation ?? 0;
    const effectivePrecipitation = precipitation >= MIN_PRECIPITATION_MM_FOR_PENALTY ? precipitation : 0;

    return {
      precipitation: effectivePrecipitation,
      rainHours: effectivePrecipitation > 0 ? rainHours : 0,
      rainMinutes: effectivePrecipitation > 0 ? rainMinutes : 0,
      rainyWindMinutes: effectivePrecipitation > 0 ? rainyWindMinutes : 0,
    };
  }

  function getFeedingSlots(args: {
    sunrise: string;
    sunset: string;
    hourlyPrecip: number[];
    hourlyWind: number[];
  }): string[] {
    const sunriseHour = new Date(args.sunrise).getHours();
    const sunsetHour = new Date(args.sunset).getHours();
    const slots = [
      { start: 6, end: 10 },
      { start: 10, end: 14 },
      { start: 14, end: 18 },
      { start: 18, end: 30 },
    ];

    return slots.map((slot) => {
      const hours = Array.from({ length: slot.end - slot.start }, (_, index) => (slot.start + index) % 24);
      const rainHours = hours.filter((hour) => (args.hourlyPrecip[hour] ?? 0) >= 0.1).length;
      const maxWind = Math.max(...hours.map((hour) => args.hourlyWind[hour] ?? 0));
      const overlapsSunrise = slot.start < sunriseHour + 2 && slot.end > sunriseHour - 1;
      const overlapsSunset = slot.start < sunsetHour + 1 && slot.end > sunsetHour - 3;

      let score = 35;
      if (overlapsSunrise || overlapsSunset) score += 35;
      if (slot.start >= 8 && slot.end <= 16) score -= 10;
      if (rainHours > 2) score -= 45;
      else if (rainHours > 0) score -= 18;
      if (maxWind >= VERY_HARD_WIND_KMH) score -= 28;
      else if (maxWind >= HARD_WIND_KMH) score -= 18;
      else if (maxWind > STRONG_WIND_KMH) score -= 8;

      const label = score >= 70 ? "excelent" : score >= 50 ? "bun" : score >= 30 ? "slab" : "evita";
      const start = String(slot.start).padStart(2, "0");
      const end = String(slot.end % 24).padStart(2, "0");
      return `${start}:00-${end}:00 · ${label}`;
    });
  }

  // ── Fetch lakes ────────────────────────────────────────────────────────────
  let lakesQuery = supabase
    .from(tables.lakes)
    .select("*")
    .order("name", { ascending: true });

  if (lakeId) {
    lakesQuery = lakesQuery.eq("id", lakeId);
  }

  if (limit) {
    lakesQuery = lakesQuery.range(offset, offset + limit - 1);
  }

  const { data: lakes, error: lakesError } = await lakesQuery;

  if (lakesError || !lakes?.length) {
    return new Response(JSON.stringify({ success: false, error: "No lakes found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const scoreSettings = await loadScoreSettings();

  const results: { lake: string; days: number; error?: string }[] = [];

  for (const lake of lakes) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lake.lat}` +
        `&longitude=${lake.lon}` +
        `&timezone=auto` +
        `&forecast_days=7` +
        `&current=temperature_2m,pressure_msl,windspeed_10m,cloud_cover,precipitation` +
        `&hourly=temperature_2m,pressure_msl,precipitation,windspeed_10m` +
        `&minutely_15=precipitation,wind_speed_10m` +
        `&daily=sunrise,sunset,windspeed_10m_max,precipitation_sum,cloudcover_mean,temperature_2m_max,temperature_2m_min`;

      const res  = await fetch(url);
      const json = await res.json();

      const current = json.current;
      const daily   = json.daily;
      const hourly  = json.hourly;
      const minutely = json.minutely_15;

      if (!res.ok || !current || !daily?.time?.length || !hourly?.time?.length) {
        throw new Error(`Open-Meteo failed: ${json.reason ?? res.statusText}`);
      }

      // ── Fetch last known pressure & temperature for delta calculation ───────
      const { data: previous } = await supabase
        .from(tables.lakeScores)
        .select("pressure, temperature, calculated_at")
        .eq("lake_id", lake.id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

      const basePressure    = previous?.pressure    ?? current.pressure_msl;
      const baseTemperature = previous?.temperature ?? current.temperature_2m;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await supabase
        .from(tables.lakeScores)
        .delete()
        .eq("lake_id", lake.id)
        .gte("calculated_at", today.toISOString());

      const numDays = daily.time.length;
      let insertedDays = 0;

      for (let d = 0; d < numDays; d++) {
        const dateStr = daily.time[d];

        const noonIdx  = d * 24 + 12;
        const pressure = hourly.pressure_msl[noonIdx]   ?? current.pressure_msl;
        const temp     = hourly.temperature_2m[noonIdx] ?? current.temperature_2m;

        const dayStartIdx = d * 24;
        const dayEndIdx = dayStartIdx + 24;
        const hourlyPrecip = (hourly.precipitation ?? []).slice(dayStartIdx, dayEndIdx);
        const hourlyWind = (hourly.windspeed_10m ?? []).slice(dayStartIdx, dayEndIdx);
        const rainMetrics = getRainMetricsForDay({
          dateStr,
          minutely,
          hourlyPrecip,
          hourlyWind,
          dailyPrecipitation: daily.precipitation_sum[d],
          currentPrecipitation: current.precipitation,
        });
        const effectiveHourlyPrecip = rainMetrics.precipitation > 0 ? hourlyPrecip : hourlyPrecip.map(() => 0);

        const windSpeed  = d === 0
          ? Math.max(current.windspeed_10m ?? 0, daily.windspeed_10m_max[d] ?? 0)
          : daily.windspeed_10m_max[d];
        const cloudCover = d === 0 ? current.cloud_cover   : daily.cloudcover_mean[d];

        let pressureDelta: number;
        let tempDelta: number;

        if (d === 0) {
          pressureDelta = pressure - basePressure;
          tempDelta     = temp     - baseTemperature;
        } else {
          const prevNoonIdx = (d - 1) * 24 + 12;
          pressureDelta = pressure - (hourly.pressure_msl[prevNoonIdx]   ?? pressure);
          tempDelta     = temp     - (hourly.temperature_2m[prevNoonIdx] ?? temp);
        }

        const score = calculateCarpScore({
          pressure,
          pressureDelta,
          wind_speed:       windSpeed,
          temperature:      temp,
          temperatureDelta: tempDelta,
          cloud_cover:      cloudCover,
          precipitation:    rainMetrics.precipitation,
          rainMinutes:      rainMetrics.rainMinutes,
          rainyWindMinutes: rainMetrics.rainyWindMinutes,
        }, scoreSettings);

        const feedingWindows = getFeedingSlots({
          sunrise: daily.sunrise[d],
          sunset: daily.sunset[d],
          hourlyPrecip: effectiveHourlyPrecip,
          hourlyWind,
        });
        const calculatedAt   = `${dateStr}T12:00:00.000Z`;

        const scorePayload = {
          lake_id:           lake.id,
          score,
          pressure,
          pressure_delta:    pressureDelta,
          wind_speed:        windSpeed,
          temperature:       temp,
          temperature_delta: tempDelta,
          precipitation:     Number(rainMetrics.precipitation.toFixed(1)),
          rain_hours:        rainMetrics.rainHours,
          feeding_windows:   feedingWindows,
          calculated_at:     calculatedAt,
        };

        const { error: insertError } = await supabase
          .from(tables.lakeScores)
          .insert(scorePayload);

        if (insertError) {
          const { precipitation, rain_hours, ...fallbackScorePayload } = scorePayload;
          const { error: fallbackInsertError } = await supabase
            .from(tables.lakeScores)
            .insert(fallbackScorePayload);

          if (fallbackInsertError) {
            throw fallbackInsertError;
          }
        }

        insertedDays++;
      }

      results.push({ lake: lake.name, days: insertedDays });

    } catch (err) {
      results.push({ lake: lake.name, days: 0, error: errorMessage(err) });
    }
  }

  const syncedDev: { lakes: number; scores: number } | null = null;
  const syncDevError: string | null = null;

  return new Response(
    JSON.stringify({ success: true, mode, lakeId, limit, offset, processed: results.length, results, syncedDev, syncDevError }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
