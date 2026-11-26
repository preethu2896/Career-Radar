import { expandDescription } from "./descriptionCodec.ts";
export type CatalogueStatement = {
  sql: string;
  args?: Array<string | number | null>;
};
export type CatalogueDatabase = {
  execute: (statement: CatalogueStatement) => Promise<{ rows: any[] }>;
  batch?: (
    statements: CatalogueStatement[],
    mode?: "write" | "read" | "deferred",
  ) => Promise<any>;
};
const recent = "j.status='OPEN' AND s.enabled=1 AND s.last_success_at>=?";
export function searchKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g, "")
    .toLowerCase()
    .replace(/\bbangalore\b/g, "bengaluru")
    .replace(/\bgurgaon\b/g, "gurugram")
    .replace(/\s+/g, " ")
    .trim();
}
function offsetValue(raw:string|null){const n=Number(raw??0);if(!Number.isSafeInteger(n)||n<0||n>1000000)throw Error('INVALID_QUERY');return n;}
const decode = (v: any) => {
  try {
    return JSON.parse(String(v ?? "null"));
  } catch {
    return null;
  }
};
const job = (r: any) => ({
  ...r,
  skills: decode(r.skills) ?? [],
  description: r.description ?? null,
  source_kind: "OFFICIAL",
  publication_state: r.status === "OPEN" ? "PUBLISHED" : "DRAFT",
  contact_email: null,
  contact_source_url: null,
  salary: null,
  education_requirement: null,
  graduation_requirement: null,
  marks_requirement: null,
  application_instructions: null,
  feed_board_id: r.source_id,
});
const columns =
  "j.id,j.company_id,json_extract(c.record_json,'$.logoUrl') AS company_logo_url,c.profile_path AS company_profile_path,j.company_slug,j.role_slug,j.source_id,s.enabled AS source_enabled,j.title,c.name AS company_name,j.location,j.work_mode,j.employment_type,j.experience_requirement,j.skills,j.source_url,j.application_url,j.status,j.published_at,j.first_seen_at,s.last_success_at AS last_checked_at";
