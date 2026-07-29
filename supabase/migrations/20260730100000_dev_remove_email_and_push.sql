-- DEV ONLY: remove legacy contact/technical data from suggestions and retire push.
-- Production objects are intentionally untouched pending a separate production sign-off.

update public.dev_lake_suggestions
set
  phone = null,
  submitter_email = null,
  submitter_ip = null,
  user_agent = null,
  confirmation_sent_at = null
where
  phone is not null
  or submitter_email is not null
  or submitter_ip is not null
  or user_agent is not null
  or confirmation_sent_at is not null;

drop table if exists public.dev_push_subscriptions;
