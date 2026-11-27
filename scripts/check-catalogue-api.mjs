import assert from 'node:assert/strict';
import handler from '../api/catalogue.mjs';
const originalFetch=globalThis.fetch,originalUrl=process.env.VITE_PUBLIC_CATALOGUE_URL;
const response=()=>({statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});
try{
 process.env.VITE_PUBLIC_CATALOGUE_URL='https://runtime-check.supabase.co/functions/v1/catalogue';
 let calls=0;
 globalThis.fetch=async()=>{calls++;return{ok:true,json:async()=>({rows:[{id:'test',status:'OPEN',has_verified_source:true,source_url:null,application_url:null,last_checked_at:new Date().toISOString()}],total:1})};};
 const denied=response();await handler({method:'GET',url:'/api/catalogue?action=access&id=one'},denied);assert.equal(denied.statusCode,400);assert.equal(calls,0);
 const result=response();await handler({method:'GET',url:'/api/catalogue?action=jobs'},result);
 assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).rows[0].has_verified_source,true);assert.equal(JSON.parse(result.body).rows[0].application_url,null);assert.ok(result.headers['Vercel-CDN-Cache-Control']);
 globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({code:'CATALOGUE_READS_BLOCKED'})});
 const blocked=response();await handler({method:'GET',url:'/api/catalogue?action=jobs'},blocked);assert.equal(blocked.statusCode,503);assert.equal(blocked.headers['Vercel-CDN-Cache-Control'],undefined);
 console.log('Plain Node catalogue bundle: public browse, verified-source flag, private rejection and uncached failure passed.');
}finally{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.VITE_PUBLIC_CATALOGUE_URL;else process.env.VITE_PUBLIC_CATALOGUE_URL=originalUrl;}
