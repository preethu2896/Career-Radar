-- Career Radar: Authentication & RLS Security Hardening
-- Migration 202610220006 (Additive, Review-Only)
-- NOTE: This migration file is review-only. Do NOT apply to the live database until authorized.

-- 1. Candidate profile self-service deletion (Right to erasure / Account closure)
-- Enables authenticated candidates to delete their own candidate profile record.
-- RLS check strictly bounds deletion to auth.uid() = id.
drop policy if exists "users can delete their own profile" on public.profiles;
create policy "users can delete their own profile" on public.profiles
  for delete using (auth.uid() = id);

-- 2. Verify that public tables restrict mutation to service_role only
-- Companies, Jobs, Career Sources, and Locations remain publicly readable for discovery
-- but cannot be inserted, updated, or deleted by anonymous or standard authenticated roles.
-- Service role bypasses RLS in Supabase by default for administrative/ETL pipelines.
