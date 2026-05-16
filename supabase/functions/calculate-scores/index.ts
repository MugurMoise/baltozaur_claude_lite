import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );
  const url = new URL(req.url);
  const mode = url.searchParams.get("env") ?? "prod";
  const limitParam = Number(url.searchParams.get("limit") ?? "0");
  const offsetParam = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), 10)
    : null;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0
    ? Math.floor(offsetParam)
    : 0;
  const tablePrefix = mode === "dev" ? "dev_" : "";
  const tables = {
    lakes: `${tablePrefix}lakes`,
    lakeScores: `${tablePrefix}lake_scores`,
  };

  async function syncDevFromProd() {
    const { data: prodLakes, error: prodLakesError } = await supabase
      .from("lakes")
      .select("*");

    if (prodLakesError) {
      throw prodLakesError;
    }

    const prodLakeIds = new Set((prodLakes ?? []).map((lake) => lake.id));
    const { data: devLakes, error: devLakesError } = await supabase
      .from("dev_lakes")
      .select("id");

    if (devLakesError) {
      throw devLakesError;
    }

    const staleDevLakeIds = (devLakes ?? [])
      .map((lake) => lake.id)
      .filter((id) => !prodLakeIds.has(id));

    if (staleDevLakeIds.length) {
      const { error: staleDeleteError } = await supabase
        .from("dev_lakes")
        .delete()
        .in("id", staleDevLakeIds);

      if (staleDeleteError) {
        throw staleDeleteError;
      }
    }

    if (prodLakes?.length) {
      const devLakesToUpsert = prodLakes.map((lake) => ({
        id: lake.id,
        name: lake.name,
        county: lake.county ?? "Necunoscut",
        distance_km: lake.distance_km ?? 0,
        lat: lake.lat ?? 44.4268,
        lon: lake.lon ?? 26.1025,
        lake_type: lake.lake_type ?? "commercial",
        description: lake.description ?? null,
        website_url: lake.website_url ?? null,
        facebook_url: lake.facebook_url ?? null,
        created_at: lake.created_at ?? new Date().toISOString(),
      }));

      const { error: lakesUpsertError } = await supabase
        .from("dev_lakes")
        .upsert(devLakesToUpsert, { onConflict: "id" });

      if (lakesUpsertError) {
        throw lakesUpsertError;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { error: deleteScoresError } = await supabase
      .from("dev_lake_scores")
      .delete()
      .gte("calculated_at", today.toISOString());

    if (deleteScoresError) {
      throw deleteScoresError;
    }

    const { data: prodScores, error: prodScoresError } = await supabase
      .from("lake_scores")
      .select("lake_id, score, pressure, pressure_delta, wind_speed, temperature, temperature_delta, feeding_windows, calculated_at")
      .gte("calculated_at", today.toISOString());

    if (prodScoresError) {
      throw prodScoresError;
    }

    if (prodScores?.length) {
      const { error: insertScoresError } = await supabase
        .from("dev_lake_scores")
        .insert(prodScores);

      if (insertScoresError) {
        throw insertScoresError;
      }
    }

    return {
      lakes: prodLakes?.length ?? 0,
      scores: prodScores?.length ?? 0,
    };
  }

  if (mode === "dev") {
    try {
      const synced = await syncDevFromProd();
      return new Response(
        JSON.stringify({ success: true, mode, mirroredFromProd: true, synced }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, mode, mirroredFromProd: true, error: String(err) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  function calculateCarpScore(weather: {
    pressure: number;
    pressureDelta: number;
    wind_speed: number;
    temperature: number;
    temperatureDelta: number;
    cloud_cover: number;
    precipitation: number;
  }) {
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

    if (weather.wind_speed >= 4 && weather.wind_speed <= 18) score += 12;
    else if (weather.wind_speed > 18 && weather.wind_speed <= 25) score += 5;
    else if (weather.wind_speed < 4) score += 2;
    else if (weather.wind_speed > 30) score -= 18;

    if (weather.cloud_cover >= 30 && weather.cloud_cover <= 90) score += 8;
    else if (weather.cloud_cover < 15) score -= 5;

    if (weather.temperatureDelta > 0.5 && weather.temperatureDelta <= 4) score += 6;
    else if (weather.temperatureDelta < -3) score -= 8;

    if (weather.precipitation > 0 && weather.precipitation <= 2) score += 4;
    else if (weather.precipitation > 5) score -= 14;

    return Math.max(0, Math.min(Math.round(score), 100));
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
  let lakesQuery = supabase
    .from(tables.lakes)
    .select("*")
    .order("name", { ascending: true });

  if (limit) {
    lakesQuery = lakesQuery.range(offset, offset + limit - 1);
  }

  const { data: lakes, error: lakesError } = await lakesQuery;

  if (lakesError || !lakes?.length) {
    return new Response(JSON.stringify({ success: false, error: "No lakes found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

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
        `&hourly=temperature_2m,pressure_msl` +
        `&daily=sunrise,sunset,windspeed_10m_max,precipitation_sum,cloudcover_mean,temperature_2m_max,temperature_2m_min`;

      const res  = await fetch(url);
      const json = await res.json();

      const current = json.current;
      const daily   = json.daily;
      const hourly  = json.hourly;

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

        const windSpeed  = d === 0 ? current.windspeed_10m : daily.windspeed_10m_max[d];
        const cloudCover = d === 0 ? current.cloud_cover   : daily.cloudcover_mean[d];
        const precip     = d === 0 ? current.precipitation : daily.precipitation_sum[d];

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

        const feedingWindows = getBestFeedingWindows(daily.sunrise[d], daily.sunset[d]);
        const calculatedAt   = `${dateStr}T12:00:00.000Z`;

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

  let syncedDev: { lakes: number; scores: number } | null = null;
  let syncDevError: string | null = null;
  try {
    syncedDev = await syncDevFromProd();
  } catch (err) {
    syncDevError = String(err);
  }

  return new Response(
    JSON.stringify({ success: true, mode, limit, offset, processed: results.length, results, syncedDev, syncDevError }),
    { headers: { "Content-Type": "application/json" } }
  );
});
