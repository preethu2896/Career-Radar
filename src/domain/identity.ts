import { normalizeCompanyName, normalizeUrl } from './normalize.js';

export interface CompanyIdentity { name: string | null; domain: string | null; }
export function companyIdentity(name: unknown, website: unknown): CompanyIdentity {
  let domain: string | null = null;
  const url = normalizeUrl(website);
  if (url) { try { domain = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* normalized URL already checked */ } }
  return { name: normalizeCompanyName(name), domain };
}

export function dedupeKey(identity: CompanyIdentity): string | null { return identity.domain ? `domain:${identity.domain}` : identity.name ? `name:${identity.name}` : null; }
export function isAmbiguous(a: CompanyIdentity, b: CompanyIdentity): boolean { return !!a.name && !!b.name && a.name === b.name && !!a.domain && !!b.domain && a.domain !== b.domain; }
