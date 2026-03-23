'use client';

import { useMemo } from 'react';
import { useData } from '@/lib/DataContext';
import { Municipality, MunicipalityMap } from '@/lib/types';
import { getCombinedTotal, haversineKm, computeNationalAvgPerCapita, formatAmount } from '@/lib/utils';
import { t, type Locale } from '@/lib/translations';

interface Story {
  headline: string;
  detail: string;
  ico: string;
  color: string;
}

function computeStories(data: MunicipalityMap, otherData: MunicipalityMap | null, locale: Locale): Story[] {
  const tr = t[locale];
  const munis = Object.values(data);
  const stories: Story[] = [];

  // 1. Biggest neighbor gap (pop >= 200, within 10km)
  let bestGap = { ratio: 0, high: null as Municipality | null, low: null as Municipality | null, dist: 0 };
  const eligible = munis.filter(m => m.population >= 200 && m.gps_lat && m.gps_lon);
  for (const a of eligible) {
    const aPC = a.population > 0 ? getCombinedTotal(a) / a.population : 0;
    if (aPC < 1) continue;
    for (const b of eligible) {
      if (a.ico === b.ico) continue;
      const bPC = b.population > 0 ? getCombinedTotal(b) / b.population : 0;
      if (bPC < 1 || aPC <= bPC) continue;
      const dist = haversineKm(a.gps_lat!, a.gps_lon!, b.gps_lat!, b.gps_lon!);
      if (dist > 10) continue;
      const ratio = aPC / bPC;
      if (ratio > bestGap.ratio) {
        bestGap = { ratio, high: a, low: b, dist };
      }
    }
  }
  if (bestGap.high && bestGap.low) {
    const hPC = Math.round(getCombinedTotal(bestGap.high) / bestGap.high.population);
    const lPC = Math.round(getCombinedTotal(bestGap.low) / bestGap.low.population);
    const detail = locale === 'sk'
      ? `${bestGap.high.official_name} (${formatAmount(hPC, locale)}/ob.) vs ${bestGap.low.official_name} (${formatAmount(lPC, locale)}/ob.) — ${Math.round(bestGap.ratio)}× rozdiel, len ${bestGap.dist.toFixed(1)} km od seba.`
      : `${bestGap.high.official_name} (${formatAmount(hPC, locale)}/cap.) vs ${bestGap.low.official_name} (${formatAmount(lPC, locale)}/cap.) — ${Math.round(bestGap.ratio)}× gap, only ${bestGap.dist.toFixed(1)} km apart.`;
    stories.push({ headline: tr.story_neighbor_gap, detail, ico: bestGap.low.ico, color: '#ef4444' });
  }

  // 2. Zero absorption — count and find largest
  const zeros = munis.filter(m => getCombinedTotal(m) === 0);
  const largestZero = zeros.sort((a, b) => (b.population || 0) - (a.population || 0))[0];
  if (zeros.length > 0 && largestZero) {
    const detail = locale === 'sk'
      ? `${zeros.length} obcí nezískalo ani cent. Najväčšia: ${largestZero.official_name} (${largestZero.population.toLocaleString('sk-SK')} obyvateľov).`
      : `${zeros.length} municipalities received zero funds. Largest: ${largestZero.official_name} (${largestZero.population.toLocaleString('en')} residents).`;
    stories.push({ headline: tr.story_zero_absorption, detail, ico: largestZero.ico, color: '#f59e0b' });
  }

  // 3. Biggest unfulfilled potential (vs national average, pop >= 5000)
  const natAvg = computeNationalAvgPerCapita(data);
  let worstGap = { muni: null as Municipality | null, gap: 0, pct: 0 };
  for (const m of munis) {
    if (m.population < 5000) continue;
    const pc = m.population > 0 ? getCombinedTotal(m) / m.population : 0;
    const gap = (natAvg - pc) * m.population;
    if (gap > worstGap.gap) {
      const pct = natAvg > 0 ? Math.round((pc / natAvg) * 100) : 0;
      worstGap = { muni: m, gap, pct };
    }
  }
  if (worstGap.muni) {
    const detail = locale === 'sk'
      ? `${worstGap.muni.official_name} nechala na stole ${formatAmount(worstGap.gap, locale)} — čerpá len ${worstGap.pct}% národného priemeru.`
      : `${worstGap.muni.official_name} left ${formatAmount(worstGap.gap, locale)} on the table — absorbs only ${worstGap.pct}% of national average.`;
    stories.push({ headline: tr.story_unfulfilled, detail, ico: worstGap.muni.ico, color: '#8b5cf6' });
  }

  // 4. Biggest jump between periods
  if (otherData) {
    let bestJump = { muni: null as Municipality | null, from: 0, to: 0, pctChange: 0 };
    for (const m of munis) {
      const other = otherData[m.ico];
      if (!other) continue;
      const cur = getCombinedTotal(m);
      const prev = getCombinedTotal(other);
      if (prev < 10000) continue; // Skip tiny base amounts
      const pctChange = ((cur - prev) / prev) * 100;
      if (pctChange > bestJump.pctChange) {
        bestJump = { muni: m, from: prev, to: cur, pctChange };
      }
    }
    if (bestJump.muni) {
      const sign = bestJump.pctChange > 0 ? '+' : '';
      const detail = locale === 'sk'
        ? `${bestJump.muni.official_name} — z ${formatAmount(bestJump.from, locale)} na ${formatAmount(bestJump.to, locale)} (${sign}${Math.round(bestJump.pctChange)}%) medzi obdobiami.`
        : `${bestJump.muni.official_name} — from ${formatAmount(bestJump.from, locale)} to ${formatAmount(bestJump.to, locale)} (${sign}${Math.round(bestJump.pctChange)}%) between periods.`;
      stories.push({ headline: tr.story_biggest_jump, detail, ico: bestJump.muni.ico, color: '#10b981' });
    }
  }

  return stories;
}

interface Props {
  locale: Locale;
  onSelectMunicipality: (m: Municipality | null) => void;
}

export default function StoriesSection({ locale, onSelectMunicipality }: Props) {
  const { data, period, getDataForPeriod } = useData();
  const tr = t[locale];

  const otherData = getDataForPeriod(period === '14' ? '21' : '14');

  const stories = useMemo(() => {
    if (!data) return [];
    return computeStories(data, otherData, locale);
  }, [data, otherData, locale]);

  if (stories.length === 0) return null;

  return (
    <section className="py-24 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold text-[#f8fafc] mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
        {tr.did_you_know}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {stories.map((story, i) => (
          <button
            key={i}
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
