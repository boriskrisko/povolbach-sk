import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VucStats } from './types';

// Colors matching modal theme (light-theme equivalents for print)
const C = {
  navy: [30, 41, 59] as [number, number, number],     // #1e293b — main text
  blue: [59, 130, 246] as [number, number, number],    // #3b82f6 — amounts, headers
  teal: [16, 185, 129] as [number, number, number],    // #10b981 — per capita, subsidiaries
  amber: [245, 158, 11] as [number, number, number],   // #f59e0b — irregularities
  gray: [148, 163, 184] as [number, number, number],   // #94a3b8 — labels
  grayLight: [226, 232, 240] as [number, number, number], // borders
};

function fmtEur(amount: number): string {
  if (amount === 0) return '0 €';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mil. €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} tis. €`;
  return `${Math.round(amount)} €`;
}

function fmtEurFull(amount: number): string {
  return `${amount.toLocaleString('sk-SK', { maximumFractionDigits: 0 })} €`;
}

interface MuniData {
  ico: string;
  official_name: string;
  region: string;
  district: string;
  population: number;
  total_contracted_eur: number;
  subsidiary_total_eur?: number;
  active_projects: number;
  completed_projects: number;
  irregularities_count: number;
  irregularities_total_eur: number;
  projects: Array<{ nazov: string; sumaZazmluvnena: number; stav: string }>;
  subsidiary_orgs?: Array<{ name: string; total_contracted_eur: number; projects_count: number }>;
  indirect_projects?: Array<{ name: string; beneficiary_name: string; contracted_eur: number }>;
}

interface DetailData {
  projects?: Array<{ nazov: string; sumaZazmluvnena: number; stav: string }>;
  subsidiary_orgs?: Array<{ name: string; total_contracted_eur: number; projects_count: number }>;
  indirect_projects?: Array<{ name: string; beneficiary_name: string; contracted_eur: number }>;
}

export async function generateMunicipalityPdf(ico: string, period: '1420' | '2127') {
  const suffix = period === '1420' ? '14' : '21';
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  // Fetch the correct period's stats data
  let m: MuniData | null = null;
  try {
    const res = await fetch(`/municipal_stats_${suffix}.json`);
    if (res.ok) {
      const all = await res.json();
      m = all[ico] || null;
    }
  } catch { /* */ }

  if (!m) {
    alert('Dáta sa nepodarilo načítať.');
    return;
  }

  // Fetch full details (all projects, not just top 5)
  let detail: DetailData = {};
  try {
    const res = await fetch(`/municipal_details_${suffix}.json`);
    if (res.ok) {
      const all = await res.json();
      detail = all[ico] || {};
    }
  } catch { /* */ }

  const allProjects = detail.projects || m.projects || [];
  const allSubs = detail.subsidiary_orgs || m.subsidiary_orgs || [];
  const allIndirect = detail.indirect_projects || m.indirect_projects || [];

  const grandTotal = (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
  const totalProjects = m.active_projects + m.completed_projects;
  const perCapita = m.population > 0 ? Math.round(grandTotal / m.population) : 0;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.navy);
  doc.text(m.official_name, 15, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.text(`${m.region}${m.district ? ` · ${m.district}` : ''} · IČO: ${m.ico}${m.population > 0 ? ` · ${m.population.toLocaleString('sk-SK')} obyvateľov` : ''}`, 15, y);
  y += 5;

  // Period badge
  doc.setTextColor(...C.blue);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Obdobie: ${periodLabel}`, 15, y);
  y += 10;

  // Summary stats — teal for amounts
  doc.setTextColor(...C.teal);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtEurFull(grandTotal), 15, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Celkové zmluvné prostriedky', 15, y);
  y += 6;

  if ((m.subsidiary_total_eur || 0) > 0) {
    doc.setTextColor(...C.navy);
    doc.text(`Priame: ${fmtEurFull(m.total_contracted_eur)}  ·  Zriaďované org.: ${fmtEurFull(m.subsidiary_total_eur || 0)}`, 15, y);
    y += 5;
  }

  doc.setTextColor(...C.navy);
  doc.text(`Projekty: ${totalProjects} (${m.active_projects} aktívnych, ${m.completed_projects} ukončených)`, 15, y);
  y += 5;

  if (perCapita > 0) {
    doc.setTextColor(...C.teal);
    doc.text(`Na obyvateľa: ${fmtEur(perCapita)}`, 15, y);
    y += 5;
  }

  // Irregularities — amber
  if (m.irregularities_count > 0) {
    y += 2;
    doc.setTextColor(...C.amber);
    doc.setFont('helvetica', 'bold');
    doc.text(`Nezrovnalosti: ${m.irregularities_count} · ${fmtEurFull(m.irregularities_total_eur)}`, 15, y);
    y += 5;
  }

  // Divider
  y += 3;
  doc.setDrawColor(...C.grayLight);
  doc.line(15, y, pageW - 15, y);
  y += 6;

  // Projects table — blue header
  if (allProjects.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.blue);
    doc.text(`Priame projekty (${allProjects.length})`, 15, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Názov projektu', 'Suma', 'Stav']],
      body: allProjects.map(p => [
        p.nazov,
        fmtEur(p.sumaZazmluvnena),
        p.stav.includes('ukončen') || p.stav.includes('Ukončen') ? 'Ukončený' : 'V realizácii',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C.navy },
      headStyles: { fillColor: C.blue, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: pageW - 30 - 28 - 22 },
        1: { cellWidth: 28, halign: 'right', textColor: C.blue },
        2: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Subsidiary orgs — teal header
  if (allSubs.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.teal);
    doc.text(`Organizácie v zriaďovateľskej pôsobnosti (${allSubs.length})`, 15, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Organizácia', 'Suma', 'Projekty']],
      body: allSubs.map(o => [o.name, fmtEur(o.total_contracted_eur), String(o.projects_count)]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C.navy },
      headStyles: { fillColor: C.teal, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: pageW - 30 - 28 - 20 },
        1: { cellWidth: 28, halign: 'right', textColor: C.teal },
        2: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Indirect projects — gray header
  if (allIndirect.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.gray);
    doc.text(`Štátne projekty v katastri (${allIndirect.length})`, 15, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Projekt', 'Suma', 'Realizátor']],
      body: allIndirect.map(p => [p.name, fmtEur(p.contracted_eur), p.beneficiary_name.split(' ').slice(0, 4).join(' ')]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C.navy },
      headStyles: { fillColor: C.gray, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: pageW - 30 - 28 - 40 },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 40 },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Footer on each page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.setFont('helvetica', 'normal');
    doc.text(`Zdroj: povolbach.sk · Dáta: ${dataSource} · Vygenerované: ${new Date().toLocaleDateString('sk-SK')}`, 15, footerY);
    doc.text(`${i} / ${pages}`, pageW - 15, footerY, { align: 'right' });
  }

  const safeName = m.official_name.replace(/[^a-zA-Z0-9áäčďéíľĺňóôŕšťúýžÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_eurofondy.pdf`);
}

export async function generateVucPdf(v: VucStats, period: '1420' | '2127') {
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  const grandTotal = v.total_contracted_eur + (v.subsidiary_total_eur || 0);
  const totalProjects = v.projects_active + v.projects_completed;
  const perCapita = v.population > 0 ? Math.round(grandTotal / v.population) : 0;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.navy);
  doc.text(v.name, 15, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.text(`IČO: ${v.ico}${v.population > 0 ? ` · ${v.population.toLocaleString('sk-SK')} obyvateľov` : ''}`, 15, y);
  y += 5;
  doc.setTextColor(...C.blue);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Obdobie: ${periodLabel}`, 15, y);
  y += 10;

  doc.setTextColor(...C.teal);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtEurFull(grandTotal), 15, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Celkové zmluvné prostriedky', 15, y);
  y += 6;

  if (v.subsidiary_total_eur > 0) {
    doc.setTextColor(...C.navy);
    doc.text(`Priame: ${fmtEurFull(v.total_contracted_eur)}  ·  Zriaďované org.: ${fmtEurFull(v.subsidiary_total_eur)}`, 15, y);
    y += 5;
  }
  doc.setTextColor(...C.navy);
  doc.text(`Projekty: ${totalProjects} (${v.projects_active} aktívnych, ${v.projects_completed} ukončených)${perCapita > 0 ? `  ·  Na obyvateľa: ${fmtEur(perCapita)}` : ''}`, 15, y);
  y += 3;
  doc.setDrawColor(...C.grayLight);
  doc.line(15, y + 3, pageW - 15, y + 3);
  y += 9;

  if (v.projects.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.blue);
    doc.text(`Projekty (${v.projects.length})`, 15, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Názov projektu', 'Suma', 'Stav']],
      body: v.projects.map(p => [p.nazov, fmtEur(p.sumaZazmluvnena), p.stav.includes('ukončen') || p.stav.includes('Ukončen') ? 'Ukončený' : 'V realizácii']),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C.navy },
      headStyles: { fillColor: C.blue, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: pageW - 30 - 28 - 22 }, 1: { cellWidth: 28, halign: 'right', textColor: C.blue }, 2: { cellWidth: 22, halign: 'center' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (v.subsidiary_orgs?.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.teal);
    doc.text(`Organizácie v zriaďovateľskej pôsobnosti (${v.subsidiary_orgs.length})`, 15, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Organizácia', 'Suma', 'Projekty']],
      body: v.subsidiary_orgs.map(o => [o.name, fmtEur(o.total_contracted_eur), String(o.projects_count)]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C.navy },
      headStyles: { fillColor: C.teal, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: pageW - 30 - 28 - 20 }, 1: { cellWidth: 28, halign: 'right', textColor: C.teal }, 2: { cellWidth: 20, halign: 'center' } },
      margin: { left: 15, right: 15 },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const fy = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.setFont('helvetica', 'normal');
    doc.text(`Zdroj: povolbach.sk · Dáta: ${dataSource} · Vygenerované: ${new Date().toLocaleDateString('sk-SK')}`, 15, fy);
    doc.text(`${i} / ${pages}`, pageW - 15, fy, { align: 'right' });
  }

  const safeName = v.name.replace(/[^a-zA-Z0-9áäčďéíľĺňóôŕšťúýžÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_eurofondy.pdf`);
}
