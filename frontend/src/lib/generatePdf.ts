import type { Municipality, MunicipalityMap, VucStats } from './types';
import type { Locale } from './translations';
import { computeNationalAvgPerCapita, findPeerRank, getCombinedTotal } from './utils';

function fmt(amount: number, locale: Locale): string {
  if (locale === 'en') {
    if (amount === 0) return '€0';
    if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `€${Math.round(amount / 1_000)}k`;
    return `€${Math.round(amount)}`;
  }
  if (amount === 0) return '0 €';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mil. €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} tis. €`;
  return `${Math.round(amount)} €`;
}

function fmtFull(amount: number): string {
  return `${amount.toLocaleString('sk-SK', { maximumFractionDigits: 0 })} €`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const L = {
  sk: {
    period: 'Obdobie', total: 'Celkové zmluvné prostriedky', direct: 'priame', subsOrgs: 'zriaďované org.',
    mikroLabel: 'mikroregióny', projects: 'projektov', active: 'aktívnych', completed: 'ukončených',
    perCapita: 'Na obyvateľa', residents: 'obyvateľov', irregularities: 'Nezrovnalosti',
    nationalAvg: 'národný priemer', gapText: 'Obec nevyčerpala', gapOf: 'potenciálu',
    aboveText: 'Obec čerpá', peerAmong: 'Medzi podobnými obcami', peerWithin: 'do',
    peerRes: 'obyvateľov', peerBetter: 'lepšia než', peerOf: 'susedov', peerRank: 'z',
    catHeading: 'TOP 5 PODĽA KATEGÓRIÍ', directHeading: 'VLASTNÉ PROJEKTY',
    subsHeading: 'Organizácie v zriaďovateľskej pôsobnosti', subsNote: 'Tieto organizácie získali fondy samostatne pod vlastným IČO. Sú zahrnuté v celkovom hodnotení obce.',
    mikroHeading: 'Projekty z mikroregiónov', mikroNote: 'Projekty realizované združeniami obcí. Sú zahrnuté v hodnotení obce. Sumy sú rozdelené podľa počtu obyvateľov členských obcí.',
    indirectHeading: 'Štátne projekty v katastri', indirectNote: 'Tieto projekty realizoval štát alebo štátne agentúry na území obce. Nie sú zahrnuté v hodnotení obce.',
    projectName: 'Názov projektu', amount: 'Suma', status: 'Stav', org: 'Organizácia',
    share: 'Podiel obce', source: 'Mikroregión', impl: 'Realizátor',
    statusDone: 'Ukončený', statusActive: 'V realizácii',
    titleSuffix: 'čerpanie Eurofondov', footer: 'Zdroj: povolbach.sk · Dáta:',
  },
  en: {
    period: 'Period', total: 'Total contracted funds', direct: 'direct', subsOrgs: 'subsidiary orgs',
    mikroLabel: 'micro-regions', projects: 'projects', active: 'active', completed: 'completed',
    perCapita: 'Per capita', residents: 'residents', irregularities: 'Irregularities',
    nationalAvg: 'national average', gapText: 'Municipality didn\'t absorb', gapOf: 'of potential',
    aboveText: 'Municipality absorbs', peerAmong: 'Among similar municipalities', peerWithin: 'within',
    peerRes: 'residents', peerBetter: 'better than', peerOf: 'of neighbors', peerRank: 'of',
    catHeading: 'TOP 5 BY CATEGORY', directHeading: 'DIRECT PROJECTS',
    subsHeading: 'Organizations under municipal jurisdiction', subsNote: 'These organizations received EU funds under their own IČO. Included in municipality score.',
    mikroHeading: 'Micro-region projects', mikroNote: 'Projects by municipal associations. Included in municipality score. Amounts split by member population.',
    indirectHeading: 'State projects in territory', indirectNote: 'Implemented by state agencies in the municipality\'s territory. Not included in score.',
    projectName: 'Project name', amount: 'Amount', status: 'Status', org: 'Organization',
    share: 'Municipal share', source: 'Micro-region', impl: 'Implementer',
    statusDone: 'Completed', statusActive: 'In progress',
    titleSuffix: 'EU Fund Absorption', footer: 'Source: povolbach.sk · Data:',
  },
};

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; font-size: 9pt; line-height: 1.4; padding: 15mm; }
  h1 { font-size: 18pt; margin-bottom: 4pt; }
  .meta { color: #94a3b8; font-size: 8.5pt; margin-bottom: 3pt; }
  .period { color: #3b82f6; font-weight: 600; font-size: 8.5pt; margin-bottom: 10pt; }
  .stat-row { display: flex; gap: 24pt; margin-bottom: 8pt; flex-wrap: wrap; }
  .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6pt; padding: 8pt 12pt; }
  .stat-val { font-size: 14pt; font-weight: 700; color: #10b981; font-variant-numeric: tabular-nums; }
  .stat-val.blue { color: #3b82f6; }
  .stat-label { font-size: 7.5pt; color: #94a3b8; margin-top: 2pt; }
  .stat-sub { font-size: 7.5pt; color: #64748b; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 10pt 0; }
  .irr { background: #fffbeb; border-left: 3pt solid #f59e0b; padding: 6pt 10pt; margin-bottom: 10pt; border-radius: 0 4pt 4pt 0; color: #92400e; font-weight: 600; font-size: 8.5pt; }
  .potential { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6pt; padding: 8pt 12pt; margin-bottom: 10pt; font-size: 8pt; }
  .bar-bg { height: 6pt; background: #e2e8f0; border-radius: 3pt; margin: 4pt 0; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3pt; }
  .note { font-size: 7pt; color: #94a3b8; margin-bottom: 4pt; }
  .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 4pt; padding-bottom: 3pt; border-bottom: 1.5pt solid currentColor; display: inline-block; }
  .section-title.blue { color: #3b82f6; }
  .section-title.teal { color: #10b981; }
  .section-title.gray { color: #94a3b8; }
  .cat-heading { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; color: #94a3b8; margin-bottom: 2pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 7.5pt; }
  th { background: #f1f5f9; text-align: left; padding: 4pt 6pt; font-weight: 600; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3pt; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 3pt 6pt; border-bottom: 0.5pt solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbfc; }
  td.amount { color: #3b82f6; font-weight: 600; font-variant-numeric: tabular-nums; }
  td.amount-teal { color: #10b981; font-weight: 600; }
  .footer { margin-top: 40pt; font-size: 7pt; color: #94a3b8; border-top: 0.5pt solid #e2e8f0; padding-top: 4pt; display: flex; justify-content: space-between; page-break-inside: avoid; }
  @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } body { padding: 0; } }
  @page { size: A4; margin: 15mm 15mm 25mm 15mm; }
`;

