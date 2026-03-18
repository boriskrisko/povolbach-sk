'use client';

import React, { useEffect } from 'react';
import { VucStats } from '@/lib/types';
import { formatAmount, formatProjects } from '@/lib/utils';
import { type Locale } from '@/lib/translations';
import { useData } from '@/lib/DataContext';

interface Props {
  vuc: VucStats | null;
  onClose: () => void;
  locale: Locale;
}

export default function VucModal({ vuc, onClose, locale }: Props) {
  const { period } = useData();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (vuc) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [vuc]);

  if (!vuc) return null;

  const totalProjects = vuc.projects_active + vuc.projects_completed;
  const subTotal = vuc.subsidiary_total_eur || 0;

  const topProjects = [...vuc.projects]
    .sort((a, b) => (b.sumaZazmluvnena || 0) - (a.sumaZazmluvnena || 0))
    .slice(0, 5);
  const topSubsidiaryOrgs = [...(vuc.subsidiary_orgs || [])]
    .sort((a, b) => (b.total_contracted_eur || 0) - (a.total_contracted_eur || 0))
    .slice(0, 5);
  const grandTotal = vuc.total_contracted_eur + subTotal;
  const perCapita = vuc.population > 0 ? Math.round(grandTotal / vuc.population) : 0;
  const subsidiaryNote = locale === 'sk'
    ? 'Tieto organizácie získali fondy samostatne pod vlastným IČO. Sú zahrnuté v celkovom hodnotení kraja.'
    : 'These organizations received EU funds under their own ICO. They are included in the region\'s total score.';
  const disclaimer = period === '2127'
    ? (locale === 'sk'
        ? 'Programové obdobie 2021–2027. Zahŕňa priame čerpanie samosprávneho kraja aj organizácií v jeho zriaďovateľskej pôsobnosti.'
        : 'Programming period 2021–2027. Includes direct regional government absorption and organizations under its jurisdiction.')
    : (locale === 'sk'
        ? 'Zahŕňa priame čerpanie samosprávneho kraja aj organizácií v jeho zriaďovateľskej pôsobnosti. Nezahŕňa projekty štátnych agentúr.'
        : 'Includes direct regional government absorption and organizations under its jurisdiction. Excludes state agency projects.');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl max-w-lg w-full mx-4 p-8 animate-fade-in-up overflow-y-auto"
        style={{ maxHeight: '85vh' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>
              {vuc.name}
            </h2>
            <p className="text-[#94a3b8] text-sm mt-1">
              IČO: <span className="font-mono text-[#f8fafc]">{vuc.ico}</span>
              {vuc.population > 0 && (
                <span> · {vuc.population.toLocaleString('sk-SK')} {locale === 'sk' ? 'obyvateľov' : 'inhabitants'}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Total card — shows breakdown if subsidiaries exist */}
          <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            {subTotal > 0 ? (
              <>
                <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 2rem)' }}>
                  {formatAmount(grandTotal, locale)}
                </div>
                <div className="text-[#94a3b8] text-xs mt-0.5">
                  {formatAmount(vuc.total_contracted_eur, locale)}{' '}
                  <span className="text-[#94a3b8]/60">{locale === 'sk' ? 'priame' : 'direct'}</span>
                </div>
                <div className="text-[#10b981] text-xs">
                  +{formatAmount(subTotal, locale)}{' '}
                  <span className="text-[#10b981]/70">{locale === 'sk' ? 'zriaďované org.' : 'orgs'}</span>
                </div>
                <div className="text-[#94a3b8] text-xs mt-1">{locale === 'sk' ? 'Celkové zmluvné prostriedky' : 'Total contracted funds'}</div>
              </>
            ) : (
              <>
                <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
                  {formatAmount(vuc.total_contracted_eur, locale)}
                </div>
                <div className="text-[#94a3b8] text-sm mt-1">{locale === 'sk' ? 'Priame čerpanie' : 'Direct absorption'}</div>
              </>
            )}
          </div>

          {/* Projects count */}
          <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="text-3xl font-bold text-[#f8fafc] font-mono">{totalProjects}</div>
            <div className="text-[#94a3b8] text-sm mt-1">
              {vuc.projects_active > 0 ? `${vuc.projects_active} ${locale === 'sk' ? 'aktívnych' : 'active'}` : ''}
              {vuc.projects_active > 0 && vuc.projects_completed > 0 ? ', ' : ''}
              {vuc.projects_completed > 0 ? `${vuc.projects_completed} ${locale === 'sk' ? 'ukončených' : 'completed'}` : ''}
            </div>
          </div>
        </div>

        {/* Per capita */}
        {perCapita > 0 && (
          <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
            <div className="text-xl font-bold text-[#10b981] font-mono">
              {formatAmount(perCapita, locale)} {locale === 'sk' ? '/ obyv.' : '/ capita'}
            </div>
            <div className="text-[#94a3b8] text-sm mt-1">
              {locale === 'sk' ? 'Čerpanie na obyvateľa' : 'Per capita absorption'}
            </div>
          </div>
        )}

        {/* Irregularities */}
        {(vuc.irregularities_count ?? 0) > 0 && (
          <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e] border-l-2 border-l-[#f59e0b]">
            <div className="text-[#f59e0b] text-sm font-medium">
              {vuc.irregularities_count} {locale === 'sk'
                ? `nezrovnalosť${(vuc.irregularities_count ?? 0) > 1 ? 'í' : ''}`
                : `irregularit${(vuc.irregularities_count ?? 0) > 1 ? 'ies' : 'y'}`
              } · {formatAmount(vuc.irregularities_total_eur ?? 0, locale)}
            </div>
          </div>
        )}

        {/* Top projects */}
        {topProjects.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#94a3b8] mb-3 uppercase tracking-wider">
              {locale === 'sk' ? 'TOP PROJEKTY' : 'TOP PROJECTS'}
            </h3>
            <div className="space-y-2">
              {topProjects.map((p, i) => {
                const isActive = !p.stav.toLowerCase().includes('ukončen');
                return (
                  <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                    <div className="text-sm text-[#f8fafc] mb-1 line-clamp-2">{p.nazov}</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#3b82f6] font-mono">{formatAmount(p.sumaZazmluvnena, locale)}</span>
                      <span className="text-[#94a3b8]">{isActive ? (locale === 'sk' ? 'V realizácii' : 'In progress') : (locale === 'sk' ? 'Ukončený' : 'Completed')}</span>
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
              {locale === 'sk' ? 'ORGANIZÁCIE V ZRIAĎOVATEĽSKEJ PÔSOBNOSTI' : 'ORGANIZATIONS UNDER REGIONAL JURISDICTION'}
              <span className="text-base leading-none" title={subsidiaryNote}>ℹ️</span>
            </h3>
            <p className="text-[#94a3b8]/60 text-xs mb-3">{subsidiaryNote}</p>
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

        {/* Disclaimer */}
        <div className="text-xs text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] mb-8">
          {disclaimer}
        </div>
      </div>
    </div>
  );
}
