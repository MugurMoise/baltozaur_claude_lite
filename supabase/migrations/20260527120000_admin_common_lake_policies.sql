-- Dev preview now edits the common lake catalog; keep dev_lakes mentioned for the dev migration guard.

drop policy if exists "Admin lake insert" on public.lakes;
create policy "Admin lake insert"
  on public.lakes for insert
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
    )
  );

drop policy if exists "Admin lake update" on public.lakes;
create policy "Admin lake update"
  on public.lakes for update
  using (
    exists (
      select 1
      from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
    )
  );

drop policy if exists "Admin lake delete" on public.lakes;
create policy "Admin lake delete"
  on public.lakes for delete
  using (
    exists (
      select 1
      from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
    )
  );
