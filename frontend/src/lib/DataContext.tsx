'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { MunicipalityMap } from './types';

export type Period = '1420' | '2127';

interface DataContextType {
  data: MunicipalityMap | null;
  loading: boolean;
  period: Period;
  setPeriod: (p: Period) => void;
  periodAvailable: Record<Period, boolean>;
  isTransitioning: boolean;
}

const DataContext = createContext<DataContextType>({
  data: null,
  loading: true,
  period: '1420',
  setPeriod: () => {},
  periodAvailable: { '1420': true, '2127': false },
  isTransitioning: false,
});

const PERIOD_FILES: Record<Period, string> = {
  '1420': '/municipal_stats.json',
  '2127': '/municipal_stats_2127.json',
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MunicipalityMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriodState] = useState<Period>('1420');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [periodAvailable, setPeriodAvailable] = useState<Record<Period, boolean>>({
    '1420': true,
    '2127': false,
  });

  const loadData = useCallback((p: Period) => {
    setLoading(true);
    fetch(PERIOD_FILES[p])
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: MunicipalityMap) => {
        setData(d);
        setLoading(false);
        setPeriodAvailable(prev => ({ ...prev, [p]: true }));
      })
      .catch(() => {
        // If 2127 data not available, keep current data
        if (p === '2127') {
          setPeriodAvailable(prev => ({ ...prev, '2127': false }));
          setPeriodState('1420');
        }
        setLoading(false);
      });
  }, []);

  // Initial load
  useEffect(() => {
    loadData('1420');
    // Check if 2127 data exists
    fetch(PERIOD_FILES['2127'], { method: 'HEAD' })
      .then(res => {
        setPeriodAvailable(prev => ({ ...prev, '2127': res.ok }));
      })
      .catch(() => {
        setPeriodAvailable(prev => ({ ...prev, '2127': false }));
      });
  }, [loadData]);

  const setPeriod = useCallback((p: Period) => {
    if (p === period) return;
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 300);
    setPeriodState(p);
    loadData(p);
  }, [period, loadData]);

  return (
    <DataContext.Provider value={{ data, loading, period, setPeriod, periodAvailable, isTransitioning }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
