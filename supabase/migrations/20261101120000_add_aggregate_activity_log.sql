-- Expose the existing aggregate action counters as a chronological admin log.
-- The result contains no visitor, session, device, or IP-level data.
create or replace function public.get_aggregate_analytics(p_days integer default 30)
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
    from public.analytics_daily_counts
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
  activity_log_values as (
    select day, bucket as name, sum(event_count)::bigint as events
    from filtered
    where metric = 'action'
    group by day, bucket
    order by day desc, events desc, name
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
    'daily', coalesce((select jsonb_agg(to_jsonb(daily_values)) from daily_values), '[]'::jsonb),
    'activity_log', coalesce((
      select jsonb_agg(to_jsonb(activity_log_values) order by day desc, events desc, name)
      from activity_log_values
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_aggregate_analytics(integer) from public;
grant execute on function public.get_aggregate_analytics(integer) to authenticated;
