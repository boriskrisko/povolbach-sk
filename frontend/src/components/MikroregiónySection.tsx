'use client';

import { useState, useEffect } from 'react';
import { formatAmount, formatProjects } from '@/lib/utils';
import { t, type Locale } from '@/lib/translations';
import { useData, Period } from '@/lib/DataContext';

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
  const [data14, setData14] = useState<MikroStats | null>(null);
  const [data21, setData21] = useState<MikroStats | null>(null);
  const [selected, setSelected] = useState<MikroCategory | null>(null);

  useEffect(() => {
    fetch('/mikroregiony_stats_14.json').then(r => r.json()).then(setData14).catch(() => {});
    fetch('/mikroregiony_stats_21.json').then(r => r.json()).then(setData21).catch(() => {});
  }, []);

  const data = period === '21' ? data21 : data14;

  if (!data) return null;

  const totalCount = data.categories.reduce((s, c) => s + c.count, 0);
  const totalEur = data.categories.reduce((s, c) => s + c.total_contracted_eur, 0);

  const heading = locale === 'sk' ? 'Medzikomunálna spolupráca' : 'Inter-Municipal Cooperation';
  const subtitle = locale === 'sk'
    ? `${totalCount} združení obcí a mikroregiónov · ${formatAmount(totalEur, locale)} zo štruktúrnych fondov EÚ`
    : `${totalCount} inter-municipal bodies · ${formatAmount(totalEur, locale)} from EU structural funds`;
  const noteText = locale === 'sk'
    ? 'Tieto prostriedky nie sú zahrnuté v hodnotení jednotlivých obcí — ide o spoločné projekty viacerých samospráv.'
    : 'These funds are not included in individual municipality scores — they represent joint projects across multiple municipalities.';

  return (
    <section id="mikroregiony" className="py-24 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold text-[#f8fafc] mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>{heading}</h2>
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
              <div className="text-sm font-semibold text-[#f8fafc] mb-2 group-hover:text-[#3b82f6] transition-colors leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{label}</div>
              <div className="font-mono font-bold text-xl mb-0.5" style={{ color }}>{formatAmount(cat.total_contracted_eur, locale)}</div>
              <div className="text-[#94a3b8] text-xs mb-2">{cat.count} {locale === 'sk' ? 'združení' : 'entities'}</div>
              <div className="text-[#94a3b8]/60 text-xs leading-snug">{desc}</div>
            </button>
          );
        })}
      </div>

      {selected && <MikroModal cat={selected} cat14={data14?.categories.find(c => c.key === selected.key) ?? null} cat21={data21?.categories.find(c => c.key === selected.key) ?? null} locale={locale} onClose={() => setSelected(null)} />}
    </section>
  );
}

function MikroModal({ cat, cat14, cat21, locale, onClose }: { cat: MikroCategory; cat14: MikroCategory | null; cat21: MikroCategory | null; locale: Locale; onClose: () => void }) {
  const { period: globalPeriod, periodAvailable } = useData();
  const tr = t[locale];
  const [localPeriod, setLocalPeriod] = useState<Period>(globalPeriod);

  useEffect(() => { setLocalPeriod(globalPeriod); }, [globalPeriod]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [onClose]);

  const activeCat = localPeriod === '14' ? (cat14 || cat) : (cat21 || cat);
  const color = CAT_COLORS[activeCat.key] ?? '#94a3b8';
  const label = locale === 'sk' ? activeCat.label_sk : activeCat.label_en;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start overflow-y-auto bg-black/60 p-4 pt-[10vh]" onClick={onClose}>
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl w-full max-w-[720px] p-8 animate-fade-in-up overflow-y-auto" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>{label}</h2>
            <p className="text-[#94a3b8] text-sm mt-1">{activeCat.count} {locale === 'sk' ? 'združení' : 'entities'} · <span className="font-mono" style={{ color }}>{formatAmount(activeCat.total_contracted_eur, locale)}</span></p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Period toggle */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] text-[#94a3b8]/40 uppercase tracking-wider">{tr.modal_detail_label(localPeriod === '14' ? tr.modal_period_14 : tr.modal_period_21)}</span>
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5">
            {(['14', '21'] as Period[]).map(p => <button key={p} onClick={() => periodAvailable[p] && setLocalPeriod(p)} disabled={!periodAvailable[p]} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${localPeriod === p ? 'bg-[#3b82f6] text-white shadow-sm' : periodAvailable[p] ? 'text-[#94a3b8]/70 hover:text-[#f8fafc]' : 'text-[#94a3b8]/20 cursor-not-allowed'}`}>{p === '14' ? tr.modal_period_14 : tr.modal_period_21}</button>)}
          </div>
        </div>

        {activeCat.entries.length === 0 ? (
          <div className="text-center py-12"><div className="text-[#94a3b8] text-sm">{tr.modal_no_data}</div></div>
        ) : (
          <div className="space-y-2">
            {activeCat.entries.map((e, i) => (
              <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                <div className="text-sm text-[#f8fafc]/90 mb-1 line-clamp-2">{e.name}</div>
                <div className="flex justify-between text-xs">
                  <span className="font-mono" style={{ color }}>{formatAmount(e.total_contracted_eur, locale)}</span>
                  <span className="text-[#94a3b8]/70">{formatProjects(e.projects_count, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 text-xs text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
          {locale === 'sk' ? 'Prostriedky nie sú zahrnuté v hodnotení jednotlivých obcí — ide o spoločné projekty viacerých samospráv.' : 'Funds are not included in individual municipality scores — these are joint projects across multiple municipalities.'}
        </div>
      </div>
    </div>
  );
}
