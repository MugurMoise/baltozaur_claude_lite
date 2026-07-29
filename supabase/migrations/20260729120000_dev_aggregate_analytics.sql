create table if not exists public.dev_analytics_daily_counts (
  day          date not null default current_date,
  metric       text not null,
  bucket       text not null,
  event_count  bigint not null default 0 check (event_count >= 0),
  primary key (day, metric, bucket)
);

create index if not exists dev_analytics_daily_counts_metric_day_idx
  on public.dev_analytics_daily_counts (metric, day desc);

alter table public.dev_analytics_daily_counts enable row level security;

revoke all on table public.dev_analytics_daily_counts from anon, authenticated;
grant select on table public.dev_analytics_daily_counts to authenticated;

drop policy if exists "Admins can read dev aggregate analytics"
  on public.dev_analytics_daily_counts;
create policy "Admins can read dev aggregate analytics"
  on public.dev_analytics_daily_counts for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

create or replace function public.increment_dev_analytics_counts(p_counts jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if jsonb_typeof(p_counts) <> 'array' then
    raise exception 'Invalid analytics batch';
  end if;

  if jsonb_array_length(p_counts) < 1 or jsonb_array_length(p_counts) > 48 then
    raise exception 'Invalid analytics batch size';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_counts) as item(metric text, bucket text, count integer)
    where item.metric not in ('page_view', 'source', 'platform', 'country', 'action', 'lake_interest')
      or item.bucket is null
      or length(item.bucket) < 1
      or length(item.bucket) > 120
      or item.bucket ~ '[[:cntrl:]]'
      or item.count is null
      or item.count < 1
      or item.count > 1000
      or (item.metric = 'page_view' and item.bucket <> 'all')
      or (item.metric = 'source' and item.bucket not in (
        'direct', 'tiktok', 'facebook', 'instagram', 'google', 'youtube', 'bing', 'other'
      ))
      or (item.metric = 'platform' and item.bucket not in ('web', 'ios_app', 'android_app'))
      or (item.metric = 'country' and item.bucket !~ '^[A-Z]{2}$')
      or (item.metric = 'action' and item.bucket not in (
        'lake_details_opened',
        'shared_lake_opened',
        'navigation_clicked',
        'share_link_copied',
        'website_clicked',
        'phone_clicked',
        'search_used',
        'filter_changed',
        'map_opened',
        'location_requested',
        'location_granted',
        'location_denied',
        'data_refreshed',
        'forecast_day_selected',
        'language_changed',
        'list_opened',
        'view_mode_changed'
      ))
  ) then
    raise exception 'Invalid analytics counter';
  end if;

  insert into public.dev_analytics_daily_counts (day, metric, bucket, event_count)
  select current_date, item.metric, item.bucket, sum(item.count)::bigint
  from jsonb_to_recordset(p_counts) as item(metric text, bucket text, count integer)
  group by item.metric, item.bucket
  on conflict (day, metric, bucket)
  do update set event_count =
    public.dev_analytics_daily_counts.event_count + excluded.event_count;
end;
$$;

revoke all on function public.increment_dev_analytics_counts(jsonb) from public;
grant execute on function public.increment_dev_analytics_counts(jsonb) to anon, authenticated;

create or replace function public.get_dev_aggregate_analytics(p_days integer default 30)
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

  with filtered as (
    select day, metric, bucket, event_count
    from public.dev_analytics_daily_counts
    where day >= current_date - (safe_days - 1)
  ),
  total_values as (
    select
      coalesce(sum(event_count) filter (where metric = 'page_view'), 0)::bigint as page_views,
      coalesce(sum(event_count) filter (where metric = 'action'), 0)::bigint as interactions
    from filtered
  ),
  source_values as (
    select bucket as name, sum(event_count)::bigint as events
    from filtered
    where metric = 'source'
    group by bucket
    order by events desc, name
  ),
  platform_values as (
    select bucket as name, sum(event_count)::bigint as events
    from filtered
    where metric = 'platform'
    group by bucket
    order by events desc, name
  ),
  country_values as (
    select bucket as name, sum(event_count)::bigint as events
    from filtered
    where metric = 'country'
    group by bucket
    having sum(event_count) >= 10
    order by events desc, name
    limit 20
  ),
  action_values as (
    select bucket as name, sum(event_count)::bigint as events
    from filtered
    where metric = 'action'
    group by bucket
    order by events desc, name
    limit 20
  ),
  lake_values as (
    select bucket as name, sum(event_count)::bigint as events
    from filtered
    where metric = 'lake_interest'
    group by bucket
    order by events desc, name
    limit 20
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
      coalesce(sum(filtered.event_count) filter (where filtered.metric = 'page_view'), 0)::bigint as page_views,
      coalesce(sum(filtered.event_count) filter (where filtered.metric = 'action'), 0)::bigint as interactions
    from day_series
    left join filtered on filtered.day = day_series.day
    group by day_series.day
    order by day_series.day
  )
  select jsonb_build_object(
    'totals', (select to_jsonb(total_values) from total_values),
    'sources', coalesce((select jsonb_agg(to_jsonb(source_values)) from source_values), '[]'::jsonb),
    'platforms', coalesce((select jsonb_agg(to_jsonb(platform_values)) from platform_values), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(to_jsonb(country_values)) from country_values), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(action_values)) from action_values), '[]'::jsonb),
    'top_lakes', coalesce((select jsonb_agg(to_jsonb(lake_values)) from lake_values), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily_values)) from daily_values), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_dev_aggregate_analytics(integer) from public;
grant execute on function public.get_dev_aggregate_analytics(integer) to authenticated;
