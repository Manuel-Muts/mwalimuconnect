create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_key text not null,
  notification_type text not null check (notification_type in ('subscription_expiry', 'new_vacancy')),
  title text not null,
  message text not null,
  vacancy_id uuid references public.vacancies (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_sent_at timestamptz,
  email_claimed_at timestamptz,
  email_attempts integer not null default 0 check (email_attempts >= 0),
  email_error text,
  unique (user_id, notification_key)
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_email_queue_idx
  on public.notifications (created_at)
  where email_sent_at is null and email_attempts < 5;

alter table public.notifications enable row level security;

create policy "Users may read their own notifications"
  on public.notifications for select
  using (user_id = (select auth.uid()));

create policy "Users may mark their own notifications as read"
  on public.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function public.notify_teachers_of_new_vacancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'published' then
      return new;
    end if;
  end if;

  insert into public.notifications (
    user_id,
    notification_key,
    notification_type,
    title,
    message,
    vacancy_id
  )
  select
    teacher.id,
    'vacancy:' || new.id::text,
    'new_vacancy',
    'New vacancy: ' || new.title,
    format(
      '%s at %s in %s. Apply by %s.',
      new.title,
      institution.name,
      new.county,
      to_char(new.application_deadline, 'FMMonth DD, YYYY')
    ),
    new.id
  from public.profiles as teacher
  join public.institutions as institution
    on institution.id = new.institution_id
  where teacher.role = 'teacher'
    and (
      teacher.county = new.county
      or exists (
        select 1
        from public.subscriptions
        where subscriptions.teacher_id = teacher.id
          and subscriptions.status = 'active'
          and subscriptions.expires_at > now()
      )
    )
  on conflict (user_id, notification_key) do nothing;

  return new;
end;
$$;

create trigger notify_teachers_of_new_vacancy
  after insert or update of status on public.vacancies
  for each row execute procedure public.notify_teachers_of_new_vacancy();

revoke all on function public.notify_teachers_of_new_vacancy() from public, anon, authenticated;

create function public.create_subscription_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_count integer;
begin
  with subscription_owners as (
    select teacher_id as user_id, max(expires_at) as expires_at
    from public.subscriptions
    where teacher_id is not null and status = 'active'
    group by teacher_id

    union all

    select profile.id as user_id, max(subscription.expires_at) as expires_at
    from public.subscriptions as subscription
    join public.profiles as profile
      on profile.institution_id = subscription.institution_id
      and profile.role = 'institution'
    where subscription.institution_id is not null
      and subscription.status = 'active'
    group by profile.id
  ),
  due_reminders as (
    select owner.user_id, owner.expires_at, reminder.days_before
    from subscription_owners as owner
    cross join (values (7), (1)) as reminder(days_before)
    where owner.expires_at > now()
      and (owner.expires_at at time zone 'Africa/Nairobi')::date
        = (now() at time zone 'Africa/Nairobi')::date + reminder.days_before
  )
  insert into public.notifications (
    user_id,
    notification_key,
    notification_type,
    title,
    message
  )
  select
    due.user_id,
    'subscription-expiry:' || due.days_before::text || ':' || due.expires_at::date::text,
    'subscription_expiry',
    'Subscription expires in ' || due.days_before::text || case when due.days_before = 1 then ' day' else ' days' end,
    'Your subscription expires on '
      || to_char(due.expires_at at time zone 'Africa/Nairobi', 'FMMonth DD, YYYY')
      || '. Renew before then to keep full access.'
  from due_reminders as due
  on conflict (user_id, notification_key) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

create function public.claim_notification_emails(p_limit integer default 50)
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

revoke all on function public.create_subscription_expiry_notifications() from public, anon, authenticated;
revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.create_subscription_expiry_notifications() to service_role;
grant execute on function public.claim_notification_emails(integer) to service_role;
