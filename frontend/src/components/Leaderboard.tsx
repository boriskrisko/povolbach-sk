'use client';

import { useData } from '@/lib/DataContext';
import { Municipality, GlobalStats } from '@/lib/types';
import { formatAmount, getCombinedTotal } from '@/lib/utils';
import ViewModeToggle from './ViewModeToggle';
import { t, type Locale } from '@/lib/translations';

type ViewMode = 'total' | 'capita';

interface Props {
  onSelectMunicipality: (m: Municipality) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  locale: Locale;
  globalStats: GlobalStats | null;
}

function getCapita(m: Municipality): number {
  return m.population > 0 ? getCombinedTotal(m) / m.population : 0;
}

function LeaderboardRow({
  m,
  rank,
  maxVal,
  color,
  onClick,
  viewMode,
  locale,
}: {
  m: Municipality;
  rank: number;
  maxVal: number;
  color: string;
  onClick: () => void;
  viewMode: ViewMode;
  locale: Locale;
}) {
  const tr = t[locale];
  const val = viewMode === 'capita' ? getCapita(m) : getCombinedTotal(m);
  const barWidth = maxVal > 0 ? (val / maxVal) * 100 : 0;
  const displayLabel = viewMode === 'capita'
    ? `${formatAmount(Math.round(val), locale)} ${tr.per_capita_suffix}`
    : formatAmount(val, locale);

  return (
    <button
      onClick={onClick}
      className="w-full text-left group hover:bg-[#1e1e2e]/50 rounded-lg px-3 py-2.5 transition-colors"
    >
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[#94a3b8] font-mono text-sm w-6 text-right">#{rank}</span>
        <span className="text-[#f8fafc] font-medium text-sm flex-1 truncate group-hover:text-[#3b82f6] transition-colors">
          {m.official_name}
        </span>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {displayLabel}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-6" />
        <div className="flex-1 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-[#94a3b8] text-xs w-24 text-right truncate">{m.region}</span>
      </div>
    </button>
  );
}

export default function Leaderboard({ onSelectMunicipality, viewMode, setViewMode, locale, globalStats }: Props) {
  const { data, loading, period } = useData();
  const tr = t[locale];

  if (loading || !data) return null;

  const all = Object.values(data);
  const zeroCount = globalStats?.withoutProjects ?? all.filter(m => m.total_contracted_eur === 0).length;

  const top10 = viewMode === 'capita'
    ? all.filter(m => m.population > 0 && getCombinedTotal(m) > 0)
        .sort((a, b) => getCapita(b) - getCapita(a))
        .slice(0, 10)
    : all.sort((a, b) => getCombinedTotal(b) - getCombinedTotal(a)).slice(0, 10);

  const bottom10 = viewMode === 'capita'
    ? all.filter(m => m.population > 0 && getCombinedTotal(m) > 0)
        .sort((a, b) => getCapita(a) - getCapita(b))
        .slice(0, 10)
    : all.filter(m => getCombinedTotal(m) > 0)
        .sort((a, b) => getCombinedTotal(a) - getCombinedTotal(b))
        .slice(0, 10);

  const maxTop = viewMode === 'capita'
    ? (top10[0] ? getCapita(top10[0]) : 1)
    : (top10[0] ? getCombinedTotal(top10[0]) : 1);

  const maxBottom = viewMode === 'capita'
    ? (bottom10.length > 0 ? getCapita(bottom10[bottom10.length - 1]) : 1)
    : (bottom10.length > 0 ? getCombinedTotal(bottom10[bottom10.length - 1]) : 1);

  return (
    <section id="rebricek" className="py-24 px-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h2
          className="text-3xl md:text-4xl font-bold text-[#f8fafc]"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {tr.leaderboard_title}
        </h2>
        <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} locale={locale} />
      </div>
      <p className="text-[#94a3b8] mb-12">
        {viewMode === 'capita' ? tr.leaderboard_subtitle_capita : tr.leaderboard_subtitle_total}
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Top 10 */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#10b981] mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
            {tr.leaderboard_top}
          </h3>
          <div className="space-y-1">
            {top10.map((m, i) => (
              <LeaderboardRow
                key={m.ico}
                m={m}
                rank={i + 1}
                maxVal={maxTop}
                color="#3b82f6"
                onClick={() => onSelectMunicipality(m)}
                viewMode={viewMode}
                locale={locale}
              />
            ))}
          </div>
        </div>

        {/* Bottom 10 */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#f59e0b] mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
            </svg>
            {tr.leaderboard_bottom}
          </h3>
          <div className="space-y-1">
            {bottom10.map((m, i) => (
              <LeaderboardRow
                key={m.ico}
                m={m}
                rank={i + 1}
                maxVal={maxBottom}
                color="#f59e0b"
                onClick={() => onSelectMunicipality(m)}
                viewMode={viewMode}
                locale={locale}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Zero municipalities callout */}
      <div className="mt-8 bg-[#13131a] border border-[#f59e0b]/20 rounded-2xl p-6 flex gap-4">
        <div className="text-[#f59e0b] text-2xl flex-shrink-0 mt-0.5">&#9888;</div>
        <div>
          <p className="text-[#f8fafc] font-medium mb-1">
            {tr.zero_municipalities(zeroCount)}
          </p>
          <p className="text-[#94a3b8] text-sm leading-relaxed">
            {period === '21' ? tr.disclaimer_21 : tr.disclaimer_14}
          </p>
          <p className="text-[#94a3b8]/60 text-xs mt-2 leading-relaxed">
            {tr.zero_muni_note(period === '21' ? 'ITMS2021+' : 'ITMS2014+')}
          </p>
        </div>
      </div>
    </section>
  );
}
