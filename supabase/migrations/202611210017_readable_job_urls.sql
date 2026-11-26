begin;
alter table public.career_opportunities add column company_slug text,add column role_slug text;
create or replace function public.job_url_slug(value text,fallback text) returns text
language sql immutable set search_path='' as $$
 select coalesce(nullif(trim(both '-' from left(regexp_replace(regexp_replace(normalize(replace(lower(coalesce(value,'')),'&',' and '),NFKD),U&'[\0300-\036f]','','g'),'[^a-z0-9]+','-','g'),120)),''),fallback);
$$;
create function public.set_job_url_slugs() returns trigger
language plpgsql security definer set search_path='' as $$
declare company_part text; role_part text; candidate text; suffix text; duplicate_number integer:=1;
begin
 -- Established links remain stable when source titles, locations or descriptions update.
 if TG_OP='UPDATE' and OLD.company_slug is not null and OLD.role_slug is not null then
  NEW.company_slug:=OLD.company_slug;NEW.role_slug:=OLD.role_slug;return NEW;
 end if;
 -- Worker upserts first run INSERT triggers: reuse the existing source record's URL.
 if NEW.feed_board_id is not null and NEW.source_job_id is not null then
  select o.company_slug,o.role_slug into company_part,role_part from public.career_opportunities o
   where o.feed_board_id=NEW.feed_board_id and o.source_job_id=NEW.source_job_id and o.company_slug is not null and o.role_slug is not null;
  if found then NEW.company_slug:=company_part;NEW.role_slug:=role_part;return NEW;end if;
 end if;
 company_part:=public.job_url_slug(NEW.company_name,'company');
 role_part:=public.job_url_slug(NEW.title,'role');candidate:=role_part;
 perform pg_advisory_xact_lock(hashtextextended('career-job-url:'||company_part,0));
 if exists(select 1 from public.career_opportunities where company_slug=company_part and role_slug=candidate and id<>NEW.id) then
  suffix:=public.job_url_slug(NEW.location,left(replace(NEW.id::text,'-',''),8));
  candidate:=role_part||'-'||left(suffix,45);
 end if;
 while exists(select 1 from public.career_opportunities where company_slug=company_part and role_slug=candidate and id<>NEW.id) loop
  candidate:=role_part||'-'||left(replace(NEW.id::text,'-',''),12)||case when duplicate_number>1 then '-'||duplicate_number else '' end;
  duplicate_number:=duplicate_number+1;
 end loop;
 NEW.company_slug:=company_part;NEW.role_slug:=candidate;return NEW;
end $$;
revoke all on function public.set_job_url_slugs() from public,anon,authenticated;
create trigger career_opportunity_url before insert or update on public.career_opportunities for each row execute function public.set_job_url_slugs();
update public.career_opportunities set company_slug=null,role_slug=null;
alter table public.career_opportunities alter column company_slug set not null,alter column role_slug set not null,
 add constraint career_job_url_unique unique(company_slug,role_slug),
 add constraint career_job_url_format check(company_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and role_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(company_slug)<=200 and length(role_slug)<=200);
commit;
