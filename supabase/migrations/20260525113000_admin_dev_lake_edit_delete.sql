drop policy if exists "Admin dev lake update" on public.dev_lakes;
create policy "Admin dev lake update"
  on public.dev_lakes for update
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

drop policy if exists "Admin dev lake delete" on public.dev_lakes;
create policy "Admin dev lake delete"
  on public.dev_lakes for delete
  using (
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
  );
