-- Additive extension for candidate profile persistence across all eight onboarding steps.
-- Preserves existing rows, defaults, triggers, and RLS policies on public.profiles.
-- Compensation columns support decimal LPA values (numeric).
-- Resume size supports byte counts (bigint) without storing binary file content in the database.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists current_city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists current_compensation numeric,
  add column if not exists expected_compensation numeric,
  add column if not exists relocation text,
  add column if not exists availability text,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists portfolio_url text,
  add column if not exists resume_name text,
  add column if not exists resume_bytes bigint;
