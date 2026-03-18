'use client';

import { useData } from '@/lib/DataContext';
import { Municipality } from '@/lib/types';
import { formatEur, getWithoutProjects } from '@/lib/utils';

type ViewMode = 'total' | 'capita';

interface Props {
  onSelectMunicipality: (m: Municipality) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

function getCapita(m: Municipality): number {
  return m.population > 0 ? m.total_contracted_eur / m.population : 0;
}

function LeaderboardRow({
  m,
  rank,
  maxVal,
  color,
  onClick,
  viewMode,
}: {
  m: Municipality;
  rank: number;
  maxVal: number;
  color: string;
  onClick: () => void;
  viewMode: ViewMode;
}) {
  const val = viewMode === 'capita' ? getCapita(m) : m.total_contracted_eur;
  const barWidth = maxVal > 0 ? (val / maxVal) * 100 : 0;
  const displayLabel = viewMode === 'capita'
    ? `${formatEur(Math.round(val))} / obyv.`
    : formatEur(val);

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

export default function Leaderboard({ onSelectMunicipality, viewMode, setViewMode }: Props) {
  const { data, loading, period } = useData();

  if (loading || !data) return null;

  const all = Object.values(data);

  const top10 = viewMode === 'capita'
    ? all.filter(m => m.population > 0 && m.total_contracted_eur > 0)
        .sort((a, b) => getCapita(b) - getCapita(a))
        .slice(0, 10)
    : all.sort((a, b) => b.total_contracted_eur - a.total_contracted_eur).slice(0, 10);

  const bottom10 = viewMode === 'capita'
    ? all.filter(m => m.population > 0 && m.total_contracted_eur > 0)
        .sort((a, b) => getCapita(a) - getCapita(b))
        .slice(0, 10)
    : all.filter(m => m.total_contracted_eur > 0)
        .sort((a, b) => a.total_contracted_eur - b.total_contracted_eur)
        .slice(0, 10);

  const zeroCount = getWithoutProjects(data);

  const maxTop = viewMode === 'capita'
    ? (top10[0] ? getCapita(top10[0]) : 1)
    : (top10[0]?.total_contracted_eur || 1);

  const maxBottom = viewMode === 'capita'
    ? (bottom10.length > 0 ? getCapita(bottom10[bottom10.length - 1]) : 1)
    : (bottom10.length > 0 ? bottom10[bottom10.length - 1]?.total_contracted_eur || 1 : 1);

  return (
    <section className="py-24 px-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h2
          className="text-3xl md:text-4xl font-bold text-[#f8fafc]"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Rebríček obcí
        </h2>
        <div className="inline-flex rounded-lg border border-[#1e1e2e] overflow-hidden">
          <button
            onClick={() => setViewMode('total')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'total'
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#13131a] text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Celkové prostriedky
          </button>
          <button
            onClick={() => setViewMode('capita')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'capita'
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#13131a] text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Na obyvateľa
          </button>
        </div>
      </div>
      <p className="text-[#94a3b8] mb-12">
        {viewMode === 'capita'
          ? 'Zoradené podľa čerpania EÚ fondov na obyvateľa'
          : 'Zoradené podľa celkových zmluvných prostriedkov EÚ'
        }
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Top 10 */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[#10b981] mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
            Najúspešnejšie obce
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
            Nevyužitý potenciál
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
            <span className="font-mono text-[#f59e0b]">{zeroCount}</span> obcí zatiaľ nevyčerpalo žiadne prostriedky EÚ
          </p>
          <p className="text-[#94a3b8] text-sm leading-relaxed">
            {period === '2127'
              ? 'Programové obdobie 2021–2027. Zahŕňa len priame čerpanie obcou.'
              : 'Zahŕňa len priame čerpanie obcou. Nezahŕňa financovanie škôl, kultúrnych zariadení a iných organizácií v zriaďovateľskej pôsobnosti obce.'
            }
          </p>
        </div>
      </div>
    </section>
  );
}
