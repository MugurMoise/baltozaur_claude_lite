alter table if exists public.dev_lakes
  add column if not exists rules text,
  add column if not exists price text;

update public.dev_lakes d
set
  rules = l.rules,
  price = l.price
from public.lakes l
where d.id = l.id;
