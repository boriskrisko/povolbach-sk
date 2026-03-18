'use client';

import { useState } from 'react';
import { DataProvider, useData } from '@/lib/DataContext';
import { Municipality } from '@/lib/types';
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
  const { isTransitioning } = useData();
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [viewMode, setViewMode] = useState<'total' | 'capita'>('total');
  const [locale, setLocale] = useState<Locale>('sk');

  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      <HeroSearch
        onSelectMunicipality={setSelectedMunicipality}
        locale={locale}
        setLocale={setLocale}
      />
      <div style={{ opacity: isTransitioning ? 0.5 : 1, transition: 'opacity 0.25s ease' }}>
        <Leaderboard
          onSelectMunicipality={setSelectedMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <VucSection
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <MikroregiónySection locale={locale} />
        <SlovakiaMap
          onMunicipalityClick={setSelectedMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <StatsContext locale={locale} />
        <Footer locale={locale} />
      </div>
      <MunicipalityModal
        municipality={selectedMunicipality}
        onClose={() => setSelectedMunicipality(null)}
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
