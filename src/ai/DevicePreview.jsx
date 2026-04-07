// src/ai/DevicePreview.jsx
import { useState } from 'react';

const PREVIEW_SIZES = [
  { label: 'Desktop Home',     width: 360, height: 202 },
  { label: 'Mobile Home',      width: 168, height: 94  },
  { label: 'Search Results',   width: 246, height: 138 },
  { label: 'Suggested',        width: 168, height: 94  },
  { label: 'TV',               width: 480, height: 270 },
  { label: 'Mobile (smallest)',width: 116, height: 65  },
];

export default function DevicePreview({ canvasDataUrl, visible }) {
  const [darkMode, setDarkMode] = useState(true);
  if (!visible || !canvasDataUrl) return null;

  return (
    <div style={{ padding:12, background:'#111', borderRadius:8, border:'1px solid #2a2a2a' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#666', textTransform:'uppercase', letterSpacing:1 }}>
          Device Preview
        </span>
        <button onClick={() => setDarkMode(d => !d)} style={{
          background:'none', border:'1px solid #333', borderRadius:4, color:'#666',
          fontSize:10, padding:'3px 8px', cursor:'pointer',
        }}>
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {PREVIEW_SIZES.map(size => (
          <div key={size.label} style={{ textAlign:'center' }}>
            <div style={{
              width: size.width * 0.5,
              height: size.height * 0.5,
              background: darkMode ? '#0f0f0f' : '#f9f9f9',
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid #2a2a2a',
            }}>
              <img src={canvasDataUrl} alt={size.label}
                style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
            <div style={{ fontSize:8, color:'#555', marginTop:3, lineHeight:1.4 }}>
              {size.label}<br />{size.width}×{size.height}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
