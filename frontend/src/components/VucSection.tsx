'use client';

import { useState, useEffect } from 'react';
import { VucStats } from '@/lib/types';
import { formatAmount } from '@/lib/utils';
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
  const [vucData, setVucData] = useState<Record<string, VucStats>>({});
  const [selectedVuc, setSelectedVuc] = useState<VucStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const file = period === '2127' ? '/vuc_stats_2127.json' : '/vuc_stats.json';
    fetch(file)
      .then(r => r.json())
      .then((d: Record<string, VucStats>) => { setVucData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading || Object.keys(vucData).length === 0) return null;

  const sorted = Object.values(vucData).sort((a, b) => {
    if (viewMode === 'capita') {
      const apc = a.population > 0 ? a.total_contracted_eur / a.population : 0;
      const bpc = b.population > 0 ? b.total_contracted_eur / b.population : 0;
      return bpc - apc;
    }
    return b.total_contracted_eur - a.total_contracted_eur;
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
          const perCapita = v.population > 0 ? Math.round(v.total_contracted_eur / v.population) : 0;
          const subsPerCapita = v.population > 0 ? Math.round(v.subsidiary_total_eur / v.population) : 0;

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
                  <div className="text-[#94a3b8] text-xs">{directLabel}</div>
                  {v.subsidiary_total_eur > 0 && (
                    <div className="text-[#10b981] text-xs mt-1.5">
                      +{formatAmount(subsPerCapita, locale)} {capSuffix} {subsLabel}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-[#3b82f6] font-mono font-bold text-xl mb-0.5">
                    {formatAmount(v.total_contracted_eur, locale)}
                  </div>
                  <div className="text-[#94a3b8] text-xs">
                    {v.projects_active + v.projects_completed} {locale === 'sk' ? 'projektov' : 'projects'} · {directLabel}
                  </div>
                  {v.subsidiary_total_eur > 0 && (
                    <div className="text-[#10b981] text-xs mt-1.5">
                      +{formatAmount(v.subsidiary_total_eur, locale)} {subsLabel}
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <VucModal vuc={selectedVuc} onClose={() => setSelectedVuc(null)} locale={locale} />
    </section>
  );
}
