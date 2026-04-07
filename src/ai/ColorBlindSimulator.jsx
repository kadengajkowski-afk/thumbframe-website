// src/ai/ColorBlindSimulator.jsx
// Brettel et al. 1997 CVD simulation
import { useState, useEffect, useRef } from 'react';

const CVD_MATRICES = {
  protanopia: {
    transform: (r,g,b) => ({
      r: 0.152286*r + 1.052583*g - 0.204868*b,
      g: 0.114503*r + 0.786281*g + 0.099216*b,
      b:-0.003882*r - 0.048116*g + 1.051998*b,
    }),
    label: 'Protanopia (no red)',
    prevalence: '1.3% of males',
  },
  deuteranopia: {
    transform: (r,g,b) => ({
      r: 0.367322*r + 0.860646*g - 0.227968*b,
      g: 0.280085*r + 0.672501*g + 0.047413*b,
      b:-0.011820*r + 0.042940*g + 0.968881*b,
    }),
    label: 'Deuteranopia (no green)',
    prevalence: '1.2% of males',
  },
  tritanopia: {
    transform: (r,g,b) => ({
      r: 1.255528*r - 0.076749*g - 0.178779*b,
      g:-0.078411*r + 0.930809*g + 0.147602*b,
      b: 0.004733*r + 0.691367*g + 0.303900*b,
    }),
    label: 'Tritanopia (no blue)',
    prevalence: '0.001%',
  },
  greyscale: {
    transform: (r,g,b) => { const l=0.299*r+0.587*g+0.114*b; return {r:l,g:l,b:l}; },
    label: 'Greyscale',
    prevalence: '0.003%',
  },
};

export default function ColorBlindSimulator({ canvasDataUrl, visible }) {
  const [activeType, setActiveType] = useState(null);
  const simCanvasRef = useRef(null);

  useEffect(() => {
    if (!visible || !canvasDataUrl || !activeType || !simCanvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const c = simCanvasRef.current;
      c.width = 300;
      c.height = Math.round(300 * img.height / img.width);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imageData.data;
      const transform = CVD_MATRICES[activeType].transform;
      for (let i = 0; i < d.length; i += 4) {
        const result = transform(d[i], d[i+1], d[i+2]);
        d[i]   = Math.min(255, Math.max(0, Math.round(result.r)));
        d[i+1] = Math.min(255, Math.max(0, Math.round(result.g)));
        d[i+2] = Math.min(255, Math.max(0, Math.round(result.b)));
      }
      ctx.putImageData(imageData, 0, 0);
    };
    img.src = canvasDataUrl;
  }, [canvasDataUrl, activeType, visible]);

  if (!visible) return null;

  return (
    <div style={{ padding:12, background:'#111', borderRadius:8, border:'1px solid #2a2a2a', marginTop:8 }}>
      <span style={{ fontSize:10, fontWeight:700, color:'#666', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:8 }}>
        Color Blind Preview — 8% of male viewers
      </span>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
        {Object.entries(CVD_MATRICES).map(([key, val]) => (
          <button key={key}
            onClick={() => setActiveType(activeType===key ? null : key)}
            style={{
              padding:'4px 8px', borderRadius:4, fontSize:9, cursor:'pointer',
              border:`1px solid ${activeType===key?'#f97316':'#333'}`,
              background: activeType===key?'rgba(249,115,22,0.12)':'#1a1a1a',
              color: activeType===key?'#f97316':'#666',
            }}>
            {val.label.split(' (')[0]}
          </button>
        ))}
      </div>
      {activeType && (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
          <div>
            <img src={canvasDataUrl} alt="Original"
              style={{ width:140, borderRadius:4, border:'1px solid #2a2a2a', display:'block' }} />
            <div style={{ fontSize:8, color:'#555', textAlign:'center', marginTop:2 }}>Original</div>
          </div>
          <div>
            <canvas ref={simCanvasRef}
              style={{ width:140, borderRadius:4, border:'1px solid #2a2a2a', display:'block' }} />
            <div style={{ fontSize:8, color:'#555', textAlign:'center', marginTop:2 }}>
              {CVD_MATRICES[activeType].label}
              <br/>({CVD_MATRICES[activeType].prevalence})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
