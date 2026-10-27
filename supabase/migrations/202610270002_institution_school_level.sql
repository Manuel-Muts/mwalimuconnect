alter table public.institutions
  add column if not exists school_level text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conrelid = 'public.institutions'::regclass
        and conname = 'institutions_school_level_check'
  ) then
    alter table public.institutions
      add constraint institutions_school_level_check
      check (school_level is null or school_level in ('ECDE', 'Lower primary', 'Upper primary', 'Junior school', 'Senior school'));
  end if;
end;
$$;

create or replace function public.set_vacancy_school_details()
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

drop trigger if exists set_vacancy_school_details on public.vacancies;

create trigger set_vacancy_school_details
  before insert or update of institution_id, county, school_level on public.vacancies
  for each row execute procedure public.set_vacancy_school_details();