interface DetailData {
  projects?: Array<{ nazov: string; sumaZazmluvnena: number; stav: string; isMikroregion?: boolean; source?: string }>;
  subsidiary_orgs?: Array<{ name: string; total_contracted_eur: number; projects_count: number }>;
  indirect_projects?: Array<{ name: string; beneficiary_name: string; contracted_eur: number }>;
}

export async function generateMunicipalityPdf(ico: string, period: '1420' | '2127', name: string, locale: Locale = 'sk', allData?: MunicipalityMap | null) {
  const suffix = period === '1420' ? '14' : '21';
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const t = L[locale];
  const title = `${name} - ${t.titleSuffix} - ${periodLabel} | povolbach.sk`;
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  const w = window.open('', '_blank');
  if (!w) { alert(locale === 'sk' ? 'Povoľte vyskakovacie okná pre tlač PDF.' : 'Please allow popups for PDF export.'); return; }
  w.document.write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><p style="font-family:sans-serif;color:#94a3b8;padding:20mm">${locale === 'sk' ? 'Generujem PDF...' : 'Generating PDF...'}</p></body></html>`);
  w.document.close();

  let m: Municipality | null = null;
  try {
    const res = await fetch(`/municipal_stats_${suffix}.json`);
    if (res.ok) { const all = await res.json(); m = all[ico] || null; }
  } catch { /* */ }
  if (!m) { w.close(); return; }

  let detail: DetailData = {};
  try {
    const res = await fetch(`/municipal_details_${suffix}.json`);
    if (res.ok) { const all = await res.json(); detail = all[ico] || {}; }
  } catch { /* */ }

  const allProjects = detail.projects || m.projects || [];
  const allSubs = detail.subsidiary_orgs || m.subsidiary_orgs || [];
  const allIndirect = detail.indirect_projects || m.indirect_projects || [];
  const grandTotal = getCombinedTotal(m);
  const totalProjects = m.active_projects + m.completed_projects;
  const perCapita = m.population > 0 ? Math.round(grandTotal / m.population) : 0;

  // Compute national average + peer rank
  let natAvg = 0;
  let peer: ReturnType<typeof findPeerRank> = null;
  if (allData) {
    natAvg = computeNationalAvgPerCapita(allData);
    peer = findPeerRank(ico, allData);
  }

  let body = `<h1>${esc(m.official_name)}</h1>
    <div class="meta">${esc(m.region)}${m.district ? ` · ${locale === 'sk' ? 'Okres' : 'District'} ${esc(m.district)}` : ''} · IČO: ${m.ico}${m.population > 0 ? ` · ${m.population.toLocaleString('sk-SK')} ${t.residents}` : ''}</div>
    <div class="period">${t.period}: ${periodLabel}</div>
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val">${fmtFull(grandTotal)}</div><div class="stat-label">${t.total}</div>
        ${(m.subsidiary_total_eur || 0) > 0 ? `<div class="stat-sub">${fmtFull(m.total_contracted_eur)} ${t.direct} · ${fmtFull(m.subsidiary_total_eur || 0)} ${t.subsOrgs}</div>` : ''}
      </div>
      <div class="stat-box"><div class="stat-val blue">${totalProjects}</div><div class="stat-label">${m.active_projects} ${t.active}, ${m.completed_projects} ${t.completed}</div></div>
      ${perCapita > 0 ? `<div class="stat-box"><div class="stat-val">${fmt(perCapita, locale)}</div><div class="stat-label">${t.perCapita}</div></div>` : ''}
    </div>`;

  // Potenciál + peer rank
  if (m.population > 0 && natAvg > 0) {
    const myPC = grandTotal / m.population;
    const pct = Math.round((myPC / natAvg) * 100);
    const barW = Math.min(pct, 100);
    const barColor = pct >= 75 ? '#10b981' : pct >= 25 ? '#f59e0b' : '#ef4444';
    const gap = Math.max(0, natAvg * m.population - grandTotal);
    body += `<div class="potential">
      <div style="display:flex;justify-content:space-between;margin-bottom:2pt"><span>${fmt(Math.round(myPC), locale)} / ${fmt(Math.round(natAvg), locale)} ${t.nationalAvg}</span><strong style="color:${barColor}">${pct}%</strong></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${barW}%;background:${barColor}"></div></div>
      ${pct < 100 ? `<div style="font-size:7pt;color:#94a3b8;margin-top:2pt">${t.gapText} <strong style="color:#f59e0b">${fmt(Math.round(gap), locale)}</strong> ${t.gapOf}.</div>` : `<div style="font-size:7pt;color:#10b981;margin-top:2pt">${t.aboveText} <strong>${pct}%</strong> ${t.nationalAvg}.</div>`}
      ${peer ? `<div style="font-size:7pt;color:#94a3b8;margin-top:2pt">${t.peerAmong} (${peer.popMin.toLocaleString('sk-SK')}–${peer.popMax.toLocaleString('sk-SK')} ${t.peerRes}, ${t.peerWithin} ${peer.radiusKm} km): <strong>${peer.rank}. ${t.peerRank} ${peer.total}</strong> — ${t.peerBetter} ${Math.round((1 - peer.rank / peer.total) * 100)}% ${t.peerOf}</div>` : ''}
    </div>`;
  }

  if (m.irregularities_count > 0) {
    body += `<div class="irr">${t.irregularities}: ${m.irregularities_count} · ${fmtFull(m.irregularities_total_eur)}</div>`;
  }

  body += '<hr class="divider">';

  const directProjects = allProjects;

  // Section heading
  // No "TOP 5" heading in PDF — PDF shows ALL projects

  if (directProjects.length > 0) {
    body += `<div class="section-title blue">${t.directHeading} (${directProjects.length})</div>
    <table><thead><tr><th>${t.projectName}</th><th class="right">${t.amount}</th><th class="center">${t.status}</th></tr></thead><tbody>`;
    for (const p of directProjects) {
      const status = (p.stav || '').toLowerCase().includes('ukončen') ? t.statusDone : t.statusActive;
      body += `<tr><td>${esc(p.nazov)}</td><td class="right amount">${fmt(p.sumaZazmluvnena, locale)}</td><td class="center">${status}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  if (allSubs.length > 0) {
    body += `<div class="section-title teal">${t.subsHeading} (${allSubs.length})</div>
    <div class="note">${t.subsNote}</div>
    <table><thead><tr><th>${t.org}</th><th class="right">${t.amount}</th><th class="center">${t.projects}</th></tr></thead><tbody>`;
    for (const o of allSubs) {
      body += `<tr><td>${esc(o.name)}</td><td class="right amount-teal">${fmt(o.total_contracted_eur, locale)}</td><td class="center">${o.projects_count}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  if (allIndirect.length > 0) {
    body += `<div class="section-title gray">${t.indirectHeading} (${allIndirect.length})</div>
    <div class="note">${t.indirectNote}</div>
    <table><thead><tr><th>${t.projectName}</th><th class="right">${t.amount}</th><th>${t.impl}</th></tr></thead><tbody>`;
    for (const p of allIndirect) {
      body += `<tr><td>${esc(p.name)}</td><td class="right amount">${fmt(p.contracted_eur, locale)}</td><td>${esc(p.beneficiary_name.split(' ').slice(0, 4).join(' '))}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  body += `<div class="footer"><span>${t.footer} ${dataSource} · ${new Date().toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}</span><span>${esc(m.official_name)}</span></div>`;

  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export async function generateVucPdf(v: VucStats, period: '1420' | '2127', locale: Locale = 'sk') {
  const suffix = period === '1420' ? '14' : '21';
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const t = L[locale];
  const title = `${v.name} - ${t.titleSuffix} - ${periodLabel} | povolbach.sk`;
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  const w = window.open('', '_blank');
  if (!w) { return; }
  w.document.write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><p style="font-family:sans-serif;color:#94a3b8;padding:20mm">${locale === 'sk' ? 'Generujem PDF...' : 'Generating PDF...'}</p></body></html>`);
  w.document.close();

  let detail: DetailData = {};
  try {
    const res = await fetch(`/vuc_details_${suffix}.json`);
    if (res.ok) { const all = await res.json(); detail = all[v.ico] || {}; }
  } catch { /* */ }

  const allProjects = detail.projects || v.projects || [];
  const allSubs = detail.subsidiary_orgs || v.subsidiary_orgs || [];
  const grandTotal = v.total_contracted_eur + (v.subsidiary_total_eur || 0);
  const totalProjects = v.projects_active + v.projects_completed;
  const perCapita = v.population > 0 ? Math.round(grandTotal / v.population) : 0;

  let body = `<h1>${esc(v.name)}</h1>
    <div class="meta">IČO: ${v.ico}${v.population > 0 ? ` · ${v.population.toLocaleString('sk-SK')} ${t.residents}` : ''}</div>
    <div class="period">${t.period}: ${periodLabel}</div>
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val">${fmtFull(grandTotal)}</div><div class="stat-label">${t.total}</div>
        ${v.subsidiary_total_eur > 0 ? `<div class="stat-sub">${fmtFull(v.total_contracted_eur)} ${t.direct} · ${fmtFull(v.subsidiary_total_eur)} ${t.subsOrgs}</div>` : ''}
      </div>
      <div class="stat-box"><div class="stat-val blue">${totalProjects}</div><div class="stat-label">${v.projects_active} ${t.active}, ${v.projects_completed} ${t.completed}</div></div>
      ${perCapita > 0 ? `<div class="stat-box"><div class="stat-val">${fmt(perCapita, locale)}</div><div class="stat-label">${t.perCapita}</div></div>` : ''}
    </div><hr class="divider">`;

  if (allProjects.length > 0) {
    body += `<div class="section-title blue">${locale === 'sk' ? 'Projekty' : 'Projects'} (${allProjects.length})</div>
    <table><thead><tr><th>${t.projectName}</th><th class="right">${t.amount}</th><th class="center">${t.status}</th></tr></thead><tbody>`;
    for (const p of allProjects) {
      const status = (p.stav || '').toLowerCase().includes('ukončen') ? t.statusDone : t.statusActive;
      body += `<tr><td>${esc(p.nazov)}</td><td class="right amount">${fmt(p.sumaZazmluvnena, locale)}</td><td class="center">${status}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  if (allSubs.length > 0) {
    body += `<div class="section-title teal">${t.subsHeading} (${allSubs.length})</div>
    <table><thead><tr><th>${t.org}</th><th class="right">${t.amount}</th><th class="center">${t.projects}</th></tr></thead><tbody>`;
    for (const o of allSubs) {
      body += `<tr><td>${esc(o.name)}</td><td class="right amount-teal">${fmt(o.total_contracted_eur, locale)}</td><td class="center">${o.projects_count}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  body += `<div class="footer"><span>${t.footer} ${dataSource} · ${new Date().toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}</span><span>${esc(v.name)}</span></div>`;

  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
