alter table public.vacancies
  add column application_deadline date;

update public.vacancies
  set application_deadline = (now() at time zone 'Africa/Nairobi')::date + 30
  where application_deadline is null;

alter table public.vacancies
  alter column application_deadline set default ((now() at time zone 'Africa/Nairobi')::date + 30),
  alter column application_deadline set not null;

create function public.validate_vacancy_application_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.application_deadline < (now() at time zone 'Africa/Nairobi')::date then
    raise exception 'The application closing date must be today or later.';
  end if;
  return new;
end;
$$;

create trigger validate_vacancy_application_deadline
  before insert or update of application_deadline on public.vacancies
  for each row execute procedure public.validate_vacancy_application_deadline();

drop policy if exists "Teachers with a saved CV may apply to published vacancies" on public.applications;
create policy "Teachers with a saved CV may apply to open vacancies"
  on public.applications for insert
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.teacher_cvs
      where teacher_cvs.teacher_id = (select auth.uid())
    )
    and exists (
      select 1
        from public.vacancies
        where vacancies.id = vacancy_id
          and vacancies.status = 'published'
          and vacancies.application_deadline >= (now() at time zone 'Africa/Nairobi')::date
          and (
            vacancies.county = public.current_teacher_county()
            or public.has_active_teacher_subscription((select auth.uid()))
          )
    )
  );
