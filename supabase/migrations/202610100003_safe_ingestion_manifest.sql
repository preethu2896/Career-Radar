-- Additive schema for reviewable, retry-safe ingestion. Apply only after review.
alter table public.companies add column if not exists identity_key text;
create unique index if not exists companies_identity_key_idx on public.companies(identity_key) where identity_key is not null;
drop index if exists public.companies_canonical_name_idx;

alter table public.company_locations add column if not exists dataset_city text;
alter table public.company_locations add column if not exists association_class text not null default 'UNKNOWN';
alter table public.company_locations add column if not exists evidence text;
alter table public.company_locations add column if not exists evidence_url text;
alter table public.company_locations add column if not exists notes text;

alter table public.career_sources add column if not exists provenance jsonb not null default '{}'::jsonb;
alter table public.raw_imports add column if not exists manifest_hash text;
create unique index if not exists raw_imports_manifest_hash_idx on public.raw_imports(manifest_hash) where manifest_hash is not null;

create table if not exists public.raw_import_rows (
  id uuid primary key default gen_random_uuid(),
  raw_import_id uuid not null references public.raw_imports(id) on delete cascade,
  source_file text not null,
  source_row_id text not null,
  source_row integer not null,
  dataset_type text,
  dataset_city text,
  raw_row jsonb not null,
  normalized_row jsonb not null,
  created_at timestamptz not null default now(),
  unique(raw_import_id, source_row_id)
);

create table if not exists public.identity_review_candidates (
  id uuid primary key default gen_random_uuid(),
  raw_import_id uuid references public.raw_imports(id) on delete set null,
  source_row_id text not null,
  canonical_name text,
  related_names jsonb not null default '[]'::jsonb,
  review_status text not null,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(raw_import_id, source_row_id)
);

alter table public.raw_import_rows enable row level security;
alter table public.identity_review_candidates enable row level security;
