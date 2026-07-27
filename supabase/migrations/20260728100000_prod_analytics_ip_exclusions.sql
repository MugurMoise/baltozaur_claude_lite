create table if not exists public.analytics_excluded_ips (
  ip_hash       text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  label         text check (length(label) <= 120),
  created_at    timestamptz not null default now(),
  created_by    uuid not null default auth.uid() references auth.users(id) on delete cascade
);

alter table public.analytics_excluded_ips enable row level security;

revoke all on table public.analytics_excluded_ips from anon, authenticated;
grant select, insert, delete on table public.analytics_excluded_ips to authenticated;

drop policy if exists "Admins can read analytics exclusions" on public.analytics_excluded_ips;
create policy "Admins can read analytics exclusions"
  on public.analytics_excluded_ips for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can create analytics exclusions" on public.analytics_excluded_ips;
create policy "Admins can create analytics exclusions"
  on public.analytics_excluded_ips for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can delete analytics exclusions" on public.analytics_excluded_ips;
create policy "Admins can delete analytics exclusions"
  on public.analytics_excluded_ips for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

create or replace function public.is_analytics_ip_excluded(p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when p_ip_hash ~ '^[0-9a-f]{64}$' then exists (
      select 1
      from public.analytics_excluded_ips excluded
      where excluded.ip_hash = p_ip_hash
    )
    else false
  end;
$$;

revoke all on function public.is_analytics_ip_excluded(text) from public;
grant execute on function public.is_analytics_ip_excluded(text) to anon, authenticated;
