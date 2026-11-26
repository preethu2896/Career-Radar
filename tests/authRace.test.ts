import { afterEach, expect, it, vi } from 'vitest';
import { getAuthSnapshot, getCachedAuthSnapshot, setCachedAuthSnapshot, signOut, supabase, StaleAuthSnapshotError, subscribeToAuthChanges } from '../src/services/auth.js';
import type { Session } from '@supabase/supabase-js';
const session = (id: string) => ({ user: { id, user_metadata: {}, app_metadata: {}, aud: 'authenticated', created_at: '' }, access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600 } as Session);
afterEach(() => { vi.restoreAllMocks(); setCachedAuthSnapshot(null); });
function deferredProfile() {
  let release!: (value: { data: null; error: null }) => void;
  const pending = new Promise<{ data: null; error: null }>(resolve => { release = resolve; });
  vi.spyOn(supabase!, 'from').mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => pending }) }) } as never);
  return () => release({ data: null, error: null });
}
it('rejects a profile response that completes after signout', async () => {
  const release = deferredProfile();
  vi.spyOn(supabase!.auth, 'signOut').mockResolvedValue({ error: null });
  const pending = getAuthSnapshot(session('alice'));
  const rejected = expect(pending).rejects.toBeInstanceOf(StaleAuthSnapshotError);
  await signOut(); release(); await rejected;
  expect(getCachedAuthSnapshot()).toBeNull();
});
it('does not let account A overwrite account B', async () => {
  const release = deferredProfile();
  const pending = getAuthSnapshot(session('alice'));
  const rejected = expect(pending).rejects.toBeInstanceOf(StaleAuthSnapshotError);
  vi.mocked(supabase!.from).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as never);
  await getAuthSnapshot(session('bob')); release(); await rejected;
  expect(getCachedAuthSnapshot()?.session?.user.id).toBe('bob');
});
it('does not let a delayed ambient session revive a signed-out account', async () => {
  let release!: (value: never) => void;
  vi.spyOn(supabase!.auth, 'getSession').mockReturnValue(new Promise(resolve => { release = resolve; }));
  vi.spyOn(supabase!.auth, 'signOut').mockResolvedValue({ error: null });
  const pending = getAuthSnapshot();
  const rejected = expect(pending).rejects.toBeInstanceOf(StaleAuthSnapshotError);
  await signOut(); release({ data: { session: session('alice') }, error: null } as never);
  await rejected; expect(getCachedAuthSnapshot()).toBeNull();
});

it('clears every subscriber immediately and lets all subscribers load the new account', async () => {
  const callbacks: ((event: 'SIGNED_IN', session: Session) => void)[] = [];
  vi.spyOn(supabase!.auth, 'onAuthStateChange').mockImplementation(callback => {
    callbacks.push(callback);
    return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
  });
  vi.spyOn(supabase!, 'from').mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as never);
  await getAuthSnapshot(session('alice'));
  const changed1 = vi.fn(), changed2 = vi.fn(), ready1 = vi.fn(), ready2 = vi.fn();
  const unsubscribe1 = subscribeToAuthChanges(ready1, changed1);
  const unsubscribe2 = subscribeToAuthChanges(ready2, changed2);
  try {
    for (const callback of callbacks) callback('SIGNED_IN', session('bob'));
    expect(changed1).toHaveBeenCalledOnce(); expect(changed2).toHaveBeenCalledOnce();
    expect(getCachedAuthSnapshot()).toBeNull();
    await vi.waitFor(() => {
      expect(ready1).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ user: expect.objectContaining({ id: 'bob' }) }) }));
      expect(ready2).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ user: expect.objectContaining({ id: 'bob' }) }) }));
    });
  } finally { unsubscribe1(); unsubscribe2(); }
});
