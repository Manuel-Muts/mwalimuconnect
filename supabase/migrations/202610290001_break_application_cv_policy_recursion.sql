create or replace function public.teacher_has_application_for_current_institution(p_teacher_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.applications
      join public.vacancies on public.vacancies.id = public.applications.vacancy_id
      where public.applications.teacher_id = p_teacher_id
        and public.vacancies.institution_id = (select public.current_institution_id())
  )
$$;

revoke all on function public.teacher_has_application_for_current_institution(uuid) from public;
grant execute on function public.teacher_has_application_for_current_institution(uuid) to authenticated, service_role;

drop policy if exists "Institutions view CVs of their applicants" on public.teacher_cvs;
create policy "Institutions view CVs of their applicants"
  on public.teacher_cvs for select
  using (
    public.current_user_role() = 'admin'
    or (
      public.current_user_role() = 'institution'
      and public.teacher_has_application_for_current_institution(teacher_id)
    )
  );
