'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useData } from '@/lib/DataContext';
import { Municipality, MunicipalityMap } from '@/lib/types';
import { getCombinedTotal, haversineKm, computeNationalAvgPerCapita, formatAmount } from '@/lib/utils';
import { t, type Locale } from '@/lib/translations';

interface Story {
  type: 'neighbor_gap' | 'zero' | 'potential' | 'jump';
  headline: string;
  detail: string;
  ico: string;
  color: string;
}

const PERIOD_LABELS: Record<string, { sk: string; en: string }> = {
  '14': { sk: '2014–2020', en: '2014–2020' },
  '21': { sk: '2021–2027', en: '2021–2027' },
};

function buildPool(data: MunicipalityMap, otherData: MunicipalityMap | null, period: string, locale: Locale): Story[] {
  const tr = t[locale];
  const pl = PERIOD_LABELS[period]?.[locale] ?? period;
  const otherPeriod = period === '14' ? '21' : '14';
  const opl = PERIOD_LABELS[otherPeriod]?.[locale] ?? otherPeriod;
  const munis = Object.values(data);
  const pool: Story[] = [];

  // A) Neighbor gaps — top 25 biggest per-capita ratios (pop >= 200, within 10km)
  const eligible = munis.filter(m => m.population >= 200 && m.gps_lat && m.gps_lon);
  const gaps: { high: Municipality; low: Municipality; ratio: number; dist: number }[] = [];
  const seenPairs = new Set<string>();
  for (const a of eligible) {
    const aPC = a.population > 0 ? getCombinedTotal(a) / a.population : 0;
    if (aPC < 1) continue;
    for (const b of eligible) {
      if (a.ico >= b.ico) continue; // avoid duplicates
      const bPC = b.population > 0 ? getCombinedTotal(b) / b.population : 0;
      if (bPC < 1) continue;
      const dist = haversineKm(a.gps_lat!, a.gps_lon!, b.gps_lat!, b.gps_lon!);
      if (dist > 10) continue;
      const pairKey = [a.ico, b.ico].sort().join('-');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const [high, low] = aPC >= bPC ? [a, b] : [b, a];
      const ratio = Math.max(aPC, bPC) / Math.min(aPC, bPC);
      if (ratio >= 3) gaps.push({ high, low, ratio, dist });
    }
  }
  gaps.sort((a, b) => b.ratio - a.ratio);
  for (const g of gaps.slice(0, 25)) {
    const hPC = Math.round(getCombinedTotal(g.high) / g.high.population);
    const lPC = Math.round(getCombinedTotal(g.low) / g.low.population);
    const detail = locale === 'sk'
      ? `${g.high.official_name} (${formatAmount(hPC, locale)}/ob.) vs ${g.low.official_name} (${formatAmount(lPC, locale)}/ob.) — ${Math.round(g.ratio)}× rozdiel, len ${g.dist.toFixed(1)} km od seba. Obdobie ${pl}.`
      : `${g.high.official_name} (${formatAmount(hPC, locale)}/cap.) vs ${g.low.official_name} (${formatAmount(lPC, locale)}/cap.) — ${Math.round(g.ratio)}× gap, only ${g.dist.toFixed(1)} km apart. Period ${pl}.`;
    pool.push({ type: 'neighbor_gap', headline: tr.story_neighbor_gap, detail, ico: g.low.ico, color: '#ef4444' });
  }

  // B) Zero absorption — top 25 largest municipalities with €0
  const zeros = munis.filter(m => getCombinedTotal(m) === 0 && m.population > 0)
    .sort((a, b) => b.population - a.population)
    .slice(0, 25);
  const totalZeros = munis.filter(m => getCombinedTotal(m) === 0).length;
  for (const z of zeros) {
    const detail = locale === 'sk'
      ? `${z.official_name} (${z.population.toLocaleString('sk-SK')} obyvateľov) nezískala ani cent za celé obdobie ${pl}. Celkovo ${totalZeros} obcí bez projektu.`
      : `${z.official_name} (${z.population.toLocaleString('en')} residents) received zero EU funds in the entire ${pl} period. ${totalZeros} municipalities total without a project.`;
    pool.push({ type: 'zero', headline: tr.story_zero_absorption, detail, ico: z.ico, color: '#f59e0b' });
  }

  // C) Unfulfilled potential — top 25 biggest gaps vs national average (pop >= 500)
  const natAvg = computeNationalAvgPerCapita(data);
  const potentials: { muni: Municipality; gap: number; pct: number }[] = [];
  for (const m of munis) {
    if (m.population < 500) continue;
    const pc = m.population > 0 ? getCombinedTotal(m) / m.population : 0;
    const gap = (natAvg - pc) * m.population;
    if (gap > 0) {
      const pct = natAvg > 0 ? Math.round((pc / natAvg) * 100) : 0;
      potentials.push({ muni: m, gap, pct });
    }
  }
  potentials.sort((a, b) => b.gap - a.gap);
  for (const p of potentials.slice(0, 25)) {
    const detail = locale === 'sk'
      ? `${p.muni.official_name} nechala na stole ${formatAmount(p.gap, locale)} v období ${pl} — čerpá len ${p.pct}% národného priemeru.`
      : `${p.muni.official_name} left ${formatAmount(p.gap, locale)} on the table in ${pl} — absorbs only ${p.pct}% of national average.`;
    pool.push({ type: 'potential', headline: tr.story_unfulfilled, detail, ico: p.muni.ico, color: '#8b5cf6' });
  }

  // D) Biggest jumps between periods — top 25 increases + top 25 decreases (pop >= 500)
  if (otherData) {
    const jumps: { muni: Municipality; from: number; to: number; pctChange: number }[] = [];
    for (const m of munis) {
      if (m.population < 500) continue;
      const other = otherData[m.ico];
      if (!other) continue;
      const cur = getCombinedTotal(m);
      const prev = getCombinedTotal(other);
      if (prev < 10000 && cur < 10000) continue;
      if (prev === 0) continue;
      const pctChange = ((cur - prev) / prev) * 100;
      jumps.push({ muni: m, from: prev, to: cur, pctChange });
    }

    // Top increases
    jumps.sort((a, b) => b.pctChange - a.pctChange);
    for (const j of jumps.slice(0, 25)) {
      if (j.pctChange <= 0) break;
      const sign = '+';
      const detail = locale === 'sk'
        ? `${j.muni.official_name} — z ${formatAmount(j.from, locale)} v období ${opl} na ${formatAmount(j.to, locale)} v období ${pl} (${sign}${Math.round(j.pctChange)}%).`
        : `${j.muni.official_name} — from ${formatAmount(j.from, locale)} in ${opl} to ${formatAmount(j.to, locale)} in ${pl} (${sign}${Math.round(j.pctChange)}%).`;
      pool.push({ type: 'jump', headline: tr.story_biggest_jump, detail, ico: j.muni.ico, color: '#10b981' });
    }

    // Top decreases
    jumps.sort((a, b) => a.pctChange - b.pctChange);
    for (const j of jumps.slice(0, 25)) {
      if (j.pctChange >= 0) break;
      const detail = locale === 'sk'
        ? `${j.muni.official_name} — z ${formatAmount(j.from, locale)} v období ${opl} na ${formatAmount(j.to, locale)} v období ${pl} (${Math.round(j.pctChange)}%).`
        : `${j.muni.official_name} — from ${formatAmount(j.from, locale)} in ${opl} to ${formatAmount(j.to, locale)} in ${pl} (${Math.round(j.pctChange)}%).`;
      pool.push({ type: 'jump', headline: tr.story_biggest_jump, detail, ico: j.muni.ico, color: '#10b981' });
    }
  }

  return pool;
}

