import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111827', borderRadius: 36,
      }}>
        <span style={{ fontSize: 110, fontWeight: 700, fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ color: '#ffffff' }}>p</span>
          <span style={{ color: '#3b82f6' }}>v</span>
        </span>
      </div>
    ),
    { ...size },
  );
}
