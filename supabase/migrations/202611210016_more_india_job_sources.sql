begin;
-- Only employer boards confirmed by a complete current public feed are enabled.
insert into public.job_feed_boards(provider,board_slug,company_name,official_careers_url,sync_batch) values
('LEVER','paytm','Paytm','https://jobs.lever.co/paytm',1),
('ASHBY','atlys','Atlys','https://jobs.ashbyhq.com/atlys',1),
('LEVER','drivetrain','Drivetrain','https://jobs.lever.co/drivetrain',1),
('LEVER','fampay','Fam','https://jobs.lever.co/fampay',1),
('LEVER','dnb','Dun & Bradstreet','https://jobs.lever.co/dnb',1),
('ASHBY','humanarchive','Human Archive','https://jobs.ashbyhq.com/humanarchive',1),
('GREENHOUSE','66degrees','66degrees','https://job-boards.greenhouse.io/66degrees',1),
('ASHBY','kantiv','Kantiv','https://jobs.ashbyhq.com/kantiv',1),
('ASHBY','interview-kickstart','Interview Kickstart','https://jobs.ashbyhq.com/interview-kickstart',2),
('ASHBY','Meraki-Labs','Meraki Labs','https://jobs.ashbyhq.com/Meraki-Labs',2),
('GREENHOUSE','stripe','Stripe','https://job-boards.greenhouse.io/stripe',2),
('GREENHOUSE','towerresearchcapital','Tower Research Capital','https://job-boards.greenhouse.io/towerresearchcapital',2),
('GREENHOUSE','alphagrepsecurities','AlphaGrep','https://job-boards.greenhouse.io/alphagrepsecurities',2),
('LEVER','meesho','Meesho','https://jobs.lever.co/meesho',2),
('LEVER','z1tech','Z1 Tech','https://jobs.lever.co/z1tech',2),
('LEVER','aleph','Aleph','https://jobs.lever.co/aleph',2),
('ASHBY','atlan','Atlan','https://jobs.ashbyhq.com/atlan',3),
('ASHBY','certifyos','CertifyOS','https://jobs.ashbyhq.com/certifyos',3),
('GREENHOUSE','databricks','Databricks','https://job-boards.greenhouse.io/databricks',3),
('GREENHOUSE','datadog','Datadog','https://job-boards.greenhouse.io/datadog',3),
('GREENHOUSE','equalexperts','Equal Experts','https://job-boards.greenhouse.io/equalexperts',3),
('ASHBY','gainsight','Gainsight','https://jobs.ashbyhq.com/gainsight',3),
('GREENHOUSE','gitlab','GitLab','https://job-boards.greenhouse.io/gitlab',3),
('GREENHOUSE','gravitonresearchcapital','Graviton Research Capital','https://job-boards.greenhouse.io/gravitonresearchcapital',3),
('GREENHOUSE','groww','Groww','https://job-boards.greenhouse.io/groww',4),
('LEVER','mindtickle','Mindtickle','https://jobs.lever.co/mindtickle',4),
('ASHBY','notion','Notion','https://jobs.ashbyhq.com/notion',4),
('LEVER','portcast','Portcast','https://jobs.lever.co/portcast',4),
('GREENHOUSE','quinstreet','QuinStreet','https://job-boards.greenhouse.io/quinstreet',4),
('GREENHOUSE','schrdinger','Schrödinger','https://job-boards.greenhouse.io/schrdinger',4),
('ASHBY','smallest','Smallest AI','https://jobs.ashbyhq.com/smallest',4),
('GREENHOUSE','zenoti','Zenoti','https://job-boards.greenhouse.io/zenoti',4),
('LEVER','zeta','Zeta','https://jobs.lever.co/zeta',5)
on conflict(provider,board_slug) do update set company_name=excluded.company_name,official_careers_url=excluded.official_careers_url,sync_batch=excluded.sync_batch;
select cron.schedule('careerradar-job-feeds-1','22 */6 * * *','select public.dispatch_job_feed_batch(1);');
select cron.schedule('careerradar-job-feeds-2','27 */6 * * *','select public.dispatch_job_feed_batch(2);');
select cron.schedule('careerradar-job-feeds-3','32 */6 * * *','select public.dispatch_job_feed_batch(3);');
select cron.schedule('careerradar-job-feeds-4','37 */6 * * *','select public.dispatch_job_feed_batch(4);');
select cron.schedule('careerradar-job-feeds-5','42 */6 * * *','select public.dispatch_job_feed_batch(5);');
commit;
