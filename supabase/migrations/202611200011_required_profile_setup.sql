begin;
-- Enforce completed-profile requirements on future writes without modifying
-- existing candidates or blocking initial partial profiles created at signup.
create or replace function public.validate_completed_candidate_profile()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare score_match text[];
begin
  if not new.onboarding_complete then return new; end if;
  if nullif(btrim(new.first_name),'') is null then
    raise check_violation using message = 'Add your first name.';
  end if;
  if jsonb_typeof(new.target_roles) is distinct from 'array' or jsonb_array_length(new.target_roles) not between 1 and 3 then
    raise check_violation using message = 'Choose one to three roles.';
  end if;
  if jsonb_typeof(new.preferred_cities) is distinct from 'array' or jsonb_array_length(new.preferred_cities) < 1 then
    raise check_violation using message = 'Choose at least one preferred location.';
  end if;
  if jsonb_typeof(new.work_preferences) is distinct from 'array' or jsonb_array_length(new.work_preferences) < 1 then
    raise check_violation using message = 'Choose at least one work preference.';
  end if;
  if exists(select 1 from jsonb_array_elements(new.target_roles || new.preferred_cities || new.work_preferences) value where jsonb_typeof(value) <> 'string' or nullif(btrim(value #>> '{}'),'') is null) then
    raise check_violation using message = 'Choose valid roles, locations and work preferences.';
  end if;
  if exists(select 1 from jsonb_array_elements_text(new.work_preferences) value where value not in ('On-site','Hybrid','Remote')) then
    raise check_violation using message = 'Choose a valid work preference.';
  end if;
  if new.career_stage is null or new.career_stage not in ('Student / Fresher','Early career','Career switcher','Experienced professional') then
    raise check_violation using message = 'Choose your career stage.';
  end if;
  if new.career_stage <> 'Student / Fresher' then
    if coalesce(new.experience_level,'') !~ '^[0-9]+([.][0-9]+)? years$' then
      raise check_violation using message = 'Enter valid years of experience.';
    end if;
    if split_part(new.experience_level,' ',1)::numeric > 70 then
      raise check_violation using message = 'Enter years of experience between 0 and 70.';
    end if;
  end if;
  if nullif(btrim(new.education_degree),'') is null then
    raise check_violation using message = 'Add your degree or qualification.';
  end if;
  if new.graduation_year is null or new.graduation_year not between 1950 and 2100 then
    raise check_violation using message = 'Enter a valid graduation year.';
  end if;
  score_match := regexp_match(btrim(coalesce(new.education_score,'')), '^((CGPA|GPA|Percentage|Score|Grade)[[:space:]]*:?[[:space:]]*)?([0-9]+([.][0-9]+)?)[[:space:]]*(/[[:space:]]*(4|10|100)|(%|CGPA|GPA|percent(age)?))?$', 'i');
  if score_match is null then
    raise check_violation using message = 'Enter valid marks or CGPA.';
  end if;
  if score_match[3]::numeric > (case when score_match[6] is not null then score_match[6]::numeric when coalesce(score_match[2],score_match[7],'') ~* '^(CGPA|GPA)$' then 10 else 100 end) then
    raise check_violation using message = 'Enter valid marks or CGPA.';
  end if;
  if jsonb_typeof(new.skills) is distinct from 'array' or jsonb_array_length(new.skills) > 50 then
    raise check_violation using message = 'Choose up to 50 skills.';
  end if;
  if not exists(select 1 from public.candidate_resumes where user_id = new.id) then
    raise check_violation using message = 'Upload and save your PDF resume to continue.';
  end if;
  return new;
end;
$$;
create trigger profiles_require_completed_setup
before insert or update of onboarding_complete,first_name,career_stage,experience_level,target_roles,skills,preferred_cities,work_preferences,education_degree,graduation_year,education_score
on public.profiles for each row execute function public.validate_completed_candidate_profile();
commit;
