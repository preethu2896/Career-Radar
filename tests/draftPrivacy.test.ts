import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadDraft, saveDraft, blankDraft } from '../src/ui/CandidateOnboarding.js';
import { clearDraftStorage } from '../src/services/auth.js';
const prefix = 'career-radar-onboarding-draft';
function storage() {
  const records = new Map<string, string>();
  return { records, getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => records.set(key, value), removeItem: (key: string) => records.delete(key), key: (i: number) => [...records.keys()][i] ?? null, get length() { return records.size; } };
}
let local: ReturnType<typeof storage>;
let session: ReturnType<typeof storage>;
beforeEach(() => { local = storage(); session = storage(); vi.stubGlobal('window', { localStorage: local, sessionStorage: session }); });
afterEach(() => vi.unstubAllGlobals());
it('restores details only in the same tab for the matching owner', () => {
  saveDraft('alice', { ...blankDraft(), firstName: 'Private', phone: '9999999999', roles: ['Analyst'] });
  expect(loadDraft('alice').phone).toBe('9999999999');
  expect(loadDraft('bob').phone).toBe(''); expect(loadDraft().phone).toBe('');
  expect(local.getItem(prefix + ':alice')).not.toContain('9999999999');
  expect(local.getItem(prefix + ':alice')).not.toContain('Private');
  session.records.clear();
  expect(loadDraft('alice')).toMatchObject({ firstName: '', phone: '', roles: ['Analyst'] });
});
it('expires drafts after 24 hours and rejects future expiry', () => {
  saveDraft('alice', { ...blankDraft(), firstName: 'Private' }, 1000);
  expect(loadDraft('alice', 1000).firstName).toBe('Private');
  expect(loadDraft('alice', 0).firstName).toBe('');
  saveDraft('alice', { ...blankDraft(), firstName: 'Private' }, 1000);
  expect(loadDraft('alice', 1000 + 24 * 60 * 60 * 1000).firstName).toBe('');
  expect(session.records.size).toBe(0);
});
it('rejects mismatched, malformed and unversioned drafts', () => {
  for (const value of ['invalid', JSON.stringify({ _ownerId: 'bob', _expiresAt: Date.now() + 1000, phone: 'private' }), JSON.stringify({ _ownerId: 'alice', phone: 'private' })]) {
    local.setItem(prefix + ':alice', value); expect(loadDraft('alice').phone).toBe('');
  }
  local.setItem(prefix, JSON.stringify({ _ownerId: 'alice', phone: 'private' }));
  expect(loadDraft('alice').phone).toBe(''); expect(local.getItem(prefix)).toBeNull();
});
it('clears both storage areas on signout', () => {
  saveDraft('alice', { ...blankDraft(), phone: 'private' }); clearDraftStorage();
  expect(local.length).toBe(0); expect(session.length).toBe(0);
});
it('fails closed for unavailable storage and unexpected field types', () => {
  session.setItem(prefix + ':alice', JSON.stringify({ _ownerId: 'alice', _expiresAt: Date.now() + 1000, phone: {}, roles: 'bad' }));
  expect(loadDraft('alice')).toMatchObject({ phone: '', roles: [] });
  vi.stubGlobal('window', { get localStorage() { throw new Error('denied'); }, get sessionStorage() { throw new Error('denied'); } });
  expect(loadDraft('alice').phone).toBe('');
});
