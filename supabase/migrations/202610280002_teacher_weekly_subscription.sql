alter table public.subscriptions
  drop constraint subscriptions_plan_key_check;

alter table public.subscriptions
  add constraint subscriptions_plan_key_check
  check (plan_key is null or plan_key in ('weekly', 'monthly', 'termly', 'yearly'));

alter table public.subscriptions
  add constraint subscriptions_weekly_teacher_only_check
  check (plan_key is distinct from 'weekly' or teacher_id is not null);
