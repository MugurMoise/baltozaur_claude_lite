-- Dev tables for testing inside the same Supabase project.
-- Production tables keep their existing names. Dev uses the dev_* prefix.

create table if not exists dev_lakes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  county       text not null,
  distance_km  numeric not null default 0,
  lat          double precision not null,
  lon          double precision not null,
  lake_type    text default 'commercial',
  description  text,
  website_url  text,
  facebook_url text,
  created_at   timestamptz default now()
);

create table if not exists dev_lake_scores (
  id                uuid primary key default gen_random_uuid(),
  lake_id           uuid not null references dev_lakes(id) on delete cascade,
  score             numeric not null,
  pressure          numeric not null,
  pressure_delta    numeric,
  wind_speed        numeric not null,
  temperature       numeric not null,
  temperature_delta numeric,
  feeding_windows   text[],
  calculated_at     timestamptz not null default now()
);

create index if not exists dev_lake_scores_lake_id_idx
  on dev_lake_scores (lake_id);

create index if not exists dev_lake_scores_calculated_at_idx
  on dev_lake_scores (calculated_at);

create or replace view dev_latest_lake_scores as
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
  l.lon
from dev_lake_scores s
join dev_lakes l on l.id = s.lake_id
where s.calculated_at >= date_trunc('day', now())
  and s.calculated_at < date_trunc('day', now()) + interval '1 day'
order by s.lake_id, s.calculated_at desc;

create table if not exists dev_push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  counties        text[] default '{}',
  max_distance_km integer default null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists dev_push_subscriptions_endpoint_idx
  on dev_push_subscriptions (endpoint);

alter table dev_lakes enable row level security;
alter table dev_lake_scores enable row level security;
alter table dev_push_subscriptions enable row level security;

drop policy if exists "Public dev lake read" on dev_lakes;
create policy "Public dev lake read"
  on dev_lakes for select
  using (true);

drop policy if exists "Public dev lake insert" on dev_lakes;
create policy "Public dev lake insert"
  on dev_lakes for insert
  with check (true);

drop policy if exists "Public dev score read" on dev_lake_scores;
create policy "Public dev score read"
  on dev_lake_scores for select
  using (true);

drop policy if exists "Public dev subscription management" on dev_push_subscriptions;
create policy "Public dev subscription management"
  on dev_push_subscriptions for all
  using (true)
  with check (true);

insert into dev_lakes (id, name, county, distance_km, lat, lon, lake_type, description)
values
  ('00000000-0000-4000-8000-000000000001', 'Dev Varlaam Lake', 'Giurgiu', 45, 44.318, 25.986, 'commercial', 'Dev seed lake'),
  ('00000000-0000-4000-8000-000000000002', 'Dev Hermes Peris', 'Ilfov', 35, 44.684, 26.016, 'commercial', 'Dev seed lake'),
  ('00000000-0000-4000-8000-000000000003', 'Dev Delta Gruiu', 'Ilfov', 42, 44.731, 26.221, 'wild', 'Dev seed lake')
on conflict (id) do update set
  name = excluded.name,
  county = excluded.county,
  distance_km = excluded.distance_km,
  lat = excluded.lat,
  lon = excluded.lon,
  lake_type = excluded.lake_type,
  description = excluded.description;

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
values
  ('00000000-0000-4000-8000-000000000001', 73, 1008.4, -1.2, 11.5, 18.4, 0.6, array['5:00-9:00', '17:00-21:00'], date_trunc('day', now()) + interval '12 hours'),
  ('00000000-0000-4000-8000-000000000002', 66, 1010.2, -0.4, 8.2, 17.9, 0.2, array['5:00-9:00'], date_trunc('day', now()) + interval '12 hours'),
  ('00000000-0000-4000-8000-000000000003', 58, 1013.1, 0.8, 6.4, 16.7, -0.1, array['18:00-21:00'], date_trunc('day', now()) + interval '12 hours'),
  ('00000000-0000-4000-8000-000000000001', 78, 1006.9, -1.5, 12.1, 19.1, 0.7, array['5:00-9:00', '17:00-21:00'], date_trunc('day', now()) + interval '1 day 12 hours'),
  ('00000000-0000-4000-8000-000000000002', 69, 1008.8, -1.4, 9.8, 18.6, 0.7, array['5:00-9:00'], date_trunc('day', now()) + interval '1 day 12 hours'),
  ('00000000-0000-4000-8000-000000000003', 61, 1011.7, -1.4, 7.1, 17.5, 0.8, array['18:00-21:00'], date_trunc('day', now()) + interval '1 day 12 hours');
