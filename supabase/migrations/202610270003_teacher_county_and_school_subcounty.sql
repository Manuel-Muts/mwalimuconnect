alter table public.profiles
  add column if not exists county text;

alter table public.institutions
  add column if not exists subcounty text;

alter table public.vacancies
  add column if not exists subcounty text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and conname = 'profiles_county_check'
  ) then
    alter table public.profiles
      add constraint profiles_county_check
      check (
        county is null or county in (
          'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet',
          'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
          'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga',
          'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
          'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru',
          'Migori', 'Mombasa', 'Murang''a', 'Nairobi', 'Nakuru',
          'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
          'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
          'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
          'Vihiga', 'Wajir', 'West Pokot'
        )
      );
  end if;
end;
$$;

create or replace function public.create_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, county)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'teacher',
    nullif(new.raw_user_meta_data ->> 'county', '')
  );
  return new;
end;
$$;

create or replace function public.set_vacancy_school_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select county, subcounty, school_level
    into new.county, new.subcounty, new.school_level
    from public.institutions
    where id = new.institution_id;

  if new.county is null or new.subcounty is null or new.school_level is null then
    raise exception 'The institution must have a county, subcounty and school level before vacancies can be posted.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_vacancy_school_details on public.vacancies;

create trigger set_vacancy_school_details
  before insert or update of institution_id, county, subcounty, school_level on public.vacancies
  for each row execute procedure public.set_vacancy_school_details();

create or replace function public.current_teacher_county()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select county
    from public.profiles
    where id = (select auth.uid())
      and role = 'teacher'
$$;

create or replace function public.set_teacher_county(p_county text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_county is null or p_county not in (
    'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet',
    'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
    'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga',
    'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
    'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru',
    'Migori', 'Mombasa', 'Murang''a', 'Nairobi', 'Nakuru',
    'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
    'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
    'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
    'Vihiga', 'Wajir', 'West Pokot'
  ) then
    raise exception 'Select a valid Kenyan county.';
  end if;

  update public.profiles
    set county = p_county
    where id = (select auth.uid())
      and role = 'teacher'
      and (county is null or county = p_county);

  if not found then
    raise exception 'The county is already set and cannot be changed.';
  end if;
end;
$$;

drop policy if exists "Teachers and admins may read published vacancies" on public.vacancies;

create policy "Teachers see published vacancies in their county"
  on public.vacancies for select
  using (
    institution_id = public.current_institution_id()
    or (
      status = 'published'
      and (
        public.current_user_role() = 'admin'
        or (
          public.current_user_role() = 'teacher'
          and county = public.current_teacher_county()
        )
      )
    )
  );
