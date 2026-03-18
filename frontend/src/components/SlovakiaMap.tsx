'use client';

import { useData } from '@/lib/DataContext';
import { getRegionStats, formatEur } from '@/lib/utils';
import ViewModeToggle from './ViewModeToggle';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Municipality, RegionStats } from '@/lib/types';

interface Props {
  onMunicipalityClick: (m: Municipality) => void;
  viewMode: 'total' | 'capita';
  setViewMode: (mode: 'total' | 'capita') => void;
}

// Map SVG id attributes to region names in our data
const ID_TO_REGION: Record<string, string> = {
  'Bratislava': 'Bratislavský kraj',
  'Trnava': 'Trnavský kraj',
  'Trenčín': 'Trenčiansky kraj',
  'Nitra': 'Nitriansky kraj',
  'Žilina': 'Žilinský kraj',
  'Banská_Bystrica': 'Banskobystrický kraj',
  'Prešov': 'Prešovský kraj',
  'Košice': 'Košický kraj',
};

const REGION_IDS = Object.keys(ID_TO_REGION);

// Slovakia bounding box
const LON_MIN = 16.85, LON_MAX = 22.57;
const LAT_MIN = 47.73, LAT_MAX = 49.61;
const SVG_W = 2400, SVG_H = 1170;

function gpsToSvg(lat: number, lon: number) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * SVG_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * SVG_H;
  return { x, y };
}

function getDotColor(amount: number): string {
  if (amount === 0) return '#2d2d4e';
  if (amount < 100_000) return '#1e3a5f';
  if (amount < 500_000) return '#1d4ed8';
  if (amount < 2_000_000) return '#3b82f6';
  if (amount < 10_000_000) return '#60a5fa';
  if (amount < 50_000_000) return '#bfdbfe';
  return '#ffffff';
}

function getDotColorCapita(amountPerCapita: number): string {
  if (amountPerCapita === 0) return '#374151';
  if (amountPerCapita < 50) return '#1e3a5f';
  if (amountPerCapita < 200) return '#1d4ed8';
  if (amountPerCapita < 500) return '#3b82f6';
  if (amountPerCapita < 1000) return '#60a5fa';
  if (amountPerCapita < 2000) return '#bfdbfe';
  return '#ffffff';
}

const LEGEND_ITEMS_TOTAL = [
  { label: '€0', color: '#2d2d4e' },
  { label: '<€100k', color: '#1e3a5f' },
  { label: '<€500k', color: '#1d4ed8' },
  { label: '<€2M', color: '#3b82f6' },
  { label: '<€10M', color: '#60a5fa' },
  { label: '<€50M', color: '#bfdbfe' },
  { label: '€50M+', color: '#ffffff' },
];

const LEGEND_ITEMS_CAPITA = [
  { label: '€0/obyv.', color: '#374151' },
  { label: '<€50', color: '#1e3a5f' },
  { label: '<€200', color: '#1d4ed8' },
  { label: '<€500', color: '#3b82f6' },
  { label: '<€1k', color: '#60a5fa' },
  { label: '<€2k', color: '#bfdbfe' },
  { label: '€2k+', color: '#ffffff' },
];

