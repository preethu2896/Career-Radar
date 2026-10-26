const PLACEHOLDERS = new Set(['', '-', '--', 'n/a', 'na', 'none', 'null', 'unknown', 'not available', 'not found']);

export function clean(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return PLACEHOLDERS.has(text.toLowerCase()) ? null : text;
}

export function normalizeCompanyName(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function displayCompanyName(value: unknown): string | null {
  const text = clean(value);
  return text ? text.replace(/\s+/g, ' ') : null;
}

export function normalizeUrl(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

export const safeExternalUrl = normalizeUrl;

export function normalizeVerification(value: unknown): { status: import('./types.js').VerificationStatus; original: string | null } {
  const original = clean(value);
  if (!original) return { status: 'UNKNOWN', original: null };
  const normalized = original.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('verified') && normalized.includes('partial')) return { status: 'PARTIALLY_VERIFIED', original };
  if (normalized === 'verified' || normalized.includes('fully verified')) return { status: 'VERIFIED', original };
  if (normalized.includes('not found')) return { status: 'NOT_FOUND', original };
  if (normalized.includes('unverified') || normalized.includes('inaccessible')) return { status: 'UNVERIFIED', original };
  return { status: 'UNKNOWN', original };
}

export function parseSkills(value: unknown): string[] {
  const text = clean(value);
  if (!text) return [];
  return [...new Set(text.split(/[;,|\n]/).map((part) => part.trim()).filter(Boolean))];
}

export function parseRoles(value: unknown): string[] {
  const text = clean(value);
  if (!text) return [];
  return text.split(/\s*(?:\||;|\n)\s*/).map((part) => part.trim()).filter(Boolean);
}

export function parseCount(value: unknown): number | null {
  const text = clean(value)?.replace(/,/g, '');
  if (!text || !/^\d+$/.test(text)) return null;
  return Number(text);
}

export function parseUrls(value: unknown): string[] {
  const text = clean(value);
  if (!text) return [];
  return [...new Set(text.split(/[;,|\n]+/).map((part) => normalizeUrl(part.trim())).filter((url): url is string => !!url))];
}

export function inferCountScope(value: unknown, explicitScope: unknown): import('./types.js').CountScope {
  const explicit = clean(explicitScope)?.toUpperCase();
  if (explicit === 'CITY' || explicit === 'GLOBAL' || explicit === 'UNKNOWN') return explicit;
  const text = clean(value)?.toLowerCase();
  if (!text) return 'UNKNOWN';
  if (text.includes('global') || text.includes('worldwide') || text.includes('all locations')) return 'GLOBAL';
  if (text.includes('city') || text.includes('local')) return 'CITY';
  return 'UNKNOWN';
}
