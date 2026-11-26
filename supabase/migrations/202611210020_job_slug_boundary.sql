begin;
-- Trim a truncated location suffix at word boundaries; existing URLs are unchanged.
create or replace function public.set_job_url_slugs() returns trigger
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
  candidate:=role_part||'-'||trim(both '-' from left(suffix,45));
 end if;
 while exists(select 1 from public.career_opportunities where company_slug=company_part and role_slug=candidate and id<>NEW.id) loop
  candidate:=role_part||'-'||left(replace(NEW.id::text,'-',''),12)||case when duplicate_number>1 then '-'||duplicate_number else '' end;
  duplicate_number:=duplicate_number+1;
 end loop;
 NEW.company_slug:=company_part;NEW.role_slug:=candidate;return NEW;
end $$;
revoke all on function public.set_job_url_slugs() from public,anon,authenticated;
commit;
