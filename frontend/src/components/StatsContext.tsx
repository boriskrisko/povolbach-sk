'use client';

import { useData } from '@/lib/DataContext';
import { formatBillions } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { t, type Locale } from '@/lib/translations';
import { GlobalStats } from '@/lib/types';

function AnimatedCounter({ target, locale }: { target: number; locale: Locale }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    const el = ref.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const duration = 1200;
    const startTime = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [started, target]);

  return (
    <div ref={ref} className="font-mono">
      {count.toLocaleString(locale === 'en' ? 'en' : 'sk-SK')}
    </div>
  );
}

interface IndirectDedup {
  unique_projects_count: number;
  unique_total_eur: number;
}

interface Props {
  locale: Locale;
  globalStats: GlobalStats | null;
  indirectDedup: IndirectDedup | null;
}

export default function StatsContext({ locale, globalStats, indirectDedup }: Props) {
  const { loading, period } = useData();
  const tr = t[locale];

  if (loading || !globalStats) return null;

  const { totalFundsEur: totalEur, withProjects, withoutProjects, totalMunicipalities, totalIndirectEur, withIndirect } = globalStats;
  const withPct = Math.round((withProjects / totalMunicipalities) * 100);
  const withoutPct = 100 - withPct;

  const indirectLabel = locale === 'sk' ? 'štátnych investícií v obciach' : 'state investments in municipalities';
  const indirectCount = indirectDedup?.unique_projects_count ?? 0;
  const indirectEur = indirectDedup?.unique_total_eur ?? 0;
  const indirectNote = locale === 'sk'
    ? `${indirectCount} unikátnych projektov · ministerstvá a štátne agentúry · nezahrnuté v hodnotení samospráv`
    : `${indirectCount} unique projects · ministries and state agencies · not included in municipal scores`;

  return (
    <section className="py-24 px-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {/* Total EUR */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#3b82f6', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {formatBillions(totalEur, locale)}
          </div>
          <div className="text-[#94a3b8] mt-2">{tr.total_funds_tracked}</div>
        </div>

        {/* With projects */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <AnimatedCounter target={withProjects} locale={locale} />
          </div>
          <div className="text-[#f8fafc] text-lg font-medium">({withPct}%)</div>
          <div className="text-[#94a3b8] mt-2">{tr.absorbing_eu}</div>
        </div>

        {/* Without projects */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <AnimatedCounter target={withoutProjects} locale={locale} />
          </div>
          <div className="text-[#f8fafc] text-lg font-medium">({withoutPct}%)</div>
          <div className="text-[#94a3b8] mt-2">{tr.without_project}</div>
        </div>

        {/* State investments */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#6366f1', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {formatBillions(indirectEur, locale)}
          </div>
          <div className="text-[#94a3b8] mt-2">{indirectLabel}</div>
          <div className="text-[#94a3b8]/50 text-xs mt-2 leading-relaxed">{indirectNote}</div>
        </div>
      </div>

      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 max-w-3xl mx-auto">
        <p className="text-[#94a3b8] leading-relaxed text-center">
          {period === '2127' ? tr.data_source_2127 : tr.data_source_1420}
        </p>
      </div>
    </section>
  );
}
