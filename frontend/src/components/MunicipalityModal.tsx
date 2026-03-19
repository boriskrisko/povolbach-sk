'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Municipality } from '@/lib/types';
import { formatAmount, formatProjects } from '@/lib/utils';
import { useData, Period } from '@/lib/DataContext';
import { useEffect } from 'react';
import { t, type Locale } from '@/lib/translations';

interface Props {
  municipality: Municipality | null;
  onClose: () => void;
  locale: Locale;
  initialPeriod?: Period | null;
}

export default function MunicipalityModal({ municipality, onClose, locale, initialPeriod }: Props) {
  const tr = t[locale];
  const { period: globalPeriod, periodAvailable, getDataForPeriod } = useData();
  const [localPeriod, setLocalPeriod] = useState<Period>(initialPeriod ?? globalPeriod);
  const [copied, setCopied] = useState(false);

  // Reset local period when modal opens or global period changes
  useEffect(() => {
    setLocalPeriod(initialPeriod ?? globalPeriod);
  }, [globalPeriod, municipality?.ico, initialPeriod]);

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

  // Update URL when local period changes (keep ?obec= in sync)
  useEffect(() => {
    if (!municipality) return;
    const url = new URL(window.location.href);
    url.searchParams.set('obec', municipality.ico);
    if (localPeriod === '2127') {
      url.searchParams.set('obdobie', '21');
    } else {
      url.searchParams.delete('obdobie');
    }
    window.history.replaceState({}, '', url.toString());
  }, [municipality, localPeriod]);

  // Update document title and OG meta tags when modal is open
  useEffect(() => {
    if (!municipality) return;
    const origTitle = document.title;

    // Resolve data for current local period
    const periodData = getDataForPeriod(localPeriod);
    const m = periodData?.[municipality.ico] ?? municipality;
    const grandTotal = (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
    const totalProjects = m.active_projects + m.completed_projects;
    const perCapita = m.population > 0 ? Math.round(grandTotal / m.population) : 0;

    const title = `${municipality.official_name} — povolbach.sk`;
    const description = `${formatAmount(grandTotal, 'sk')} EU fondov · ${totalProjects} projektov${perCapita > 0 ? ` · ${formatAmount(perCapita, 'sk')}/obyv.` : ''}`;

    document.title = title;

    // Update OG meta tags
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:url', window.location.href);

    return () => {
      document.title = origTitle;
      // Restore default OG tags
      setMeta('og:title', 'povolbach.sk');
      setMeta('og:description', 'Efektívnosť čerpania európskych fondov na Slovensku');
      setMeta('og:url', window.location.origin);
    };
  }, [municipality, localPeriod, getDataForPeriod]);

  // Resolve the municipality data for the selected local period
  const m = useMemo(() => {
    if (!municipality) return null;
    if (localPeriod === globalPeriod) return municipality;
    const otherData = getDataForPeriod(localPeriod);
    if (!otherData) return null;
    return otherData[municipality.ico] ?? null;
  }, [municipality, localPeriod, globalPeriod, getDataForPeriod]);

  const shareUrl = useMemo(() => {
    if (!municipality) return '';
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.origin);
    url.searchParams.set('obec', municipality.ico);
    if (localPeriod === '2127') url.searchParams.set('obdobie', '21');
    return url.toString();
  }, [municipality, localPeriod]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  if (!municipality) return null;

  const hasData = m && (m.total_contracted_eur > 0 || m.active_projects > 0 || m.completed_projects > 0 || (m.subsidiary_total_eur || 0) > 0);
  const totalProjects = m ? m.active_projects + m.completed_projects : 0;
  const subTotal = m ? (m.subsidiary_total_eur || 0) : 0;
  const grandTotal = m ? m.total_contracted_eur + subTotal : 0;

  const topProjects = m ? [...m.projects]
    .sort((a, b) => (b.sumaZazmluvnena || 0) - (a.sumaZazmluvnena || 0))
    .slice(0, 5) : [];
  const topIndirect = m ? [...(m.indirect_projects || [])]
    .sort((a, b) => (b.contracted_eur || 0) - (a.contracted_eur || 0))
    .slice(0, 5) : [];
  const topSubsidiaryOrgs = m ? [...(m.subsidiary_orgs || [])]
    .sort((a, b) => (b.total_contracted_eur || 0) - (a.total_contracted_eur || 0))
    .slice(0, 5) : [];

  const shareText = tr.share_text(municipality.official_name, shareUrl);
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
  const threadsShareUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`;

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
        {/* Header with close button */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-[#f8fafc]" style={{ fontFamily: 'Syne, sans-serif' }}>
              {municipality.official_name}
            </h2>
            <p className="text-[#94a3b8] text-sm mt-1">
              {municipality.region}{municipality.district ? ` · ${municipality.district}` : ''} · {municipality.nuts5_code}
            </p>
            <p className="text-[#94a3b8] text-sm">
              IČO: <span className="font-mono text-[#f8fafc]">{municipality.ico}</span>
              {municipality.population > 0 && (
                <span> · {municipality.population.toLocaleString('sk-SK')} {locale === 'sk' ? 'obyvateľov' : 'inhabitants'}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none ml-4"
          >
            &times;
          </button>
        </div>

        {/* Local period toggle + share button row */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1 bg-[#0a0a0f] rounded-lg p-1 border border-[#1e1e2e]">
            {(['1420', '2127'] as Period[]).map(p => {
              const isActive = localPeriod === p;
              const isAvailable = periodAvailable[p];
              return (
                <button
                  key={p}
                  onClick={() => isAvailable && setLocalPeriod(p)}
                  disabled={!isAvailable}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#3b82f6] text-white shadow-sm'
                      : isAvailable
                        ? 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e1e2e]'
                        : 'text-[#94a3b8]/30 cursor-not-allowed'
                  }`}
                >
                  {p === '1420' ? tr.modal_period_1420 : tr.modal_period_2127}
                </button>
              );
            })}
          </div>

          {/* Share buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#3b82f6] transition-all"
              title={tr.share_button}
            >
              {copied ? tr.share_copied : tr.share_button}
            </button>
            <a
              href={facebookShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#1877f2] hover:border-[#1877f2] transition-all"
              title={tr.share_facebook}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a
              href={`https://www.instagram.com/`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard.writeText(shareText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                window.open('https://www.instagram.com/', '_blank');
              }}
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#e4405f] hover:border-[#e4405f] transition-all"
              title={`${tr.share_instagram} — ${locale === 'sk' ? 'skopíruje text do schránky' : 'copies text to clipboard'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a
              href={threadsShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#f8fafc] transition-all"
              title={tr.share_threads}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-1.03 1.28-2.567 1.958-4.433 1.964h-.025c-1.476-.006-2.692-.482-3.522-1.378-.77-.833-1.193-1.96-1.222-3.257-.003-.087-.004-.174-.004-.262 0-3.27 2.14-5.378 5.453-5.378 1.032 0 1.907.189 2.643.567l-.882 1.795c-.493-.253-1.06-.38-1.69-.38-2.31 0-3.507 1.476-3.507 3.396 0 .063.001.126.003.188.028 1.027.573 2.63 2.782 2.642 1.258-.005 2.2-.42 2.802-1.167.41-.51.688-1.192.838-2.065-.787-.322-1.686-.486-2.693-.486l.382-1.96c1.46 0 2.746.285 3.839.85 1.27.658 2.183 1.68 2.646 2.96.776 2.14.724 5.053-1.617 7.345C17.622 23.14 15.32 23.976 12.186 24z"/></svg>
            </a>
          </div>
        </div>

        {/* No data state */}
        {!hasData ? (
          <div className="text-center py-12">
            <div className="text-[#94a3b8] text-sm">{tr.modal_no_data}</div>
          </div>
        ) : (
          <>
            {/* Main stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Total card */}
              <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
                {subTotal > 0 ? (
                  <>
                    <div className="font-bold text-[#3b82f6] font-mono" style={{ fontSize: 'clamp(1.2rem, 3.5vw, 2rem)' }}>
                      {formatAmount(grandTotal, locale)}
                    </div>
                    <div className="text-[#94a3b8] text-xs mt-0.5">
                      {formatAmount(m!.total_contracted_eur, locale)}{' '}
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
                      {formatAmount(m!.total_contracted_eur, locale)}
                    </div>
                    <div className="text-[#94a3b8] text-sm mt-1">{tr.modal_total}</div>
                  </>
                )}
              </div>

              {/* Projects count */}
              <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
                <div className="text-3xl font-bold text-[#f8fafc] font-mono">{totalProjects}</div>
                <div className="text-[#94a3b8] text-sm mt-1">
                  {m!.active_projects > 0 ? `${m!.active_projects} ${tr.modal_active}` : ''}
                  {m!.active_projects > 0 && m!.completed_projects > 0 ? ', ' : ''}
                  {m!.completed_projects > 0 ? `${m!.completed_projects} ${tr.modal_completed}` : ''}
                  {totalProjects === 0 ? tr.modal_projects : ''}
                </div>
              </div>
            </div>

            {/* Per capita */}
            {m!.population > 0 && grandTotal > 0 && (
              <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
                <div className="text-xl font-bold text-[#10b981] font-mono">
                  {formatAmount(Math.round(grandTotal / m!.population), locale)} {tr.per_capita_suffix}
                </div>
                <div className="text-[#94a3b8] text-sm mt-1">{tr.modal_per_capita}</div>
              </div>
            )}

            {/* Irregularities */}
            {m!.irregularities_count > 0 && (
              <div className="mb-6 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e] border-l-2 border-l-[#f59e0b]">
                <div className="text-[#f59e0b] text-sm font-medium">
                  {tr.modal_irregularities(m!.irregularities_count, formatAmount(m!.irregularities_total_eur, locale))}
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
                            ? org.share_pct
                              ? `podiel ${org.share_pct}% z ${formatAmount(org.full_amount_eur, locale)} (spoločný podnik ${org.co_owners} obcí)`
                              : `podiel 1/${org.co_owners} z ${formatAmount(org.full_amount_eur, locale)} (spoločný podnik ${org.co_owners} obcí)`
                            : org.share_pct
                              ? `${org.share_pct}% share of ${formatAmount(org.full_amount_eur, locale)} (joint venture of ${org.co_owners} municipalities)`
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
              {localPeriod === '2127' ? tr.modal_disclaimer_2127 : tr.modal_disclaimer_1420}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
