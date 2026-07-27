-- Applied previously through main; kept here so dev_ migration history stays aligned.

do $$
declare
  approved_user_id uuid;
  approved_email text;
begin
  select id, email
    into approved_user_id, approved_email
  from auth.users
  where lower(email) = lower('mugur.gabriel@gmail.com')
  order by created_at desc
  limit 1;

  if approved_user_id is null then
    raise exception 'Approved admin account was not found in auth.users';
  end if;

  insert into public.admin_users (user_id, email)
  values (approved_user_id, approved_email)
  on conflict (user_id) do update
    set email = excluded.email;
end;
$$;
