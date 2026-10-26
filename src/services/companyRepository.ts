import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './auth.js';

export type CompanyRecord = { id: string; canonical_name: string; website: string | null; industry: string | null; description: string | null; headquarters: string | null; verification_status: string; source_url: string | null; locations?: Array<{ city: string | null; dataset_city: string | null; association_class: string; evidence: string | null }> };
export type CompanySearchFilters = { query?: string; city?: string; verificationStatus?: string; hasRoles?: boolean };

export function createCompanyRepository(client: SupabaseClient | null = supabase) {
  return {
    configured: Boolean(client),
    async search(filters: CompanySearchFilters = {}): Promise<CompanyRecord[]> {
      if (!client) return [];
      let query = client.from('companies').select('id,canonical_name,website,industry,description,headquarters,verification_status,source_url,company_locations(city,dataset_city,association_class,evidence),jobs(id)').order('canonical_name');
      if (filters.query) query = query.ilike('canonical_name', `%${filters.query}%`);
      if (filters.verificationStatus) query = query.eq('verification_status', filters.verificationStatus);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as CompanyRecord[]).filter((company) => !filters.city || company.locations?.some((location) => location.city === filters.city || location.dataset_city === filters.city)).filter((company) => !filters.hasRoles || ((company as CompanyRecord & { jobs?: unknown[] }).jobs?.length ?? 0) > 0);
    },
  };
}
