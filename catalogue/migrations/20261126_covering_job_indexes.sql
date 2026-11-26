CREATE INDEX IF NOT EXISTS catalogue_job_company_cover ON catalogue_jobs(company_id,status,published_at DESC,id,source_id,work_mode);
CREATE INDEX IF NOT EXISTS catalogue_job_work_cover ON catalogue_jobs(work_mode,status,source_id,published_at,id,company_id);
