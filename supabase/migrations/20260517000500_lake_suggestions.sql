create table if not exists public.lake_suggestions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  county       text,
  lat          double precision,
  lon          double precision,
  website_url  text,
  facebook_url text,
  phone        text,
  notes        text,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

create index if not exists lake_suggestions_status_idx
  on public.lake_suggestions (status, created_at desc);

alter table public.lake_suggestions enable row level security;

drop policy if exists "Public lake suggestions insert" on public.lake_suggestions;
create policy "Public lake suggestions insert"
  on public.lake_suggestions for insert
  with check (status = 'pending');

drop policy if exists "Public lake suggestions read none" on public.lake_suggestions;
create policy "Public lake suggestions read none"
  on public.lake_suggestions for select
  using (false);

create table if not exists public.dev_lake_suggestions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  county       text,
  lat          double precision,
  lon          double precision,
  website_url  text,
  facebook_url text,
  phone        text,
  notes        text,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

create index if not exists dev_lake_suggestions_status_idx
  on public.dev_lake_suggestions (status, created_at desc);

alter table public.dev_lake_suggestions enable row level security;

drop policy if exists "Public dev lake suggestions insert" on public.dev_lake_suggestions;
create policy "Public dev lake suggestions insert"
  on public.dev_lake_suggestions for insert
  with check (status = 'pending');

drop policy if exists "Public dev lake suggestions read none" on public.dev_lake_suggestions;
create policy "Public dev lake suggestions read none"
  on public.dev_lake_suggestions for select
  using (false);
