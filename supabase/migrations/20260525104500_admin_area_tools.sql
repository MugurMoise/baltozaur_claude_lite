-- Admin operations UI support for dev dashboard.

create table if not exists public.admin_score_settings (
  id         text primary key default 'default',
  settings   jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.admin_score_settings enable row level security;

drop policy if exists "Admin score settings read" on public.admin_score_settings;
create policy "Admin score settings read"
  on public.admin_score_settings for select
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admin score settings write" on public.admin_score_settings;
create policy "Admin score settings write"
  on public.admin_score_settings for all
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admin dev lake insert" on public.dev_lakes;
create policy "Admin dev lake insert"
  on public.dev_lakes for insert
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );
