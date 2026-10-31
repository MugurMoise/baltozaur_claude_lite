-- A pseudonymous activity log for the production admin dashboard.
-- It intentionally stores no IP address, email, account, or browser fingerprint.
create table if not exists public.analytics_activity_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  visitor_id uuid not null,
  event_name text not null,
  page_path text not null,
  details jsonb not null default '{}'::jsonb,
  constraint analytics_activity_log_event_name_check check (event_name in (
    'page_view', 'lake_details_opened', 'shared_lake_opened', 'navigation_clicked',
    'share_link_copied', 'website_clicked', 'phone_clicked', 'search_used', 'filter_changed',
    'map_opened', 'location_requested', 'location_granted', 'location_denied', 'data_refreshed',
    'forecast_day_selected', 'language_changed', 'list_opened', 'view_mode_changed'
  )),
  constraint analytics_activity_log_page_path_check check (page_path like '/%')
);

create index if not exists analytics_activity_log_occurred_at_idx
  on public.analytics_activity_log (occurred_at desc);

alter table public.analytics_activity_log enable row level security;
revoke all on table public.analytics_activity_log from anon, authenticated;

create or replace function public.record_analytics_activity(p_activities jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if jsonb_typeof(p_activities) <> 'array'
    or jsonb_array_length(p_activities) < 1
    or jsonb_array_length(p_activities) > 40 then
    raise exception 'Invalid activity batch';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_activities) as item(
      visitor_id text, event_name text, page_path text, details jsonb
    )
    where item.visitor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item.event_name not in (
        'page_view', 'lake_details_opened', 'shared_lake_opened', 'navigation_clicked',
        'share_link_copied', 'website_clicked', 'phone_clicked', 'search_used', 'filter_changed',
        'map_opened', 'location_requested', 'location_granted', 'location_denied', 'data_refreshed',
        'forecast_day_selected', 'language_changed', 'list_opened', 'view_mode_changed'
      )
      or item.page_path is null or item.page_path !~ '^/' or length(item.page_path) > 200
      or item.details is null or jsonb_typeof(item.details) <> 'object'
  ) then
    raise exception 'Invalid activity entry';
  end if;

  insert into public.analytics_activity_log (visitor_id, event_name, page_path, details)
  select item.visitor_id::uuid, item.event_name, item.page_path, item.details
  from jsonb_to_recordset(p_activities) as item(
    visitor_id text, event_name text, page_path text, details jsonb
  );
end;
$$;

create or replace function public.record_analytics_batch(p_counts jsonb, p_activities jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.increment_analytics_counts(p_counts);
  perform public.record_analytics_activity(p_activities);
end;
$$;

create or replace function public.get_analytics_activity_log(
  p_days integer default 30,
  p_limit integer default 250
)
returns table (
  occurred_at timestamptz,
  visitor_id text,
  name text,
  page_path text,
  details jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  safe_days integer := greatest(1, least(coalesce(p_days, 30), 90));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 250), 500));
begin
  if not exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select log.occurred_at, log.visitor_id::text, log.event_name, log.page_path, log.details
  from public.analytics_activity_log log
  where log.occurred_at >= current_date - (safe_days - 1)
  order by log.occurred_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.record_analytics_activity(jsonb) from public;
revoke all on function public.record_analytics_batch(jsonb, jsonb) from public;
revoke all on function public.get_analytics_activity_log(integer, integer) from public;
grant execute on function public.record_analytics_batch(jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_analytics_activity_log(integer, integer) to authenticated;
