'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { VucStats } from '@/lib/types';
import { formatAmount, formatProjects } from '@/lib/utils';
import { t, type Locale } from '@/lib/translations';
import { useData, Period } from '@/lib/DataContext';
import { generateVucPdf } from '@/lib/generatePdf';

interface Props {
  vuc: VucStats | null;
  vucOtherPeriod?: VucStats | null;
  onClose: () => void;
  locale: Locale;
}

function Spinner() {
  return <span className="inline-block w-3 h-3 border-2 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />;
}

export default function VucModal({ vuc, vucOtherPeriod, onClose, locale }: Props) {
  const tr = t[locale];
  const { period: globalPeriod, periodLoading, periodAvailable } = useData();
  const [localPeriod, setLocalPeriod] = useState<Period>(globalPeriod);
  const [copied, setCopied] = useState(false);
  const [copiedVisible, setCopiedVisible] = useState(false);

  useEffect(() => { setLocalPeriod(globalPeriod); }, [globalPeriod, vuc?.ico]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (vuc) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }
  }, [vuc]);

  if (!vuc) return null;

  // Determine which VÚC data is for which period
  const v14 = globalPeriod === '1420' ? vuc : vucOtherPeriod;
  const v21 = globalPeriod === '2127' ? vuc : vucOtherPeriod;
  const v = localPeriod === '1420' ? v14 : v21;

  const getStats = (v: VucStats | null | undefined) => {
    if (!v) return { total: 0, projects: 0, perCapita: 0 };
    const total = v.total_contracted_eur + (v.subsidiary_total_eur || 0);
    return { total, projects: v.projects_active + v.projects_completed, perCapita: v.population > 0 ? Math.round(total / v.population) : 0 };
  };
  const stats14 = getStats(v14);
  const stats21 = getStats(v21);

  const detailLoading = localPeriod === '1420' ? periodLoading['1420'] : periodLoading['2127'];
  const totalProjects = v ? v.projects_active + v.projects_completed : 0;
  const subTotal = v ? (v.subsidiary_total_eur || 0) : 0;
  const grandTotal = v ? v.total_contracted_eur + subTotal : 0;
  const perCapita = v && v.population > 0 ? Math.round(grandTotal / v.population) : 0;
  const hasData = v && grandTotal > 0;

  const topProjects = v ? [...v.projects].sort((a, b) => (b.sumaZazmluvnena || 0) - (a.sumaZazmluvnena || 0)).slice(0, 5) : [];
  const topSubs = v ? [...(v.subsidiary_orgs || [])].sort((a, b) => (b.total_contracted_eur || 0) - (a.total_contracted_eur || 0)).slice(0, 5) : [];

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://povolbach.sk';
  const threadsText = `${vuc.name} — čerpanie eurofondov ${shareUrl}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(threadsText)}`;

  const copyToClipboard = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { const i = document.createElement('input'); i.value = text; document.body.appendChild(i); i.select(); document.execCommand('copy'); document.body.removeChild(i); }
  }, []);
  const showCopied = useCallback(() => { setCopied(true); setCopiedVisible(true); setTimeout(() => setCopiedVisible(false), 2000); setTimeout(() => setCopied(false), 3000); }, []);
  const handleShare = useCallback(async () => {
    try { await navigator.share({ title: `${vuc.name} — povolbach.sk`, text: `${vuc.name} — čerpanie eurofondov`, url: shareUrl }); }
    catch { await copyToClipboard(shareUrl); showCopied(); }
  }, [vuc, shareUrl, copyToClipboard, showCopied]);
  const handleCopy = useCallback(async () => { await copyToClipboard(shareUrl); showCopied(); }, [shareUrl, copyToClipboard, showCopied]);

  const renderCell = (loading: boolean, loaded: boolean, val: number, other: number, fmt: (v: number) => string, hl: boolean) => {
    if (loading && !loaded) return <Spinner />;
    if (val === 0) return <span className={hl ? 'text-[#94a3b8]' : 'text-[#94a3b8]/50'}>—</span>;
    const higher = val > other && other >= 0;
    return <span className={`font-mono text-sm ${hl ? 'text-[#f8fafc]' : 'text-[#94a3b8]'}`}>{higher && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] mr-1 align-middle" />}{fmt(val)}</span>;
  };

  const is14A = localPeriod === '1420';
  const is14L = !!v14, is21L = !!v21;
  const btnCls = "p-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-white/20 transition-all";

  const subsidiaryNote = locale === 'sk'
    ? 'Tieto organizácie získali fondy samostatne pod vlastným IČO. Sú zahrnuté v celkovom hodnotení kraja.'
    : 'These organizations received EU funds under their own ICO. They are included in the region\'s total score.';
  const disclaimer = localPeriod === '2127'
    ? (locale === 'sk' ? 'Programové obdobie 2021–2027. Zahŕňa priame čerpanie samosprávneho kraja aj organizácií v jeho zriaďovateľskej pôsobnosti.' : 'Programming period 2021–2027. Includes direct regional government absorption and organizations under its jurisdiction.')
    : (locale === 'sk' ? 'Zahŕňa priame čerpanie samosprávneho kraja aj organizácií v jeho zriaďovateľskej pôsobnosti. Nezahŕňa projekty štátnych agentúr.' : 'Includes direct regional government absorption and organizations under its jurisdiction. Excludes state agency projects.');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-hidden" onClick={onClose}>
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl max-w-lg w-full mx-4 p-6 sm:p-8 animate-fade-in-up overflow-y-auto" style={{ maxHeight: '85vh' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>{vuc.name}</h2>
            <p className="text-[#94a3b8] text-sm mt-1">IČO: <span className="font-mono text-[#f8fafc]">{vuc.ico}</span>{vuc.population > 0 && <span> · {vuc.population.toLocaleString('sk-SK')} {locale === 'sk' ? 'obyvateľov' : 'inhabitants'}</span>}</p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Share + Period toggle row */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-1.5">
            <button onClick={handleShare} title={tr.share_button} className={btnCls}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>
            <button onClick={handleCopy} title={locale === 'sk' ? 'Kopírovať odkaz' : 'Copy link'} className={btnCls}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer" title="Facebook" className={`${btnCls} hover:!text-[#1877f2] hover:!border-[#1877f2]/40`}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
            <a href={threadsUrl} target="_blank" rel="noopener noreferrer" title="Threads" className={btnCls}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-1.03 1.28-2.567 1.958-4.433 1.964h-.025c-1.476-.006-2.692-.482-3.522-1.378-.77-.833-1.193-1.96-1.222-3.257-.003-.087-.004-.174-.004-.262 0-3.27 2.14-5.378 5.453-5.378 1.032 0 1.907.189 2.643.567l-.882 1.795c-.493-.253-1.06-.38-1.69-.38-2.31 0-3.507 1.476-3.507 3.396 0 .063.001.126.003.188.028 1.027.573 2.63 2.782 2.642 1.258-.005 2.2-.42 2.802-1.167.41-.51.688-1.192.838-2.065-.787-.322-1.686-.486-2.693-.486l.382-1.96c1.46 0 2.746.285 3.839.85 1.27.658 2.183 1.68 2.646 2.96.776 2.14.724 5.053-1.617 7.345C17.622 23.14 15.32 23.976 12.186 24z"/></svg></a>
            <button onClick={() => v && generateVucPdf(v, localPeriod)} title="PDF" className={btnCls}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg></button>
            {copied && <span className={`absolute left-[88px] -top-7 text-[11px] text-[#10b981] bg-[#0a0a0f] border border-[#1e1e2e] rounded px-1.5 py-0.5 transition-opacity duration-1000 ${copiedVisible ? 'opacity-100' : 'opacity-0'}`}>{tr.share_copied}</span>}
          </div>
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5">
            {(['1420', '2127'] as Period[]).map(p => <button key={p} onClick={() => periodAvailable[p] && setLocalPeriod(p)} disabled={!periodAvailable[p]} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${localPeriod === p ? 'bg-[#3b82f6] text-white shadow-sm' : periodAvailable[p] ? 'text-[#94a3b8]/70 hover:text-[#f8fafc]' : 'text-[#94a3b8]/20 cursor-not-allowed'}`}>{p === '1420' ? tr.modal_period_1420 : tr.modal_period_2127}</button>)}
          </div>
        </div>

        {/* Comparison table */}
        <div className="rounded-lg border border-white/[0.08] mb-4 overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup><col style={{ width: '25%' }} /><col style={{ width: '37.5%' }} /><col style={{ width: '37.5%' }} /></colgroup>
            <thead><tr className="text-xs">
              <th className="px-3 py-2 text-left font-normal text-[#94a3b8]/40">{locale === 'sk' ? 'Obdobie' : 'Period'}</th>
              <th className={`px-3 py-2 text-center font-medium ${is14A ? 'bg-[#3b82f6]/8 text-[#3b82f6]' : 'text-[#94a3b8]/50'}`}>{tr.modal_period_1420}</th>
              <th className={`px-3 py-2 text-center font-medium ${!is14A ? 'bg-[#3b82f6]/8 text-[#3b82f6]' : 'text-[#94a3b8]/50'}`}>{tr.modal_period_2127}</th>
            </tr></thead>
            <tbody>
              <tr className="border-t border-white/[0.06]">
                <td className="px-3 py-2 text-left text-xs text-[#94a3b8]/50">{tr.modal_comparison_total}</td>
                <td className={`px-3 py-2 text-center ${is14A ? 'bg-[#3b82f6]/[0.03]' : ''}`}>{renderCell(periodLoading['1420'], is14L, stats14.total, stats21.total, v => formatAmount(v, locale), is14A)}</td>
                <td className={`px-3 py-2 text-center ${!is14A ? 'bg-[#3b82f6]/[0.03]' : ''}`}>{renderCell(periodLoading['2127'], is21L, stats21.total, stats14.total, v => formatAmount(v, locale), !is14A)}</td>
              </tr>
              <tr className="border-t border-white/[0.06]">
                <td className="px-3 py-2 text-left text-xs text-[#94a3b8]/50">{tr.modal_comparison_projects}</td>
                <td className={`px-3 py-2 text-center ${is14A ? 'bg-[#3b82f6]/[0.03]' : ''}`}>{renderCell(periodLoading['1420'], is14L, stats14.projects, stats21.projects, v => String(v), is14A)}</td>
                <td className={`px-3 py-2 text-center ${!is14A ? 'bg-[#3b82f6]/[0.03]' : ''}`}>{renderCell(periodLoading['2127'], is21L, stats21.projects, stats14.projects, v => String(v), !is14A)}</td>
              </tr>
              {vuc.population > 0 && <tr className="border-t border-white/[0.06]">
                <td className="px-3 py-2 text-left text-xs text-[#94a3b8]/50">{tr.modal_comparison_per_capita}</td>
                <td className={`px-3 py-2 text-center ${is14A ? 'bg-[#3b82f6]/[0.03]' : ''}`}>{renderCell(periodLoading['1420'], is14L, stats14.perCapita, stats21.perCapita, v => formatAmount(v, locale), is14A)}</td>
                <td className={`px-3 py-2 text-center ${!is14A ? 'bg-[#3b82f6]/[0.03]' : ''}`}>{renderCell(periodLoading['2127'], is21L, stats21.perCapita, stats14.perCapita, v => formatAmount(v, locale), !is14A)}</td>
              </tr>}
            </tbody>
          </table>
        </div>

        {/* Detail label */}
        <div className="text-[11px] text-[#94a3b8]/40 uppercase tracking-wider mb-4">
          {tr.modal_detail_label(localPeriod === '1420' ? tr.modal_period_1420 : tr.modal_period_2127)}
        </div>

        {/* Detail */}
        {detailLoading && !v ? (
          <div className="flex items-center justify-center py-12 gap-2"><Spinner /><span className="text-[#94a3b8] text-sm">{locale === 'sk' ? 'Načítavam...' : 'Loading...'}</span></div>
        ) : !hasData ? (
          <div className="text-center py-12"><div className="text-[#94a3b8] text-sm">{tr.modal_no_data}</div></div>
        ) : (<>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
              {subTotal > 0 ? (<>
                <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 2rem)' }}>{formatAmount(grandTotal, locale)}</div>
                <div className="text-[#94a3b8] text-xs mt-0.5">{formatAmount(v!.total_contracted_eur, locale)} <span className="text-[#94a3b8]/60">{locale === 'sk' ? 'priame' : 'direct'}</span></div>
                <div className="text-[#10b981] text-xs">+{formatAmount(subTotal, locale)} <span className="text-[#10b981]/70">{locale === 'sk' ? 'zriaďované org.' : 'orgs'}</span></div>
                <div className="text-[#94a3b8] text-xs mt-1">{locale === 'sk' ? 'Celkové zmluvné prostriedky' : 'Total contracted funds'}</div>
              </>) : (<>
                <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>{formatAmount(v!.total_contracted_eur, locale)}</div>
                <div className="text-[#94a3b8] text-sm mt-1">{locale === 'sk' ? 'Priame čerpanie' : 'Direct absorption'}</div>
              </>)}
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
              <div className="text-3xl font-bold text-[#f8fafc] font-mono">{totalProjects}</div>
              <div className="text-[#94a3b8] text-sm mt-1">{v!.projects_active > 0 ? `${v!.projects_active} ${locale === 'sk' ? 'aktívnych' : 'active'}` : ''}{v!.projects_active > 0 && v!.projects_completed > 0 ? ', ' : ''}{v!.projects_completed > 0 ? `${v!.projects_completed} ${locale === 'sk' ? 'ukončených' : 'completed'}` : ''}</div>
            </div>
          </div>

          {perCapita > 0 && <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]"><div className="text-xl font-bold text-[#10b981] font-mono">{formatAmount(perCapita, locale)} {locale === 'sk' ? '/ obyv.' : '/ capita'}</div><div className="text-[#94a3b8] text-sm mt-1">{locale === 'sk' ? 'Čerpanie na obyvateľa' : 'Per capita absorption'}</div></div>}

          {(v!.irregularities_count ?? 0) > 0 && <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e] border-l-2 border-l-[#f59e0b]"><div className="text-[#f59e0b] text-sm font-medium">{v!.irregularities_count} {locale === 'sk' ? `nezrovnalosť${(v!.irregularities_count ?? 0) > 1 ? 'í' : ''}` : `irregularit${(v!.irregularities_count ?? 0) > 1 ? 'ies' : 'y'}`} · {formatAmount(v!.irregularities_total_eur ?? 0, locale)}</div></div>}

          {topProjects.length > 0 && <div className="mb-6"><h3 className="text-sm font-medium text-[#94a3b8] mb-3 uppercase tracking-wider">{locale === 'sk' ? 'TOP PROJEKTY' : 'TOP PROJECTS'}</h3><div className="space-y-2">{topProjects.map((p, i) => { const act = !p.stav.toLowerCase().includes('ukončen'); return <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]"><div className="text-sm text-[#f8fafc] mb-1 line-clamp-2">{p.nazov}</div><div className="flex justify-between text-xs"><span className="text-[#3b82f6] font-mono">{formatAmount(p.sumaZazmluvnena, locale)}</span><span className="text-[#94a3b8]">{act ? (locale === 'sk' ? 'V realizácii' : 'In progress') : (locale === 'sk' ? 'Ukončený' : 'Completed')}</span></div></div>; })}</div></div>}

          {subTotal > 0 && topSubs.length > 0 && (() => { const hasJV = topSubs.some(o => (o.co_owners||0) > 1); return <div className="mb-6"><h3 className="text-sm font-medium text-[#10b981]/80 mb-1 uppercase tracking-wider flex items-center gap-1.5">{locale === 'sk' ? 'ORGANIZÁCIE V ZRIAĎOVATEĽSKEJ PÔSOBNOSTI' : 'ORGANIZATIONS UNDER REGIONAL JURISDICTION'}<span className="text-base leading-none" title={subsidiaryNote}>ℹ️</span></h3><p className="text-[#94a3b8]/60 text-xs mb-3">{subsidiaryNote}</p><div className="space-y-2">{topSubs.map((org, i) => <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] border-l-2 border-l-[#10b981]/40"><div className="text-sm text-[#f8fafc]/90 mb-1 line-clamp-2">{org.name}</div><div className="flex justify-between text-xs"><span className="text-[#10b981] font-mono">{formatAmount(org.total_contracted_eur, locale)}</span><span className="text-[#94a3b8]/70">{formatProjects(org.projects_count, locale)}</span></div>{(org.co_owners||0) > 1 && org.full_amount_eur && <div className="text-[10px] text-[#94a3b8]/50 mt-1">↳ {locale === 'sk' ? (org.share_pct ? `podiel ${org.share_pct}% z ${formatAmount(org.full_amount_eur, locale)} (spoločný podnik ${org.co_owners} obcí)` : `podiel 1/${org.co_owners} z ${formatAmount(org.full_amount_eur, locale)} (spoločný podnik ${org.co_owners} obcí)`) : (org.share_pct ? `${org.share_pct}% share of ${formatAmount(org.full_amount_eur, locale)} (joint venture of ${org.co_owners} municipalities)` : `share 1/${org.co_owners} of ${formatAmount(org.full_amount_eur, locale)} (joint venture of ${org.co_owners} municipalities)`)}</div>}</div>)}</div>{hasJV && <p className="text-[10px] text-[#94a3b8]/40 mt-2">{locale === 'sk' ? 'Sumy spoločných podnikov sú rozdelené proporcionálne medzi spoluvlastníkov.' : 'Joint venture amounts are split proportionally among co-owners.'}</p>}</div>; })()}

          <div className="text-xs text-[#94a3b8] bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] mb-8">{disclaimer}</div>
        </>)}
      </div>
    </div>
  );
}
