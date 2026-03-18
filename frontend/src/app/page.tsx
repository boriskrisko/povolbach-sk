'use client';

import { useState } from 'react';
import { DataProvider } from '@/lib/DataContext';
import { Municipality } from '@/lib/types';
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

  return (
    <DataProvider>
      <main className="min-h-screen bg-[#0a0a0f]">
        <HeroSearch onSelectMunicipality={setSelectedMunicipality} />
        <Leaderboard
          onSelectMunicipality={setSelectedMunicipality}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <SlovakiaMap
          onMunicipalityClick={setSelectedMunicipality}
          viewMode={viewMode}
        />
        <StatsContext />
        <Footer />
        <MunicipalityModal
          municipality={selectedMunicipality}
          onClose={() => setSelectedMunicipality(null)}
        />
      </main>
    </DataProvider>
  );
}
