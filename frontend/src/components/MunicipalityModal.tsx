'use client';

import React from 'react';
import { Municipality } from '@/lib/types';
import { formatEurFull, formatEur } from '@/lib/utils';
import { useData } from '@/lib/DataContext';
import { useEffect } from 'react';

interface Props {
  municipality: Municipality | null;
  onClose: () => void;
}

export default function MunicipalityModal({ municipality, onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (municipality) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [municipality]);

  const { period } = useData();

  if (!municipality) return null;

  const m = municipality;
  const totalProjects = m.active_projects + m.completed_projects;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl max-w-lg w-full mx-4 p-8 animate-fade-in-up overflow-y-auto"
        style={{ maxHeight: '85vh', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>
              {m.official_name}
            </h2>
            <p className="text-[#94a3b8] text-sm mt-1">
              {m.region}{m.district ? ` · ${m.district}` : ''} · {m.nuts5_code}
            </p>
            <p className="text-[#94a3b8] text-sm">
              IČO: <span className="font-mono text-[#f8fafc]">{m.ico}</span>
              {m.population > 0 && <span> · {m.population.toLocaleString('sk-SK')} obyvateľov</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Main stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
              {formatEur(m.total_contracted_eur)}
            </div>
            <div className="text-[#94a3b8] text-sm mt-1">Celkové zmluvné prostriedky</div>
          </div>
          <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="text-3xl font-bold text-[#f8fafc] font-mono">
              {totalProjects}
            </div>
            <div className="text-[#94a3b8] text-sm mt-1">
              {m.active_projects > 0 ? `${m.active_projects} aktívnych` : ''}
              {m.active_projects > 0 && m.completed_projects > 0 ? ', ' : ''}
              {m.completed_projects > 0 ? `${m.completed_projects} ukončených` : ''}
              {totalProjects === 0 ? 'projektov' : ''}
            </div>
          </div>
        </div>

        {/* Per capita if population available */}
        {m.population > 0 && m.total_contracted_eur > 0 && (
          <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="text-xl font-bold text-[#10b981] font-mono">
              {formatEur(Math.round(m.total_contracted_eur / m.population))} / obyvateľ
            </div>
            <div className="text-[#94a3b8] text-sm mt-1">Čerpanie na obyvateľa</div>
          </div>
        )}

        {/* Irregularities */}
        {m.irregularities_count > 0 && (
          <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e] border-l-2 border-l-[#f59e0b]">
            <div className="text-[#f59e0b] text-sm font-medium">
              {m.irregularities_count} nezrovnalosť{m.irregularities_count > 1 ? 'í' : ''} · {formatEurFull(m.irregularities_total_eur)}
            </div>
          </div>
        )}

        {/* Top projects */}
        {m.projects.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#94a3b8] mb-3 uppercase tracking-wider">
              Top projekty
            </h3>
            <div className="space-y-2">
              {m.projects.map((p, i) => (
                <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                  <div className="text-sm text-[#f8fafc] mb-1 line-clamp-2">{p.nazov}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#3b82f6] font-mono">{formatEur(p.sumaZazmluvnena)}</span>
                    <span className="text-[#94a3b8]">{p.stav.includes('ukončený') ? 'Ukončený' : 'V realizácii'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] mb-8">
          {period === '2127'
            ? 'Programové obdobie 2021–2027. Zahŕňa len priame čerpanie obcou.'
            : 'Zahŕňa len priame čerpanie obcou. Nezahŕňa financovanie škôl, kultúrnych zariadení a iných organizácií v zriaďovateľskej pôsobnosti obce.'
          }
        </div>
      </div>
    </div>
  );
}