export default function SlovakiaMap({ onMunicipalityClick, viewMode, setViewMode }: Props) {
  const { data, loading } = useData();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [hoveredRegionStats, setHoveredRegionStats] = useState<RegionStats | null>(null);
  const [hoveredMunicipality, setHoveredMunicipality] = useState<Municipality | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [svgLoaded, setSvgLoaded] = useState(false);

  const regionStats = data ? getRegionStats(data) : [];
  const statsMap = useMemo(
    () => Object.fromEntries(regionStats.map(r => [r.name, r])),
    [regionStats]
  );

  // Get all municipalities with GPS as a flat array
  const municipalities = useMemo(() => {
    if (!data) return [];
    return Object.values(data).filter(m => m.gps_lat && m.gps_lon);
  }, [data]);

  // Style region paths: subtle dark outlines, slight highlight on hover
  const styleRegions = useCallback((highlightRegion?: string | null) => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    for (const svgId of REGION_IDS) {
      const regionName = ID_TO_REGION[svgId];
      const el = svg.getElementById(svgId) as HTMLElement | null;
      if (!el) continue;

      const isHovered = highlightRegion === regionName;
      el.setAttribute('fill', isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(15,15,25,0.4)');
      el.setAttribute('stroke', '#2d2d4e');
      el.setAttribute('stroke-width', '1.5');
      el.style.pointerEvents = 'visiblePainted';
      el.style.cursor = 'pointer';
      el.dataset.region = regionName;
    }
  }, []);

  // Fetch, inline, and style the SVG
  useEffect(() => {
    if (!containerRef.current || !data) return;

    fetch('/sk-region-col.svg')
      .then(res => res.text())
      .then(svgText => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = svgText;

        const svg = containerRef.current.querySelector('svg');
        if (!svg) return;

        svg.setAttribute('width', '100%');
        svg.setAttribute('height', 'auto');
        svg.style.display = 'block';
        svg.style.maxHeight = '450px';

        // Style country outline
        const slovensko = svg.getElementById('Slovensko') as HTMLElement | null;
        if (slovensko) {
          slovensko.setAttribute('fill', '#0f0f19');
          slovensko.setAttribute('stroke', '#1e1e2e');
          slovensko.setAttribute('stroke-width', '1');
          slovensko.style.pointerEvents = 'none';
        }

        // Strip hardcoded fills and apply subtle region styling
        for (const svgId of REGION_IDS) {
          const el = svg.getElementById(svgId) as HTMLElement | null;
          if (!el) continue;
          el.removeAttribute('fill');
          el.style.transition = 'fill 0.15s ease';
        }

        styleRegions(null);
        setSvgLoaded(true);
      })
      .catch(err => console.error('Failed to load SVG map:', err));
  }, [data, styleRegions]);

  // Re-style regions when hover changes
  useEffect(() => {
    styleRegions(hoveredRegion);
  }, [hoveredRegion, styleRegions]);

  // Mouse events for region hover
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || !svgLoaded) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const regionName = target.dataset?.region ||
        target.closest('[data-region]')?.getAttribute('data-region');

      if (regionName && !hoveredMunicipality) {
        const rect = container.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top - 15,
        });
        setHoveredRegion(regionName);
        setHoveredRegionStats(statsMap[regionName] || null);
      } else if (!hoveredMunicipality) {
        setHoveredRegion(null);
        setHoveredRegionStats(null);
      }
    };

    const handleMouseLeave = () => {
      setHoveredRegion(null);
      setHoveredRegionStats(null);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [data, statsMap, svgLoaded, hoveredMunicipality]);

  if (loading || !data) return null;

  return (
    <section className="py-24 px-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h2
          className="text-3xl md:text-4xl font-bold text-[#f8fafc]"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Mapa Slovenska
        </h2>
        <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
      </div>
      <p className="text-[#94a3b8] mb-12">
        Každý bod predstavuje jednu obec — farba podľa výšky čerpania EÚ fondov
      </p>

      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 md:p-10 relative">
        {/* SVG region outlines container */}
        <div className="w-full relative">
          <div ref={containerRef} className="w-full" />

          {/* Dot overlay SVG — positioned exactly over the inlined SVG */}
          {svgLoaded && (
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="absolute inset-0 w-full h-full"
              style={{ maxHeight: '450px' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {municipalities.map(m => {
                const { x, y } = gpsToSvg(m.gps_lat!, m.gps_lon!);
                const isHovered = hoveredMunicipality?.ico === m.ico;
                const perCapita = m.population > 0 ? m.total_contracted_eur / m.population : 0;
                const dotColor = viewMode === 'capita'
                  ? getDotColorCapita(perCapita)
                  : getDotColor(m.total_contracted_eur);
                return (
                  <circle
                    key={m.ico}
                    cx={x}
                    cy={y}
                    r={isHovered ? 18 : 6}
                    fill={dotColor}
                    opacity={isHovered ? 1 : 0.85}
                    style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                    onMouseEnter={(e) => {
                      setHoveredMunicipality(m);
                      setHoveredRegion(null);
                      setHoveredRegionStats(null);
                      const container = containerRef.current;
                      if (container) {
                        const rect = container.getBoundingClientRect();
                        setTooltipPos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top - 15,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredMunicipality(null)}
                    onClick={() => onMunicipalityClick(m)}
                  />
                );
              })}
            </svg>
          )}

          {/* Region tooltip */}
          {hoveredRegionStats && !hoveredMunicipality && (
            <div
              className="absolute bg-[#0a0a0f] border border-[#3b82f6]/40 rounded-xl px-4 py-3 shadow-xl shadow-black/50 z-10"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
              }}
            >
              <div className="text-[#f8fafc] font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
                {hoveredRegionStats.name}
              </div>
              <div className="text-[#94a3b8] text-xs mt-1.5 space-y-0.5">
                <div>Počet obcí: <span className="text-[#f8fafc]">{hoveredRegionStats.municipalityCount}</span></div>
                <div>Celkové fondy: <span className="text-[#f8fafc]">{formatEur(hoveredRegionStats.totalEur)}</span></div>
                <div>Priemer na obec: <span className="text-[#3b82f6] font-mono">{formatEur(hoveredRegionStats.avgEur)}</span></div>
              </div>
            </div>
          )}

          {/* Municipality tooltip */}
          {hoveredMunicipality && (
            <div
              className="absolute bg-[#0a0a0f] border border-[#3b82f6]/40 rounded-xl px-4 py-3 shadow-xl shadow-black/50 z-10"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
              }}
            >
              <div className="text-[#f8fafc] font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
                {hoveredMunicipality.official_name}
              </div>
              <div className="text-[#94a3b8] text-xs mt-1">
                {hoveredMunicipality.region}
              </div>
              <div className="text-[#94a3b8] text-xs mt-1.5 space-y-0.5">
                <div>
                  {viewMode === 'capita' && hoveredMunicipality.population > 0 ? (
                    <><span className="text-[#3b82f6] font-mono font-semibold">
                      {formatEur(Math.round(hoveredMunicipality.total_contracted_eur / hoveredMunicipality.population))}
                    </span>{' '}/ obyvateľa</>
                  ) : (
                    <><span className="text-[#3b82f6] font-mono font-semibold">{formatEur(hoveredMunicipality.total_contracted_eur)}</span>{' '}celkové fondy</>
                  )}
                </div>
                <div>
                  {hoveredMunicipality.active_projects + hoveredMunicipality.completed_projects} projektov
                  {hoveredMunicipality.active_projects > 0 && ` (${hoveredMunicipality.active_projects} aktívnych)`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dot legend */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-[#94a3b8] flex-wrap">
          {(viewMode === 'capita' ? LEGEND_ITEMS_CAPITA : LEGEND_ITEMS_TOTAL).map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Region grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {regionStats.map(r => (
          <div
            key={r.name}
            className={`bg-[#13131a] border rounded-xl p-4 transition-colors ${
              hoveredRegion === r.name ? 'border-[#3b82f6]' : 'border-[#1e1e2e]'
            }`}
          >
            <div className="text-sm text-[#f8fafc] font-medium mb-1">{r.name}</div>
            <div className="text-[#3b82f6] font-mono text-lg font-bold">{formatEur(r.totalEur)}</div>
            <div className="text-[#94a3b8] text-xs mt-1">
              {r.municipalityCount} obcí · {r.withoutProjects} bez projektu
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
