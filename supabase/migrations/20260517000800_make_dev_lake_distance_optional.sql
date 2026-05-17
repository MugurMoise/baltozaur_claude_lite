-- Dev lakes mirror production metadata, where distance_km can be unknown.

alter table if exists public.dev_lakes
  alter column distance_km drop not null,
  alter column distance_km drop default;
