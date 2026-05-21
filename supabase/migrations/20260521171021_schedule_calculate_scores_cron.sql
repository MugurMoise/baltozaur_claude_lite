-- Refresh weather-backed fishing scores every 3 hours.
-- The function rewrites today + 6 forecast days for each lake, then mirrors prod
-- rows into dev_* tables, so one production run keeps both environments fresh.
do $$
begin
  perform cron.unschedule('calculate-scores-every-3-hours');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'calculate-scores-every-3-hours',
  '0 */3 * * *',
  $$
  select net.http_post(
    url     := 'https://ecgscjtczbtvkqrdogoo.supabase.co/functions/v1/calculate-scores',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZ3NjanRjemJ0dmtxcmRvZ29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTcyMDYsImV4cCI6MjA5MzY3MzIwNn0.9qj7WXXy2-r45w32EKB9PcTshNTQDYkCN14xpANMGlY", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
