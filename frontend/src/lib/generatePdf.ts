import type { Municipality, VucStats } from './types';

function fmtEur(amount: number): string {
  if (amount === 0) return '0 €';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mil. €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} tis. €`;
  return `${Math.round(amount)} €`;
}

function fmtEurFull(amount: number): string {
  return `${amount.toLocaleString('sk-SK', { maximumFractionDigits: 0 })} €`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
  .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 4pt; padding-bottom: 3pt; border-bottom: 1.5pt solid currentColor; display: inline-block; }
  .section-title.blue { color: #3b82f6; }
  .section-title.teal { color: #10b981; }
  .section-title.gray { color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 7.5pt; }
  th { background: #f1f5f9; text-align: left; padding: 4pt 6pt; font-weight: 600; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.3pt; }
  th.blue { background: #eff6ff; color: #3b82f6; }
  th.teal { background: #ecfdf5; color: #10b981; }
  th.gray { background: #f8fafc; color: #94a3b8; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 3pt 6pt; border-bottom: 0.5pt solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbfc; }
  td.amount { color: #3b82f6; font-weight: 600; font-variant-numeric: tabular-nums; }
  td.amount-teal { color: #10b981; font-weight: 600; font-variant-numeric: tabular-nums; }
  .footer { position: fixed; bottom: 10mm; left: 15mm; right: 15mm; font-size: 7pt; color: #94a3b8; border-top: 0.5pt solid #e2e8f0; padding-top: 4pt; display: flex; justify-content: space-between; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body { padding: 10mm; -webkit-print-color-adjust: exact !important; }
    .footer { position: fixed; }
  }
  @page { size: A4; margin: 10mm; }
`;

