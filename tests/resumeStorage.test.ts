import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn(), from: vi.fn(), storageFrom: vi.fn() }));
vi.mock('../src/services/auth.js', () => ({ getSession: async () => (await mocks.getSession()).data.session, supabase: { auth: { getSession: mocks.getSession }, functions: { invoke: mocks.invoke }, from: mocks.from, storage: { from: mocks.storageFrom } } }));
import { getSavedResume, removeSavedResume, saveResume, downloadSavedResume } from '../src/services/resumeStorage.js';
const pdf = () => new File(['%PDF-1.7 test'], 'resume.pdf', { type: 'application/pdf' });
beforeEach(() => { vi.resetAllMocks(); mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'alice' } } }, error: null }); });
it('requires consent and rejects renamed non-PDFs before invoking the backend', async () => {
  await expect(saveResume('alice', pdf(), false)).rejects.toThrow('agree');
  await expect(saveResume('alice', new File(['bad'], 'resume.pdf', { type: 'application/pdf' }), true)).rejects.toThrow('valid PDF');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('prevents an account mismatch before any request', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'bob' } } }, error: null });
  await expect(getSavedResume('alice')).rejects.toThrow('Sign in');
  await expect(saveResume('alice', pdf(), true)).rejects.toThrow('Sign in');
  await expect(removeSavedResume('alice')).rejects.toThrow('Sign in');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('uses the endpoint without direct storage writes or metadata upserts', async () => {
  const record = { user_id: 'alice', storage_path: 'alice/new.pdf' };
  mocks.invoke.mockResolvedValue({ data: { record }, error: null });
  expect(await saveResume('alice', pdf(), true)).toEqual(record);
  const [name, options] = mocks.invoke.mock.calls[0]!;
  expect(name).toBe('manage-resume'); expect(options.method).toBe('POST');
  expect(options.body.get('consent')).toBe('true');
  expect(mocks.storageFrom).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
});
it('fails closed if secure storage is unavailable', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: {} });
  await expect(saveResume('alice', pdf(), true)).rejects.toThrow('not be completed');
  expect(mocks.storageFrom).not.toHaveBeenCalled();
});
it('surfaces rate limits and rejects response ownership mismatches', async () => {
  mocks.invoke.mockResolvedValueOnce({ error: { context: new Response(JSON.stringify({ error: 'Too many resume uploads.' }), { status: 429 }) } });
  await expect(saveResume('alice', pdf(), true)).rejects.toThrow('Too many');
  mocks.invoke.mockResolvedValueOnce({ data: { record: { user_id: 'bob', storage_path: 'bob/file.pdf' } } });
  await expect(saveResume('alice', pdf(), true)).rejects.toThrow('confirmed');
});
it('requires backend confirmation before confirming deletion', async () => {
  mocks.invoke.mockResolvedValueOnce({ data: {} });
  await expect(removeSavedResume('alice')).rejects.toThrow('confirmed');
  mocks.invoke.mockResolvedValueOnce({ data: { removed: true } }); await removeSavedResume('alice');
  expect(mocks.invoke).toHaveBeenLastCalledWith('manage-resume', { method: 'DELETE' });
});

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
it('downloads the current private PDF with a fresh cache nonce and no-store',async()=>{
  vi.useFakeTimers();
  const download=vi.fn().mockResolvedValue({data:new Blob(['%PDF-1.7 test']),error:null});
  mocks.storageFrom.mockReturnValue({download});
  mocks.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'alice',storage_path:'alice/current.pdf',file_name:'resume.pdf'},error:null})})})});
  const link={href:'',download:'',click:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>link});
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test-download');
  vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  await downloadSavedResume('alice');
  expect(download).toHaveBeenCalledWith('alice/current.pdf',{cacheNonce:expect.any(String)},{cache:'no-store'});
  expect(link.click).toHaveBeenCalledOnce();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-download');
});
