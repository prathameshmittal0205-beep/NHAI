import { ImageResponse } from 'next/og';
 
export const runtime = 'edge';
export const alt = 'NHAI Datalake 3.0';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
 
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 80,
          color: 'white',
          background: '#020617', // Navy / Slate-950
          width: '100%',
          height: '100%',
          padding: '50px 200px',
          textAlign: 'center',
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          fontWeight: 'bold',
        }}
      >
        <div style={{ marginBottom: 20 }}>NHAI Datalake 3.0</div>
        <div style={{ fontSize: 40, color: '#94a3b8', fontWeight: 'normal' }}>
          Offline Facial Recognition System
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
