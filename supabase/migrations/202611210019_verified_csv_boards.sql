begin;
-- Sources checked against complete current public employer feeds or explicit JobPosting pages.
insert into public.job_feed_boards(provider,board_slug,company_name,official_careers_url,sync_batch,source_urls) values
('WORKABLE','innovaccer-analytics','Innovaccer Analytics','https://apply.workable.com/innovaccer-analytics',5,'[]'::jsonb),
('ASHBY','Aspora','Aspora','https://jobs.ashbyhq.com/Aspora',5,'[]'::jsonb),
('GREENHOUSE','cloudsek','CloudSEK','https://job-boards.greenhouse.io/cloudsek',5,'[]'::jsonb),
('GREENHOUSE','razorpaysoftwareprivatelimited','Razorpay','https://job-boards.greenhouse.io/razorpaysoftwareprivatelimited',0,'[]'::jsonb),
('ASHBY','novo','Novo','https://jobs.ashbyhq.com/novo',5,'[]'::jsonb),
('GREENHOUSE','karya','Karya','https://job-boards.greenhouse.io/karya',5,'[]'::jsonb),
('GREENHOUSE','stockx','StockX','https://job-boards.greenhouse.io/stockx',5,'[]'::jsonb),
('WORKABLE','weekday-1','Weekday AI','https://apply.workable.com/weekday-1',5,'[]'::jsonb),
('GREENHOUSE','devrev','DevRev','https://job-boards.greenhouse.io/devrev',6,'[]'::jsonb),
('ASHBY','parspec','Parspec','https://jobs.ashbyhq.com/parspec',6,'[]'::jsonb),
('ASHBY','bureau','Bureau','https://jobs.ashbyhq.com/bureau',6,'[]'::jsonb),
('ASHBY','metaforms','Metaforms','https://jobs.ashbyhq.com/metaforms',6,'[]'::jsonb),
('LEVER','dozee','Dozee','https://jobs.lever.co/dozee',6,'[]'::jsonb),
('ASHBY','interview-kickstart','Interview Kickstart','https://jobs.ashbyhq.com/interview-kickstart',2,'[]'::jsonb),
('LEVER','zeta','Zeta','https://jobs.lever.co/zeta',5,'[]'::jsonb),
('LEVER','hevodata','Hevo Data','https://jobs.lever.co/hevodata',0,'[]'::jsonb),
('GREENHOUSE','6sense','6sense','https://job-boards.greenhouse.io/6sense',6,'[]'::jsonb),
('WORKABLE','lokal-app','Lokal App','https://apply.workable.com/lokal-app',6,'[]'::jsonb),
('ASHBY','spotdraft','SpotDraft','https://jobs.ashbyhq.com/spotdraft',6,'[]'::jsonb),
('LEVER','acceldata','Acceldata','https://jobs.lever.co/acceldata',7,'[]'::jsonb),
('ASHBY','oaknorth','OakNorth','https://jobs.ashbyhq.com/oaknorth',7,'[]'::jsonb),
('ASHBY','headout','Headout','https://jobs.ashbyhq.com/headout',7,'[]'::jsonb),
('WORKABLE','caxton','Caxton Associates','https://apply.workable.com/caxton',7,'[]'::jsonb),
('ASHBY','bolna','Bolna AI','https://jobs.ashbyhq.com/bolna',7,'[]'::jsonb),
('LEVER','saviynt','Saviynt','https://jobs.lever.co/saviynt',7,'[]'::jsonb),
('GREENHOUSE','quince','Quince','https://job-boards.greenhouse.io/quince',7,'[]'::jsonb),
('GREENHOUSE','sigmoid','Sigmoid','https://job-boards.greenhouse.io/sigmoid',0,'[]'::jsonb),
('RECRUITEE','gain','Gain','https://gain.recruitee.com',7,'[]'::jsonb),
('ASHBY','airbound','Airbound','https://jobs.ashbyhq.com/airbound',8,'[]'::jsonb),
('GREENHOUSE','eclinicalsolutions','eClinical Solutions','https://job-boards.greenhouse.io/eclinicalsolutions',8,'[]'::jsonb),
('LEVER','fampay','Fam','https://jobs.lever.co/fampay',1,'[]'::jsonb),
('LEVER','pocketfm','Pocket FM','https://jobs.lever.co/pocketfm',8,'[]'::jsonb),
('ASHBY','Almabase','Almabase','https://jobs.ashbyhq.com/Almabase',8,'[]'::jsonb),
('LEVER','gushwork','Gushwork','https://jobs.lever.co/gushwork',8,'[]'::jsonb),
('WORKABLE','apna','Apna','https://apply.workable.com/apna',8,'[]'::jsonb),
('LEVER','cred','CRED','https://jobs.lever.co/cred',8,'[]'::jsonb),
('ASHBY','sarvam','Sarvam','https://www.sarvam.ai/careers',0,'[]'::jsonb),
('GREENHOUSE','glance','Glance','https://job-boards.greenhouse.io/glance',8,'[]'::jsonb),
('GREENHOUSE','inmobi','InMobi','https://job-boards.greenhouse.io/inmobi',9,'[]'::jsonb),
('GREENHOUSE','hackerrank','HackerRank','https://job-boards.greenhouse.io/hackerrank',0,'[]'::jsonb),
('LEVER','meesho','Meesho','https://jobs.lever.co/meesho',2,'[]'::jsonb),
('SCHEMA','pages-73-strings','73 Strings','https://73strings.teamtailor.com/jobs/8491769-senior-data-engineer',10,'["https://73strings.teamtailor.com/jobs/8491769-senior-data-engineer","https://73strings.teamtailor.com/jobs/8464497-senior-site-reliability-engineer-application-support-sre"]'::jsonb),
('SCHEMA','pages-infinity','Infinity','https://www.ycombinator.com/companies/infinity/jobs/OFwxm4z-software-engineer-backend',10,'["https://www.ycombinator.com/companies/infinity/jobs/OFwxm4z-software-engineer-backend"]'::jsonb),
('SCHEMA','pages-dognosis','Dognosis','https://www.dognosis.tech/careers/principal-hardware-engineer-mechatronics',11,'["https://www.dognosis.tech/careers/principal-hardware-engineer-mechatronics","https://www.dognosis.tech/careers/hardware-engineer-wearables","https://www.dognosis.tech/careers/hardware-engineer-mechatronics","https://www.dognosis.tech/careers/embedded-engineer","https://www.dognosis.tech/careers/hardware-intern","https://www.dognosis.tech/careers/software-engineer-backend","https://www.dognosis.tech/careers/software-intern","https://www.dognosis.tech/careers/decision-scientist-health-economics-and-decision-modeling","https://www.dognosis.tech/careers/field-care-specialist","https://www.dognosis.tech/careers/k9-trainer","https://www.dognosis.tech/careers/lab-manager-diagnostics-laboratory-operations","https://www.dognosis.tech/careers/lawyer-generalist","https://www.dognosis.tech/careers/care-coordinator"]'::jsonb),
('SCHEMA','pages-astrobase-space-technologies-pvt-ltd','Astrobase Space Technologies Pvt. Ltd.','https://www.astrobase.in/careers/76682',11,'["https://www.astrobase.in/careers/76682","https://www.astrobase.in/careers/96018","https://www.astrobase.in/careers/93265","https://www.astrobase.in/careers/65893","https://www.astrobase.in/careers/64581","https://www.astrobase.in/careers/93395","https://www.astrobase.in/careers/93389","https://www.astrobase.in/careers/94506","https://www.astrobase.in/careers/62148","https://www.astrobase.in/careers/62147","https://www.astrobase.in/careers/93256","https://www.astrobase.in/careers/80010","https://www.astrobase.in/careers/93964","https://www.astrobase.in/careers/93702","https://www.astrobase.in/careers/93701","https://www.astrobase.in/careers/86894","https://www.astrobase.in/careers/86893","https://www.astrobase.in/careers/86891","https://www.astrobase.in/careers/71598","https://www.astrobase.in/careers/96374","https://www.astrobase.in/careers/95351","https://www.astrobase.in/careers/94943","https://www.astrobase.in/careers/71640","https://www.astrobase.in/careers/51952","https://www.astrobase.in/careers/81516","https://www.astrobase.in/careers/96366","https://www.astrobase.in/careers/96364","https://www.astrobase.in/careers/96363","https://www.astrobase.in/careers/96362","https://www.astrobase.in/careers/80013","https://www.astrobase.in/careers/93665","https://www.astrobase.in/careers/93664","https://www.astrobase.in/careers/93516","https://www.astrobase.in/careers/93514","https://www.astrobase.in/careers/93513","https://www.astrobase.in/careers/93511","https://www.astrobase.in/careers/93510","https://www.astrobase.in/careers/93509","https://www.astrobase.in/careers/93508","https://www.astrobase.in/careers/93506"]'::jsonb),
('SCHEMA','pages-astrobase-space-technologies-pvt-ltd-1','Astrobase Space Technologies Pvt. Ltd.','https://www.astrobase.in/careers/93505',12,'["https://www.astrobase.in/careers/93505","https://www.astrobase.in/careers/93504","https://www.astrobase.in/careers/93503","https://www.astrobase.in/careers/94944","https://www.astrobase.in/careers/92029","https://www.astrobase.in/careers/92027","https://www.astrobase.in/careers/92025","https://www.astrobase.in/careers/93201","https://www.astrobase.in/careers/87827","https://www.astrobase.in/careers/75583","https://www.astrobase.in/careers/48292","https://www.astrobase.in/careers/96331","https://www.astrobase.in/careers/95430","https://www.astrobase.in/careers/95429","https://www.astrobase.in/careers/95428","https://www.astrobase.in/careers/95427","https://www.astrobase.in/careers/95420","https://www.astrobase.in/careers/95419","https://www.astrobase.in/careers/95417","https://www.astrobase.in/careers/95415","https://www.astrobase.in/careers/95393","https://www.astrobase.in/careers/95372","https://www.astrobase.in/careers/95367","https://www.astrobase.in/careers/95249","https://www.astrobase.in/careers/95171","https://www.astrobase.in/careers/95169","https://www.astrobase.in/careers/92166","https://www.astrobase.in/careers/92151","https://www.astrobase.in/careers/95919","https://www.astrobase.in/careers/95636","https://www.astrobase.in/careers/94533","https://www.astrobase.in/careers/94530"]'::jsonb),
('SCHEMA','pages-boeing','Boeing','https://jobs.boeing.com/job/mohanbari/experienced-field-service-representative-defense/185/103515972896',12,'["https://jobs.boeing.com/job/mohanbari/experienced-field-service-representative-defense/185/103515972896","https://jobs.boeing.com/job/prayagraj/experienced-product-quality-acceptance-specialist/185/103112305104","https://jobs.boeing.com/job/arakkonam/experienced-field-service-rep-defense/185/103112305088","https://jobs.boeing.com/job/bengaluru/experienced-customer-support-systems-service-engineer-flight-controls/185/103413932192","https://jobs.boeing.com/job/bengaluru/experienced-quality-systems-specialist-process-quality/185/103413916208","https://jobs.boeing.com/job/bengaluru/lead-avionics-systems-customer-support-engineer-communications-navigation-surveillance-systems/185/103377080432","https://jobs.boeing.com/job/bengaluru/experienced-software-application-qa-tester-java-full-stack/185/103328338800","https://jobs.boeing.com/job/bengaluru/experienced-software-application-developer-java-full-stack/185/103328338752","https://jobs.boeing.com/job/bengaluru/lead-software-application-engineer-java-full-stack/185/103328338720","https://jobs.boeing.com/job/bengaluru/associate-software-application-developer-java-full-stack/185/103328338496","https://jobs.boeing.com/job/bengaluru/lead-software-architect/185/103328338448","https://jobs.boeing.com/job/bengaluru/lead-software-application-devops-engineer/185/103328338400","https://jobs.boeing.com/job/bengaluru/lead-product-owner/185/103328338368","https://jobs.boeing.com/job/bengaluru/senior-lead-product-owner/185/103328338320","https://jobs.boeing.com/job/bengaluru/senior-lead-software-architect/185/103328338272","https://jobs.boeing.com/job/bengaluru/software-application-development-manager/185/103328338224","https://jobs.boeing.com/job/ridley-park/ch-47-experienced-field-service-representative-india/185/103081842032"]'::jsonb)
on conflict(provider,board_slug) do update set enabled=true,source_urls=case when excluded.provider='SCHEMA' then excluded.source_urls else job_feed_boards.source_urls end;
select cron.schedule('careerradar-job-feeds-6','47 0,6,12,18 * * *','select public.dispatch_job_feed_batch(6);');
select cron.schedule('careerradar-job-feeds-7','52 0,6,12,18 * * *','select public.dispatch_job_feed_batch(7);');
select cron.schedule('careerradar-job-feeds-8','57 0,6,12,18 * * *','select public.dispatch_job_feed_batch(8);');
select cron.schedule('careerradar-job-feeds-9','2 1,7,13,19 * * *','select public.dispatch_job_feed_batch(9);');
select cron.schedule('careerradar-job-feeds-10','7 1,7,13,19 * * *','select public.dispatch_job_feed_batch(10);');
select cron.schedule('careerradar-job-feeds-11','12 1,7,13,19 * * *','select public.dispatch_job_feed_batch(11);');
select cron.schedule('careerradar-job-feeds-12','17 1,7,13,19 * * *','select public.dispatch_job_feed_batch(12);');
commit;
