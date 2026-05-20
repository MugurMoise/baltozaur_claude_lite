-- Add international area fields for production lakes.
-- Existing Romanian lakes keep the current county behaviour via region = county.

alter table if exists public.lakes
  add column if not exists country text default 'RO',
  add column if not exists region text;

update public.lakes
set
  country = coalesce(nullif(country, ''), 'RO'),
  region = coalesce(nullif(region, ''), county)
where country is null
   or country = ''
   or region is null
   or region = '';

create index if not exists lakes_country_region_idx
  on public.lakes (country, region);
