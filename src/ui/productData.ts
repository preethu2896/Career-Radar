import { createCompanyRepository } from '../services/companyRepository.js';
import { createLocalCompanyRepository, type LocalCompanyRecord } from '../services/localCompanyRepository.js';
import type { Company } from './mockData.js';

export type ProductDataResult = { companies: Company[]; source: 'local' | 'live' | 'demo'; error: string | null };
const statusLabel = (values: string[]) => values.length === 1 && values[0] === 'VERIFIED' ? 'Verified' : values.some((value) => value === 'PARTIALLY_VERIFIED') ? 'Partially verified' : values.some((value) => value === 'UNVERIFIED') ? 'Unverified' : 'Unknown';
const colorFor = (name: string) => `hsl(${Math.abs([...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360} 48% 48%)`;
const toCompany = (record: LocalCompanyRecord): Company => { const scopes = [...new Set(record.openingCounts.map((item) => item.scope))]; const known = record.openingCounts.filter((item) => item.count !== null); const openingSummary = known.length ? known.map((item) => `${item.count} ${item.scope.toLowerCase()} count`).join(' · ') : scopes.length ? `Opening scope: ${scopes.join(' / ')} · count unavailable` : 'Opening count: unknown'; return { id: record.id, name: record.name, mark: record.name.slice(0, 1).toUpperCase(), accent: colorFor(record.name), category: record.industry ?? 'Industry not established', city: [...new Set(record.cityAssociations.map((association) => association.datasetCity ?? association.city).filter((value): value is string => !!value))].join(' · ') || 'Location unknown', status: statusLabel(record.verificationStatuses) as Company['status'], match: null, reason: record.identityReviewStatuses.some((status) => status !== 'NO_REVIEW_NEEDED') ? 'Identity review is required before this record can be used as a recommendation.' : 'No illustrative recommendation reason is presented for local records.', roles: record.roles.length || null, signal: record.identityReviewStatuses.some((status) => status !== 'NO_REVIEW_NEEDED') ? 'Review required' : 'Source evidence available', signalTone: 'neutral', source: record.careerUrls.length ? 'Career source available' : 'Source unknown', lastChecked: 'Date not established', skills: [], description: 'No verified company description is available.', website: record.website ?? '', careerUrls: record.careerUrls, demoData: false, openingSummary }; };

export async function loadProductCompanies(query = ''): Promise<ProductDataResult> {
  const localRepository = createLocalCompanyRepository();
  try {
    const records = await localRepository.all();
    return { source: 'local', error: null, companies: records.filter((record) => !query || `${record.name} ${record.industry ?? ''}`.toLowerCase().includes(query.toLowerCase())).map(toCompany) };
  } catch (localError) {
    const repository = createCompanyRepository();
    if (!repository.configured) return { companies: [], source: 'demo', error: localError instanceof Error ? localError.message : 'LOCAL_DATA_UNAVAILABLE' };
    try {
      const records = await repository.search({ query });
      return { source: 'live', error: null, companies: records.map((record) => ({ id: record.id, name: record.canonical_name, mark: record.canonical_name.slice(0, 1).toUpperCase(), accent: colorFor(record.canonical_name), category: record.industry ?? 'Industry not established', city: record.locations?.[0]?.city ?? record.locations?.[0]?.dataset_city ?? 'Location unknown', status: record.verification_status === 'VERIFIED' ? 'Verified' : 'Unknown', match: null, reason: 'No illustrative recommendation reason is presented for live records.', roles: null, signal: 'Source evidence available', signalTone: 'neutral', source: record.source_url ? 'Source available' : 'Source unknown', lastChecked: 'Date not established', skills: [], description: record.description ?? 'No verified company description is available.', website: record.website ?? '', demoData: false })) };
    } catch (error) { return { companies: [], source: 'demo', error: error instanceof Error ? error.message : 'LIVE_DATA_UNAVAILABLE' }; }
  }
}
