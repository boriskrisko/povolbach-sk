'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Municipality } from '@/lib/types';
import { formatAmount, formatProjects } from '@/lib/utils';
import { useData, Period } from '@/lib/DataContext';
import { t, type Locale } from '@/lib/translations';

interface Props {
  municipality: Municipality | null;
  onClose: () => void;
  locale: Locale;
}

/** Small inline spinner for loading columns */
function Spinner() {
  return (
    <span className="inline-block w-3 h-3 border-2 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />
  );
}

export default function MunicipalityModal({ municipality, onClose, locale }: Props) {
  const tr = t[locale];
  const { period: globalPeriod, periodLoading, periodAvailable, getDataForPeriod } = useData();
  const [copied, setCopied] = useState(false);
  const [localPeriod, setLocalPeriod] = useState<Period>(globalPeriod);

  // Reset local period when modal opens or global period changes
  useEffect(() => {
    setLocalPeriod(globalPeriod);
  }, [globalPeriod, municipality?.ico]);

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

  // Update URL to reflect local period
  useEffect(() => {
    if (!municipality) return;
    const url = new URL(window.location.href);
    url.searchParams.set('ico', municipality.ico);
    if (localPeriod === '2127') {
      url.searchParams.set('obdobie', '21');
    } else {
      url.searchParams.delete('obdobie');
    }
    window.history.replaceState({}, '', url.toString());
  }, [municipality, localPeriod]);

  // Resolve data for BOTH periods (for comparison header)
  const data14 = getDataForPeriod('1420');
  const data21 = getDataForPeriod('2127');
  const m14 = data14?.[municipality?.ico ?? ''] ?? null;
  const m21 = data21?.[municipality?.ico ?? ''] ?? null;

  // Detail section uses the LOCAL period
  const m = localPeriod === '1420' ? m14 : m21;
  const detailLoading = localPeriod === '1420' ? periodLoading['1420'] : periodLoading['2127'];

  // Helper: compute stats for a period's municipality data
  const getStats = useCallback((muni: Municipality | null) => {
    if (!muni) return { total: 0, projects: 0, perCapita: 0 };
    const total = (muni.total_contracted_eur || 0) + (muni.subsidiary_total_eur || 0);
    const projects = muni.active_projects + muni.completed_projects;
    const perCapita = muni.population > 0 ? Math.round(total / muni.population) : 0;
    return { total, projects, perCapita };
  }, []);

  const stats14 = useMemo(() => getStats(m14), [m14, getStats]);
  const stats21 = useMemo(() => getStats(m21), [m21, getStats]);

  // OG meta tags
  useEffect(() => {
    if (!municipality) return;
    const origTitle = document.title;
    const detailStats = localPeriod === '1420' ? stats14 : stats21;

    const title = `${municipality.official_name} — povolbach.sk`;
    const description = `${formatAmount(detailStats.total, 'sk')} EU fondov · ${detailStats.projects} projektov${detailStats.perCapita > 0 ? ` · ${formatAmount(detailStats.perCapita, 'sk')}/obyv.` : ''}`;

    document.title = title;

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

    const ogImageUrl = `${window.location.origin}/api/og?ico=${municipality.ico}${localPeriod === '2127' ? '&obdobie=21' : ''}`;
    setMeta('og:image', ogImageUrl);

    const setMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMetaName('twitter:card', 'summary_large_image');

    return () => {
      document.title = origTitle;
      setMeta('og:title', 'povolbach.sk');
      setMeta('og:description', 'Efektívnosť čerpania európskych fondov na Slovensku');
      setMeta('og:url', window.location.origin);
      setMeta('og:image', `${window.location.origin}/api/og`);
    };
  }, [municipality, localPeriod, stats14, stats21]);

  // Share URL
  const shareUrl = useMemo(() => {
    if (!municipality || typeof window === 'undefined') return '';
    const url = new URL(window.location.origin);
    url.searchParams.set('ico', municipality.ico);
    if (localPeriod === '2127') url.searchParams.set('obdobie', '21');
    return url.toString();
  }, [municipality, localPeriod]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  // Native share for mobile — used by all social buttons when available
  const handleNativeShare = useCallback(async () => {
    if (!municipality) return;
    try {
      await navigator.share({
        title: `${municipality.official_name} — povolbach.sk`,
        text: locale === 'sk'
          ? `Pozri ako čerpá eurofondy ${municipality.official_name}`
          : `See how ${municipality.official_name} uses EU funds`,
        url: shareUrl,
      });
    } catch {
      // User cancelled or share failed — ignore
    }
  }, [municipality, shareUrl, locale]);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  if (!municipality) return null;

  const shareText = tr.share_text(municipality.official_name, shareUrl);
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
  const threadsShareUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`;

  // Detail section data
  const hasDetailData = m && (m.total_contracted_eur > 0 || m.active_projects > 0 || m.completed_projects > 0 || (m.subsidiary_total_eur || 0) > 0);
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

  // Comparison helper: render a value cell with loading/no-data/value states
  const renderCell = (
    isLoading: boolean,
    dataLoaded: boolean,
    value: number,
    otherValue: number,
    formatter: (v: number) => string,
    isHighlighted: boolean,
  ) => {
    if (isLoading && !dataLoaded) {
      return <Spinner />;
    }
    if (value === 0) {
      return <span className={isHighlighted ? 'text-[#94a3b8]' : 'text-[#94a3b8]/50'}>—</span>;
    }
    const isHigher = value > otherValue && otherValue >= 0;
    return (
      <span className={`font-mono ${isHighlighted ? 'text-[#f8fafc]' : 'text-[#94a3b8]'}`}>
        {isHigher && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] mr-1.5 align-middle" />}
        {formatter(value)}
      </span>
    );
  };

  const is14Loaded = !!data14;
  const is21Loaded = !!data21;
  const is14Active = globalPeriod === '1420';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl max-w-lg w-full mx-4 p-6 sm:p-8 animate-fade-in-up overflow-y-auto"
        style={{ maxHeight: '85vh', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
            className="text-[#94a3b8] hover:text-[#f8fafc] transition-colors text-2xl leading-none ml-4 flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* Share buttons */}
        <div className="flex items-center gap-1.5 mb-5">
          <button
            onClick={handleCopyLink}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#3b82f6] transition-all"
            title={tr.share_button}
          >
            {copied ? tr.share_copied : tr.share_button}
          </button>
          {/* Facebook */}
          {canNativeShare ? (
            <button
              onClick={handleNativeShare}
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#1877f2] hover:border-[#1877f2] transition-all"
              title={tr.share_facebook}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </button>
          ) : (
            <a
              href={facebookShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#1877f2] hover:border-[#1877f2] transition-all"
              title={tr.share_facebook}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
          )}
          {/* Instagram */}
          {canNativeShare ? (
            <button
              onClick={handleNativeShare}
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#e4405f] hover:border-[#e4405f] transition-all"
              title={tr.share_instagram}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </button>
          ) : (
            <a
              href="https://www.instagram.com/"
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
          )}
          {/* Threads */}
          {canNativeShare ? (
            <button
              onClick={handleNativeShare}
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#f8fafc] transition-all"
              title={tr.share_threads}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-1.03 1.28-2.567 1.958-4.433 1.964h-.025c-1.476-.006-2.692-.482-3.522-1.378-.77-.833-1.193-1.96-1.222-3.257-.003-.087-.004-.174-.004-.262 0-3.27 2.14-5.378 5.453-5.378 1.032 0 1.907.189 2.643.567l-.882 1.795c-.493-.253-1.06-.38-1.69-.38-2.31 0-3.507 1.476-3.507 3.396 0 .063.001.126.003.188.028 1.027.573 2.63 2.782 2.642 1.258-.005 2.2-.42 2.802-1.167.41-.51.688-1.192.838-2.065-.787-.322-1.686-.486-2.693-.486l.382-1.96c1.46 0 2.746.285 3.839.85 1.27.658 2.183 1.68 2.646 2.96.776 2.14.724 5.053-1.617 7.345C17.622 23.14 15.32 23.976 12.186 24z"/></svg>
            </button>
          ) : (
            <a
              href={threadsShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#f8fafc] transition-all"
              title={tr.share_threads}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-1.03 1.28-2.567 1.958-4.433 1.964h-.025c-1.476-.006-2.692-.482-3.522-1.378-.77-.833-1.193-1.96-1.222-3.257-.003-.087-.004-.174-.004-.262 0-3.27 2.14-5.378 5.453-5.378 1.032 0 1.907.189 2.643.567l-.882 1.795c-.493-.253-1.06-.38-1.69-.38-2.31 0-3.507 1.476-3.507 3.396 0 .063.001.126.003.188.028 1.027.573 2.63 2.782 2.642 1.258-.005 2.2-.42 2.802-1.167.41-.51.688-1.192.838-2.065-.787-.322-1.686-.486-2.693-.486l.382-1.96c1.46 0 2.746.285 3.839.85 1.27.658 2.183 1.68 2.646 2.96.776 2.14.724 5.053-1.617 7.345C17.622 23.14 15.32 23.976 12.186 24z"/></svg>
            </a>
          )}
        </div>

        {/* ── Side-by-side period comparison ── */}
        <div className="rounded-lg border border-white/[0.08] mb-4 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="py-1.5 px-2 text-left font-normal text-[#94a3b8]/40 w-[72px]" />
                <th className={`py-1.5 px-2 text-center font-medium w-1/2 ${is14Active ? 'bg-[#3b82f6]/8 text-[#3b82f6]' : 'text-[#94a3b8]/50'}`}>
                  {tr.modal_period_1420}
                </th>
                <th className={`py-1.5 px-2 text-center font-medium w-1/2 ${!is14Active ? 'bg-[#3b82f6]/8 text-[#3b82f6]' : 'text-[#94a3b8]/50'}`}>
                  {tr.modal_period_2127}
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-t border-white/[0.06]">
                <td className="py-1.5 px-2 text-[#94a3b8]/50 text-xs">{tr.modal_comparison_total}</td>
                <td className={`py-1.5 px-2 text-center ${is14Active ? 'bg-[#3b82f6]/[0.03]' : ''}`}>
                  {renderCell(periodLoading['1420'], is14Loaded, stats14.total, stats21.total, v => formatAmount(v, locale), is14Active)}
                </td>
                <td className={`py-1.5 px-2 text-center ${!is14Active ? 'bg-[#3b82f6]/[0.03]' : ''}`}>
                  {renderCell(periodLoading['2127'], is21Loaded, stats21.total, stats14.total, v => formatAmount(v, locale), !is14Active)}
                </td>
              </tr>
              <tr className="border-t border-white/[0.06]">
                <td className="py-1.5 px-2 text-[#94a3b8]/50 text-xs">{tr.modal_comparison_projects}</td>
                <td className={`py-1.5 px-2 text-center ${is14Active ? 'bg-[#3b82f6]/[0.03]' : ''}`}>
                  {renderCell(periodLoading['1420'], is14Loaded, stats14.projects, stats21.projects, v => String(v), is14Active)}
                </td>
                <td className={`py-1.5 px-2 text-center ${!is14Active ? 'bg-[#3b82f6]/[0.03]' : ''}`}>
                  {renderCell(periodLoading['2127'], is21Loaded, stats21.projects, stats14.projects, v => String(v), !is14Active)}
                </td>
              </tr>
              {municipality.population > 0 && (
                <tr className="border-t border-white/[0.06]">
                  <td className="py-1.5 px-2 text-[#94a3b8]/50 text-xs">{tr.modal_comparison_per_capita}</td>
                  <td className={`py-1.5 px-2 text-center ${is14Active ? 'bg-[#3b82f6]/[0.03]' : ''}`}>
                    {renderCell(periodLoading['1420'], is14Loaded, stats14.perCapita, stats21.perCapita, v => formatAmount(v, locale), is14Active)}
                  </td>
                  <td className={`py-1.5 px-2 text-center ${!is14Active ? 'bg-[#3b82f6]/[0.03]' : ''}`}>
                    {renderCell(periodLoading['2127'], is21Loaded, stats21.perCapita, stats14.perCapita, v => formatAmount(v, locale), !is14Active)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Local period toggle ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5">
            {(['1420', '2127'] as Period[]).map(p => {
              const active = localPeriod === p;
              const available = periodAvailable[p];
              return (
                <button
                  key={p}
                  onClick={() => available && setLocalPeriod(p)}
                  disabled={!available}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                    active
                      ? 'bg-[#3b82f6] text-white shadow-sm'
                      : available
                        ? 'text-[#94a3b8]/70 hover:text-[#f8fafc]'
                        : 'text-[#94a3b8]/20 cursor-not-allowed'
                  }`}
                >
                  {p === '1420' ? tr.modal_period_1420 : tr.modal_period_2127}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-[#94a3b8]/40 uppercase tracking-wider">
            {tr.modal_detail_label(localPeriod === '1420' ? tr.modal_period_1420 : tr.modal_period_2127)}
          </span>
        </div>

        {/* Detail: loading state */}
        {detailLoading && !m ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Spinner />
            <span className="text-[#94a3b8] text-sm">{locale === 'sk' ? 'Načítavam...' : 'Loading...'}</span>
          </div>
        ) : !hasDetailData ? (
          /* Detail: no data for this period */
          <div className="text-center py-12">
            <div className="text-[#94a3b8] text-sm">{tr.modal_no_data}</div>
          </div>
        ) : (
          <>
            {/* Main stats grid */}
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
