import { ImageResponse } from 'next/og';
export const runtime = 'edge';

// G4: EdProSys OG image — 1200×630 for social sharing
// Referenced in app/layout.tsx as /api/og
export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        padding: '60px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 80, fontWeight: 900, color: '#ffffff', letterSpacing: '-2px' }}>EdProSys</div>
        <div style={{ fontSize: 34, color: '#F97316', fontWeight: 500 }}>Powering Institutions. Empowering Futures.</div>
        <div style={{ fontSize: 26, color: '#6366F1', marginTop: 8 }}>edprosys.com</div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
