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
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #131320 40%, #0a0a0f 100%)',
          color: '#f8fafc', padding: '60px 80px', justifyContent: 'space-between',
        }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 400, height: 400, background: 'radial-gradient(circle at top right, rgba(59,130,246,0.1) 0%, transparent 70%)', display: 'flex' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
            <div style={{ width: 8, height: 32, backgroundColor: '#3b82f6', borderRadius: 4, display: 'flex' }} />
            <span style={{ fontSize: 36, fontWeight: 700 }}>
              <span style={{ color: '#ffffff' }}>po</span>
              <span style={{ color: '#3b82f6' }}>volbach</span>
              <span style={{ color: '#6b7280' }}>.sk</span>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1 }}>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
              Efektívnosť čerpania
            </div>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
              európskych fondov
            </div>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>
              na Slovensku
            </div>
          </div>

          <div style={{ display: 'flex', gap: 32, alignItems: 'center', zIndex: 1 }}>
            <div style={{ fontSize: 22, color: '#94a3b8' }}>2 926 obcí</div>
            <div style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#3b82f6', display: 'flex' }} />
            <div style={{ fontSize: 22, color: '#3b82f6', fontWeight: 600 }}>3.32 mld. €</div>
            <div style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#3b82f6', display: 'flex' }} />
            <div style={{ fontSize: 22, color: '#94a3b8' }}>2014–2027</div>
          </div>
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
            <span style={{ fontSize: 26, fontWeight: 700 }}>
              <span style={{ color: '#ffffff' }}>po</span>
              <span style={{ color: '#3b82f6' }}>volbach</span>
              <span style={{ color: '#6b7280' }}>.sk</span>
            </span>
          </div>
          {period && <div style={{ fontSize: 18, color: '#3b82f6', padding: '6px 16px', border: '2px solid #3b82f6', borderRadius: 8 }}>{period}</div>}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
