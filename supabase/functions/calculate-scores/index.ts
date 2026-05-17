import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing Supabase service role key" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey
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

  function errorMessage(err: unknown) {
    if (err instanceof Error) return err.message;

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

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
        phone: lake.phone ?? null,
        created_at: lake.created_at ?? new Date().toISOString(),
      }));

      const { error: lakesUpsertError } = await supabase
        .from("dev_lakes")
        .upsert(devLakesToUpsert, { onConflict: "id" });

      if (lakesUpsertError) {
        const fallbackLakes = devLakesToUpsert.map(({ phone, ...lake }) => lake);
        const { error: fallbackLakesUpsertError } = await supabase
          .from("dev_lakes")
          .upsert(fallbackLakes, { onConflict: "id" });

        if (fallbackLakesUpsertError) {
          throw fallbackLakesUpsertError;
        }
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

    let { data: prodScores, error: prodScoresError } = await supabase
      .from("lake_scores")
      .select("lake_id, score, pressure, pressure_delta, wind_speed, temperature, temperature_delta, feeding_windows, calculated_at, precipitation, rain_hours")
      .gte("calculated_at", today.toISOString());

    if (prodScoresError) {
      const fallback = await supabase
        .from("lake_scores")
        .select("lake_id, score, pressure, pressure_delta, wind_speed, temperature, temperature_delta, feeding_windows, calculated_at")
        .gte("calculated_at", today.toISOString());

      prodScores = fallback.data?.map((score) => ({
        ...score,
        precipitation: null,
        rain_hours: 0,
      })) ?? null;
      prodScoresError = fallback.error;
    }

    if (prodScoresError) {
      throw prodScoresError;
    }

    const devScoresToInsert = (prodScores ?? []).filter((score) => prodLakeIds.has(score.lake_id));

    if (devScoresToInsert.length) {
      const { error: insertScoresError } = await supabase
        .from("dev_lake_scores")
        .insert(devScoresToInsert);

      if (insertScoresError) {
        const fallbackScores = devScoresToInsert.map(({ precipitation, rain_hours, ...score }) => score);
        const { error: fallbackInsertScoresError } = await supabase
          .from("dev_lake_scores")
          .insert(fallbackScores);

        if (fallbackInsertScoresError) {
          throw fallbackInsertScoresError;
        }
      }
    }

    return {
      lakes: prodLakes?.length ?? 0,
      scores: devScoresToInsert.length,
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
        JSON.stringify({ success: false, mode, mirroredFromProd: true, error: errorMessage(err) }),
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
    rainHours: number;
    rainyWindHours: number;
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

    if (weather.rainyWindHours > 0) score -= 70;
    else if (weather.rainHours > 2) score -= 50;
    else if (weather.precipitation > 0) score -= 16;

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
        `&hourly=temperature_2m,pressure_msl,precipitation,windspeed_10m` +
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

        const dayStartIdx = d * 24;
        const dayEndIdx = dayStartIdx + 24;
        const hourlyPrecip = (hourly.precipitation ?? []).slice(dayStartIdx, dayEndIdx);
        const hourlyWind = (hourly.windspeed_10m ?? []).slice(dayStartIdx, dayEndIdx);
        const rainHours = hourlyPrecip.filter((value: number) => value >= 0.1).length;
        const rainyWindHours = hourlyPrecip.filter((value: number, index: number) => (
          value >= 0.1 && (hourlyWind[index] ?? 0) >= 20
        )).length;

        const windSpeed  = d === 0 ? current.windspeed_10m : daily.windspeed_10m_max[d];
        const cloudCover = d === 0 ? current.cloud_cover   : daily.cloudcover_mean[d];
        const precip     = daily.precipitation_sum[d] ?? current.precipitation ?? 0;

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
          rainHours,
          rainyWindHours,
        });

        const feedingWindows = getBestFeedingWindows(daily.sunrise[d], daily.sunset[d]);
        const calculatedAt   = `${dateStr}T12:00:00.000Z`;

        const scorePayload = {
          lake_id:           lake.id,
          score,
          pressure,
          pressure_delta:    pressureDelta,
          wind_speed:        windSpeed,
          temperature:       temp,
          temperature_delta: tempDelta,
          precipitation:     precip,
          rain_hours:        rainHours,
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

  let syncedDev: { lakes: number; scores: number } | null = null;
  let syncDevError: string | null = null;
  try {
    syncedDev = await syncDevFromProd();
  } catch (err) {
    syncDevError = errorMessage(err);
  }

  return new Response(
    JSON.stringify({ success: true, mode, limit, offset, processed: results.length, results, syncedDev, syncDevError }),
    { headers: { "Content-Type": "application/json" } }
  );
});
