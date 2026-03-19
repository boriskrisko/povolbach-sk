'use client';

import { useState, useEffect } from 'react';
import { VucStats } from '@/lib/types';
import { formatAmount, formatProjects } from '@/lib/utils';
import ViewModeToggle from './ViewModeToggle';
import VucModal from './VucModal';
import { type Locale } from '@/lib/translations';
import { useData } from '@/lib/DataContext';

interface Props {
  viewMode: 'total' | 'capita';
  setViewMode: (m: 'total' | 'capita') => void;
  locale: Locale;
}

export default function VucSection({ viewMode, setViewMode, locale }: Props) {
  const { period } = useData();
  const [vucData14, setVucData14] = useState<Record<string, VucStats>>({});
  const [vucData21, setVucData21] = useState<Record<string, VucStats>>({});
  const [selectedVuc, setSelectedVuc] = useState<VucStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load both periods on mount
    Promise.all([
      fetch('/vuc_stats_14.json').then(r => r.json()).catch(() => ({})),
      fetch('/vuc_stats_21.json').then(r => r.json()).catch(() => ({})),
    ]).then(([d14, d21]) => {
      setVucData14(d14);
      setVucData21(d21);
      setLoading(false);
    });
  }, []);

  const vucData = period === '2127' ? vucData21 : vucData14;
  const vucDataOther = period === '2127' ? vucData14 : vucData21;

  if (loading || Object.keys(vucData).length === 0) return null;

  const sorted = Object.values(vucData).sort((a, b) => {
    const aTotal = a.total_contracted_eur + (a.subsidiary_total_eur || 0);
    const bTotal = b.total_contracted_eur + (b.subsidiary_total_eur || 0);
    if (viewMode === 'capita') {
      const apc = a.population > 0 ? aTotal / a.population : 0;
      const bpc = b.population > 0 ? bTotal / b.population : 0;
      return bpc - apc;
    }
    return bTotal - aTotal;
  });

  const heading = locale === 'sk' ? 'Samosprávne kraje' : 'Regional Governments';
  const subtitle = locale === 'sk'
    ? 'Európske fondy čerpané na úrovni krajov'
    : 'EU funds absorbed at the regional government level';
  const capSuffix = locale === 'sk' ? '/ obyv.' : '/ cap.';
  const directLabel = locale === 'sk' ? 'priame' : 'direct';
  const subsLabel = locale === 'sk' ? 'zriaďované organizácie' : 'subsidiaries';

  return (
    <section className="py-24 px-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h2
          className="text-3xl md:text-4xl font-bold text-[#f8fafc]"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {heading}
        </h2>
        <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} locale={locale} />
      </div>
      <p className="text-[#94a3b8] mb-10">{subtitle}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.map(v => {
          const grandTotal = v.total_contracted_eur + (v.subsidiary_total_eur || 0);
          const perCapita = v.population > 0 ? Math.round(grandTotal / v.population) : 0;

          return (
            <button
              key={v.ico}
              onClick={() => setSelectedVuc(v)}
              className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5 text-left hover:border-[#3b82f6] transition-colors group"
            >
              <div
                className="text-sm font-semibold text-[#f8fafc] mb-3 group-hover:text-[#3b82f6] transition-colors leading-tight"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {v.name}
              </div>

              {viewMode === 'capita' ? (
                <>
                  <div className="text-[#3b82f6] font-mono font-bold text-xl mb-0.5">
                    {formatAmount(perCapita, locale)} {capSuffix}
                  </div>
                  {v.subsidiary_total_eur > 0 && (
                    <div className="text-[#94a3b8] text-xs">
                      {formatAmount(v.total_contracted_eur, locale)} {directLabel} + {formatAmount(v.subsidiary_total_eur, locale)} {subsLabel}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-[#3b82f6] font-mono font-bold text-xl mb-0.5">
                    {formatAmount(grandTotal, locale)}
                  </div>
                  <div className="text-[#94a3b8] text-xs">
                    {formatProjects(v.projects_active + v.projects_completed, locale)}
                    {v.subsidiary_total_eur > 0 && (
                      <> · {formatAmount(v.total_contracted_eur, locale)} {directLabel} + {formatAmount(v.subsidiary_total_eur, locale)} {subsLabel}</>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      <VucModal vuc={selectedVuc} vucOtherPeriod={selectedVuc ? (vucDataOther[selectedVuc.ico] ?? null) : null} onClose={() => setSelectedVuc(null)} locale={locale} />
    </section>
  );
}
