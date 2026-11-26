begin;
alter table public.profiles
  add column if not exists education_degree text,
  add column if not exists graduation_year integer,
  add column if not exists education_score text;
alter table public.profiles add constraint profiles_graduation_year_range
  check (graduation_year is null or graduation_year between 1950 and 2100) not valid;
alter table public.profiles add constraint profiles_education_lengths
  check (length(education_degree) <= 160 and length(education_score) <= 80) not valid;

-- A separate moderated feed. Historical imports are not promoted to openings.
create table public.career_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check(length(company_name) between 1 and 160),
  title text not null check(length(title) between 1 and 200),
  location text, work_mode text, experience_requirement text,
  education_requirement text, graduation_requirement text, marks_requirement text,
  salary text, description text, application_instructions text,
  skills jsonb not null default '[]' check(jsonb_typeof(skills) = 'array'),
  source_url text not null check(source_url ~ '^https://'),
  application_url text check(application_url is null or application_url ~ '^https://'),
  contact_email text, contact_source_url text check(contact_source_url is null or contact_source_url ~ '^https://'),
  source_kind text not null default 'UNKNOWN' check(source_kind in ('OFFICIAL','PUBLIC_POST','UNKNOWN')),
  status text not null default 'UNKNOWN' check(status in ('OPEN','CLOSED','UNKNOWN')),
  publication_state text not null default 'DRAFT' check(publication_state in ('DRAFT','PUBLISHED')),
  published_at timestamptz, first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz,
  check(last_checked_at is null or last_checked_at <= now() + interval '5 minutes')
);
alter table public.career_opportunities enable row level security;
create policy "published opportunities readable" on public.career_opportunities
  for select to anon, authenticated using(publication_state = 'PUBLISHED');
revoke all on public.career_opportunities from anon, authenticated;
grant select on public.career_opportunities to anon, authenticated;
grant all on public.career_opportunities to service_role;
create index career_opportunities_recent_idx on public.career_opportunities(last_checked_at desc)
  where publication_state = 'PUBLISHED' and status = 'OPEN';

create table public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_key text not null check(length(entity_key) between 1 and 180),
  source_kind text not null check(source_kind in ('OPPORTUNITY','MANUAL')),
  company_name text not null check(length(company_name) between 1 and 160),
  title text not null check(length(title) between 1 and 200),
  source_url text check(source_url is null or source_url ~ '^https?://'),
  status text not null default 'Saved' check(status in ('Saved','Preparing','Applied','Interview','Offer','Rejected','Withdrawn','No response')),
  notes text not null default '' check(length(notes) <= 4000),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, entity_key)
);
alter table public.candidate_applications enable row level security;
create policy "application owner access" on public.candidate_applications
  for all to authenticated using((select auth.uid()) = user_id) with check((select auth.uid()) = user_id);
create policy "application owner boundary" on public.candidate_applications as restrictive
  for all to anon, authenticated using((select auth.uid()) = user_id) with check((select auth.uid()) = user_id);
revoke all on public.candidate_applications from anon;
grant select,insert,update,delete on public.candidate_applications to authenticated;
grant all on public.candidate_applications to service_role;
create index candidate_applications_owner_idx on public.candidate_applications(user_id,updated_at desc);
create function public.set_candidate_application_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'Applied' and new.applied_at is null then new.applied_at := now(); end if;
  return new;
end;
$$;
create trigger candidate_applications_updated before insert or update on public.candidate_applications
  for each row execute function public.set_candidate_application_timestamps();
commit;
