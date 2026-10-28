alter table public.teacher_cvs
  add column candidate_statement text not null default '';

drop policy if exists "Teachers with a saved CV may apply to open vacancies" on public.applications;
create policy "Teachers with a complete CV may apply to open vacancies"
  on public.applications for insert
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
    and exists (
      select 1
        from public.teacher_cvs
        where teacher_cvs.teacher_id = (select auth.uid())
          and length(trim(teacher_cvs.candidate_statement)) > 0
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
