'use client';

import { useEffect, useState, useCallback } from 'react';
import { t, type Locale } from '@/lib/translations';

const SECTIONS = [
  { id: 'rebricek', key: 'nav_rankings' as const },
  { id: 'kraje', key: 'nav_regions' as const },
  { id: 'mikroregiony', key: 'nav_microregions' as const },
  { id: 'mapa', key: 'nav_map' as const },
  { id: 'pribehy', key: 'nav_stories' as const },
];

interface Props {
  locale: Locale;
}

export default function StickyNav({ locale }: Props) {
  const tr = t[locale];
  const [visible, setVisible] = useState(false);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      <div className="bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 flex items-center h-11 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="text-sm font-bold tracking-tight flex-shrink-0 mr-4"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            <span className="text-[#ffffff]">po</span>
            <span className="text-[#3b82f6]">volbach</span>
            <span className="text-[#6b7280]">.sk</span>
          </button>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex-shrink-0 ${
                activeId === s.id
                  ? 'text-[#3b82f6]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              {tr[s.key]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
