export interface IndirectProject {
  name: string;
  beneficiary_name: string;
  beneficiary_ico: string;
  contracted_eur: number;
  status: string;
}

export interface SubsidiaryOrg {
  ico: string;
  name: string;
  total_contracted_eur: number;
  projects_count: number;
  co_owners?: number;
  full_amount_eur?: number;
  share_pct?: number;
}

export interface VucStats {
  ico: string;
  name: string;
  name_short: string;
  region_key: string;
  population: number;
  total_contracted_eur: number;
  projects_active: number;
  projects_completed: number;
  projects: ProjectSummary[];
  subsidiary_total_eur: number;
  subsidiary_orgs: SubsidiaryOrg[];
  irregularities_count?: number;
  irregularities_total_eur?: number;
}

export interface Municipality {
  ico: string;
  official_name: string;
  nuts5_code: string;
  region: string;
  district: string;
  population: number;
  type: string;
  active_projects: number;
  completed_projects: number;
  total_contracted_eur: number;
  total_contracted_amended_eur: number;
  gps_lat: number | null;
  gps_lon: number | null;
  irregularities_count: number;
  irregularities_total_eur: number;
  projects: ProjectSummary[];
  indirect_projects?: IndirectProject[];
  indirect_total_eur?: number;
  subsidiary_total_eur?: number;
  subsidiary_orgs?: SubsidiaryOrg[];
}

export interface ProjectSummary {
  nazov: string;
  sumaZazmluvnena: number;
  stav: string;
  datumKoncaRealizacie?: string;
}

export interface MunicipalityMap {
  [ico: string]: Municipality;
}

export interface RegionStats {
  name: string;
  totalEur: number;
  totalPopulation: number;
  municipalityCount: number;
  avgEur: number;
  withProjects: number;
  withoutProjects: number;
}

export interface GlobalStats {
  totalMunicipalities: number;
  totalFundsEur: number;
  withProjects: number;
  withoutProjects: number;
  totalIndirectEur: number;
  withIndirect: number;
  uniqueIndirectEur: number;
  uniqueIndirectCount: number;
  byRegion: Record<string, { total: number; count: number; zero: number }>;
}
