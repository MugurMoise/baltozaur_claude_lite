-- Distance from Bucharest only applies to local/Romanian lakes.
-- International lakes should leave distance_km null instead of storing a fake 0.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lakes'
      and column_name = 'distance_km'
  ) then
    alter table public.lakes
      alter column distance_km drop not null,
      alter column distance_km drop default;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dev_lakes'
      and column_name = 'distance_km'
  ) then
    alter table public.dev_lakes
      alter column distance_km drop not null,
      alter column distance_km drop default;
  end if;
end $$;
