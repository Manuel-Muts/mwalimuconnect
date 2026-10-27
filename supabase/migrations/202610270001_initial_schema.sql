create extension if not exists pgcrypto;

create type public.app_role as enum ('teacher', 'institution', 'admin');
create type public.vacancy_status as enum ('draft', 'published', 'closed');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text not null,
  school_level text not null check (school_level in ('ECDE', 'Lower primary', 'Upper primary', 'Junior school', 'Senior school')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'teacher',
  institution_id uuid references public.institutions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  title text not null,
  description text not null default '',
  county text not null,
  school_level text not null check (school_level in ('ECDE', 'Lower primary', 'Upper primary', 'Junior school', 'Senior school')),
  category text not null default 'Teaching',
  employment_type text not null default 'Full-time' check (employment_type in ('Full-time', 'Part-time', 'Internship', 'BOM')),
  status public.vacancy_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (vacancy_id, teacher_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  provider_reference text unique,
  amount_kes integer not null check (amount_kes > 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'failed', 'expired')),
  created_at timestamptz not null default now()
);

create function public.set_vacancy_school_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select county, school_level
    into new.county, new.school_level
    from public.institutions
    where id = new.institution_id;

  if new.county is null or new.school_level is null then
    raise exception 'The institution must have a county and school level before vacancies can be posted.';
  end if;

  return new;
end;
$$;

create trigger set_vacancy_school_details
  before insert or update of institution_id, county, school_level on public.vacancies
  for each row execute procedure public.set_vacancy_school_details();

create function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function public.current_institution_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select institution_id from public.profiles where id = (select auth.uid())
$$;

create function public.create_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'teacher');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_teacher_profile();

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.vacancies enable row level security;
alter table public.applications enable row level security;
alter table public.subscriptions enable row level security;

create policy "Published vacancy schools are public"
  on public.institutions for select
  using (
    exists (
      select 1 from public.vacancies
      where vacancies.institution_id = institutions.id and vacancies.status = 'published'
    )
    or public.current_user_role() = 'admin'
    or id = public.current_institution_id()
  );

create policy "Profiles are visible to their owner and admins"
  on public.profiles for select
  using (id = (select auth.uid()) or public.current_user_role() = 'admin');

create policy "Teachers and admins may read published vacancies"
  on public.vacancies for select
  using (
    status = 'published'
    or institution_id = public.current_institution_id()
    or public.current_user_role() = 'admin'
  );

create policy "Institutions and admins may manage vacancies"
  on public.vacancies for all
  using (institution_id = public.current_institution_id() or public.current_user_role() = 'admin')
  with check (institution_id = public.current_institution_id() or public.current_user_role() = 'admin');

create policy "Teachers may view and submit their applications"
  on public.applications for select
  using (teacher_id = (select auth.uid()) or public.current_user_role() = 'admin'
    or exists (
      select 1 from public.vacancies
      where vacancies.id = applications.vacancy_id
        and vacancies.institution_id = public.current_institution_id()
    ));

create policy "Teachers may apply to published vacancies"
  on public.applications for insert
  with check (
    teacher_id = (select auth.uid())
    and public.current_user_role() = 'teacher'
    and exists (
      select 1 from public.vacancies
      where vacancies.id = vacancy_id and vacancies.status = 'published'
    )
  );

create policy "Institutions and admins may view subscriptions"
  on public.subscriptions for select
  using (institution_id = public.current_institution_id() or public.current_user_role() = 'admin');
