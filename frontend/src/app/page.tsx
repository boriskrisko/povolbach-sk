import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import ClientPage from './ClientPage';

function fmtAmount(amount: number): string {
  if (amount === 0) return '0 €';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} mld. €`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mil. €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} tis. €`;
  return `${Math.round(amount)} €`;
}

// Cache JSON data in memory at module level
let muniCache14: Record<string, Record<string, unknown>> | null = null;
let muniCache21: Record<string, Record<string, unknown>> | null = null;
let vucCache14: Record<string, Record<string, unknown>> | null = null;
let vucCache21: Record<string, Record<string, unknown>> | null = null;

function loadJson(filename: string): Record<string, Record<string, unknown>> {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'public', filename), 'utf-8'));
  } catch {
    return {};
  }
}

function getMuniData(period: '14' | '21') {
  if (period === '14') { if (!muniCache14) muniCache14 = loadJson('municipal_stats_14.json'); return muniCache14; }
  if (!muniCache21) muniCache21 = loadJson('municipal_stats_21.json'); return muniCache21;
}

function getVucData(period: '14' | '21') {
  if (period === '14') { if (!vucCache14) vucCache14 = loadJson('vuc_stats_14.json'); return vucCache14; }
  if (!vucCache21) vucCache21 = loadJson('vuc_stats_21.json'); return vucCache21;
}

type Props = {
  searchParams: Promise<{ ico?: string; vuc?: string; obdobie?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const period = params.obdobie === '21' ? '21' : '14';
  const periodLabel = period === '14' ? '2014–2020' : '2021–2027';

  if (params.ico) {
    const data = getMuniData(period);
    const m = data[params.ico] as Record<string, unknown> | undefined;
    if (m) {
      const name = (m.official_name as string) || 'Obec';
      const region = (m.region as string) || '';
      const totalEur = ((m.total_contracted_eur as number) || 0) + ((m.subsidiary_total_eur as number) || 0);
      const projects = ((m.active_projects as number) || 0) + ((m.completed_projects as number) || 0);
      const pop = (m.population as number) || 0;
      const perCapita = pop > 0 ? Math.round(totalEur / pop) : 0;
      const total = fmtAmount(totalEur);

      const ogParams = new URLSearchParams({ name, total, projects: String(projects), region, period: periodLabel });
      if (perCapita > 0) ogParams.set('percapita', `${fmtAmount(perCapita)}`);

      return {
        title: `${name} — povolbach.sk`,
        description: `${total} EU fondov · ${projects} projektov${perCapita > 0 ? ` · ${fmtAmount(perCapita)}/obyv.` : ''} · ${periodLabel}`,
        openGraph: {
          title: `${name} — povolbach.sk`,
          description: `${total} EU fondov · ${projects} projektov${perCapita > 0 ? ` · ${fmtAmount(perCapita)}/obyv.` : ''}`,
          url: `https://povolbach.sk/?ico=${params.ico}&obdobie=${period}`,
          images: [`/api/og?${ogParams.toString()}`],
          type: 'website',
        },
        twitter: { card: 'summary_large_image' },
      };
    }
  }

  if (params.vuc) {
    const data = getVucData(period);
    const v = data[params.vuc] as Record<string, unknown> | undefined;
    if (v) {
      const name = (v.name as string) || 'Kraj';
      const totalEur = ((v.total_contracted_eur as number) || 0) + ((v.subsidiary_total_eur as number) || 0);
      const projects = ((v.projects_active as number) || 0) + ((v.projects_completed as number) || 0);
      const total = fmtAmount(totalEur);

      const ogParams = new URLSearchParams({ name, total, projects: String(projects), period: periodLabel });

      return {
        title: `${name} — povolbach.sk`,
        description: `${total} EU fondov · ${projects} projektov · ${periodLabel}`,
        openGraph: {
          title: `${name} — povolbach.sk`,
          description: `${total} EU fondov · ${projects} projektov`,
          url: `https://povolbach.sk/?vuc=${params.vuc}&obdobie=${period}`,
          images: [`/api/og?${ogParams.toString()}`],
          type: 'website',
        },
        twitter: { card: 'summary_large_image' },
      };
    }
  }

  return {
    title: 'povolbach.sk — Efektívnosť čerpania európskych fondov na Slovensku',
    description: 'Zistite, ako efektívne vaša obec čerpá eurofondy. Dáta z ITMS2014+ a ITMS2021+.',
    openGraph: {
      title: 'povolbach.sk',
      description: 'Efektívnosť čerpania európskych fondov na Slovensku',
      images: ['/api/og'],
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default function Home() {
  return <ClientPage />;
}
