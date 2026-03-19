import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

interface DetailData {
  projects?: Array<{ nazov: string; sumaZazmluvnena: number; stav: string; datumKoncaRealizacie?: string }>;
  subsidiary_orgs?: Array<{ name: string; total_contracted_eur: number; projects_count: number }>;
  indirect_projects?: Array<{ name: string; beneficiary_name: string; contracted_eur: number; status: string }>;
}

export async function generateMunicipalityPdf(m: Municipality, period: '1420' | '2127') {
  const suffix = period === '1420' ? '14' : '21';
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  // Fetch full details on-demand
  let detail: DetailData = {};
  try {
    const res = await fetch(`/municipal_details_${suffix}.json`);
    if (res.ok) {
      const all = await res.json();
      detail = all[m.ico] || {};
    }
  } catch { /* use empty detail */ }

  const allProjects = detail.projects || m.projects || [];
  const allSubs = detail.subsidiary_orgs || m.subsidiary_orgs || [];
  const allIndirect = detail.indirect_projects || m.indirect_projects || [];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(m.official_name, 15, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${m.region}${m.district ? ` · ${m.district}` : ''} · IČO: ${m.ico}${m.population > 0 ? ` · ${m.population.toLocaleString('sk-SK')} obyvateľov` : ''}`, 15, y);
  y += 5;
  doc.text(`Obdobie: ${periodLabel}`, 15, y);
  y += 10;

  // Summary stats
  doc.setTextColor(0);
  const grandTotal = (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
  const totalProjects = m.active_projects + m.completed_projects;
  const perCapita = m.population > 0 ? Math.round(grandTotal / m.population) : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Celkové zmluvné prostriedky: ${fmtEurFull(grandTotal)}`, 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  if ((m.subsidiary_total_eur || 0) > 0) {
    doc.text(`  Priame: ${fmtEurFull(m.total_contracted_eur)}  ·  Zriaďované org.: ${fmtEurFull(m.subsidiary_total_eur || 0)}`, 15, y);
    y += 6;
  }
  doc.text(`Projekty: ${totalProjects} (${m.active_projects} aktívnych, ${m.completed_projects} ukončených)${perCapita > 0 ? `  ·  Na obyvateľa: ${fmtEur(perCapita)}` : ''}`, 15, y);
  y += 4;

  // Irregularities
  if (m.irregularities_count > 0) {
    y += 4;
    doc.setTextColor(200, 120, 0);
    doc.text(`Nezrovnalosti: ${m.irregularities_count} · ${fmtEurFull(m.irregularities_total_eur)}`, 15, y);
    doc.setTextColor(0);
    y += 4;
  }

  y += 6;

  // Projects table
  if (allProjects.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
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
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: pageW - 30 - 30 - 22 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Subsidiary orgs
  if (allSubs.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Organizácie v zriaďovateľskej pôsobnosti (${allSubs.length})`, 15, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Organizácia', 'Suma', 'Projekty']],
      body: allSubs.map(o => [o.name, fmtEur(o.total_contracted_eur), String(o.projects_count)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: pageW - 30 - 30 - 20 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Indirect projects
  if (allIndirect.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Štátne projekty v katastri (${allIndirect.length})`, 15, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Projekt', 'Suma', 'Realizátor']],
      body: allIndirect.map(p => [p.name, fmtEur(p.contracted_eur), p.beneficiary_name.split(' ').slice(0, 4).join(' ')]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [148, 163, 184], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: pageW - 30 - 30 - 40 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 40 },
      },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Zdroj: povolbach.sk · Dáta: ${dataSource} · Vygenerované: ${new Date().toLocaleDateString('sk-SK')}`, 15, footerY);

  const safeName = m.official_name.replace(/[^a-zA-Z0-9áäčďéíľĺňóôŕšťúýžÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_eurofondy.pdf`);
}

export async function generateVucPdf(v: VucStats, period: '1420' | '2127') {
  const periodLabel = period === '1420' ? '2014–2020' : '2021–2027';
  const dataSource = period === '1420' ? 'ITMS2014+' : 'ITMS2021+';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(v.name, 15, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`IČO: ${v.ico}${v.population > 0 ? ` · ${v.population.toLocaleString('sk-SK')} obyvateľov` : ''} · Obdobie: ${periodLabel}`, 15, y);
  y += 10;

  doc.setTextColor(0);
  const grandTotal = v.total_contracted_eur + (v.subsidiary_total_eur || 0);
  const totalProjects = v.projects_active + v.projects_completed;
  const perCapita = v.population > 0 ? Math.round(grandTotal / v.population) : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Celkové zmluvné prostriedky: ${fmtEurFull(grandTotal)}`, 15, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  if (v.subsidiary_total_eur > 0) {
    doc.text(`  Priame: ${fmtEurFull(v.total_contracted_eur)}  ·  Zriaďované org.: ${fmtEurFull(v.subsidiary_total_eur)}`, 15, y);
    y += 6;
  }
  doc.text(`Projekty: ${totalProjects} (${v.projects_active} aktívnych, ${v.projects_completed} ukončených)${perCapita > 0 ? `  ·  Na obyvateľa: ${fmtEur(perCapita)}` : ''}`, 15, y);
  y += 10;

  if (v.projects.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Projekty (${v.projects.length})`, 15, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Názov projektu', 'Suma', 'Stav']],
      body: v.projects.map(p => [p.nazov, fmtEur(p.sumaZazmluvnena), p.stav.includes('ukončen') || p.stav.includes('Ukončen') ? 'Ukončený' : 'V realizácii']),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
      columnStyles: { 0: { cellWidth: pageW - 30 - 30 - 22 }, 1: { cellWidth: 30, halign: 'right' }, 2: { cellWidth: 22, halign: 'center' } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (v.subsidiary_orgs?.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.text(`Organizácie v zriaďovateľskej pôsobnosti (${v.subsidiary_orgs.length})`, 15, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Organizácia', 'Suma', 'Projekty']],
      body: v.subsidiary_orgs.map(o => [o.name, fmtEur(o.total_contracted_eur), String(o.projects_count)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8 },
      columnStyles: { 0: { cellWidth: pageW - 30 - 30 - 20 }, 1: { cellWidth: 30, halign: 'right' }, 2: { cellWidth: 20, halign: 'center' } },
      margin: { left: 15, right: 15 },
    });
  }

  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Zdroj: povolbach.sk · Dáta: ${dataSource} · Vygenerované: ${new Date().toLocaleDateString('sk-SK')}`, 15, footerY);

  const safeName = v.name.replace(/[^a-zA-Z0-9áäčďéíľĺňóôŕšťúýžÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_eurofondy.pdf`);
}
