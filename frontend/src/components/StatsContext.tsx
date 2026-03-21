'use client';

import { useData } from '@/lib/DataContext';
import { formatBillionsParts } from '@/lib/utils';
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

interface Props {
  locale: Locale;
  globalStats: GlobalStats | null;
}

export default function StatsContext({ locale, globalStats }: Props) {
  const { loading, period } = useData();
  const tr = t[locale];

  if (loading || !globalStats) return null;

  const { totalFundsEur: totalEur, withProjects, withoutProjects, totalMunicipalities, uniqueIndirectEur } = globalStats;
  const withPct = Math.round((withProjects / totalMunicipalities) * 100);
  const withoutPct = 100 - withPct;

  const indirectLabel = locale === 'sk' ? 'štátnych investícií v obciach' : 'state investments in municipalities';

  const totalParts = formatBillionsParts(totalEur, locale);
  const indirectParts = formatBillionsParts(uniqueIndirectEur, locale);

  return (
    <section className="py-24 px-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {/* Total EUR */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 text-center flex flex-col justify-center">
          <div
            className="text-4xl md:text-5xl font-bold"
            style={{ color: '#3b82f6', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {totalParts.number}
          </div>
          <div className="text-[#f8fafc] text-lg font-medium mt-1">{totalParts.unit}</div>
          <div className="text-[#94a3b8] mt-2">{tr.total_funds_tracked}</div>
        </div>

        {/* With projects */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 text-center flex flex-col justify-center">
          <div
            className="text-4xl md:text-5xl font-bold"
            style={{ color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <AnimatedCounter target={withProjects} locale={locale} />
          </div>
          <div className="text-[#f8fafc] text-lg font-medium mt-1">({withPct}%)</div>
          <div className="text-[#94a3b8] mt-2">{tr.absorbing_eu}</div>
        </div>

        {/* Without projects */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 text-center flex flex-col justify-center">
          <div
            className="text-4xl md:text-5xl font-bold"
            style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <AnimatedCounter target={withoutProjects} locale={locale} />
          </div>
          <div className="text-[#f8fafc] text-lg font-medium mt-1">({withoutPct}%)</div>
          <div className="text-[#94a3b8] mt-2">{tr.without_project}</div>
        </div>

        {/* State investments */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 text-center flex flex-col justify-center">
          <div
            className="text-4xl md:text-5xl font-bold"
            style={{ color: '#6366f1', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {indirectParts.number}
          </div>
          <div className="text-[#f8fafc] text-lg font-medium mt-1">{indirectParts.unit}</div>
          <div className="text-[#94a3b8] mt-2">{indirectLabel}</div>
        </div>
      </div>

      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 max-w-3xl mx-auto">
        <p className="text-[#94a3b8] leading-relaxed text-center">
          {period === '21' ? tr.data_source_21 : tr.data_source_14}
        </p>
      </div>
    </section>
  );
}
