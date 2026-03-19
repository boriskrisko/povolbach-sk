import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get('name');
  const total = searchParams.get('total');
  const projects = searchParams.get('projects');
  const percapita = searchParams.get('percapita');
  const period = searchParams.get('period');
  const region = searchParams.get('region');

  if (!name) {
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

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #131320 40%, #0a0a0f 100%)',
        color: '#f8fafc', padding: '60px 80px', justifyContent: 'space-between',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle at top right, rgba(59,130,246,0.08) 0%, transparent 70%)', display: 'flex' }} />

        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1 }}>
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15, marginBottom: 12 }}>{name}</div>
          {region && <div style={{ fontSize: 22, color: '#94a3b8' }}>{region}</div>}
        </div>

        <div style={{ display: 'flex', gap: 56, alignItems: 'flex-end', zIndex: 1 }}>
          {total && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: '#3b82f6' }}>{total}</div>
              <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>EU fondy celkovo</div>
            </div>
          )}
          {projects && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 52, fontWeight: 700 }}>{projects}</div>
              <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>projektov</div>
            </div>
          )}
          {percapita && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: '#10b981' }}>{percapita}</div>
              <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>na obyvateľa</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 24, backgroundColor: '#3b82f6', borderRadius: 4, display: 'flex' }} />
            <div style={{ fontSize: 26, fontWeight: 700, color: '#f8fafc' }}>povolbach.sk</div>
          </div>
          {period && <div style={{ fontSize: 18, color: '#3b82f6', padding: '6px 16px', border: '2px solid #3b82f6', borderRadius: 8 }}>{period}</div>}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
