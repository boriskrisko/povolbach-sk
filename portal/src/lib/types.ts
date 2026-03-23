export interface Organization {
  id: string
  name: string
  country: string
  entity_type: EntityType
  parent_id: string | null
  reg_id: string | null
  population: number | null
  gps_lat: number | null
  gps_lng: number | null
  region: string | null
  district: string | null
  metadata: Record<string, unknown>
  claimed: boolean
  created_at: string
  updated_at: string
}

export type EntityType =
  | 'vuc'
  | 'mesto'
  | 'mestska_cast'
  | 'obec'
  | 'zdruzenie'
  | 'sme'
  | 'ngo'
  | 'skola'
  | 'stat'

export interface User {
  id: string
  email: string
  name: string | null
  org_id: string
  role: 'admin' | 'editor' | 'viewer'
  locale: string
  notification_frequency: 'daily' | 'weekly' | 'none'
  created_at: string
  last_login_at: string | null
}

export interface FundCall {
  id: string
  external_id: string | null
  code: string | null
  title: string
  description: string | null
  country: string
  program: string | null
  priority_axis: string | null
  specific_objective: string | null
  managing_authority: string | null
  eligible_entity_types: string[] | null
  eligible_regions: string[] | null
  excluded_regions: string[] | null
  population_min: number | null
  population_max: number | null
  min_grant_eur: number | null
  max_grant_eur: number | null
  cofinancing_rate: number | null
  published_at: string | null
  deadline: string | null
  allocation_eur: number | null
  status: 'open' | 'closed' | 'cancelled'
  source_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CallMatch {
  id: string
  org_id: string
  call_id: string
  relevance_score: number | null
  match_reasons: string[] | null
  notified: boolean
  notified_at: string | null
  dismissed: boolean
  created_at: string
  fund_calls?: FundCall
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  vuc: 'VÚC',
  mesto: 'Mesto',
  mestska_cast: 'Mestská časť',
  obec: 'Obec',
  zdruzenie: 'Združenie obcí',
  sme: 'Firma',
  ngo: 'Nezisková organizácia',
  skola: 'Škola',
  stat: 'Štátna inštitúcia',
}
