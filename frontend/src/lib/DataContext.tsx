'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { MunicipalityMap } from './types';

export type Period = '14' | '21';

interface DataContextType {
  data: MunicipalityMap | null;
  loading: boolean;
  period: Period;
  setPeriod: (p: Period) => void;
  periodAvailable: Record<Period, boolean>;
  periodLoading: Record<Period, boolean>;
  isTransitioning: boolean;
  getDataForPeriod: (p: Period) => MunicipalityMap | null;
}

const DataContext = createContext<DataContextType>({
  data: null,
  loading: true,
  period: '14',
  setPeriod: () => {},
  periodAvailable: { '14': true, '21': false },
  periodLoading: { '14': true, '21': true },
  isTransitioning: false,
  getDataForPeriod: () => null,
});

const PERIOD_FILES: Record<Period, string> = {
  '14': '/municipal_stats_14.json',
  '21': '/municipal_stats_21.json',
};

export function DataProvider({ children }: { children: ReactNode }) {
  // Cache both periods' data — once loaded, swapping is instant (like viewMode)
  const cache = useRef<Partial<Record<Period, MunicipalityMap>>>({});

  const [period, setPeriodState] = useState<Period>('14');
  const [data, setData] = useState<MunicipalityMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [periodAvailable, setPeriodAvailable] = useState<Record<Period, boolean>>({
    '14': true,
    '21': false,
  });
  const [periodLoading, setPeriodLoading] = useState<Record<Period, boolean>>({
    '14': true,
    '21': true,
  });

  const loadPeriod = useCallback((p: Period, onDone?: () => void) => {
    if (cache.current[p]) {
      setPeriodLoading(prev => ({ ...prev, [p]: false }));
      onDone?.();
      return;
    }
    setPeriodLoading(prev => ({ ...prev, [p]: true }));
    fetch(PERIOD_FILES[p])
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: MunicipalityMap) => {
        cache.current[p] = d;
        setPeriodAvailable(prev => ({ ...prev, [p]: true }));
        setPeriodLoading(prev => ({ ...prev, [p]: false }));
        onDone?.();
      })
      .catch(() => {
        if (p === '21') {
          setPeriodAvailable(prev => ({ ...prev, '21': false }));
        }
        setPeriodLoading(prev => ({ ...prev, [p]: false }));
        onDone?.();
      });
  }, []);

  // Initial load: load 14 immediately, then pre-fetch 21 in background
  useEffect(() => {
    setLoading(true);
    loadPeriod('14', () => {
      setData(cache.current['14'] ?? null);
      setLoading(false);
      // Pre-fetch 21 silently after 14 is ready
      loadPeriod('21');
    });
  }, [loadPeriod]);

  // Switching period: if cached → instant swap (no layout shift), else fetch
  const setPeriod = useCallback((p: Period) => {
    if (p === period) return;
    if (cache.current[p]) {
      // Instant swap — identical to viewMode toggle, no async, no layout shift
      setPeriodState(p);
      setData(cache.current[p] ?? null);
    } else {
      // Data not yet cached — fetch (rare: only if pre-fetch hasn't finished)
      setIsTransitioning(true);
      setLoading(true);
      setPeriodState(p);
      loadPeriod(p, () => {
        setData(cache.current[p] ?? null);
        setLoading(false);
        setTimeout(() => setIsTransitioning(false), 300);
      });
    }
  }, [period, loadPeriod]);

  const getDataForPeriod = useCallback((p: Period): MunicipalityMap | null => {
    return cache.current[p] ?? null;
  }, []);

  return (
    <DataContext.Provider value={{ data, loading, period, setPeriod, periodAvailable, periodLoading, isTransitioning, getDataForPeriod }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
