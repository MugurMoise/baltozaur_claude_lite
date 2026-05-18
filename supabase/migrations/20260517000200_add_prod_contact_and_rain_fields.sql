alter table if exists public.lakes
  add column if not exists website_url text,
  add column if not exists facebook_url text,
  add column if not exists phone text;

alter table if exists public.lake_scores
  add column if not exists precipitation numeric,
  add column if not exists rain_hours integer default 0;
