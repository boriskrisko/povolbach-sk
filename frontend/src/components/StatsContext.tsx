'use client';

import { useData } from '@/lib/DataContext';
import { getTotalEur, getWithProjects, getWithoutProjects, formatBillions } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

function AnimatedCounter({ target }: { target: number }) {
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
      {count.toLocaleString('sk-SK')}
    </div>
  );
}

export default function StatsContext() {
  const { data, loading, period } = useData();

  if (loading || !data) return null;

  const totalEur = getTotalEur(data);
  const withProjects = getWithProjects(data);
  const withoutProjects = getWithoutProjects(data);
  const totalMunicipalities = Object.keys(data).length;
  const withPct = Math.round((withProjects / totalMunicipalities) * 100);
  const withoutPct = 100 - withPct;

  return (
    <section className="py-24 px-4 max-w-5xl mx-auto">
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {/* Total EUR */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#3b82f6', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {formatBillions(totalEur)}
          </div>
          <div className="text-[#94a3b8] mt-2">Celkové fondy sledované</div>
        </div>

        {/* With projects */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <AnimatedCounter target={withProjects} />
          </div>
          <div className="text-[#f8fafc] text-lg font-medium">({withPct}%)</div>
          <div className="text-[#94a3b8] mt-2">čerpá EÚ fondy</div>
        </div>

        {/* Without projects */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 text-center">
          <div
            className="text-4xl md:text-5xl font-bold mb-2"
            style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <AnimatedCounter target={withoutProjects} />
          </div>
          <div className="text-[#f8fafc] text-lg font-medium">({withoutPct}%)</div>
          <div className="text-[#94a3b8] mt-2">bez projektu</div>
        </div>
      </div>

      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 max-w-3xl mx-auto">
        <p className="text-[#94a3b8] leading-relaxed text-center">
          {period === '2127'
            ? 'Dáta pochádzajú z oficiálneho systému ITMS2021+, ktorý eviduje všetky projekty financované z európskych štrukturálnych a investičných fondov v programovom období 2021–2027. Povolbach.sk agreguje tieto dáta na úrovni jednotlivých obcí a miest.'
            : 'Dáta pochádzajú z oficiálneho systému ITMS2014+, ktorý eviduje všetky projekty financované z európskych štrukturálnych a investičných fondov v programovom období 2014–2021. Povolbach.sk agreguje tieto dáta na úrovni jednotlivých obcí a miest.'
          }
        </p>
      </div>
    </section>
  );
}
