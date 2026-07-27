-- Applied previously through main; kept here so dev_ migration history stays aligned.

create table if not exists public.analytics_events (
  id                bigint generated always as identity primary key,
  occurred_at       timestamptz not null default now(),
  app_environment   text not null check (app_environment in ('dev', 'prod')),
  event_name        text not null,
  session_id        uuid not null,
  source            text not null,
  medium            text not null,
  campaign          text,
  referrer_domain   text,
  landing_path      text not null,
  page_path         text not null,
  platform          text not null,
  device_type       text not null,
  language          text,
  metadata          jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_environment_date_idx
  on public.analytics_events (app_environment, occurred_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id);
create index if not exists analytics_events_source_idx
  on public.analytics_events (source);
create index if not exists analytics_events_name_idx
  on public.analytics_events (event_name);

alter table public.analytics_events enable row level security;

revoke all on table public.analytics_events from anon, authenticated;
grant select on table public.analytics_events to authenticated;

drop policy if exists "Admins can read analytics" on public.analytics_events;
create policy "Admins can read analytics"
  on public.analytics_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

create or replace function public.track_analytics_event(
  p_event_name text,
  p_session_id uuid,
  p_app_environment text,
  p_source text,
  p_medium text,
  p_campaign text default null,
  p_referrer_domain text default null,
  p_landing_path text default '/',
  p_page_path text default '/',
  p_platform text default 'web',
  p_device_type text default 'desktop',
  p_language text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_event_name !~ '^[a-z0-9_]{1,64}$'
    or p_app_environment not in ('dev', 'prod')
    or length(p_source) > 80
    or length(p_medium) > 80
    or length(coalesce(p_campaign, '')) > 120
    or length(coalesce(p_referrer_domain, '')) > 120
    or length(p_landing_path) > 160
    or length(p_page_path) > 160
    or length(p_platform) > 32
    or length(p_device_type) > 32
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_metadata, '{}'::jsonb)::text) > 4096
  then
    raise exception 'Invalid analytics event';
  end if;

  if (
    select count(*)
    from public.analytics_events ae
    where ae.session_id = p_session_id
      and ae.occurred_at > now() - interval '1 minute'
  ) >= 60 then
    return;
  end if;

  insert into public.analytics_events (
    app_environment,
    event_name,
    session_id,
    source,
    medium,
    campaign,
    referrer_domain,
    landing_path,
    page_path,
    platform,
    device_type,
    language,
    metadata
  ) values (
    p_app_environment,
    p_event_name,
    p_session_id,
    left(p_source, 80),
    left(p_medium, 80),
    nullif(left(coalesce(p_campaign, ''), 120), ''),
    nullif(left(coalesce(p_referrer_domain, ''), 120), ''),
    p_landing_path,
    p_page_path,
    p_platform,
    p_device_type,
    nullif(left(coalesce(p_language, ''), 16), ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.track_analytics_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.track_analytics_event(
  text, uuid, text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;

create or replace function public.get_analytics_summary(
  p_days integer default 30,
  p_environment text default 'prod'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  safe_days integer := greatest(1, least(coalesce(p_days, 30), 90));
begin
  if not exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  if p_environment not in ('dev', 'prod') then
    raise exception 'Invalid environment';
  end if;

  with filtered as (
    select *
    from public.analytics_events
    where app_environment = p_environment
      and occurred_at >= now() - make_interval(days => safe_days)
  ),
  total_values as (
    select
      count(distinct session_id)::integer as sessions,
      count(*) filter (where event_name = 'page_view')::integer as page_views,
      count(*)::integer as events,
      count(distinct session_id) filter (where event_name <> 'page_view')::integer as engaged_sessions
    from filtered
  ),
  source_values as (
    select
      source as name,
      count(distinct session_id)::integer as sessions,
      count(*) filter (where event_name = 'page_view')::integer as page_views,
      count(*)::integer as events
    from filtered
    group by source
    order by sessions desc, events desc
    limit 12
  ),
  platform_values as (
    select
      platform as name,
      count(distinct session_id)::integer as sessions,
      count(*) filter (where event_name = 'page_view')::integer as page_views,
      count(*)::integer as events
    from filtered
    group by platform
    order by sessions desc
  ),
  event_values as (
    select event_name as name, count(*)::integer as events
    from filtered
    where event_name <> 'page_view'
    group by event_name
    order by events desc
    limit 12
  ),
  campaign_values as (
    select
      campaign as name,
      count(distinct session_id)::integer as sessions,
      count(*)::integer as events
    from filtered
    where campaign is not null
    group by campaign
    order by sessions desc, events desc
    limit 12
  ),
  lake_values as (
    select
      metadata->>'lake_name' as name,
      count(*)::integer as events
    from filtered
    where event_name in (
      'lake_details_opened',
      'shared_lake_opened',
      'navigation_clicked',
      'share_link_copied',
      'website_clicked',
      'phone_clicked'
    )
      and nullif(metadata->>'lake_name', '') is not null
    group by metadata->>'lake_name'
    order by events desc
    limit 12
  ),
  day_series as (
    select generate_series(
      current_date - (safe_days - 1),
      current_date,
      interval '1 day'
    )::date as day
  ),
  daily_values as (
    select
      day_series.day,
      count(distinct filtered.session_id)::integer as sessions,
      count(*) filter (where filtered.event_name = 'page_view')::integer as page_views,
      count(filtered.id)::integer as events
    from day_series
    left join filtered on filtered.occurred_at >= day_series.day
      and filtered.occurred_at < day_series.day + interval '1 day'
    group by day_series.day
    order by day_series.day
  )
  select jsonb_build_object(
    'totals', (select to_jsonb(total_values) from total_values),
    'sources', coalesce((select jsonb_agg(to_jsonb(source_values)) from source_values), '[]'::jsonb),
    'platforms', coalesce((select jsonb_agg(to_jsonb(platform_values)) from platform_values), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(event_values)) from event_values), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(to_jsonb(campaign_values)) from campaign_values), '[]'::jsonb),
    'top_lakes', coalesce((select jsonb_agg(to_jsonb(lake_values)) from lake_values), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily_values)) from daily_values), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_analytics_summary(integer, text) from public;
grant execute on function public.get_analytics_summary(integer, text) to authenticated;
