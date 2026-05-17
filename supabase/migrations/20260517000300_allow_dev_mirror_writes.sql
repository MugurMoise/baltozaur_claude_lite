drop policy if exists "Public dev lake update" on public.dev_lakes;
create policy "Public dev lake update"
  on public.dev_lakes for update
  using (true)
  with check (true);

drop policy if exists "Public dev lake delete" on public.dev_lakes;
create policy "Public dev lake delete"
  on public.dev_lakes for delete
  using (true);

drop policy if exists "Public dev score insert" on public.dev_lake_scores;
create policy "Public dev score insert"
  on public.dev_lake_scores for insert
  with check (true);

drop policy if exists "Public dev score update" on public.dev_lake_scores;
create policy "Public dev score update"
  on public.dev_lake_scores for update
  using (true)
  with check (true);

drop policy if exists "Public dev score delete" on public.dev_lake_scores;
create policy "Public dev score delete"
  on public.dev_lake_scores for delete
  using (true);
