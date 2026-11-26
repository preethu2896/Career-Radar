begin;
alter table public.job_feed_boards add column if not exists discovery_roots jsonb not null default '[]'::jsonb check(jsonb_typeof(discovery_roots)='array' and jsonb_array_length(discovery_roots)<=4);
update public.job_feed_boards set discovery_roots='["https://73strings.teamtailor.com/jobs"]'::jsonb where board_slug='pages-73-strings';
update public.job_feed_boards set discovery_roots='["https://www.ycombinator.com/companies/infinity/jobs"]'::jsonb where board_slug='pages-infinity';
update public.job_feed_boards set discovery_roots='["https://www.dognosis.tech/careers"]'::jsonb where board_slug='pages-dognosis';
update public.job_feed_boards set discovery_roots='["https://www.astrobase.in/careers"]'::jsonb where board_slug='pages-astrobase-space-technologies-pvt-ltd';
update public.job_feed_boards set discovery_roots='["https://jobs.boeing.com/location/india-jobs/185/1269750/2"]'::jsonb where board_slug='pages-boeing';
commit;
