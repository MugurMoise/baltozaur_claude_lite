-- Add international area fields for dev while keeping Romanian county behaviour intact.
-- Production table changes should be promoted through main/prod validation.

alter table if exists public.dev_lakes
  add column if not exists country text default 'RO',
  add column if not exists region text;

update public.dev_lakes
set
  country = coalesce(nullif(country, ''), 'RO'),
  region = coalesce(nullif(region, ''), county)
where country is null
   or country = ''
   or region is null
   or region = '';

create index if not exists dev_lakes_country_region_idx
  on public.dev_lakes (country, region);

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
  l.country,
  l.region,
  l.distance_km,
  l.lat,
  l.lon,
  s.precipitation,
  s.rain_hours,
  l.website_url,
  l.facebook_url,
  l.phone,
  l.description,
  l.rules,
  l.price
from public.dev_lake_scores s
join public.dev_lakes l on l.id = s.lake_id
where s.calculated_at >= date_trunc('day', now())
  and s.calculated_at < date_trunc('day', now()) + interval '1 day'
order by s.lake_id, s.calculated_at desc;
