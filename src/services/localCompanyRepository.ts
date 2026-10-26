export type LocalSourceRow = {
  sourceRowId: string;
  sourceFile: string;
  sourceRow: number;
  datasetCity: string | null;
  cityAssociation: { city: string | null; datasetCity: string | null; associationClass: string; evidence: string | null; evidenceUrl: string | null; notes: string | null; source: string };
  verificationStatus: string;
  openingCount: number | null;
  openingCountScope: 'CITY' | 'GLOBAL' | 'UNKNOWN';
  website: string | null;
  careerUrl: string | null;
  sourceUrl: string | null;
  sourceUrls: string[];
  jobTitle: string | null;
  jobUrl: string | null;
  location: string | null;
  identityReview: { status: string; reasons: string[]; relatedNames: string[] };
};
export type LocalCompanyRecord = {
  id: string;
  identityKey: string;
  name: string;
  website: string | null;
  careerUrls: string[];
  industry: string | null;
  headquarters: string | null;
  verificationStatuses: string[];
  cityAssociations: LocalSourceRow['cityAssociation'][];
  sourceRows: LocalSourceRow[];
  roles: Array<{ title: string; url: string | null; location: string | null; sourceRowId: string }>;
  openingCounts: Array<{ count: number | null; scope: 'CITY' | 'GLOBAL' | 'UNKNOWN'; sourceRowId: string }>;
  identityReviewStatuses: string[];
};
export type LocalCompanyFilters = { query?: string; city?: string; verificationStatus?: string; hasRoles?: boolean; page?: number; pageSize?: number };
let cache: LocalCompanyRecord[] | null = null;

async function readIndex(): Promise<LocalCompanyRecord[]> {
  if (cache) return cache;
  const response = await fetch('/data/company-index.json');
  if (!response.ok) throw new Error(`LOCAL_DATA_HTTP_${response.status}`);
  cache = (await response.json()) as LocalCompanyRecord[];
  return cache;
}

export function createLocalCompanyRepository() {
  return {
    async search(filters: LocalCompanyFilters = {}) {
      const rows = await readIndex();
      const filtered = filterLocalCompanies(rows, filters);
      return paginateLocalCompanies(filtered, filters.page, filters.pageSize);
    },
    async all() { return readIndex(); },
  };
}

export function paginateLocalCompanies(rows: LocalCompanyRecord[], requestedPage = 1, requestedPageSize = 24) {
  const page = Math.max(1, requestedPage); const pageSize = Math.max(1, Math.min(100, requestedPageSize));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export function filterLocalCompanies(rows: LocalCompanyRecord[], filters: LocalCompanyFilters = {}) {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return rows.filter((company) => !query || `${company.name} ${company.industry ?? ''} ${company.headquarters ?? ''} ${company.sourceRows.flatMap((row) => [row.datasetCity ?? '', row.jobTitle ?? '']).join(' ')}`.toLowerCase().includes(query))
    .filter((company) => !filters.city || company.cityAssociations.some((association) => association.datasetCity === filters.city || association.city === filters.city))
    .filter((company) => !filters.verificationStatus || company.verificationStatuses.includes(filters.verificationStatus))
    .filter((company) => !filters.hasRoles || company.roles.length > 0);
}

export function resetLocalCompanyCache() { cache = null; }
