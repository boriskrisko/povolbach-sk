'use client';

import { useState, useRef, useEffect } from 'react';
import { useData, type Period } from '@/lib/DataContext';
import { Municipality, GlobalStats } from '@/lib/types';
import { searchMunicipalitiesFlexible, formatAmount, formatBillions, getCombinedTotal } from '@/lib/utils';
import { t, type Locale } from '@/lib/translations';

interface Props {
  onSelectMunicipality: (m: Municipality) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  globalStats: GlobalStats | null;
}

export default function HeroSearch({ onSelectMunicipality, locale, setLocale, globalStats }: Props) {
  const { data, loading, period, setPeriod, periodAvailable } = useData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Municipality[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const periodToggleRef = useRef<HTMLDivElement>(null);
  const [showStickyToggle, setShowStickyToggle] = useState(false);
  const tr = t[locale];
  const is21Available = periodAvailable['21'];

  function handlePeriodChange(newPeriod: Period) {
    const scrollY = window.scrollY;
    setPeriod(newPeriod);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
      });
    });
    setTimeout(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    }, 100);
  }

  useEffect(() => {
    const el = periodToggleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyToggle(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const r = searchMunicipalitiesFlexible(data, query);
    setResults(r);
    setShowDropdown(r.length > 0);
    setSelectedIndex(-1);
  }, [query, data]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      onSelectMunicipality(results[selectedIndex]);
      setShowDropdown(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const totalCount = globalStats?.totalMunicipalities ?? 0;
  const totalEur = globalStats?.totalFundsEur ?? 0;

  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative px-4">
      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 py-5">
        <div className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
          <span className="text-[#3b82f6]">po</span>
          <span className="text-[#ffffff]">volbach</span>
          <span className="text-[#6b7280]">.sk</span>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setLocale('sk')}
            className={`font-medium transition-colors ${locale === 'sk' ? 'text-[#f8fafc]' : 'text-[#94a3b8] hover:text-[#f8fafc]'}`}
          >
            SK
          </button>
          <span className="text-[#94a3b8]">/</span>
          <button
            onClick={() => setLocale('en')}
            className={`font-medium transition-colors ${locale === 'en' ? 'text-[#f8fafc]' : 'text-[#94a3b8] hover:text-[#f8fafc]'}`}
          >
            EN
          </button>
        </div>
      </nav>

      {/* Center content */}
      <div className="w-full text-center" style={{ maxWidth: 'min(1100px, 94vw)' }}>
        <p className="text-[#94a3b8] text-sm tracking-widest uppercase mb-6 animate-fade-in-up">
          {tr.hero_label}
        </p>

        <h1
          className="font-bold text-[#f8fafc] mb-10 leading-tight animate-fade-in-up animate-delay-100"
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(2.5rem, 5.5vw, 6rem)',
            maxWidth: 'min(1100px, 94vw)',
            margin: '0 auto 2.5rem',
          }}
        >
          {tr.hero_heading}
        </h1>

        {/* Search */}
        <div className="relative z-40 w-full max-w-[700px] mx-auto animate-fade-in-up animate-delay-200">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              placeholder={tr.hero_search_placeholder}
              className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-xl pl-12 pr-4 py-4 text-lg text-[#f8fafc] placeholder:text-[#94a3b8]/60 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 transition-all"
              disabled={loading}
            />
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 bg-[#13131a] border border-[#1e1e2e] rounded-xl overflow-hidden shadow-2xl shadow-black/80 z-50 search-dropdown max-h-80 overflow-y-auto"
            >
              {results.map((m, i) => (
                <button
                  key={m.ico}
                  onClick={() => {
                    onSelectMunicipality(m);
                    setShowDropdown(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[#1e1e2e] transition-colors ${
                    i === selectedIndex ? 'bg-[#1e1e2e]' : ''
                  }`}
                >
                  <div>
                    <span className="text-[#f8fafc] font-medium">{m.official_name}</span>
                    <span className="text-[#94a3b8] text-sm ml-2">{m.region}</span>
                  </div>
                  <span className="text-[#3b82f6] font-mono text-sm font-medium">
                    {formatAmount(getCombinedTotal(m), locale)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-[#94a3b8] text-sm">
              {tr.no_results}
            </div>
          )}
        </div>

        {/* Stats line */}
        <p className="text-[#94a3b8] text-sm mt-8 animate-fade-in-up animate-delay-300">
          {loading ? (
            'Načítavam dáta...'
          ) : (
            tr.hero_stats(totalCount, formatBillions(totalEur, locale), period)
          )}
        </p>

        {/* Period toggle */}
        <div ref={periodToggleRef} className="mt-4 animate-fade-in-up animate-delay-400">
          <div className="text-[#94a3b8] text-xs mb-2 mt-4">{tr.period_label}</div>
          <div className="inline-flex rounded-lg border border-[#1e1e2e] overflow-hidden mt-2">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handlePeriodChange('14')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                period === '14'
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#13131a] text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              2014 – 2020
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => is21Available && handlePeriodChange('21')}
              disabled={!is21Available}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                period === '21'
                  ? 'bg-[#3b82f6] text-white'
                  : is21Available
                    ? 'bg-[#13131a] text-[#94a3b8] hover:text-[#f8fafc]'
                    : 'bg-[#13131a] text-[#94a3b8]/40 cursor-not-allowed'
              }`}
              title={!is21Available ? 'Dáta 2021–2027 sa načítavajú, skúste neskôr.' : undefined}
            >
              2021 – 2027
            </button>
          </div>
          {!is21Available && (
            <div className="text-[#94a3b8]/50 text-xs mt-1.5">
              Dáta 2021–2027 sa načítavajú, skúste neskôr.
            </div>
          )}
          {period === '21' && (
            <div className="text-[#f59e0b] text-xs mt-2">
              {tr.period_ongoing}
            </div>
          )}
        </div>
      </div>

      {/* Sticky floating period toggle */}
      <div
        style={{
          position: 'fixed',
          top: '70px',
          right: '24px',
          zIndex: 40,
          opacity: showStickyToggle ? 1 : 0,
          transform: showStickyToggle ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: showStickyToggle ? 'auto' : 'none',
        }}
      >
        <div
          className="inline-flex rounded-lg border border-[#1e1e2e] overflow-hidden"
          style={{
            background: 'rgba(10, 10, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => handlePeriodChange('14')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              period === '14' ? 'bg-[#3b82f6] text-white' : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            2014 – 2020
          </button>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => is21Available && handlePeriodChange('21')}
            disabled={!is21Available}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              period === '21'
                ? 'bg-[#3b82f6] text-white'
                : is21Available
                  ? 'text-[#94a3b8] hover:text-[#f8fafc]'
                  : 'text-[#94a3b8]/40 cursor-not-allowed'
            }`}
          >
            2021 – 2027
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 animate-bounce-slow text-[#94a3b8]/40" style={{ marginTop: '2.5rem' }}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