function limit(raw: string | null, fallback = 24, max = 100) {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(max, n) : fallback;
}
export async function catalogueRead(
  db: CatalogueDatabase,
  url: URL,
  now = new Date(),
) {
  const p = url.searchParams,
    action = p.get("action") ?? "jobs",
    fresh = new Date(now.getTime() - 72 * 3600000).toISOString();
  const text = (name: string, max = 160) => {
    const v = p.get(name) ?? "";
    if (v.length > max) throw Error("INVALID_QUERY");
    return v.trim();
  };
  if (action === "health") {
    return { ready: true, storage: "public-catalogue" };
  }
  if (action === "job") {
    const id = text("id"),
      company = text("company"),
      role = text("role");
    const condition = id ? "j.id=?" : "j.company_slug=? AND j.role_slug=?";
    const r = await db.execute({
      sql: `SELECT ${columns},j.description FROM catalogue_jobs j JOIN catalogue_sources s ON s.id=j.source_id JOIN catalogue_companies c ON c.id=j.company_id WHERE ${condition} LIMIT 1`,
      args: id ? [id] : [company, role],
    });
    if(r.rows[0]&&(r.rows[0].source_enabled===0||String(r.rows[0].last_checked_at??'')<fresh)&&r.rows[0].status==='OPEN')r.rows[0].status='UNKNOWN';
    if(r.rows[0])r.rows[0].description=await expandDescription(String(r.rows[0].description??''));
    return { job: r.rows[0] ? job(r.rows[0]) : null };
  }
  if (action === "companies" || action === "company") {
    const id = text("id"),
      path = text("path", 800),
      q = searchKey(text("query")),
      city = searchKey(text("city")),
      industry = text("industry"),
      where: string[] = [],
      args: Array<string | number | null> = [];
    if (action === "company") {
      where.push(id ? "c.id=?" : "c.profile_path=?");
      args.push(id || path);
    } else {
      if (q) {
        where.push(
          "(c.name_key LIKE ? OR coalesce(json_extract(c.record_json,'$.searchIndustry'),lower(coalesce(c.industry,''))) LIKE ?)",
        );
        args.push("%" + q + "%", "%" + q + "%");
      }
      if (city) {
        where.push(
          "coalesce(json_extract(c.record_json,'$.searchPlace'),lower(coalesce(c.city,'')||' '||coalesce(c.country,''))) LIKE ?",
        );
        args.push("%" + city + "%");
      }
      if (industry) {
        where.push("c.industry=?");
        args.push(industry);
      }
      if (p.get("added") === "1") where.push("json_extract(c.record_json,'$.addedAt') IS NOT NULL");
    }
    if(p.has('saved')){let ids:any;try{ids=JSON.parse(p.get('saved')!);}catch{throw Error('INVALID_QUERY');}if(!Array.isArray(ids)||ids.length>500||!ids.every(id=>typeof id==='string'&&id.length<100))throw Error('INVALID_QUERY');where.push('c.id IN (SELECT value FROM json_each(?))');args.push(JSON.stringify(ids));}
    const clause = where.length ? "WHERE " + where.join(" AND ") : "";
    const n = action === "company" ? 1 : limit(p.get("limit")),
      offset = offsetValue(p.get("offset"));
    const r = await db.execute({
      sql: `SELECT c.record_json FROM catalogue_companies c ${clause} ORDER BY ${p.get('sort')==='name'?'c.name_key,c.id':"coalesce(json_extract(c.record_json,'$.addedAt'),'') DESC,c.name_key,c.id"} LIMIT ? OFFSET ?`,
      args: [...args, n, offset],
    });
    if (action === "company")
      return { company: r.rows[0] ? decode(r.rows[0].record_json) : null };
    const count = await db.execute({
      sql: `SELECT count(*) AS n FROM catalogue_companies c ${clause}`,
      args,
    });
    return {
      rows: r.rows.map((r: any) => decode(r.record_json)),
      total: Number(count.rows[0]?.n ?? 0),
    };
  }
  if(action==='company_activity'){
    let ids:unknown;try{ids=JSON.parse(p.get('ids')??'[]');}catch{throw Error('INVALID_QUERY');}
    if(!Array.isArray(ids)||ids.length>12||!ids.every(id=>typeof id==='string'&&id.length>0&&id.length<100))throw Error('INVALID_QUERY');
    if(!ids.length)return{rows:[]};
    const r=await db.execute({sql:`SELECT j.company_id AS id,count(*) AS count FROM catalogue_jobs j INDEXED BY catalogue_job_company_cover JOIN catalogue_sources s ON s.id=j.source_id WHERE j.company_id IN (SELECT value FROM json_each(?)) AND ${recent} GROUP BY j.company_id`,args:[JSON.stringify(ids),fresh]});
    return{rows:r.rows.map((row:any)=>({id:String(row.id),count:Number(row.count)}))};
  }
  if(action==='counts'){const r=await db.execute({sql:'SELECT count(*) AS total FROM catalogue_companies',args:[]});return{companies:Number(r.rows[0]?.total??0)};}
 if(action==='company_facets'){
 const r=await db.execute({sql:"SELECT country,city,industry,count(*) AS n,sum(CASE WHEN json_extract(record_json,'$.addedAt') IS NOT NULL THEN 1 ELSE 0 END) AS added FROM catalogue_companies GROUP BY country,city,industry",args:[]});
 const industries=[...new Set(r.rows.map((x:any)=>x.industry).filter(Boolean))].sort();const locations=[...new Set(r.rows.flatMap((x:any)=>[x.city,x.country]).filter((value:any)=>Boolean(value)&&!['Unknown','Unspecified'].includes(value)))].sort();
 return {total:r.rows.reduce((n:number,r:any)=>n+Number(r.n),0),added:r.rows.reduce((n:number,r:any)=>n+Number(r.added),0),industries,locations};
 }
 if (action === "facets") {
    const r = await db.execute({
      sql: "SELECT c.id,c.name,json_extract(c.record_json,'$.logoUrl') AS logo_url,sum(s.snapshot_count) AS n,min(s.sample_location) AS location FROM catalogue_sources s JOIN catalogue_companies c ON c.id=s.company_id WHERE s.enabled=1 AND s.last_success_at>=? GROUP BY c.id ORDER BY c.name_key",
      args: [fresh],
    });
    const companies = r.rows.map(
      (r: any) => [String(r.name), Number(r.n)] as [string, number],
    );
    const featured = [...r.rows]
      .sort((a: any, b: any) => Number(b.n) - Number(a.n))
      .filter((r: any) => Number(r.n) > 0)
      .slice(0, 3)
      .map((r: any) => ({
        id: r.id,
        logoUrl: r.logo_url??null,
        name: r.name,
        count: Number(r.n),
        location: r.location,
      }));
    const stats = await db.execute({
      sql: "SELECT sum(snapshot_count) AS total FROM catalogue_sources WHERE enabled=1 AND last_success_at>=?",
      args: [fresh],
    });
    return { companies, featured, locations:r.rows.map((r:any)=>r.location).filter(Boolean), total: Number(stats.rows[0]?.total ?? 0) };
  }
  if (action !== "jobs") throw Error("UNKNOWN_ACTION");
  const where = [recent],
    args: Array<string | number | null> = [fresh],
    q = searchKey(text("query")),
    company = text("company"),
    location = searchKey(text("location")),
    work = text("workMode"),
    experience = text("experience"),
    sort = text("sort");
  const placeTerms = location.match(/[\p{L}\p{N}]+/gu) ?? [];
  const placeMatch = placeTerms.length > 0 && placeTerms.every(t => t.length >= 2)
    ? placeTerms.map(t => '"' + t + '"*').join(" AND ") : "";
  if (!q && placeMatch) {
    where.push("j.rowid IN (SELECT rowid FROM catalogue_jobs_fts WHERE catalogue_jobs_fts MATCH ?)");
    args.push(placeMatch);
  }
  if (q) {
    const terms = q.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (terms.length && terms.every((t) => t.length >= 2) && !/\+|#/.test(q)) {
      where.push(
        "j.rowid IN (SELECT rowid FROM catalogue_jobs_fts WHERE catalogue_jobs_fts MATCH ?)",
      );
      args.push(
        [terms.map((t) => '"' + t.replace(/"/g, '""') + '"*').join(" AND "), placeMatch].filter(Boolean).join(" AND "),
      );
    } else {
      where.push("j.search_text LIKE ?");
      args.push("%" + q + "%");
    }
  }
  const companyId=text('companyId'),exclude=text('exclude');
  if(companyId){where.push('j.company_id=?');args.push(companyId);}
  if(exclude){where.push('j.id<>?');args.push(exclude);}
  if (company) {
    where.push("c.name_key LIKE ?");
    args.push("%" + searchKey(company) + "%");
  }
  if (location) {
    if(location==='india'){where.push("(' '||j.location_key||' ') GLOB ?");args.push('*[^a-z0-9]india[^a-z0-9]*');}
    else{where.push("j.location_key LIKE ?");args.push("%" + location + "%");}
  }
  if (work) {
    where.push("j.work_mode=?");
    args.push(work);
  }
  if (experience === "freshers") where.push("j.accepts_freshers=1");
  if (experience === "internship") where.push("j.internship=1");
  const from =
    `FROM catalogue_jobs j ${companyId?'INDEXED BY catalogue_job_company_cover':''} JOIN catalogue_sources s ON s.id=j.source_id JOIN catalogue_companies c ON c.id=j.company_id`;
  let counts: Record<string, number>;
  let remoteTotal:number|undefined;
  if (where.length === 1) {
    const dates=[1,7,30].map(days=>new Date(now.getTime()-days*86400000).toISOString());
    const total=await db.execute({sql:"SELECT coalesce(sum(snapshot_count),0) AS total FROM catalogue_sources WHERE enabled=1 AND last_success_at>=?",args:[fresh]});
    const r=await db.execute({sql:`SELECT sum(CASE WHEN j.published_at>=? THEN 1 ELSE 0 END) AS d1,sum(CASE WHEN j.published_at>=? THEN 1 ELSE 0 END) AS d7,count(*) AS d30 FROM catalogue_jobs j INDEXED BY catalogue_job_posted_source JOIN catalogue_sources s ON s.id=j.source_id WHERE ${recent} AND j.published_at>=? AND j.published_at<=?`,args:[dates[0]!,dates[1]!,fresh,dates[2]!,now.toISOString()]});const x=r.rows[0];
    counts={'':Number(total.rows[0].total),'1':Number(x.d1??0),'7':Number(x.d7??0),'30':Number(x.d30??0)};
  } else {
    const dates = [1, 7, 30].map((days) =>
      new Date(now.getTime() - days * 86400000).toISOString(),
    );
    const r = await db.execute({
      sql: `SELECT count(*) AS total,sum(CASE WHEN j.published_at>=? THEN 1 ELSE 0 END) AS d1,sum(CASE WHEN j.published_at>=? THEN 1 ELSE 0 END) AS d7,sum(CASE WHEN j.published_at>=? THEN 1 ELSE 0 END) AS d30 ${companyId?",sum(CASE WHEN j.work_mode='Remote' THEN 1 ELSE 0 END) AS remote_total":""} ${company?from:from.replace(' JOIN catalogue_companies c ON c.id=j.company_id','').replace('FROM catalogue_jobs j ',work&&!location&&!companyId?'FROM catalogue_jobs j INDEXED BY catalogue_job_work_cover ':'FROM catalogue_jobs j ')} WHERE ${where.join(" AND ")}`,
      args: [...dates, ...args],
    });
    const x = r.rows[0];
    if(companyId)remoteTotal=Number(x.remote_total??0);
    counts = {
      "": Number(x.total),
      "1": Number(x.d1 ?? 0),
      "7": Number(x.d7 ?? 0),
      "30": Number(x.d30 ?? 0),
    };
  }
  const posted = text("posted");
  if (posted && ["1", "7", "30"].includes(posted)) {
    where.push("j.published_at>=?");
    args.push(
      new Date(now.getTime() - Number(posted) * 86400000).toISOString(),
    );
  }
  const order =
    sort === "company"
      ? "c.name_key,j.title"
      : sort === "posted"
        ? "j.published_at DESC,j.id"
        : "s.last_success_at DESC,j.id";
  const n = limit(p.get("limit")),
    offset = offsetValue(p.get("offset"));
  const r = await db.execute({
    sql: `WITH matched AS MATERIALIZED (SELECT j.id ${where.length===1&&sort!=="company"&&sort!=="posted"?"FROM catalogue_sources s CROSS JOIN catalogue_jobs j ON j.source_id=s.id JOIN catalogue_companies c ON c.id=j.company_id":from} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?) SELECT ${columns} FROM matched m JOIN catalogue_jobs j ON j.id=m.id JOIN catalogue_sources s ON s.id=j.source_id JOIN catalogue_companies c ON c.id=j.company_id ORDER BY ${order}` ,
    args: [...args, n, offset],
  });
  return {
    rows: r.rows.map(job),
    total: counts[posted] ?? counts[""],
    postedCounts: counts,
    ...(remoteTotal===undefined?{}:{remoteTotal}),
  };
}
