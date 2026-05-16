import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );
  const url = new URL(req.url);
  const mode = url.searchParams.get("env") ?? "prod";
  const tablePrefix = mode === "dev" ? "dev_" : "";
  const tables = {
    lakes: `${tablePrefix}lakes`,
    lakeScores: `${tablePrefix}lake_scores`,
  };

  // ── Scoring (unchanged from your original) ─────────────────────────────────
  function calculateCarpScore(weather: {
    pressure: number;
    pressureDelta: number;
    wind_speed: number;
    temperature: number;
    temperatureDelta: number;
    cloud_cover: number;
    precipitation: number;
  }) {
    let score = 50;

    if (weather.pressure < 1010) score += 10;

    if (weather.wind_speed >= 8 && weather.wind_speed <= 20) score += 10;

    if (weather.temperature >= 16 && weather.temperature <= 24) score += 20;

    if (weather.pressureDelta <= -2) score += 15;
    if (weather.pressureDelta <= -5) score += 10;
    if (weather.pressureDelta >= 3)  score -= 15;
    if (weather.pressureDelta >= 6)  score -= 25;

    if (weather.temperatureDelta > 2)  score += 10;
    if (weather.temperatureDelta < -3) score -= 10;

    if (weather.cloud_cover >= 60) score += 10;

    if (weather.precipitation > 0 && weather.precipitation <= 2) score += 5;
    if (weather.precipitation > 5) score -= 15;

    return Math.max(0, Math.min(score, 100));
  }

  function getBestFeedingWindows(sunrise: string, sunset: string): string[] {
    const sunriseHour = new Date(sunrise).getHours();
    const sunsetHour  = new Date(sunset).getHours();
    return [
      `${sunriseHour - 1}:00-${sunriseHour + 3}:00`,
      `${sunsetHour - 3}:00-${sunsetHour + 1}:00`,
    ];
  }

  // ── Fetch lakes ────────────────────────────────────────────────────────────
  const { data: lakes, error: lakesError } = await supabase
    .from(tables.lakes)
    .select("*");

  if (lakesError || !lakes?.length) {
    return new Response(JSON.stringify({ success: false, error: "No lakes found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { lake: string; days: number; error?: string }[] = [];

  for (const lake of lakes) {
    try {
      // ── Open-Meteo: current + 7-day daily forecast ─────────────────────────
      // daily:   one value per calendar day (pressure_msl_mean is not available,
      //          so we use hourly and pick noon values — see below)
      // We request hourly for pressure + temp, and daily for wind/precip/cloud/sun
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lake.lat}` +
        `&longitude=${lake.lon}` +
        `&timezone=auto` +
        `&forecast_days=7` +
        `&current=temperature_2m,pressure_msl,windspeed_10m,cloud_cover,precipitation` +
        `&hourly=temperature_2m,pressure_msl` +
        `&daily=sunrise,sunset,windspeed_10m_max,precipitation_sum,cloudcover_mean,temperature_2m_max,temperature_2m_min`;

      const res  = await fetch(url);
      const json = await res.json();

      const current = json.current;
      const daily   = json.daily;
      const hourly  = json.hourly; // arrays of 168 values (7 days × 24h)

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

      // ── Delete stale forecast rows for this lake (keep today's history) ────
      // We only delete rows whose calculated_at date is >= tomorrow,
      // so historical snapshots are preserved.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      await supabase
        .from(tables.lakeScores)
        .delete()
        .eq("lake_id", lake.id)
        .gte("calculated_at", tomorrow.toISOString());

      // ── Insert one row per forecast day ────────────────────────────────────
      const numDays = daily.time.length; // typically 7
      let insertedDays = 0;

      for (let d = 0; d < numDays; d++) {
        const dateStr = daily.time[d]; // e.g. "2026-05-14"

        // Pick the noon hourly index for this day (d*24 + 12)
        const noonIdx   = d * 24 + 12;
        const pressure  = hourly.pressure_msl[noonIdx]    ?? current.pressure_msl;
        const temp      = hourly.temperature_2m[noonIdx]  ?? current.temperature_2m;

        // For day 0 use actual current values; for future days use daily aggregates
        const windSpeed   = d === 0 ? current.windspeed_10m  : daily.windspeed_10m_max[d];
        const cloudCover  = d === 0 ? current.cloud_cover    : daily.cloudcover_mean[d];
        const precip      = d === 0 ? current.precipitation  : daily.precipitation_sum[d];

        // Delta: day 0 vs previous DB reading; day N vs day N-1 noon value
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
          precipitation:    precip,
        });

        const feedingWindows = getBestFeedingWindows(
          daily.sunrise[d],
          daily.sunset[d]
        );

        // Set calculated_at to noon on the forecast date so date filtering works cleanly
        const calculatedAt = `${dateStr}T12:00:00.000Z`;

        await supabase.from(tables.lakeScores).insert({
          lake_id:           lake.id,
          score,
          pressure,
          pressure_delta:    pressureDelta,
          wind_speed:        windSpeed,
          temperature:       temp,
          temperature_delta: tempDelta,
          feeding_windows:   feedingWindows,
          calculated_at:     calculatedAt,
        });

        insertedDays++;
      }

      results.push({ lake: lake.name, days: insertedDays });

    } catch (err) {
      results.push({ lake: lake.name, days: 0, error: String(err) });
    }
  }

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
