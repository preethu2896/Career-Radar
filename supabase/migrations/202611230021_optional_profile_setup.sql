begin;
-- Keep existing profile rows and private PDFs untouched. Career information is
-- optional for a job portal; validate supplied preferences without gating access.
create or replace function public.validate_completed_candidate_profile()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare values_array jsonb;
begin
  if length(coalesce(new.first_name,'')) > 100 then
    raise check_violation using message = 'Keep your first name within 100 characters.';
  end if;
  if jsonb_typeof(new.target_roles) is distinct from 'array' or jsonb_array_length(new.target_roles) > 3 then
    raise check_violation using message = 'Choose up to three roles.';
  end if;
  if jsonb_typeof(new.preferred_cities) is distinct from 'array' or jsonb_array_length(new.preferred_cities) > 50 then
    raise check_violation using message = 'Choose up to 50 locations.';
  end if;
  if jsonb_typeof(new.work_preferences) is distinct from 'array' or jsonb_array_length(new.work_preferences) > 3 then
    raise check_violation using message = 'Choose valid work preferences.';
  end if;
  if jsonb_typeof(new.skills) is distinct from 'array' or jsonb_array_length(new.skills) > 50 then
    raise check_violation using message = 'Choose up to 50 skills.';
  end if;
  values_array := new.target_roles || new.preferred_cities || new.work_preferences || new.skills;
  if exists(select 1 from jsonb_array_elements(values_array) v where jsonb_typeof(v) <> 'string' or nullif(btrim(v #>> '{}'),'') is null or length(v #>> '{}') > 200) then
    raise check_violation using message = 'Use valid text for roles, locations, skills and work preferences.';
  end if;
  if exists(select 1 from jsonb_array_elements_text(new.work_preferences) v where v not in ('On-site','Hybrid','Remote')) then
    raise check_violation using message = 'Choose a valid work preference.';
  end if;
  return new;
end;
$$;
commit;
