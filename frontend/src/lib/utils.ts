import { Municipality, MunicipalityMap, RegionStats } from './types';
import type { Locale } from './translations';

export function formatAmount(amount: number, locale: Locale = 'sk'): string {
  if (locale === 'en') {
    if (amount === 0) return '€0';
    if (amount >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `€${Math.round(amount / 1_000)}k`;
    return `€${Math.round(amount)}`;
  }
  // Slovak locale
  if (amount === 0) return '0 €';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} mld. €`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mil. €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} tis. €`;
  return `${Math.round(amount)} €`;
}

// Backward-compat alias (always SK locale)
export function formatEur(amount: number): string {
  return formatAmount(amount, 'sk');
}

export function formatEurFull(amount: number): string {
  return `€${amount.toLocaleString('sk-SK', { maximumFractionDigits: 0 })}`;
}

export function formatBillions(amount: number, locale: Locale = 'sk'): string {
  if (locale === 'en') {
    if (amount >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(2)}B`;
    return `€${(amount / 1_000_000).toFixed(0)}M`;
  }
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} mld. €`;
  return `${(amount / 1_000_000).toFixed(0)} mil. €`;
}

export function getTop10(data: MunicipalityMap): Municipality[] {
  return Object.values(data)
    .sort((a, b) => b.total_contracted_eur - a.total_contracted_eur)
    .slice(0, 10);
}

export function getBottom10WithProjects(data: MunicipalityMap): Municipality[] {
  return Object.values(data)
    .filter(m => m.total_contracted_eur > 0)
    .sort((a, b) => a.total_contracted_eur - b.total_contracted_eur)
    .slice(0, 10);
}

export function getTotalEur(data: MunicipalityMap): number {
  return Object.values(data).reduce((sum, m) => sum + m.total_contracted_eur, 0);
}

export function getWithProjects(data: MunicipalityMap): number {
  return Object.values(data).filter(m => m.total_contracted_eur > 0).length;
}

export function getWithoutProjects(data: MunicipalityMap): number {
  return Object.values(data).filter(m => m.total_contracted_eur === 0).length;
}

export function getRegionStats(data: MunicipalityMap): RegionStats[] {
  const regions: Record<string, { totalEur: number; totalPopulation: number; count: number; withProjects: number; withoutProjects: number }> = {};

  for (const m of Object.values(data)) {
    const region = m.region || 'Neznámy';
    if (!regions[region]) {
      regions[region] = { totalEur: 0, totalPopulation: 0, count: 0, withProjects: 0, withoutProjects: 0 };
    }
    regions[region].totalEur += m.total_contracted_eur;
    regions[region].totalPopulation += m.population || 0;
    regions[region].count += 1;
    if (m.total_contracted_eur > 0) {
      regions[region].withProjects += 1;
    } else {
      regions[region].withoutProjects += 1;
    }
  }

  return Object.entries(regions)
    .map(([name, s]) => ({
      name,
      totalEur: s.totalEur,
      totalPopulation: s.totalPopulation,
      municipalityCount: s.count,
      avgEur: s.count > 0 ? s.totalEur / s.count : 0,
      withProjects: s.withProjects,
      withoutProjects: s.withoutProjects,
    }))
    .sort((a, b) => b.avgEur - a.avgEur);
}

export function searchMunicipalities(data: MunicipalityMap, query: string): Municipality[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  return Object.values(data)
    .filter(m => m.official_name.toLowerCase().includes(q))
    .sort((a, b) => {
      // Exact start match first
      const aStarts = a.official_name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.official_name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.total_contracted_eur - a.total_contracted_eur;
    })
    .slice(0, 20);
}

// Remove diacritics for search
export function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function searchMunicipalitiesFlexible(data: MunicipalityMap, query: string): Municipality[] {
  if (query.length < 2) return [];
  const q = removeDiacritics(query.toLowerCase());
  return Object.values(data)
    .filter(m => removeDiacritics(m.official_name.toLowerCase()).includes(q))
    .sort((a, b) => {
      const aName = removeDiacritics(a.official_name.toLowerCase());
      const bName = removeDiacritics(b.official_name.toLowerCase());
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.total_contracted_eur - a.total_contracted_eur;
    })
    .slice(0, 20);
}
