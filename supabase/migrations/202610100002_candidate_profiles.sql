create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  career_stage text,
  experience_level text,
  target_roles jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  preferred_cities jsonb not null default '[]'::jsonb,
  work_preferences jsonb not null default '[]'::jsonb,
  industries jsonb not null default '[]'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_onboarding_complete_idx on public.profiles (onboarding_complete);

alter table public.profiles enable row level security;

drop policy if exists "users can read their own profile" on public.profiles;
create policy "users can read their own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "users can create their own profile" on public.profiles;
create policy "users can create their own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();
