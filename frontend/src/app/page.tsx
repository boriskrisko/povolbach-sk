'use client';

import { useState } from 'react';
import { DataProvider } from '@/lib/DataContext';
import { Municipality } from '@/lib/types';
import { type Locale } from '@/lib/translations';
import dynamic from 'next/dynamic';
import HeroSearch from '@/components/HeroSearch';
import Leaderboard from '@/components/Leaderboard';
const SlovakiaMap = dynamic(() => import('@/components/SlovakiaMap'), { ssr: false });
import StatsContext from '@/components/StatsContext';
import Footer from '@/components/Footer';
import MunicipalityModal from '@/components/MunicipalityModal';

export default function Home() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [viewMode, setViewMode] = useState<'total' | 'capita'>('total');
  const [locale, setLocale] = useState<Locale>('sk');

  return (
    <DataProvider>
      <main className="min-h-screen bg-[#0a0a0f]">
        <HeroSearch
          onSelectMunicipality={setSelectedMunicipality}
          locale={locale}
          setLocale={setLocale}
        />
        <Leaderboard
          onSelectMunicipality={setSelectedMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <SlovakiaMap
          onMunicipalityClick={setSelectedMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
          locale={locale}
        />
        <StatsContext locale={locale} />
        <Footer locale={locale} />
        <MunicipalityModal
          municipality={selectedMunicipality}
          onClose={() => setSelectedMunicipality(null)}
          locale={locale}
        />
      </main>
    </DataProvider>
  );
}
