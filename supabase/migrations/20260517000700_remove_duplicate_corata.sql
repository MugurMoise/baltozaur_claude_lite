-- Remove duplicate lake entry. Keep "Balta Corata".

delete from public.lake_scores
where lake_id = 'af310fb2-c807-4fe9-a0d0-89368e12b677';

delete from public.dev_lake_scores
where lake_id = 'af310fb2-c807-4fe9-a0d0-89368e12b677';

delete from public.dev_lakes
where id = 'af310fb2-c807-4fe9-a0d0-89368e12b677'
  and name = 'Corata';

delete from public.lakes
where id = 'af310fb2-c807-4fe9-a0d0-89368e12b677'
  and name = 'Corata';
