'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
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
  '2127': '/municipal_stats_21.json',
};

export function DataProvider({ children }: { children: ReactNode }) {
  // Cache both periods' data — once loaded, swapping is instant (like viewMode)
  const cache = useRef<Partial<Record<Period, MunicipalityMap>>>({});

  const [period, setPeriodState] = useState<Period>('1420');
  const [data, setData] = useState<MunicipalityMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [periodAvailable, setPeriodAvailable] = useState<Record<Period, boolean>>({
    '1420': true,
    '2127': false,
  });

  const loadPeriod = useCallback((p: Period, onDone?: () => void) => {
    if (cache.current[p]) {
      onDone?.();
      return;
    }
    fetch(PERIOD_FILES[p])
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: MunicipalityMap) => {
        cache.current[p] = d;
        setPeriodAvailable(prev => ({ ...prev, [p]: true }));
        onDone?.();
      })
      .catch(() => {
        if (p === '2127') {
          setPeriodAvailable(prev => ({ ...prev, '2127': false }));
        }
        onDone?.();
      });
  }, []);

  // Initial load: load 1420 immediately, then pre-fetch 2127 in background
  useEffect(() => {
    setLoading(true);
    loadPeriod('1420', () => {
      setData(cache.current['1420'] ?? null);
      setLoading(false);
      // Pre-fetch 2127 silently after 1420 is ready
      loadPeriod('2127');
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

  return (
    <DataContext.Provider value={{ data, loading, period, setPeriod, periodAvailable, isTransitioning }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
