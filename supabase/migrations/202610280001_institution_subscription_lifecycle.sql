alter table public.subscriptions
  alter column institution_id drop not null,
  add column if not exists duration_days integer not null default 30,
  add column if not exists teacher_id uuid references public.profiles (id) on delete cascade,
  add column if not exists plan_key text,
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists provider_updated_at timestamptz,
  add column if not exists provider_invoice_id text unique;

alter table public.subscriptions
  add constraint subscriptions_duration_days_check
  check (duration_days between 1 and 3650);

alter table public.subscriptions
  add constraint subscriptions_owner_check
  check ((institution_id is not null) <> (teacher_id is not null)),
  add constraint subscriptions_plan_key_check
  check (plan_key is null or plan_key in ('monthly', 'termly', 'yearly'));

create index if not exists subscriptions_institution_status_expiry_idx
  on public.subscriptions (institution_id, status, expires_at desc);
create index if not exists subscriptions_teacher_status_expiry_idx
  on public.subscriptions (teacher_id, status, expires_at desc);

create or replace function public.has_active_institution_subscription(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'admin'
    or (
      p_institution_id = public.current_institution_id()
      and exists (
        select 1
          from public.subscriptions
          where institution_id = p_institution_id
            and status = 'active'
            and expires_at > now()
      )
    )
$$;

create or replace function public.has_active_teacher_subscription(p_teacher_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_teacher_id = (select auth.uid())
    and exists (
      select 1
        from public.subscriptions
        where teacher_id = p_teacher_id
          and status = 'active'
          and expires_at > now()
    )
$$;

drop policy if exists "Teachers see published vacancies in their county" on public.vacancies;

create policy "Teachers see county or subscribed nationwide vacancies"
  on public.vacancies for select
  using (
    institution_id = public.current_institution_id()
    or (
      status = 'published'
      and (
        public.current_user_role() = 'admin'
        or (
          public.current_user_role() = 'teacher'
          and (
            county = public.current_teacher_county()
            or public.has_active_teacher_subscription((select auth.uid()))
          )
        )
      )
    )
  );

drop policy if exists "Teachers may apply to published vacancies" on public.applications;

create policy "Teachers may apply to county or subscribed vacancies"
  on public.applications for insert
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
    and exists (
      select 1
        from public.vacancies
        where vacancies.id = vacancy_id
          and vacancies.status = 'published'
          and (
            vacancies.county = public.current_teacher_county()
            or public.has_active_teacher_subscription((select auth.uid()))
          )
    )
  );

drop policy if exists "Institutions and admins may view subscriptions" on public.subscriptions;
create policy "Account owners and admins may view subscriptions"
  on public.subscriptions for select
  using (
    public.current_user_role() = 'admin'
    or institution_id = public.current_institution_id()
    or teacher_id = (select auth.uid())
  );

drop policy if exists "Institutions and admins may manage vacancies" on public.vacancies;

create policy "Institutions with active subscriptions and admins may manage vacancies"
  on public.vacancies for all
  using (
    public.current_user_role() = 'admin'
    or (
      institution_id = public.current_institution_id()
      and public.has_active_institution_subscription(institution_id)
    )
  )
  with check (
    public.current_user_role() = 'admin'
    or (
      institution_id = public.current_institution_id()
      and public.has_active_institution_subscription(institution_id)
    )
  );

create or replace function public.process_intasend_subscription_event(
  p_api_ref text,
  p_invoice_id text,
  p_state text,
  p_amount numeric,
  p_currency text,
  p_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_starts_at timestamptz;
begin
  select *
    into v_subscription
    from public.subscriptions
    where provider_reference = p_api_ref
    for update;

  if not found then
    return 'not_found';
  end if;

  if p_invoice_id is null
    or (v_subscription.provider_invoice_id is not null and v_subscription.provider_invoice_id <> p_invoice_id)
    or p_currency is distinct from 'KES'
    or p_amount is null
    or p_amount <> v_subscription.amount_kes
    or p_updated_at is null then
    return 'invalid_payment';
  end if;

  if v_subscription.status = 'active' then
    return 'already_processed';
  end if;

  if v_subscription.provider_updated_at is not null
    and p_updated_at < v_subscription.provider_updated_at then
    return 'already_processed';
  end if;

  if p_state in ('FAILED', 'CANCELED') then
    update public.subscriptions
      set status = 'failed',
          provider_invoice_id = coalesce(provider_invoice_id, p_invoice_id),
          provider_updated_at = p_updated_at
      where id = v_subscription.id;
    return 'failed';
  end if;

  if p_state <> 'COMPLETE' then
    update public.subscriptions
      set provider_invoice_id = coalesce(provider_invoice_id, p_invoice_id),
          provider_updated_at = p_updated_at
      where id = v_subscription.id;
    return 'pending';
  end if;

  if v_subscription.institution_id is not null then
    perform 1
      from public.institutions
      where id = v_subscription.institution_id
      for update;
  else
    perform 1
      from public.profiles
      where id = v_subscription.teacher_id
      for update;
  end if;

  select greatest(now(), coalesce(max(expires_at), now()))
    into v_starts_at
    from public.subscriptions
    where (
        (v_subscription.institution_id is not null and institution_id = v_subscription.institution_id)
        or (v_subscription.teacher_id is not null and teacher_id = v_subscription.teacher_id)
      )
      and status = 'active';

  update public.subscriptions
    set status = 'active',
        provider_invoice_id = coalesce(provider_invoice_id, p_invoice_id),
        provider_updated_at = p_updated_at,
        starts_at = v_starts_at,
        expires_at = v_starts_at + make_interval(days => v_subscription.duration_days)
    where id = v_subscription.id;

  return 'active';
end;
$$;

revoke all on function public.process_intasend_subscription_event(text, text, text, numeric, text, timestamptz) from public;
grant execute on function public.process_intasend_subscription_event(text, text, text, numeric, text, timestamptz) to service_role;
