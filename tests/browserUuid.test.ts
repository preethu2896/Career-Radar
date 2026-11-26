import { afterEach, expect, it, vi } from 'vitest';
import { browserUuid } from '../src/services/browserUuid.js';
const nativeCrypto = globalThis.crypto;
afterEach(() => vi.unstubAllGlobals());
it('creates distinct v4 UUIDs on HTTP LAN pages without randomUUID', () => {
  vi.stubGlobal('crypto', { getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto) });
  const first = browserUuid();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(browserUuid()).not.toBe(first);
});
it('uses native randomUUID where available', () => {
  const randomUUID = vi.fn(() => 'test-uuid');
  vi.stubGlobal('crypto', { randomUUID });
  expect(browserUuid()).toBe('test-uuid');
  expect(randomUUID).toHaveBeenCalledOnce();
});