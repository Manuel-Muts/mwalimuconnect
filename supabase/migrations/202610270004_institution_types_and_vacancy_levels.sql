alter table public.institutions
  drop constraint if exists institutions_school_level_check;

update public.institutions
  set school_level = case
    when lower(school_level) = 'senior school' then 'Senior School'
    else 'Primary + JSS'
  end
  where school_level is not null;

alter table public.institutions
  add constraint institutions_school_level_check
  check (school_level is null or school_level in ('Primary + JSS', 'Senior School'));

alter table public.vacancies
  drop constraint if exists vacancies_school_level_check;

drop trigger if exists set_vacancy_school_details on public.vacancies;

update public.vacancies
  set school_level = case
    when school_level = 'ECDE' then 'ECDE / Early Years'
    when school_level = 'Lower primary' then 'Lower Primary'
    when school_level = 'Upper primary' then 'Upper Primary'
    when school_level = 'Junior school' then 'JSS'
    when school_level = 'Senior school' then 'Senior School'
    else school_level
  end;

alter table public.vacancies
  add constraint vacancies_school_level_check
  check (school_level in ('ECDE / Early Years', 'Lower Primary', 'Upper Primary', 'JSS', 'Senior School'));

create or replace function public.set_vacancy_school_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  institution_type text;
begin
  select county, subcounty, school_level
    into new.county, new.subcounty, institution_type
    from public.institutions
    where id = new.institution_id;

  if new.county is null or new.subcounty is null or institution_type is null then
    raise exception 'The institution must have a county, subcounty and institution type before vacancies can be posted.';
  end if;

  if (institution_type = 'Primary + JSS' and new.school_level not in ('ECDE / Early Years', 'Lower Primary', 'Upper Primary', 'JSS'))
    or (institution_type = 'Senior School' and new.school_level <> 'Senior School') then
    raise exception 'Select a teaching level that matches the institution type.';
  end if;

  return new;
end;
$$;

create trigger set_vacancy_school_details
  before insert or update of institution_id, county, subcounty, school_level on public.vacancies
  for each row execute procedure public.set_vacancy_school_details();
