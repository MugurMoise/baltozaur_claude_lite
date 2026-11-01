-- The hosting layer resolves the request IP. Keep only its coarse result; never
-- persist the IP address, precise coordinates, ISP, or user-agent fingerprint.
alter table public.analytics_activity_log
  add column if not exists country_code text,
  add column if not exists region_code text,
  add column if not exists city text;

alter table public.analytics_activity_log
  drop constraint if exists analytics_activity_log_country_code_check,
  drop constraint if exists analytics_activity_log_region_code_check,
  drop constraint if exists analytics_activity_log_city_check;

alter table public.analytics_activity_log
  add constraint analytics_activity_log_country_code_check check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint analytics_activity_log_region_code_check check (region_code is null or (length(region_code) between 1 and 12 and region_code !~ '[[:cntrl:]]')),
  add constraint analytics_activity_log_city_check check (city is null or (length(city) between 1 and 120 and city !~ '[[:cntrl:]]'));

create index if not exists analytics_activity_log_visitor_occurred_at_idx
  on public.analytics_activity_log (visitor_id, occurred_at desc);

create or replace function public.record_analytics_activity(p_activities jsonb, p_location jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  safe_country text := nullif(upper(trim(coalesce(p_location->>'country', ''))), '');
  safe_region text := nullif(trim(coalesce(p_location->>'region', '')), '');
  safe_city text := nullif(trim(coalesce(p_location->>'city', '')), '');
begin
  if jsonb_typeof(p_activities) <> 'array' or jsonb_array_length(p_activities) < 1 or jsonb_array_length(p_activities) > 40 then raise exception 'Invalid activity batch'; end if;
  if jsonb_typeof(coalesce(p_location, '{}'::jsonb)) <> 'object'
    or (safe_country is not null and safe_country !~ '^[A-Z]{2}$')
    or (safe_region is not null and (length(safe_region) > 12 or safe_region ~ '[[:cntrl:]]'))
    or (safe_city is not null and (length(safe_city) > 120 or safe_city ~ '[[:cntrl:]]')) then raise exception 'Invalid location'; end if;
  if exists (select 1 from jsonb_to_recordset(p_activities) as item(visitor_id text, event_name text, page_path text, details jsonb) where item.visitor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or item.event_name not in ('page_view','lake_details_opened','shared_lake_opened','navigation_clicked','share_link_copied','website_clicked','phone_clicked','search_used','filter_changed','map_opened','location_requested','location_granted','location_denied','data_refreshed','forecast_day_selected','language_changed','list_opened','view_mode_changed') or item.page_path is null or item.page_path !~ '^/' or length(item.page_path) > 200 or item.details is null or jsonb_typeof(item.details) <> 'object') then raise exception 'Invalid activity entry'; end if;
  insert into public.analytics_activity_log (visitor_id, event_name, page_path, details, country_code, region_code, city)
  select item.visitor_id::uuid, item.event_name, item.page_path, item.details, safe_country, safe_region, safe_city
  from jsonb_to_recordset(p_activities) as item(visitor_id text, event_name text, page_path text, details jsonb);
end; $$;

create or replace function public.record_analytics_batch(p_counts jsonb, p_activities jsonb, p_location jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.increment_analytics_counts(p_counts);
  perform public.record_analytics_activity(p_activities, p_location);
end; $$;

-- PostgreSQL cannot change a function's table-return shape in place.
drop function if exists public.get_analytics_activity_log(integer, integer);

create or replace function public.get_analytics_activity_log(p_days integer default 30, p_limit integer default 250)
returns table(occurred_at timestamptz, visitor_id text, name text, page_path text, details jsonb, country_code text, region_code text, city text)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare safe_days integer := greatest(1, least(coalesce(p_days,30),90)); safe_limit integer := greatest(1, least(coalesce(p_limit,250),500));
begin
  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then raise exception 'Admin access required'; end if;
  return query select log.occurred_at, log.visitor_id::text, log.event_name, log.page_path, log.details, log.country_code, log.region_code, log.city from public.analytics_activity_log log where log.occurred_at >= current_date - (safe_days - 1) order by log.occurred_at desc limit safe_limit;
end; $$;

create or replace function public.get_analytics_visitor_profiles(p_days integer default 30, p_limit integer default 100)
returns table(visitor_id text, first_seen timestamptz, last_seen timestamptz, events bigint, page_views bigint, countries text[], regions text[], cities text[], platforms text[], sources text[])
language plpgsql security definer set search_path = pg_catalog, public as $$
declare safe_days integer := greatest(1, least(coalesce(p_days,30),90)); safe_limit integer := greatest(1, least(coalesce(p_limit,100),250));
begin
  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then raise exception 'Admin access required'; end if;
  return query select log.visitor_id::text, min(log.occurred_at), max(log.occurred_at), count(*)::bigint, count(*) filter (where log.event_name='page_view')::bigint, coalesce(array_agg(distinct log.country_code) filter (where log.country_code is not null), '{}'::text[]), coalesce(array_agg(distinct log.region_code) filter (where log.region_code is not null), '{}'::text[]), coalesce(array_agg(distinct log.city) filter (where log.city is not null), '{}'::text[]), coalesce(array_agg(distinct log.details->>'platform') filter (where log.details ? 'platform'), '{}'::text[]), coalesce(array_agg(distinct log.details->>'source') filter (where log.details ? 'source'), '{}'::text[]) from public.analytics_activity_log log where log.occurred_at >= current_date - (safe_days - 1) group by log.visitor_id order by max(log.occurred_at) desc limit safe_limit;
end; $$;

create or replace function public.get_analytics_visitor_activity(p_visitor_id text, p_days integer default 30, p_limit integer default 250)
returns table(occurred_at timestamptz, visitor_id text, name text, page_path text, details jsonb, country_code text, region_code text, city text)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare safe_days integer := greatest(1, least(coalesce(p_days,30),90)); safe_limit integer := greatest(1, least(coalesce(p_limit,250),500));
begin
  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then raise exception 'Admin access required'; end if;
  if p_visitor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid visitor'; end if;
  return query select log.occurred_at, log.visitor_id::text, log.event_name, log.page_path, log.details, log.country_code, log.region_code, log.city from public.analytics_activity_log log where log.visitor_id = p_visitor_id::uuid and log.occurred_at >= current_date - (safe_days - 1) order by log.occurred_at desc limit safe_limit;
end; $$;

revoke all on function public.record_analytics_activity(jsonb, jsonb) from public;
revoke all on function public.record_analytics_batch(jsonb, jsonb, jsonb) from public;
revoke all on function public.get_analytics_visitor_profiles(integer, integer) from public;
revoke all on function public.get_analytics_visitor_activity(text, integer, integer) from public;
grant execute on function public.record_analytics_batch(jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_analytics_visitor_profiles(integer, integer) to authenticated;
grant execute on function public.get_analytics_visitor_activity(text, integer, integer) to authenticated;