interface DetailData {
  projects?: Array<{ nazov: string; sumaZazmluvnena: number; stav: string }>;
  subsidiary_orgs?: Array<{ name: string; total_contracted_eur: number; projects_count: number }>;
  indirect_projects?: Array<{ name: string; beneficiary_name: string; contracted_eur: number }>;
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank');
  if (!w) { alert('Povoľte vyskakovacie okná pre tlač PDF.'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

export async function generateMunicipalityPdf(ico: string, period: '1420' | '2127') {
  const suffix = period === '1420' ? '14' : '21';
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  let m: Municipality | null = null;
  try {
    const res = await fetch(`/municipal_stats_${suffix}.json`);
    if (res.ok) { const all = await res.json(); m = all[ico] || null; }
  } catch { /* */ }
  if (!m) { alert('Dáta sa nepodarilo načítať.'); return; }

  let detail: DetailData = {};
  try {
    const res = await fetch(`/municipal_details_${suffix}.json`);
    if (res.ok) { const all = await res.json(); detail = all[ico] || {}; }
  } catch { /* */ }

  const allProjects = detail.projects || m.projects || [];
  const allSubs = detail.subsidiary_orgs || m.subsidiary_orgs || [];
  const allIndirect = detail.indirect_projects || m.indirect_projects || [];
  const grandTotal = (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
  const totalProjects = m.active_projects + m.completed_projects;
  const perCapita = m.population > 0 ? Math.round(grandTotal / m.population) : 0;

  let body = `
    <h1>${esc(m.official_name)}</h1>
    <div class="meta">${esc(m.region)}${m.district ? ` · ${esc(m.district)}` : ''} · IČO: ${m.ico}${m.population > 0 ? ` · ${m.population.toLocaleString('sk-SK')} obyvateľov` : ''}</div>
    <div class="period">Obdobie: ${periodLabel}</div>

    <div class="stat-row">
      <div class="stat-box"><div class="stat-val">${fmtEurFull(grandTotal)}</div><div class="stat-label">Celkové zmluvné prostriedky</div>
        ${(m.subsidiary_total_eur || 0) > 0 ? `<div class="stat-sub">${fmtEurFull(m.total_contracted_eur)} priame · ${fmtEurFull(m.subsidiary_total_eur || 0)} zriaďované org.</div>` : ''}
      </div>
      <div class="stat-box"><div class="stat-val blue">${totalProjects}</div><div class="stat-label">${m.active_projects} aktívnych, ${m.completed_projects} ukončených</div></div>
      ${perCapita > 0 ? `<div class="stat-box"><div class="stat-val">${fmtEur(perCapita)}</div><div class="stat-label">Na obyvateľa</div></div>` : ''}
    </div>`;

  if (m.irregularities_count > 0) {
    body += `<div class="irr">Nezrovnalosti: ${m.irregularities_count} · ${fmtEurFull(m.irregularities_total_eur)}</div>`;
  }

  body += '<hr class="divider">';

  if (allProjects.length > 0) {
    body += `<div class="section-title blue">Priame projekty (${allProjects.length})</div>
    <table><thead><tr><th>Názov projektu</th><th class="right">Suma</th><th class="center">Stav</th></tr></thead><tbody>`;
    for (const p of allProjects) {
      const status = (p.stav || '').toLowerCase().includes('ukončen') ? 'Ukončený' : 'V realizácii';
      body += `<tr><td>${esc(p.nazov)}</td><td class="right amount">${fmtEur(p.sumaZazmluvnena)}</td><td class="center">${status}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  if (allSubs.length > 0) {
    body += `<div class="section-title teal">Organizácie v zriaďovateľskej pôsobnosti (${allSubs.length})</div>
    <table><thead><tr><th>Organizácia</th><th class="right">Suma</th><th class="center">Projekty</th></tr></thead><tbody>`;
    for (const o of allSubs) {
      body += `<tr><td>${esc(o.name)}</td><td class="right amount-teal">${fmtEur(o.total_contracted_eur)}</td><td class="center">${o.projects_count}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  if (allIndirect.length > 0) {
    body += `<div class="section-title gray">Štátne projekty v katastri (${allIndirect.length})</div>
    <table><thead><tr><th>Projekt</th><th class="right">Suma</th><th>Realizátor</th></tr></thead><tbody>`;
    for (const p of allIndirect) {
      body += `<tr><td>${esc(p.name)}</td><td class="right amount">${fmtEur(p.contracted_eur)}</td><td>${esc(p.beneficiary_name.split(' ').slice(0, 4).join(' '))}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  body += `<div class="footer"><span>Zdroj: povolbach.sk · Dáta: ${dataSource} · Vygenerované: ${new Date().toLocaleDateString('sk-SK')}</span><span>${esc(m.official_name)}</span></div>`;

  openPrintWindow(`<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"><title>${esc(m.official_name)} — eurofondy</title><style>${CSS}</style></head><body>${body}</body></html>`);
}

export async function generateVucPdf(v: VucStats, period: '1420' | '2127') {
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';
  const grandTotal = v.total_contracted_eur + (v.subsidiary_total_eur || 0);
  const totalProjects = v.projects_active + v.projects_completed;
  const perCapita = v.population > 0 ? Math.round(grandTotal / v.population) : 0;

  let body = `
    <h1>${esc(v.name)}</h1>
    <div class="meta">IČO: ${v.ico}${v.population > 0 ? ` · ${v.population.toLocaleString('sk-SK')} obyvateľov` : ''}</div>
    <div class="period">Obdobie: ${periodLabel}</div>
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val">${fmtEurFull(grandTotal)}</div><div class="stat-label">Celkové zmluvné prostriedky</div>
        ${v.subsidiary_total_eur > 0 ? `<div class="stat-sub">${fmtEurFull(v.total_contracted_eur)} priame · ${fmtEurFull(v.subsidiary_total_eur)} zriaďované org.</div>` : ''}
      </div>
      <div class="stat-box"><div class="stat-val blue">${totalProjects}</div><div class="stat-label">${v.projects_active} aktívnych, ${v.projects_completed} ukončených</div></div>
      ${perCapita > 0 ? `<div class="stat-box"><div class="stat-val">${fmtEur(perCapita)}</div><div class="stat-label">Na obyvateľa</div></div>` : ''}
    </div><hr class="divider">`;

  if (v.projects.length > 0) {
    body += `<div class="section-title blue">Projekty (${v.projects.length})</div><table><thead><tr><th>Názov projektu</th><th class="right">Suma</th><th class="center">Stav</th></tr></thead><tbody>`;
    for (const p of v.projects) {
      const status = (p.stav || '').toLowerCase().includes('ukončen') ? 'Ukončený' : 'V realizácii';
      body += `<tr><td>${esc(p.nazov)}</td><td class="right amount">${fmtEur(p.sumaZazmluvnena)}</td><td class="center">${status}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  if (v.subsidiary_orgs?.length > 0) {
    body += `<div class="section-title teal">Organizácie v zriaďovateľskej pôsobnosti (${v.subsidiary_orgs.length})</div><table><thead><tr><th>Organizácia</th><th class="right">Suma</th><th class="center">Projekty</th></tr></thead><tbody>`;
    for (const o of v.subsidiary_orgs) {
      body += `<tr><td>${esc(o.name)}</td><td class="right amount-teal">${fmtEur(o.total_contracted_eur)}</td><td class="center">${o.projects_count}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  body += `<div class="footer"><span>Zdroj: povolbach.sk · Dáta: ${dataSource} · Vygenerované: ${new Date().toLocaleDateString('sk-SK')}</span><span>${esc(v.name)}</span></div>`;

  openPrintWindow(`<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"><title>${esc(v.name)} — eurofondy</title><style>${CSS}</style></head><body>${body}</body></html>`);
}
