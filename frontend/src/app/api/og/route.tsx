import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

interface MunicipalityData {
  ico: string;
  official_name: string;
  region: string;
  population: number;
  total_contracted_eur: number;
  subsidiary_total_eur?: number;
  active_projects: number;
  completed_projects: number;
}

function formatAmount(amount: number): string {
  if (amount === 0) return '0 €';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} mld. €`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mil. €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} tis. €`;
  return `${Math.round(amount)} €`;
}

// Cache parsed JSON in memory across warm invocations
let cache14: Record<string, MunicipalityData> | null = null;
let cache21: Record<string, MunicipalityData> | null = null;

function loadData(period: '14' | '21'): Record<string, MunicipalityData> {
  if (period === '14' && cache14) return cache14;
  if (period === '21' && cache21) return cache21;

  // Try multiple paths — Vercel copies public files to different locations
  const paths = [
    join(process.cwd(), 'public', `municipal_stats_${period}.json`),
    join(process.cwd(), `municipal_stats_${period}.json`),
    join(process.cwd(), '.next', 'static', `municipal_stats_${period}.json`),
  ];

  for (const p of paths) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      if (period === '14') cache14 = data;
      else cache21 = data;
      return data;
    } catch {
      continue;
    }
  }

  return {};
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ico = searchParams.get('ico');
  const obdobie = searchParams.get('obdobie');

  if (!ico) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0f 0%, #13131a 50%, #0a0a0f 100%)', color: '#f8fafc' }}>
          <div style={{ fontSize: 72, fontWeight: 700, marginBottom: 20 }}>povolbach.sk</div>
          <div style={{ fontSize: 28, color: '#94a3b8', textAlign: 'center', maxWidth: '80%' }}>Efektívnosť čerpania európskych fondov na Slovensku</div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const period = obdobie === '21' ? '21' : '14';
  const periodLabel = period === '14' ? '2014–2020' : '2021–2027';

  let data: Record<string, MunicipalityData>;
  try {
    data = loadData(period);
  } catch {
    data = {};
  }

  // If filesystem read failed, try fetch as fallback
  if (!data[ico]) {
    try {
      const baseUrl = request.nextUrl.origin;
      const res = await fetch(`${baseUrl}/municipal_stats_${period}.json`, { next: { revalidate: 3600 } });
      if (res.ok) {
        data = await res.json();
        if (period === '14') cache14 = data;
        else cache21 = data;
      }
    } catch { /* give up */ }
  }

  const m = data[ico];
  if (!m) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0f 0%, #13131a 50%, #0a0a0f 100%)', color: '#f8fafc' }}>
          <div style={{ fontSize: 48, fontWeight: 700 }}>povolbach.sk</div>
          <div style={{ fontSize: 24, color: '#94a3b8', marginTop: 12 }}>Obec nenájdená</div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const grandTotal = (m.total_contracted_eur || 0) + (m.subsidiary_total_eur || 0);
  const totalProjects = m.active_projects + m.completed_projects;
  const perCapita = m.population > 0 ? Math.round(grandTotal / m.population) : 0;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #131320 40%, #0a0a0f 100%)',
        color: '#f8fafc', padding: '60px 80px', justifyContent: 'space-between',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle at top right, rgba(59,130,246,0.08) 0%, transparent 70%)', display: 'flex' }} />

        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1 }}>
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15, marginBottom: 12 }}>{m.official_name}</div>
          <div style={{ fontSize: 22, color: '#94a3b8' }}>{m.region} · IČO {m.ico}{m.population > 0 ? ` · ${m.population.toLocaleString('sk-SK')} obyvateľov` : ''}</div>
        </div>

        <div style={{ display: 'flex', gap: 56, alignItems: 'flex-end', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: '#3b82f6' }}>{formatAmount(grandTotal)}</div>
            <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>EU fondy celkovo</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 700 }}>{totalProjects}</div>
            <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>projektov</div>
          </div>
          {perCapita > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: '#10b981' }}>{formatAmount(perCapita)}</div>
              <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>na obyvateľa</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 24, backgroundColor: '#3b82f6', borderRadius: 4, display: 'flex' }} />
            <div style={{ fontSize: 26, fontWeight: 700, color: '#f8fafc' }}>povolbach.sk</div>
          </div>
          <div style={{ fontSize: 18, color: '#3b82f6', padding: '6px 16px', border: '2px solid #3b82f6', borderRadius: 8 }}>{periodLabel}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
