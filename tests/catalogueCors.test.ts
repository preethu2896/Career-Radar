import{expect,it}from'vitest';
import{catalogueCorsHeaders}from'../supabase/functions/_shared/catalogueCors.js';
it('allows authenticated browser SDK request headers in the catalogue preflight',()=>{const allowed=catalogueCorsHeaders['access-control-allow-headers'].toLowerCase().split(',').map(x=>x.trim());for(const header of['authorization','apikey','content-type','x-client-info'])expect(allowed).toContain(header);expect(catalogueCorsHeaders['access-control-allow-methods']).toContain('OPTIONS');expect(catalogueCorsHeaders['access-control-allow-methods']).toContain('POST');});
