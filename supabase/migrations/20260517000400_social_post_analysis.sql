-- TikTok/social signal MVP.
-- Dev uses dev_* tables; production uses the unprefixed equivalents.

create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null default 'tiktok',
  source_url    text not null unique,
  lake_id       uuid references public.lakes(id) on delete set null,
  author_handle text,
  caption       text,
  posted_at     timestamptz,
  view_count    integer,
  like_count    integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.social_post_analysis (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null unique references public.social_posts(id) on delete cascade,
  event_type           text not null,
  lake_guess           text,
  fish_type            text,
  estimated_weight_kg  numeric,
  confidence           numeric not null default 0,
  popularity_score     integer not null default 0,
  sentiment            text,
  mentions_bad_weather boolean not null default false,
  mentions_no_bites    boolean not null default false,
  mentions_rain        boolean not null default false,
  mentions_wind        boolean not null default false,
  summary              text,
  raw_result           jsonb not null default '{}'::jsonb,
  analyzed_at          timestamptz not null default now()
);

create index if not exists social_posts_lake_id_idx
  on public.social_posts (lake_id);

create index if not exists social_posts_created_at_idx
  on public.social_posts (created_at desc);

create index if not exists social_post_analysis_event_type_idx
  on public.social_post_analysis (event_type);

alter table public.social_posts enable row level security;
alter table public.social_post_analysis enable row level security;

drop policy if exists "Public social posts read" on public.social_posts;
create policy "Public social posts read"
  on public.social_posts for select
  using (true);

drop policy if exists "Public social posts write" on public.social_posts;
create policy "Public social posts write"
  on public.social_posts for all
  using (true)
  with check (true);

drop policy if exists "Public social analysis read" on public.social_post_analysis;
create policy "Public social analysis read"
  on public.social_post_analysis for select
  using (true);

drop policy if exists "Public social analysis write" on public.social_post_analysis;
create policy "Public social analysis write"
  on public.social_post_analysis for all
  using (true)
  with check (true);

create table if not exists public.dev_social_posts (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null default 'tiktok',
  source_url    text not null unique,
  lake_id       uuid references public.dev_lakes(id) on delete set null,
  author_handle text,
  caption       text,
  posted_at     timestamptz,
  view_count    integer,
  like_count    integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.dev_social_post_analysis (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null unique references public.dev_social_posts(id) on delete cascade,
  event_type           text not null,
  lake_guess           text,
  fish_type            text,
  estimated_weight_kg  numeric,
  confidence           numeric not null default 0,
  popularity_score     integer not null default 0,
  sentiment            text,
  mentions_bad_weather boolean not null default false,
  mentions_no_bites    boolean not null default false,
  mentions_rain        boolean not null default false,
  mentions_wind        boolean not null default false,
  summary              text,
  raw_result           jsonb not null default '{}'::jsonb,
  analyzed_at          timestamptz not null default now()
);

create index if not exists dev_social_posts_lake_id_idx
  on public.dev_social_posts (lake_id);

create index if not exists dev_social_posts_created_at_idx
  on public.dev_social_posts (created_at desc);

create index if not exists dev_social_post_analysis_event_type_idx
  on public.dev_social_post_analysis (event_type);

alter table public.dev_social_posts enable row level security;
alter table public.dev_social_post_analysis enable row level security;

drop policy if exists "Public dev social posts read" on public.dev_social_posts;
create policy "Public dev social posts read"
  on public.dev_social_posts for select
  using (true);

drop policy if exists "Public dev social posts write" on public.dev_social_posts;
create policy "Public dev social posts write"
  on public.dev_social_posts for all
  using (true)
  with check (true);

drop policy if exists "Public dev social analysis read" on public.dev_social_post_analysis;
create policy "Public dev social analysis read"
  on public.dev_social_post_analysis for select
  using (true);

drop policy if exists "Public dev social analysis write" on public.dev_social_post_analysis;
create policy "Public dev social analysis write"
  on public.dev_social_post_analysis for all
  using (true)
  with check (true);
