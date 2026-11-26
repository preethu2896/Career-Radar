begin;
create table if not exists public.candidate_saved_companies (
  user_id uuid not null references public.candidate_accounts(id) on delete cascade,
  company_id text not null check (char_length(company_id) between 1 and 240),
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);
alter table public.candidate_saved_companies enable row level security;
revoke all on public.candidate_saved_companies from anon, authenticated;
grant select, insert, delete on public.candidate_saved_companies to authenticated;
grant all on public.candidate_saved_companies to service_role;
create policy saved_companies_read_own on public.candidate_saved_companies for select to authenticated using (user_id = public.current_candidate_id());
create policy saved_companies_insert_own on public.candidate_saved_companies for insert to authenticated with check (user_id = public.current_candidate_id());
create policy saved_companies_delete_own on public.candidate_saved_companies for delete to authenticated using (user_id = public.current_candidate_id());
commit;
