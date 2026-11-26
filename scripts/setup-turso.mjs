import{readFile}from'node:fs/promises';import{createClient}from'@libsql/client/web';
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});const sql=await readFile('catalogue/schema.sql','utf8');await db.executeMultiple(sql.replace(/^\uFEFF/,''));console.log('Public catalogue schema installed; no private user tables created.');
