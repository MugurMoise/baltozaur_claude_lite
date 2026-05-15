import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );

  function calculateCarpScore(weather: {
    pressure: number;
    pressureDelta: number;
    wind_speed: number;
    temperature: number;
    temperatureDelta: number;
    cloud_cover: number;
    precipitation: number;
  }) {
    let score = 35;

    if (weather.pressure >= 1008 && weather.pressure <= 1015) score += 8;
    if (weather.pressure < 1005)  score += 12;
    if (weather.pressure > 1020)  score -= 15;

    if (weather.pressureDelta <= -1) score += 10;
    if (weather.pressureDelta <= -3) score += 15;
    if (weather.pressureDelta <= -6) score += 8;
    if (weather.pressureDelta >= 2)  score -= 12;
    if (weather.pressureDelta >= 5)  score -= 20;

    if (weather.temperature >= 17 && weather.temperature <= 23) score += 15;
    if (weather.temperature < 10)  score -= 20;
    if (weather.temperature > 30)  score -= 15;

    if (weather.temperatureDelta > 1)  score += 6;
    if (weather.temperatureDelta > 3)  score += 8;
    if (weather.temperatureDelta < -2) score -= 10;

    if (weather.wind_speed >= 7 && weather.wind_speed <= 18) score += 10;
    if (weather.wind_speed > 30) score -= 20;

    if (weather.cloud_cover >= 40 && weather.cloud_cover <= 85) score += 10;
    if (weather.cloud_cover < 15) score -= 8;

    if (weather.precipitation > 0 && weather.precipitation <= 1.5) score += 6;
    if (weather.precipitation > 4) score -= 15;

    score += Math.floor(Math.random() * 8) - 4;

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

  const { data: lakes, error: lakesError } = await supabase
    .from("lakes")
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

      const { data: previous } = await supabase
        .from("lake_scores")
        .select("pressure, temperature, calculated_at")
        .eq("lake_id", lake.id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

      const basePressure    = previous?.pressure    ?? current.pressure_msl;
      const baseTemperature = previous?.temperature ?? current.temperature_2m;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      await supabase
        .from("lake_scores")
        .delete()
        .eq("lake_id", lake.id)
        .gte("calculated_at", tomorrow.toISOString());

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

        await supabase.from("lake_scores").insert({
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
