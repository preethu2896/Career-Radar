import type { ObservationStatus } from './types.js';

export function classifyObservation(previous: { title: string; jobUrl: string | null } | null, current: { title: string; jobUrl: string | null }): ObservationStatus {
  if (!previous) return 'UNKNOWN';
  return previous.title.trim().toLowerCase() === current.title.trim().toLowerCase() && previous.jobUrl === current.jobUrl ? 'PERSISTENT' : 'UNKNOWN';
}

export function jobIdentity(companyId: string, title: string, jobUrl: string | null): string {
  return `${companyId}|${title.trim().toLowerCase().replace(/\s+/g, ' ')}|${jobUrl ?? ''}`;
}
