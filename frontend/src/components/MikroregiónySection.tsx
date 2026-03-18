'use client';

import { useState, useEffect } from 'react';
import { formatAmount } from '@/lib/utils';
import { type Locale } from '@/lib/translations';
import { useData } from '@/lib/DataContext';

interface MikroEntry {
  ico: string;
  name: string;
  total_contracted_eur: number;
  projects_count: number;
}

interface MikroCategory {
  key: string;
  label_sk: string;
  label_en: string;
  desc_sk: string;
  desc_en: string;
  count: number;
  total_contracted_eur: number;
  entries: MikroEntry[];
}

interface MikroStats {
  total_count: number;
  total_contracted_eur: number;
  categories: MikroCategory[];
}

const CAT_COLORS: Record<string, string> = {
  voda: '#3b82f6',
  odpad: '#10b981',
  doprava: '#f59e0b',
  rozvoj: '#8b5cf6',
};

interface Props {
  locale: Locale;
}

export default function MikroregiónySection({ locale }: Props) {
  const { period } = useData();
  const [data, setData] = useState<MikroStats | null>(null);
  const [selected, setSelected] = useState<MikroCategory | null>(null);

  useEffect(() => {
    const file = period === '2127' ? '/mikroregiony_stats_2127.json' : '/mikroregiony_stats.json';
    fetch(file)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [period]);

  if (!data) return null;

  const heading = locale === 'sk' ? 'Medzikomunálna spolupráca' : 'Inter-Municipal Cooperation';
  const subtitle = locale === 'sk'
    ? `${data.total_count} združení obcí a mikroregiónov · ${formatAmount(data.total_contracted_eur, locale)} zo štruktúrnych fondov EÚ`
    : `${data.total_count} inter-municipal bodies · ${formatAmount(data.total_contracted_eur, locale)} from EU structural funds`;
  const noteText = locale === 'sk'
    ? 'Tieto prostriedky nie sú zahrnuté v hodnotení jednotlivých obcí — ide o spoločné projekty viacerých samospráv.'
    : 'These funds are not included in individual municipality scores — they represent joint projects across multiple municipalities.';

  return (
    <section className="py-24 px-4 max-w-6xl mx-auto">
      <h2
        className="text-3xl md:text-4xl font-bold text-[#f8fafc] mb-2"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {heading}
      </h2>
      <p className="text-[#94a3b8] mb-2">{subtitle}</p>
      <p className="text-[#94a3b8]/60 text-xs mb-10">{noteText}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.categories.map(cat => {
          const color = CAT_COLORS[cat.key] ?? '#94a3b8';
          const label = locale === 'sk' ? cat.label_sk : cat.label_en;
          const desc = locale === 'sk' ? cat.desc_sk : cat.desc_en;
          return (
            <button
              key={cat.key}
              onClick={() => setSelected(cat)}
              className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5 text-left hover:border-[#3b82f6] transition-colors group"
              style={{ borderLeftColor: color, borderLeftWidth: 3 }}
            >
              <div
                className="text-sm font-semibold text-[#f8fafc] mb-2 group-hover:text-[#3b82f6] transition-colors leading-tight"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {label}
              </div>
              <div className="font-mono font-bold text-xl mb-0.5" style={{ color }}>
                {formatAmount(cat.total_contracted_eur, locale)}
              </div>
              <div className="text-[#94a3b8] text-xs mb-2">
                {cat.count} {locale === 'sk' ? 'združení' : 'entities'}
              </div>
              <div className="text-[#94a3b8]/60 text-xs leading-snug">{desc}</div>
            </button>
          );
        })}
      </div>

      {selected && (
        <MikroModal cat={selected} locale={locale} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function MikroModal({ cat, locale, onClose }: { cat: MikroCategory; locale: Locale; onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const color = CAT_COLORS[cat.key] ?? '#94a3b8';
  const label = locale === 'sk' ? cat.label_sk : cat.label_en;
  const projectsWord = locale === 'sk' ? 'projektov' : 'projects';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl max-w-lg w-full mx-4 p-8 animate-fade-in-up overflow-y-auto"
        style={{ maxHeight: '85vh' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>
              {label}
            </h2>
            <p className="text-[#94a3b8] text-sm mt-1">
              {cat.count} {locale === 'sk' ? 'združení' : 'entities'} · <span className="font-mono" style={{ color }}>{formatAmount(cat.total_contracted_eur, locale)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="space-y-2">
          {cat.entries.map((e, i) => (
            <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
              <div className="text-sm text-[#f8fafc]/90 mb-1 line-clamp-2">{e.name}</div>
              <div className="flex justify-between text-xs">
                <span className="font-mono" style={{ color }}>{formatAmount(e.total_contracted_eur, locale)}</span>
                <span className="text-[#94a3b8]/70">{e.projects_count} {projectsWord}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
          {locale === 'sk'
            ? 'Prostriedky nie sú zahrnuté v hodnotení jednotlivých obcí — ide o spoločné projekty viacerých samospráv.'
            : 'Funds are not included in individual municipality scores — these are joint projects across multiple municipalities.'}
        </div>
      </div>
    </div>
  );
}
