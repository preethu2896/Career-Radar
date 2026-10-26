export type VerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'NOT_FOUND' | 'UNKNOWN';
export type CountScope = 'CITY' | 'GLOBAL' | 'UNKNOWN';
export type JobStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type ObservationStatus = 'NEW' | 'PERSISTENT' | 'REMOVED' | 'UNKNOWN';
export type CityAssociationClass = 'VERIFIED_OFFICE' | 'POSSIBLE_OFFICE' | 'DATASET_ASSOCIATION' | 'CONFLICTING' | 'UNKNOWN';
export type IdentityReviewStatus = 'NO_REVIEW_NEEDED' | 'CONFIRMED_RELATIONSHIP' | 'UNRESOLVED_CANDIDATE' | 'KEEP_SEPARATE' | 'MANUAL_REVIEW';

export interface CityAssociation {
  city: string | null;
  datasetCity: string | null;
  associationClass: CityAssociationClass;
  evidence: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  source: 'REFERENCE_AUDIT' | 'SOURCE_DATASET' | 'UNKNOWN';
}

export interface AuditProvenance {
  verificationEvidence: string | null;
  checkedAt: string | null;
  confidence: string | null;
  notes: string | null;
  evidenceType: string | null;
  sourceUrls: string[];
}

export interface NormalizedRow {
  sourceFile: string;
  sourceRowId: string;
  sourceKind: 'CITY' | 'REMOTE' | 'UNKNOWN';
  sourceRow: number;
  datasetType: string | null;
  datasetCity: string | null;
  raw: Record<string, string>;
  canonicalName: string | null;
  originalCompanyName: string | null;
  website: string | null;
  careerUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  jobTitle: string | null;
  jobUrl: string | null;
  location: string | null;
  experienceRequirement: string | null;
  employmentType: string | null;
  workMode: string | null;
  description: string | null;
  skills: string[];
  educationRequirement: string | null;
  salary: string | null;
  verificationStatus: VerificationStatus;
  originalVerificationStatus: string | null;
  openingCount: number | null;
  openingCountScope: CountScope;
  sourceUrl: string | null;
  sourceUrls: string[];
  auditProvenance: AuditProvenance;
  cityAssociation: CityAssociation;
  identityReview: { status: IdentityReviewStatus; reasons: string[]; relatedNames: string[] };
}

export interface ImportError { sourceFile: string; sourceRow: number; message: string; raw: Record<string, string>; }
export interface ImportSummary {
  sourceFiles: number; rowsRead: number; imported: number; skipped: number; rejected: number;
  companies: number; duplicateCandidates: number; ambiguousCandidates: number; cityAssociations: number;
  careerSources: number; jobs: number; observations: number; missingOrInvalidUrls: number;
  missingJobTitles: number; unknownVerificationStatuses: number; byVerificationStatus: Record<string, number>;
  byOpeningCountScope: Record<CountScope, number>; globalCountRows: number; jobDetailRows: number;
  companyLevelRows: number; incompleteOrConflictingRows: number; errors: ImportError[];
}

export interface CareerProfile { careerStage: 'FRESHER' | 'EARLY_CAREER' | 'EXPERIENCED' | 'UNKNOWN'; skills: string[]; preferredCities?: string[]; preferredWorkModes?: string[]; industries?: string[]; }
export interface MatchReason { type: 'SKILL' | 'LOCATION' | 'WORK_MODE' | 'INDUSTRY' | 'CAREER_STAGE' | 'EVIDENCE'; text: string; evidence?: string; }
export interface MatchResult { entityType: 'COMPANY' | 'JOB'; entityId: string; score?: number; reasons: MatchReason[]; }
