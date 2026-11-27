-- Run once after provider access is restored. Rebuild is atomic and idempotent.
BEGIN IMMEDIATE;
CREATE INDEX IF NOT EXISTS catalogue_job_intern_cover ON catalogue_jobs(internship,status,source_id,published_at,id,company_id);
CREATE INDEX IF NOT EXISTS catalogue_job_fresher_cover ON catalogue_jobs(accepts_freshers,status,source_id,published_at,id,company_id);
CREATE INDEX IF NOT EXISTS catalogue_job_company_title ON catalogue_jobs(company_id,status,title,id,source_id);
CREATE TABLE IF NOT EXISTS catalogue_posted_days (
 source_id TEXT NOT NULL REFERENCES catalogue_sources(id),
 day TEXT NOT NULL,
 n INTEGER NOT NULL CHECK(n>=0),
 PRIMARY KEY(source_id,day)
) WITHOUT ROWID;
DELETE FROM catalogue_posted_days;
INSERT INTO catalogue_posted_days(source_id,day,n)
 SELECT source_id,substr(published_at,1,10),count(*) FROM catalogue_jobs
 WHERE status='OPEN' AND published_at IS NOT NULL GROUP BY source_id,substr(published_at,1,10);
CREATE INDEX IF NOT EXISTS catalogue_posted_day_lookup ON catalogue_posted_days(day,source_id,n);
CREATE INDEX IF NOT EXISTS catalogue_company_recent_order ON catalogue_companies(coalesce(json_extract(record_json,'$.addedAt'),'') DESC,name_key,id);
CREATE INDEX IF NOT EXISTS catalogue_company_name_order ON catalogue_companies(name_key,id);
CREATE INDEX IF NOT EXISTS catalogue_job_posted_source ON catalogue_jobs(status,published_at DESC,source_id);
CREATE TRIGGER IF NOT EXISTS catalogue_posted_insert AFTER INSERT ON catalogue_jobs
 WHEN new.status='OPEN' AND new.published_at IS NOT NULL BEGIN
 INSERT INTO catalogue_posted_days(source_id,day,n) VALUES(new.source_id,substr(new.published_at,1,10),1)
 ON CONFLICT(source_id,day) DO UPDATE SET n=n+1;
END;
CREATE TRIGGER IF NOT EXISTS catalogue_posted_delete AFTER DELETE ON catalogue_jobs
 WHEN old.status='OPEN' AND old.published_at IS NOT NULL BEGIN
 UPDATE catalogue_posted_days SET n=n-1 WHERE source_id=old.source_id AND day=substr(old.published_at,1,10);
END;
CREATE TRIGGER IF NOT EXISTS catalogue_posted_change AFTER UPDATE OF status,published_at,source_id ON catalogue_jobs
 WHEN old.status IS NOT new.status OR old.published_at IS NOT new.published_at OR old.source_id IS NOT new.source_id BEGIN
 UPDATE catalogue_posted_days SET n=n-1 WHERE old.status='OPEN' AND old.published_at IS NOT NULL AND source_id=old.source_id AND day=substr(old.published_at,1,10);
 INSERT INTO catalogue_posted_days(source_id,day,n)
 SELECT new.source_id,substr(new.published_at,1,10),1 WHERE new.status='OPEN' AND new.published_at IS NOT NULL
 ON CONFLICT(source_id,day) DO UPDATE SET n=n+1;
END;
INSERT INTO catalogue_meta(key,value) VALUES('read_model','posted-days-v1') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
COMMIT;
