alter table if exists public.dev_lakes
  add column if not exists website_url text,
  add column if not exists facebook_url text,
  add column if not exists phone text;

alter table if exists public.dev_lake_scores
  add column if not exists precipitation numeric,
  add column if not exists rain_hours integer default 0;

create or replace view public.dev_latest_lake_scores as
select distinct on (s.lake_id)
  s.id,
  s.lake_id,
  s.score,
  s.pressure,
  s.pressure_delta,
  s.wind_speed,
  s.temperature,
  s.temperature_delta,
  s.feeding_windows,
  s.calculated_at,
  l.name,
  l.county,
  l.distance_km,
  l.lat,
  l.lon,
  s.precipitation,
  s.rain_hours,
  l.website_url,
  l.facebook_url,
  l.phone
from public.dev_lake_scores s
join public.dev_lakes l on l.id = s.lake_id
where s.calculated_at >= date_trunc('day', now())
  and s.calculated_at < date_trunc('day', now()) + interval '1 day'
order by s.lake_id, s.calculated_at desc;
