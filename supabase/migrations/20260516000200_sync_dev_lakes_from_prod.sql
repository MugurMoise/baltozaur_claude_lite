-- Keep dev_lakes 1:1 with production lakes for realistic dev testing.
-- This copies public lake metadata only, not score history or subscriptions.

do $$
declare
  has_lake_type boolean;
  has_description boolean;
  has_website_url boolean;
  has_facebook_url boolean;
  has_created_at boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lakes' and column_name = 'lake_type'
  ) into has_lake_type;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lakes' and column_name = 'description'
  ) into has_description;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lakes' and column_name = 'website_url'
  ) into has_website_url;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lakes' and column_name = 'facebook_url'
  ) into has_facebook_url;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lakes' and column_name = 'created_at'
  ) into has_created_at;

  execute format(
    $sql$
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
      coalesce(county, 'Necunoscut'),
      coalesce(distance_km, 0),
      coalesce(lat, 44.4268),
      coalesce(lon, 26.1025),
      %s,
      %s,
      %s,
      %s,
      %s
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
      facebook_url = excluded.facebook_url
    $sql$,
    case when has_lake_type then 'lake_type' else '''commercial''::text' end,
    case when has_description then 'description' else 'null::text' end,
    case when has_website_url then 'website_url' else 'null::text' end,
    case when has_facebook_url then 'facebook_url' else 'null::text' end,
    case when has_created_at then 'coalesce(created_at, now())' else 'now()' end
  );
end $$;

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
