create table public.teacher_cvs (
  teacher_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null default '',
  professional_title text not null,
  years_experience integer not null default 0 check (years_experience between 0 and 60),
  education text not null,
  experience text not null,
  skills text not null,
  certifications text not null default '',
  updated_at timestamptz not null default now(),
  constraint teacher_cvs_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint teacher_cvs_email_not_empty check (length(trim(email)) > 0),
  constraint teacher_cvs_title_not_empty check (length(trim(professional_title)) > 0),
  constraint teacher_cvs_education_not_empty check (length(trim(education)) > 0),
  constraint teacher_cvs_experience_not_empty check (length(trim(experience)) > 0),
  constraint teacher_cvs_skills_not_empty check (length(trim(skills)) > 0)
);

alter table public.teacher_cvs enable row level security;
revoke all on public.teacher_cvs from anon;
grant select, insert, update on public.teacher_cvs to authenticated;

create policy "Teachers manage their own CV"
  on public.teacher_cvs for all
  using (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
  )
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
  );

create policy "Institutions view CVs of their applicants"
  on public.teacher_cvs for select
  using (
    public.current_user_role() = 'admin'
    or exists (
      select 1
        from public.applications
        join public.vacancies on vacancies.id = applications.vacancy_id
        where applications.teacher_id = teacher_cvs.teacher_id
          and vacancies.institution_id = public.current_institution_id()
    )
  );

drop policy if exists "Teachers may apply to published vacancies" on public.applications;
create policy "Teachers with a saved CV may apply to published vacancies"
  on public.applications for insert
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.teacher_cvs
      where teacher_cvs.teacher_id = (select auth.uid())
    )
    and exists (
      select 1 from public.vacancies
      where vacancies.id = vacancy_id
        and vacancies.status = 'published'
    )
  );
