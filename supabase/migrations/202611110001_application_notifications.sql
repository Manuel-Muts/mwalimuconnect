alter table public.notifications
  drop constraint notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in ('subscription_expiry', 'new_vacancy', 'application_received'));

create function public.notify_institution_of_new_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    user_id,
    notification_key,
    notification_type,
    title,
    message,
    vacancy_id
  )
  select
    head.id,
    'application:' || new.id::text,
    'application_received',
    'New application received',
    format(
      '%s applied for %s.',
      coalesce(nullif(btrim(teacher.full_name), ''), 'A teacher'),
      vacancy.title
    ),
    vacancy.id
  from public.vacancies as vacancy
  join public.profiles as head
    on head.institution_id = vacancy.institution_id
    and head.role = 'institution'
  join public.profiles as teacher
    on teacher.id = new.teacher_id
  where vacancy.id = new.vacancy_id
  on conflict (user_id, notification_key) do nothing;

  return new;
end;
$$;

create trigger notify_institution_of_new_application
  after insert on public.applications
  for each row execute procedure public.notify_institution_of_new_application();

revoke all on function public.notify_institution_of_new_application() from public, anon, authenticated;

create or replace function public.claim_notification_emails(p_limit integer default 50)
returns table (
  notification_id uuid,
  recipient_email text,
  notification_type text,
  title text,
  message text
)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select notification.id
    from public.notifications as notification
    join auth.users as account on account.id = notification.user_id
    where notification.email_sent_at is null
      and notification.email_attempts < 5
      and notification.notification_type in ('subscription_expiry', 'new_vacancy')
      and account.email is not null
      and (
        notification.email_claimed_at is null
        or notification.email_claimed_at < now() - interval '15 minutes'
      )
    order by notification.created_at
    for update of notification skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ),
  claimed as (
    update public.notifications as notification
    set email_claimed_at = now(),
        email_attempts = notification.email_attempts + 1,
        email_error = null
    from candidates
    where notification.id = candidates.id
    returning
      notification.id,
      notification.user_id,
      notification.notification_type,
      notification.title,
      notification.message
  )
  select claimed.id, account.email, claimed.notification_type, claimed.title, claimed.message
  from claimed
  join auth.users as account on account.id = claimed.user_id;
$$;

revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
