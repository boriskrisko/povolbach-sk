'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { DataProvider, useData, Period } from '@/lib/DataContext';
import { Municipality, GlobalStats } from '@/lib/types';
import { type Locale } from '@/lib/translations';
import dynamic from 'next/dynamic';
import HeroSearch from '@/components/HeroSearch';
import Leaderboard from '@/components/Leaderboard';
const SlovakiaMap = dynamic(() => import('@/components/SlovakiaMap'), { ssr: false });
const VucSection = dynamic(() => import('@/components/VucSection'), { ssr: false });
const MikroregiónySection = dynamic(() => import('@/components/MikroregiónySection'), { ssr: false });
import StatsContext from '@/components/StatsContext';
import Footer from '@/components/Footer';
import MunicipalityModal from '@/components/MunicipalityModal';

function PageContent() {
  const { data, isTransitioning, period, setPeriod, getDataForPeriod } = useData();
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [viewMode, setViewMode] = useState<'total' | 'capita'>('total');
  const [locale, setLocale] = useState<Locale>('sk');
  const deepLinkHandled = useRef(false);

  // Handle deep-link on page load: ?obec={ico}&obdobie=21
  useEffect(() => {
    if (deepLinkHandled.current || !data) return;
    const params = new URLSearchParams(window.location.search);
    const ico = params.get('obec');
    const obdobie = params.get('obdobie');
    if (!ico) return;

    deepLinkHandled.current = true;

    // Set global period from deep-link
    if (obdobie === '21') {
      setPeriod('2127');
    }

    // Try to find the municipality in any available data
    const targetPeriod: Period = obdobie === '21' ? '2127' : '1420';
    const targetData = getDataForPeriod(targetPeriod);
    const fallbackData = getDataForPeriod(targetPeriod === '1420' ? '2127' : '1420');

    const muni = targetData?.[ico] ?? fallbackData?.[ico] ?? data[ico] ?? null;
    if (muni) {
      setSelectedMunicipality(muni);
    }
  }, [data, getDataForPeriod, setPeriod]);

  // Update URL when modal opens/closes
  const handleSelectMunicipality = useCallback((muni: Municipality | null) => {
    setSelectedMunicipality(muni);
    if (muni) {
      const url = new URL(window.location.href);
      url.searchParams.set('obec', muni.ico);
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('obec');
      url.searchParams.delete('obdobie');
      window.history.replaceState({}, '', url.pathname);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    handleSelectMunicipality(null);
  }, [handleSelectMunicipality]);

  const globalStats = useMemo((): GlobalStats | null => {
    if (!data) return null;
    const munis = Object.values(data);
    return {
      totalMunicipalities: munis.length,
      totalFundsEur: munis.reduce((s, m) => s + (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0), 0),
      withProjects: munis.filter(m => (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0) > 0).length,
      withoutProjects: munis.filter(m => (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0) === 0).length,
      totalIndirectEur: munis.reduce((s, m) => s + (m.indirect_total_eur || 0), 0),
      withIndirect: munis.filter(m => (m.indirect_total_eur || 0) > 0).length,
      ...(() => {
        const seen = new Set<string>();
        let uniqueIndirectEur = 0;
        let uniqueIndirectCount = 0;
        for (const m of munis) {
          for (const p of (m.indirect_projects || [])) {
            const pid = (p as { id?: string; kod?: string; name?: string }).id
              || (p as { kod?: string }).kod
              || (p as { name?: string }).name || '';
            if (pid && !seen.has(pid)) {
              seen.add(pid);
              uniqueIndirectEur += (p as { contracted_eur?: number }).contracted_eur || 0;
              uniqueIndirectCount++;
            }
          }
        }
        return { uniqueIndirectEur, uniqueIndirectCount };
      })(),
      byRegion: munis.reduce((acc, m) => {
        const r = m.region || 'Iné';
        if (!acc[r]) acc[r] = { total: 0, count: 0, zero: 0 };
        acc[r].total += (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
        acc[r].count++;
        if (!(m.total_contracted_eur || 0) && !(m.subsidiary_total_eur || 0)) acc[r].zero++;
        return acc;
      }, {} as Record<string, { total: number; count: number; zero: number }>),
    };
  }, [data]);

  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      <HeroSearch
        onSelectMunicipality={handleSelectMunicipality}
        locale={locale}
        setLocale={setLocale}
        globalStats={globalStats}
      />
      <div style={{ opacity: isTransitioning ? 0.5 : 1, transition: 'opacity 0.25s ease' }}>
        <Leaderboard
          onSelectMunicipality={handleSelectMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
          globalStats={globalStats}
        />
        <VucSection
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <MikroregiónySection locale={locale} />
        <SlovakiaMap
          onMunicipalityClick={handleSelectMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <StatsContext locale={locale} globalStats={globalStats} />
        <Footer locale={locale} />
      </div>
      <MunicipalityModal
        municipality={selectedMunicipality}
        onClose={handleCloseModal}
        locale={locale}
      />
    </main>
  );
}

export default function Home() {
  return (
    <DataProvider>
      <PageContent />
    </DataProvider>
  );
}
