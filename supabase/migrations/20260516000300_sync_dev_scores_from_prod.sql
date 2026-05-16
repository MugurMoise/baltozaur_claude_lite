-- Keep dev forecast days aligned with production forecast data.
-- This refreshes current/future dev score rows from production lake_scores.

delete from dev_lake_scores
where calculated_at >= date_trunc('day', now());

insert into dev_lake_scores (
  lake_id,
  score,
  pressure,
  pressure_delta,
  wind_speed,
  temperature,
  temperature_delta,
  feeding_windows,
  calculated_at
)
select
  s.lake_id,
  coalesce(s.score, 0),
  coalesce(s.pressure, 0),
  s.pressure_delta,
  coalesce(s.wind_speed, 0),
  coalesce(s.temperature, 0),
  s.temperature_delta,
  s.feeding_windows,
  s.calculated_at
from lake_scores s
join dev_lakes d on d.id = s.lake_id
where s.calculated_at >= date_trunc('day', now());
