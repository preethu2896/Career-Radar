-- Additive mapping table for employer-direct imports.
-- This migration is intentionally not applied by the local dry-run pipeline.
-- Preflight must confirm that no incompatible table with this name already exists.
do $$
begin
  if to_regclass('public.employer_direct_external_ids') is not null then
    raise exception 'employer_direct_external_ids already exists; inspect its schema before applying this migration';
  end if;
end $$;

create table public.employer_direct_external_ids (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'job', 'source')),
  external_id text not null,
  database_id uuid not null,
  raw_import_id uuid references public.raw_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, external_id),
  unique(entity_type, database_id)
);

create index employer_direct_external_ids_database_idx
  on public.employer_direct_external_ids(database_id);

alter table public.employer_direct_external_ids enable row level security;
