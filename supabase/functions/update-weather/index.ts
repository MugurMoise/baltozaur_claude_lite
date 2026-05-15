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

  const { data: lakes } = await supabase.from("lakes").select("*");

  for (const lake of lakes || []) {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lake.lat}` +
      `&longitude=${lake.lon}` +
      `&timezone=auto` +
      `&daily=sunrise,sunset` +
      `&current=temperature_2m,pressure_msl,windspeed_10m,cloud_cover,precipitation`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherJson     = await weatherResponse.json();
    const current         = weatherJson.current;
    const sunrise         = weatherJson.daily.sunrise[0];
    const sunset          = weatherJson.daily.sunset[0];

    const feedingWindows = getBestFeedingWindows(sunrise, sunset);

    const { data: previous } = await supabase
      .from("lake_scores")
      .select("pressure, temperature")
      .eq("lake_id", lake.id)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .single();

    const previousPressure    = previous?.pressure    ?? current.pressure_msl;
    const previousTemperature = previous?.temperature ?? current.temperature_2m;

    const pressureDelta    = current.pressure_msl   - previousPressure;
    const temperatureDelta = current.temperature_2m - previousTemperature;

    const score = calculateCarpScore({
      pressure:         current.pressure_msl,
      pressureDelta,
      wind_speed:       current.windspeed_10m,
      temperature:      current.temperature_2m,
      temperatureDelta,
      cloud_cover:      current.cloud_cover,
      precipitation:    current.precipitation,
    });

    await supabase.from("lake_scores").insert({
      lake_id:           lake.id,
      score,
      pressure:          current.pressure_msl,
      pressure_delta:    pressureDelta,
      wind_speed:        current.windspeed_10m,
      temperature:       current.temperature_2m,
      temperature_delta: temperatureDelta,
      feeding_windows:   feedingWindows,
      calculated_at:     new Date().toISOString(),
    });
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
