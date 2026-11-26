import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();});
async function client(){vi.stubEnv('VITE_PUBLIC_CATALOGUE_URL','https://catalogue.example.test/');return import('../src/services/publicCatalogueClient.js');}
it('forwards cancellation and allows a failed request to be retried',async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ok:true,json:async()=>({rows:[]})});vi.stubGlobal('fetch',fetcher);
 const {catalogueRequest}=await client();const controller=new AbortController();
 await expect(catalogueRequest('jobs',{},controller.signal)).rejects.toThrow('offline');
 controller.abort();expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true);
 await expect(catalogueRequest('jobs')).resolves.toEqual({rows:[]});
});
it('sends long saved-company lists in the request body with a deadline',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({rows:[]})});vi.stubGlobal('fetch',fetcher);
 const {catalogueRequest}=await client();await catalogueRequest('companies',{saved:JSON.stringify(Array.from({length:100},(_,i)=>'company-'+i+'x'.repeat(20)))});
 expect(fetcher.mock.calls[0]![0]).toBe('https://catalogue.example.test/');expect(fetcher.mock.calls[0]![1]).toMatchObject({method:'POST',signal:expect.any(AbortSignal)});
});
