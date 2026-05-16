-- Keep dev_lakes 1:1 with production lakes for realistic dev testing.
-- This copies public lake metadata only, not score history or subscriptions.

insert into dev_lakes (
  id,
  name,
  county,
  distance_km,
  lat,
  lon,
  lake_type,
  description,
  website_url,
  facebook_url,
  created_at
)
select
  id,
  'Dev ' || regexp_replace(name, '^Dev\s+', ''),
  county,
  distance_km,
  lat,
  lon,
  lake_type,
  description,
  website_url,
  facebook_url,
  coalesce(created_at, now())
from lakes
on conflict (id) do update set
  name = excluded.name,
  county = excluded.county,
  distance_km = excluded.distance_km,
  lat = excluded.lat,
  lon = excluded.lon,
  lake_type = excluded.lake_type,
  description = excluded.description,
  website_url = excluded.website_url,
  facebook_url = excluded.facebook_url;

-- Remove dev lakes that no longer exist in production so the sets stay 1:1.
delete from dev_lakes d
where not exists (
  select 1
  from lakes l
  where l.id = d.id
);

-- Ensure each dev lake has a safe current dev score row before the weather job runs.
insert into dev_lake_scores (
  lake_id,
  score,
  pressure,
  pressure_delta,
  wind_speed,
  temperature,
  temperature_delta,
  feeding_windows,
  calculated_at
)
select
  d.id,
  55 + ((abs(hashtext(d.id::text)) % 31))::numeric,
  1006 + ((abs(hashtext(d.name)) % 90)::numeric / 10),
  -1 + ((abs(hashtext(d.county)) % 20)::numeric / 10),
  5 + ((abs(hashtext(d.name || d.county)) % 140)::numeric / 10),
  15 + ((abs(hashtext(d.id::text || d.name)) % 90)::numeric / 10),
  -0.5 + ((abs(hashtext(d.name || d.id::text)) % 20)::numeric / 10),
  array['5:00-9:00', '17:00-21:00'],
  date_trunc('day', now()) + interval '12 hours'
from dev_lakes d
where not exists (
  select 1
  from dev_lake_scores s
  where s.lake_id = d.id
    and s.calculated_at >= date_trunc('day', now())
    and s.calculated_at < date_trunc('day', now()) + interval '1 day'
);
