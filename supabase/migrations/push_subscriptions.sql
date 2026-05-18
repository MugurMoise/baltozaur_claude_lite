-- ── push_subscriptions table ────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  -- Zone preferences
  counties        text[]    default '{}',
  max_distance_km integer   default null,
  -- Metadata
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Index for fast lookups by endpoint
create index if not exists push_subscriptions_endpoint_idx
  on push_subscriptions (endpoint);

-- RLS: allow anyone to insert/update their own subscription (identified by endpoint)
alter table push_subscriptions enable row level security;

create policy "Anyone can upsert their subscription"
  on push_subscriptions
  for all
  using (true)
  with check (true);

-- ── Cron job: send notifications every evening at 20:00 Romania time ─────────
-- Romania is UTC+2 (UTC+3 in summer). 18:00 UTC = 20:00 EET / 21:00 EEST
-- Using 17:00 UTC as a safe middle ground (19:00 winter, 20:00 summer)
select cron.schedule(
  'send-evening-notifications',
  '0 17 * * *',
  $$
  select net.http_post(
    url     := 'https://ecgscjtczbtvkqrdogoo.supabase.co/functions/v1/send-notifications',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZ3NjanRjemJ0dmtxcmRvZ29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTcyMDYsImV4cCI6MjA5MzY3MzIwNn0.9qj7WXXy2-r45w32EKB9PcTshNTQDYkCN14xpANMGlY", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