function pickRandom4(pool: Story[]): Story[] {
  if (pool.length <= 4) return pool;
  // Pick one from each type if available, then fill randomly
  const byType: Record<string, Story[]> = {};
  for (const s of pool) {
    (byType[s.type] ??= []).push(s);
  }
  const picked: Story[] = [];
  const usedIdx = new Set<number>();
  for (const type of ['neighbor_gap', 'zero', 'potential', 'jump']) {
    const bucket = byType[type];
    if (!bucket || bucket.length === 0) continue;
    const idx = Math.floor(Math.random() * bucket.length);
    const story = bucket[idx];
    const poolIdx = pool.indexOf(story);
    if (poolIdx >= 0 && !usedIdx.has(poolIdx)) {
      picked.push(story);
      usedIdx.add(poolIdx);
    }
    if (picked.length >= 4) break;
  }
  // Fill remaining slots randomly
  while (picked.length < 4) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!usedIdx.has(idx)) {
      picked.push(pool[idx]);
      usedIdx.add(idx);
    }
  }
  return picked;
}

interface Props {
  locale: Locale;
  onSelectMunicipality: (m: Municipality | null) => void;
}

export default function StoriesSection({ locale, onSelectMunicipality }: Props) {
  const { data, period, getDataForPeriod } = useData();
  const tr = t[locale];

  const otherData = getDataForPeriod(period === '14' ? '21' : '14');

  const pool = useMemo(() => {
    if (!data) return [];
    return buildPool(data, otherData, period, locale);
  }, [data, otherData, period, locale]);

  const [stories, setStories] = useState<Story[]>([]);

  // Pick random 4 when pool changes (period toggle, data load)
  useEffect(() => {
    if (pool.length > 0) setStories(pickRandom4(pool));
  }, [pool]);

  const reroll = useCallback(() => {
    setStories(pickRandom4(pool));
  }, [pool]);

  if (stories.length === 0) return null;

  return (
    <section id="pribehy" className="py-24 px-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>
          {tr.did_you_know}
        </h2>
        {pool.length > 4 && (
          <button
            onClick={reroll}
            className="text-sm text-[#94a3b8] hover:text-[#f8fafc] transition-colors bg-white/[0.04] rounded-lg px-3 py-1.5 border border-white/[0.06] hover:border-white/[0.12]"
          >
            {tr.more_stories}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stories.map((story, i) => (
          <button
            key={`${story.ico}-${i}`}
            onClick={() => {
              const m = data?.[story.ico];
              if (m) onSelectMunicipality(m);
            }}
            className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5 text-left hover:border-white/20 transition-all group"
            style={{ borderLeftWidth: 3, borderLeftColor: story.color }}
          >
            <div className="text-sm font-semibold text-[#f8fafc] mb-1 group-hover:text-[#3b82f6] transition-colors">
              {story.headline}
            </div>
            <div className="text-sm text-[#94a3b8] leading-relaxed">
              {story.detail}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
