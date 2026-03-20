import { Municipality, MunicipalityMap, RegionStats } from './types';
import type { Locale } from './translations';

export function formatProjects(count: number, locale: Locale): string {
  if (locale === 'en') return count === 1 ? '1 project' : `${count} projects`;
  if (count === 1) return '1 projekt';
  if (count >= 2 && count <= 4) return `${count} projekty`;
  return `${count} projektov`;
}

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

/** Combined total: direct + subsidiary (the number that matters for absorption ranking). */
export function getCombinedTotal(m: Municipality): number {
  return (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
}

export function getTop10(data: MunicipalityMap): Municipality[] {
  return Object.values(data)
    .sort((a, b) => getCombinedTotal(b) - getCombinedTotal(a))
    .slice(0, 10);
}

export function getBottom10WithProjects(data: MunicipalityMap): Municipality[] {
  return Object.values(data)
    .filter(m => getCombinedTotal(m) > 0)
    .sort((a, b) => getCombinedTotal(a) - getCombinedTotal(b))
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
    regions[region].totalEur += getCombinedTotal(m);
    // Skip parent BA/KE population (already counted via their MČ)
    if (!PARENT_CITY_ICOS.has(m.ico)) {
      regions[region].totalPopulation += m.population || 0;
    }
    regions[region].count += 1;
    if (getCombinedTotal(m) > 0) {
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

/** Haversine distance in km between two GPS points */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NeighborResult {
  municipality: Municipality;
  distanceKm: number;
}

/** Find N nearest municipalities by GPS distance */
export function findNeighbors(targetIco: string, data: MunicipalityMap, count = 5): NeighborResult[] {
  const target = data[targetIco];
  if (!target?.gps_lat || !target?.gps_lon) return [];
  return Object.values(data)
    .filter(m => m.ico !== targetIco && m.gps_lat && m.gps_lon)
    .map(m => ({ municipality: m, distanceKm: haversineKm(target.gps_lat!, target.gps_lon!, m.gps_lat!, m.gps_lon!) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}

export interface SimilarSizeResult {
  municipality: Municipality;
  populationDiff: number;
}

/** Find N municipalities closest in population */
export function findSimilarSize(targetIco: string, data: MunicipalityMap, count = 5): SimilarSizeResult[] {
  const target = data[targetIco];
  if (!target?.population) return [];
  return Object.values(data)
    .filter(m => m.ico !== targetIco && m.population > 0)
    .map(m => ({ municipality: m, populationDiff: Math.abs(m.population - target.population) }))
    .sort((a, b) => a.populationDiff - b.populationDiff)
    .slice(0, count);
}

// Bratislava and Košice parent records duplicate their MČ populations.
// Exclude parent population (but keep their EUR — those are unique projects).
const PARENT_CITY_ICOS = new Set(['00603481', '00691135']); // Bratislava, Košice

/** Compute national per-capita average, excluding duplicate parent city populations */
export function computeNationalAvgPerCapita(data: MunicipalityMap): number {
  let totalEur = 0, totalPop = 0;
  for (const m of Object.values(data)) {
    totalEur += getCombinedTotal(m);
    if (!PARENT_CITY_ICOS.has(m.ico)) {
      totalPop += m.population || 0;
    }
  }
  return totalPop > 0 ? totalEur / totalPop : 0;
}

/** Find peer rank: municipalities in ±50% population within expanding radius */
export function findPeerRank(targetIco: string, data: MunicipalityMap): { rank: number; total: number; radiusKm: number; popMin: number; popMax: number } | null {
  const target = data[targetIco];
  if (!target?.population || !target.gps_lat || !target.gps_lon) return null;
  const popMin = Math.round(target.population * 0.5);
  const popMax = Math.round(target.population * 1.5);

  for (const radiusKm of [30, 50, 100]) {
    const peers: { ico: string; perCapita: number }[] = [];
    for (const m of Object.values(data)) {
      if (!m.population || m.population < popMin || m.population > popMax) continue;
      if (!m.gps_lat || !m.gps_lon) continue;
      const dist = haversineKm(target.gps_lat, target.gps_lon, m.gps_lat, m.gps_lon);
      if (dist > radiusKm) continue;
      const pc = m.population > 0 ? getCombinedTotal(m) / m.population : 0;
      peers.push({ ico: m.ico, perCapita: pc });
    }
    if (peers.length >= 5) {
      peers.sort((a, b) => b.perCapita - a.perCapita);
      const rank = peers.findIndex(p => p.ico === targetIco) + 1;
      return { rank, total: peers.length, radiusKm, popMin, popMax };
    }
  }
  return null;
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
      return getCombinedTotal(b) - getCombinedTotal(a);
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
      return getCombinedTotal(b) - getCombinedTotal(a);
    })
    .slice(0, 20);
}
