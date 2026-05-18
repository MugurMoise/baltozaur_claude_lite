create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  created_at timestamptz not null default now()
);

alter table if exists public.lake_suggestions
  add column if not exists submitter_email text,
  add column if not exists submitter_ip text,
  add column if not exists user_agent text,
  add column if not exists confirmation_sent_at timestamptz;

alter table if exists public.dev_lake_suggestions
  add column if not exists submitter_email text,
  add column if not exists submitter_ip text,
  add column if not exists user_agent text,
  add column if not exists confirmation_sent_at timestamptz;

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read own admin record" on public.admin_users;
create policy "Admins can read own admin record"
  on public.admin_users for select
  using (auth.uid() = user_id);

drop policy if exists "Admin lake suggestions read" on public.lake_suggestions;
create policy "Admin lake suggestions read"
  on public.lake_suggestions for select
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admin lake suggestions update" on public.lake_suggestions;
create policy "Admin lake suggestions update"
  on public.lake_suggestions for update
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

drop policy if exists "Admin dev lake suggestions read" on public.dev_lake_suggestions;
create policy "Admin dev lake suggestions read"
  on public.dev_lake_suggestions for select
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admin dev lake suggestions update" on public.dev_lake_suggestions;
create policy "Admin dev lake suggestions update"
  on public.dev_lake_suggestions for update
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
