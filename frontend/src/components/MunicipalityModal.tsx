'use client';

import React from 'react';
import { Municipality } from '@/lib/types';
import { formatAmount, formatProjects } from '@/lib/utils';
import { useData } from '@/lib/DataContext';
import { useEffect } from 'react';
import { t, type Locale } from '@/lib/translations';

interface Props {
  municipality: Municipality | null;
  onClose: () => void;
  locale: Locale;
}

export default function MunicipalityModal({ municipality, onClose, locale }: Props) {
  const tr = t[locale];

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
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
  const subTotal = m.subsidiary_total_eur || 0;
  const grandTotal = m.total_contracted_eur + subTotal;

  // Sorted + capped client-side (build script pre-sorts, this is a safety net)
  const topProjects = [...m.projects]
    .sort((a, b) => (b.sumaZazmluvnena || 0) - (a.sumaZazmluvnena || 0))
    .slice(0, 5);
  const topIndirect = [...(m.indirect_projects || [])]
    .sort((a, b) => (b.contracted_eur || 0) - (a.contracted_eur || 0))
    .slice(0, 5);
  const topSubsidiaryOrgs = [...(m.subsidiary_orgs || [])]
    .sort((a, b) => (b.total_contracted_eur || 0) - (a.total_contracted_eur || 0))
    .slice(0, 5);

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
              {m.population > 0 && (
                <span> · {m.population.toLocaleString('sk-SK')} {locale === 'sk' ? 'obyvateľov' : 'inhabitants'}</span>
              )}
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
          {/* Total card — shows breakdown if subsidiaries exist */}
          <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            {subTotal > 0 ? (
              <>
                <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 2rem)' }}>
                  {formatAmount(grandTotal, locale)}
                </div>
                <div className="text-[#94a3b8] text-xs mt-0.5">
                  {formatAmount(m.total_contracted_eur, locale)}{' '}
                  <span className="text-[#94a3b8]/60">{locale === 'sk' ? 'priame' : 'direct'}</span>
                </div>
                <div className="text-[#10b981] text-xs">
                  +{formatAmount(subTotal, locale)}{' '}
                  <span className="text-[#10b981]/70">{locale === 'sk' ? 'zriaďované org.' : 'orgs'}</span>
                </div>
                <div className="text-[#94a3b8] text-xs mt-1">{tr.modal_total}</div>
              </>
            ) : (
              <>
                <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
                  {formatAmount(m.total_contracted_eur, locale)}
                </div>
                <div className="text-[#94a3b8] text-sm mt-1">{tr.modal_total}</div>
              </>
            )}
          </div>

          {/* Projects count */}
          <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="text-3xl font-bold text-[#f8fafc] font-mono">{totalProjects}</div>
            <div className="text-[#94a3b8] text-sm mt-1">
              {m.active_projects > 0 ? `${m.active_projects} ${tr.modal_active}` : ''}
              {m.active_projects > 0 && m.completed_projects > 0 ? ', ' : ''}
              {m.completed_projects > 0 ? `${m.completed_projects} ${tr.modal_completed}` : ''}
              {totalProjects === 0 ? tr.modal_projects : ''}
            </div>
          </div>
        </div>

        {/* Per capita */}
        {m.population > 0 && grandTotal > 0 && (
          <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="text-xl font-bold text-[#10b981] font-mono">
              {formatAmount(Math.round(grandTotal / m.population), locale)} {tr.per_capita_suffix}
            </div>
            <div className="text-[#94a3b8] text-sm mt-1">{tr.modal_per_capita}</div>
          </div>
        )}

        {/* Irregularities */}
        {m.irregularities_count > 0 && (
          <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e] border-l-2 border-l-[#f59e0b]">
            <div className="text-[#f59e0b] text-sm font-medium">
              {tr.modal_irregularities(m.irregularities_count, formatAmount(m.irregularities_total_eur, locale))}
            </div>
          </div>
        )}

        {/* Top projects */}
        {topProjects.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#94a3b8] mb-3 uppercase tracking-wider">
              {tr.modal_top_projects}
            </h3>
            <div className="space-y-2">
              {topProjects.map((p, i) => {
                const isActive = !p.stav.toLowerCase().includes('ukončen');
                const endDate = p.datumKoncaRealizacie
                  ? (() => {
                      const d = new Date(p.datumKoncaRealizacie);
                      return isNaN(d.getTime()) ? null : `${d.getMonth() + 1}/${d.getFullYear()}`;
                    })()
                  : null;
                return (
                  <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                    <div className="text-sm text-[#f8fafc] mb-1 line-clamp-2">{p.nazov}</div>
                    {isActive && endDate && (
                      <div className="text-xs text-[#94a3b8]/60 mb-1">
                        {locale === 'sk' ? 'Realizácia do' : 'Until'}: {endDate}
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#3b82f6] font-mono">{formatAmount(p.sumaZazmluvnena, locale)}</span>
                      <span className="text-[#94a3b8]">{isActive ? tr.active : tr.completed}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subsidiary orgs */}
        {subTotal > 0 && topSubsidiaryOrgs.length > 0 && (() => {
          const hasJointVentures = topSubsidiaryOrgs.some(o => (o.co_owners || 0) > 1);
          return (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#10b981]/80 mb-1 uppercase tracking-wider flex items-center gap-1.5">
              {tr.modal_subsidiary_title}
              <span className="text-base leading-none" title={tr.modal_subsidiary_note}>ℹ️</span>
            </h3>
            <p className="text-[#94a3b8]/60 text-xs mb-3">{tr.modal_subsidiary_note}</p>
            <div className="space-y-2">
              {topSubsidiaryOrgs.map((org, i) => (
                <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] border-l-2 border-l-[#10b981]/40">
                  <div className="text-sm text-[#f8fafc]/90 mb-1 line-clamp-2">{org.name}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#10b981] font-mono">{formatAmount(org.total_contracted_eur, locale)}</span>
                    <span className="text-[#94a3b8]/70">{formatProjects(org.projects_count, locale)}</span>
                  </div>
                  {(org.co_owners || 0) > 1 && org.full_amount_eur && (
                    <div className="text-[10px] text-[#94a3b8]/50 mt-1">
                      ↳ {locale === 'sk'
                        ? `podiel 1/${org.co_owners} z ${formatAmount(org.full_amount_eur, locale)} (spoločný podnik ${org.co_owners} obcí)`
                        : `share 1/${org.co_owners} of ${formatAmount(org.full_amount_eur, locale)} (joint venture of ${org.co_owners} municipalities)`}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {hasJointVentures && (
              <p className="text-[10px] text-[#94a3b8]/40 mt-2">
                {locale === 'sk'
                  ? 'Sumy spoločných podnikov sú rozdelené proporcionálne medzi spoluvlastníkov.'
                  : 'Joint venture amounts are split proportionally among co-owners.'}
              </p>
            )}
          </div>
          );
        })()}

        {/* Indirect / state projects */}
        {topIndirect.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#94a3b8]/70 mb-1 uppercase tracking-wider flex items-center gap-1.5">
              {tr.modal_indirect_title}
              <span className="text-base leading-none" title={tr.modal_indirect_note}>ℹ️</span>
            </h3>
            <p className="text-[#94a3b8]/60 text-xs mb-3">{tr.modal_indirect_note}</p>
            <div className="space-y-2">
              {topIndirect.map((p, i) => (
                <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] opacity-80">
                  <div className="text-sm text-[#f8fafc]/80 mb-1 line-clamp-2">{p.name}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#3b82f6]/80 font-mono">{formatAmount(p.contracted_eur, locale)}</span>
                    <span className="text-[#94a3b8]/70">{p.beneficiary_name.split(' ').slice(0, 3).join(' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] mb-8">
          {period === '2127' ? tr.modal_disclaimer_2127 : tr.modal_disclaimer_1420}
        </div>
      </div>
    </div>
  );
}
