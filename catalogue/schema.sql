PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS catalogue_companies (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL, profile_path TEXT NOT NULL UNIQUE,
 website TEXT, careers_url TEXT, country TEXT, city TEXT, industry TEXT, record_json TEXT NOT NULL,
 checked_at TEXT, added_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalogue_company_name ON catalogue_companies(name_key);
CREATE INDEX IF NOT EXISTS catalogue_company_place ON catalogue_companies(country,city);
CREATE TABLE IF NOT EXISTS catalogue_sources (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL, board_slug TEXT NOT NULL, api_region TEXT NOT NULL DEFAULT 'US',
 company_id TEXT NOT NULL REFERENCES catalogue_companies(id), official_url TEXT NOT NULL,
 scope TEXT NOT NULL DEFAULT 'WORLDWIDE', enabled INTEGER NOT NULL DEFAULT 1,
 source_urls TEXT NOT NULL DEFAULT '[]', discovery_roots TEXT NOT NULL DEFAULT '[]',
 last_success_at TEXT, last_error TEXT, next_due_at TEXT NOT NULL, lease_owner TEXT, lease_expires_at TEXT,
 snapshot_count INTEGER NOT NULL DEFAULT 0, posted_1d INTEGER NOT NULL DEFAULT 0, posted_7d INTEGER NOT NULL DEFAULT 0, posted_30d INTEGER NOT NULL DEFAULT 0,
 sample_location TEXT, UNIQUE(provider,api_region,board_slug)
);
CREATE INDEX IF NOT EXISTS catalogue_source_due ON catalogue_sources(enabled,next_due_at,lease_expires_at);
CREATE TABLE IF NOT EXISTS catalogue_jobs (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES catalogue_companies(id), source_id TEXT NOT NULL REFERENCES catalogue_sources(id), source_job_id TEXT NOT NULL,
 company_slug TEXT NOT NULL, role_slug TEXT NOT NULL, title TEXT NOT NULL, location TEXT,
 work_mode TEXT, employment_type TEXT, experience_requirement TEXT, description TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '[]',
 source_url TEXT NOT NULL, application_url TEXT, status TEXT NOT NULL DEFAULT 'OPEN', missing_checks INTEGER NOT NULL DEFAULT 0,
 published_at TEXT, first_seen_at TEXT NOT NULL, content_hash TEXT NOT NULL, accepts_freshers INTEGER NOT NULL, internship INTEGER NOT NULL,
 search_text TEXT NOT NULL, location_key TEXT NOT NULL, UNIQUE(source_id,source_job_id), UNIQUE(company_slug,role_slug)
);
CREATE INDEX IF NOT EXISTS catalogue_job_source ON catalogue_jobs(source_id,status);
CREATE INDEX IF NOT EXISTS catalogue_job_recent ON catalogue_jobs(status,first_seen_at DESC,id);
CREATE INDEX IF NOT EXISTS catalogue_job_posted ON catalogue_jobs(status,published_at DESC,id);
CREATE INDEX IF NOT EXISTS catalogue_job_company ON catalogue_jobs(company_id,status,published_at DESC);
CREATE INDEX IF NOT EXISTS catalogue_job_work ON catalogue_jobs(work_mode,status);
CREATE INDEX IF NOT EXISTS catalogue_job_fresher ON catalogue_jobs(accepts_freshers,status);
CREATE INDEX IF NOT EXISTS catalogue_job_intern ON catalogue_jobs(internship,status);
CREATE VIRTUAL TABLE IF NOT EXISTS catalogue_jobs_fts USING fts5(search_text,content='catalogue_jobs',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2',prefix='2 3');
CREATE TRIGGER IF NOT EXISTS catalogue_jobs_ai AFTER INSERT ON catalogue_jobs BEGIN INSERT INTO catalogue_jobs_fts(rowid,search_text) VALUES(new.rowid,new.search_text); END;
CREATE TRIGGER IF NOT EXISTS catalogue_jobs_ad AFTER DELETE ON catalogue_jobs BEGIN INSERT INTO catalogue_jobs_fts(catalogue_jobs_fts,rowid,search_text) VALUES('delete',old.rowid,old.search_text); END;
CREATE TRIGGER IF NOT EXISTS catalogue_jobs_au AFTER UPDATE OF search_text ON catalogue_jobs WHEN old.search_text<>new.search_text BEGIN INSERT INTO catalogue_jobs_fts(catalogue_jobs_fts,rowid,search_text) VALUES('delete',old.rowid,old.search_text); INSERT INTO catalogue_jobs_fts(rowid,search_text) VALUES(new.rowid,new.search_text); END;
CREATE TABLE IF NOT EXISTS catalogue_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS catalogue_sources_checked ON catalogue_sources(enabled,last_success_at DESC,id);
CREATE INDEX IF NOT EXISTS catalogue_job_source_order ON catalogue_jobs(source_id,status,id);



CREATE INDEX IF NOT EXISTS catalogue_job_posted_source ON catalogue_jobs(status,published_at DESC,source_id);
