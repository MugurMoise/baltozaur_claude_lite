-- Production privacy cleanup approved on 2026-07-29.

update public.lake_suggestions
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

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-evening-notifications';

drop table if exists public.push_subscriptions;
