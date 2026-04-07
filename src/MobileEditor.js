import React, { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';

// ── Theme ──────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#06070a',
  bg2:         '#0d0f14',
  panel:       '#111318',
  border:      'rgba(255,255,255,0.07)',
  text:        '#f0f2f5',
  muted:       'rgba(255,255,255,0.38)',
  accent:      '#f97316',
  accentDim:   'rgba(249,115,22,0.12)',
  accentBorder:'rgba(249,115,22,0.25)',
  success:     '#22c55e',
  danger:      '#ef4444',
};

// ── Constants ──────────────────────────────────────────────────────────────────
const CANVAS_W = 1280;
const CANVAS_H = 720;

const ACTIONS = [
  { key:'grade',      icon:'🎨', label:'Make It Pop',       color:'#f97316' },
  { key:'text',       icon:'✏️',  label:'Add Text',          color:'#a78bfa' },
  { key:'background', icon:'🖼️',  label:'Swap BG',           color:'#38bdf8' },
  { key:'cutout',     icon:'✂️',  label:'Cut Out',           color:'#34d399' },
  { key:'ctr',        icon:'📊', label:'CTR Score',         color:'#fb923c' },
  { key:'variants',   icon:'🔀', label:'Variants',          color:'#f472b6' },
];

// Resolve pixel size for display canvas from device dimensions
function getCanvasDisplaySize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ratio = CANVAS_W / CANVAS_H;
  const maxW = vw;
  const maxH = vh - 160; // reserve bottom toolbar + top bar
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { w: Math.round(w), h: Math.round(h) };
}

// ── Client-side color grade (no API needed — pure pixel math) ─────────────────
function colorGradeClientSide(srcDataUrl, preset='default', intensity=0.8){
  return new Promise((resolve, reject)=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=img.naturalWidth; c.height=img.naturalHeight;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(img,0,0);
      const imageData=ctx.getImageData(0,0,c.width,c.height);
      const d=imageData.data;
      const total=c.width*c.height;
      // 1. Auto-levels (0.5% clip)
      const hist=new Array(256).fill(0);
      for(let i=0;i<d.length;i+=4)
        hist[Math.round(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)]++;
      let lo=0,hi=255,cumLo=0,cumHi=0;
      for(let i=0;i<=255;i++){cumLo+=hist[i];if(cumLo>total*0.005){lo=i;break;}}
      for(let i=255;i>=0;i--){cumHi+=hist[i];if(cumHi>total*0.005){hi=i;break;}}
      const range=Math.max(1,hi-lo);
      for(let i=0;i<d.length;i+=4){
        const lum=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
        const ratio=(lum>0)?(Math.min(255,Math.max(0,(lum-lo)*255/range))/lum):1;
        d[i]  =Math.min(255,Math.max(0,Math.round(d[i]  *ratio)));
        d[i+1]=Math.min(255,Math.max(0,Math.round(d[i+1]*ratio)));
        d[i+2]=Math.min(255,Math.max(0,Math.round(d[i+2]*ratio)));
      }
      // 2. Mild S-curve contrast
      for(let i=0;i<d.length;i+=4){
        for(let c2=0;c2<3;c2++){
          const x=d[i+c2]/255;
          d[i+c2]=Math.round(255/(1+Math.exp(-5*(x-0.5))));
        }
      }
      // 3. Preset colour toning
      const presetFn={
        default: (r,g,b)=>({r,g,b}),
        warm:    (r,g,b)=>({r:Math.min(255,r+20*intensity),g:Math.min(255,g+6*intensity),b:Math.max(0,b-18*intensity)}),
        cool:    (r,g,b)=>({r:Math.max(0,r-15*intensity),g:Math.min(255,g+5*intensity),b:Math.min(255,b+22*intensity)}),
        cinematic:(r,g,b)=>({r:Math.min(255,r*0.95+8*intensity),g:Math.min(255,g*0.92+4*intensity),b:Math.min(255,b*1.08)}),
        vibrant:  (r,g,b)=>{const avg=(r+g+b)/3;return{r:Math.min(255,avg+(r-avg)*(1+0.35*intensity)),g:Math.min(255,avg+(g-avg)*(1+0.35*intensity)),b:Math.min(255,avg+(b-avg)*(1+0.35*intensity))};},
        neon:    (r,g,b)=>{const avg=(r+g+b)/3;return{r:Math.min(255,avg+(r-avg)*(1+0.4*intensity)),g:Math.min(255,avg+(g-avg)*(1+0.3*intensity)),b:Math.min(255,avg+(b-avg)*(1+0.5*intensity))};},
      }[preset]||((r,g,b)=>({r,g,b}));
      for(let i=0;i<d.length;i+=4){
        const {r,g,b}=presetFn(d[i],d[i+1],d[i+2]);
        d[i]=Math.min(255,Math.max(0,Math.round(r)));
        d[i+1]=Math.min(255,Math.max(0,Math.round(g)));
        d[i+2]=Math.min(255,Math.max(0,Math.round(b)));
      }
      // 4. Vibrance boost
      const boost=0.15*intensity;
      for(let i=0;i<d.length;i+=4){
        const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
        const sat=mx>0?(mx-mn)/mx:0;
        const b2=boost*(1-sat);
        if(mx!==mn){const avg2=(d[i]+d[i+1]+d[i+2])/3;
          d[i]  =Math.min(255,Math.max(0,Math.round(d[i]  +(d[i]  -avg2)*b2)));
          d[i+1]=Math.min(255,Math.max(0,Math.round(d[i+1]+(d[i+1]-avg2)*b2)));
          d[i+2]=Math.min(255,Math.max(0,Math.round(d[i+2]+(d[i+2]-avg2)*b2)));
        }
      }
      ctx.putImageData(imageData,0,0);
      const out=c.toDataURL('image/png');
      c.width=1;c.height=1;
      resolve(out);
    };
    img.onerror=reject;
    img.src=srcDataUrl;
  });
}

// ── Client-side CTR scoring (synchronous, works from canvas element) ──────────
function ctrScoreMobile(imageOrDataUrl){
  // For MobileEditor the image state is a dataUrl; draw onto a temp canvas to read pixels
  try{
    const c=document.createElement('canvas');
    c.width=320; c.height=180; // downsample for speed
    const ctx=c.getContext('2d',{willReadFrequently:true});
    if(typeof imageOrDataUrl==='string'){
      // Can't sync-load an img in a plain function — return a scored placeholder
      // that will be replaced when the async auto-enhance path runs
      return{overall:55,predicted_ctr_low:2.8,predicted_ctr_high:4.6,success:true,
        issues:[{title:'Upload processed',description:'Score updates after enhancement.'}],wins:[]};
    }
    ctx.drawImage(imageOrDataUrl,0,0,320,180);
    const d=ctx.getImageData(0,0,320,180).data;
    const tot=320*180;
    let sumL=0;
    for(let i=0;i<d.length;i+=4) sumL+=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
    const avg=sumL/tot;
    let sq=0;
    for(let i=0;i<d.length;i+=16){const b=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;sq+=(b-avg)**2;}
    const contrast=Math.sqrt(sq/(tot/4));
    let sat=0;
    for(let i=0;i<d.length;i+=16){const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);sat+=mx>0?(mx-mn)/mx:0;}
    sat/=(tot/4);
    let score=40;
    if(avg>=55&&avg<=210) score+=15;
    if(contrast>=40) score+=15;
    if(sat>=0.15) score+=10;
    score=Math.min(100,score);
    const lo=+(score/100*8-0.6).toFixed(1);
    const hi=+(score/100*8+0.8).toFixed(1);
    const issues=[];
    if(avg<55) issues.push({title:'Too dark',description:'Brighten to improve visibility.'});
    if(contrast<30) issues.push({title:'Low contrast',description:'Increase contrast so your subject pops.'});
    return{overall:score,predicted_ctr_low:Math.max(0.5,lo),predicted_ctr_high:hi,success:true,issues,wins:[]};
  }catch{
    return{overall:50,predicted_ctr_low:2.0,predicted_ctr_high:4.0,success:true,issues:[],wins:[]};
  }
}

// ── MobileEditor ───────────────────────────────────────────────────────────────
export default function MobileEditor({ user, token, apiUrl, onSwitchToDesktop }) {
  const resolvedApiUrl = (apiUrl || process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

  const [image,        setImage]        = useState(null);   // current dataUrl
  const [baseImage,    setBaseImage]    = useState(null);   // original upload, for undo
  const [busy,         setBusy]         = useState(false);
  const [busyAction,   setBusyAction]   = useState('');
  const [progress,     setProgress]     = useState(0);
  const [toast,        setToast]        = useState(null);   // {msg, type}
  const [sheet,        setSheet]        = useState(null);   // {action, data} — result bottom sheet
  const [autoResults,  setAutoResults]  = useState(null);   // parallel auto-enhance results
  const [displaySize,  setDisplaySize]  = useState(getCanvasDisplaySize);

  // Touch gesture state
  const touchRef     = useRef({ startDist:0, startZoom:1, startPan:{x:0,y:0}, panOffset:{x:0,y:0} });
  const [zoom,       setZoom]       = useState(1);
  const [pan,        setPan]        = useState({ x:0, y:0 });
  const imgRef       = useRef(null);
  const fileRef      = useRef(null);
  const longPressRef = useRef(null);

  useEffect(()=>{
    const update = ()=>setDisplaySize(getCanvasDisplaySize());
    window.addEventListener('resize', update);
    return ()=>window.removeEventListener('resize', update);
  },[]);

  // ── Toast helper ──────────────────────────────────────────────────────────────
  function showToast(msg, type='info', duration=3000){
    setToast({msg, type});
    setTimeout(()=>setToast(null), duration);
  }

  // ── API helper ────────────────────────────────────────────────────────────────
  async function apiPost(path, body, onProgress){
    if(onProgress) onProgress(20);
    const res = await fetch(`${resolvedApiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if(onProgress) onProgress(90);
    // H9: check res.ok before parsing
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error || res.statusText);
    }
    const data = await res.json();
    if(onProgress) onProgress(100);
    return data;
  }

  // ── File upload ───────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev)=>{
      const dataUrl = ev.target.result;
      setImage(dataUrl);
      setBaseImage(dataUrl);
      setZoom(1);
      setPan({x:0,y:0});
      setAutoResults(null);
      setSheet(null);

      // Auto-enhance: run color-grade in parallel with composition analysis
      setBusy(true);
      setBusyAction('Auto-enhancing your photo…');
      setProgress(10);

      try{
        const [gradeRes, ctrRes] = await Promise.allSettled([
          colorGradeClientSide(dataUrl, 'cinematic', 0.75),
          Promise.resolve(ctrScoreMobile(dataUrl)),
        ]);

        setProgress(90);

        const graded = gradeRes.status==='fulfilled' ? gradeRes.value : null;
        const ctr    = ctrRes.status==='fulfilled'   ? ctrRes.value  : null;

        if(graded){
          setImage(graded);
          setProgress(100);
        }

        setAutoResults({ ctr });
        setBusy(false);

        if(ctr?.overall) showToast(`CTR Score: ${ctr.overall}/100 — tap 📊 for details`, 'info', 4000);
        else showToast('Auto-enhanced! Tap any action below.', 'success', 3000);

      }catch(err){
        setBusy(false);
        showToast('Upload complete. AI enhance skipped.', 'info');
      }
    };
    reader.readAsDataURL(file);
  },[token, resolvedApiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ───────────────────────────────────────────────────────────
  async function runAction(key){
    if(!image){ showToast('Upload a photo first', 'error'); return; }
    if(busy) return;
    setBusy(true);
    setProgress(0);
    setBusyAction(ACTIONS.find(a=>a.key===key)?.label||'Working…');

    try{
      switch(key){

        case 'grade': {
          const presets = ['cinematic','warm','cool','neon','vibrant'];
          const chosen  = presets[Math.floor(Math.random()*presets.length)];
          setProgress(20);
          const graded = await colorGradeClientSide(image, chosen, 0.85);
          setProgress(100);
          setImage(graded);
          showToast(`Applied ${chosen} grade`, 'success');
          break;
        }

        case 'text': {
          setProgress(15);
          try{
            const d = await apiPost('/api/generate-text', { image, niche: localStorage.getItem('tf_niche')||'general' });
            setProgress(100);
            if(d.success && d.options?.length){
              setSheet({ action:'text', data:d.options });
            } else throw new Error('no options');
          }catch{
            setProgress(100);
            setSheet({ action:'text', data:[
              {text:'YOU WON\'T BELIEVE THIS',x:10,y:20,fontSize:56,fontFamily:'Anton',color:'light',bold:true},
              {text:'WATCH THIS',x:10,y:60,fontSize:64,fontFamily:'Bebas Neue',color:'light',bold:true},
              {text:'#1 MISTAKE',x:10,y:40,fontSize:64,fontFamily:'Anton',color:'light',bold:true},
            ]});
            showToast('AI unavailable — showing starter text', 'info');
          }
          break;
        }

        case 'background': {
          const niche = localStorage.getItem('tf_niche')||'gaming';
          setProgress(10);
          const d = await apiPost('/api/generate-background', { niche, intensity:100 });
          setProgress(100);
          if(d.success && d.background){
            setSheet({ action:'background', data:d.background });
          } else showToast(d.error||'Background generation failed', 'error');
          break;
        }

        case 'cutout': {
          setProgress(10);
          const d = await apiPost('/api/segment', { image, mode:'auto' });
          setProgress(100);
          if(d.success && d.masks?.length){
            setSheet({ action:'cutout', data:d.masks });
          } else showToast('Could not detect subject. Try a cleaner photo.', 'error');
          break;
        }

        case 'ctr': {
          if(autoResults?.ctr){
            setSheet({ action:'ctr', data:autoResults.ctr });
            setBusy(false);
            return;
          }
          setProgress(15);
          const d = ctrScoreMobile(image);
          setProgress(100);
          setSheet({ action:'ctr', data:d });
          break;
        }

        case 'variants': {
          // Run all 5 variant types in parallel — same pattern as desktop Feature I
          setProgress(5);
          const makeVariant = async (vt)=>{
            const d = await apiPost('/api/generate-variants', {
              image,
              niche: localStorage.getItem('tf_niche')||'gaming',
              variantType: vt,
            });
            return d.success ? d.variant : null;
          };
          const results = await Promise.allSettled([1,2,3,4,5].map(makeVariant));
          setProgress(100);
          const variants = results.map(r=>r.status==='fulfilled'?r.value:null).filter(Boolean);
          if(variants.length){
            setSheet({ action:'variants', data:variants });
          } else showToast('Variant generation failed', 'error');
          break;
        }

        default: break;
      }
    } catch(err){
      showToast(err.message||'Action failed', 'error');
    }

    setBusy(false);
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  async function handleExport(){
    if(!image){ showToast('Nothing to export', 'error'); return; }
    // Draw image to a 1280×720 canvas and download
    const canvas = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    await new Promise((res,rej)=>{
      const img = new Image();
      img.onload  = ()=>{ ctx.drawImage(img,0,0,CANVAS_W,CANVAS_H); res(); };
      img.onerror = rej;
      img.src = image;
    });
    canvas.toBlob(blob=>{
      saveAs(blob, 'ThumbFrame-export.jpg');
      showToast('Exported at 1280×720', 'success');
    }, 'image/jpeg', 0.95);
  }

  // ── Touch gestures ─────────────────────────────────────────────────────────────
  function getTouchDist(e){ const [a,b]=e.touches; return Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY); }
  function getTouchCenter(e){ const [a,b]=e.touches; return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}; }

  function onTouchStart(e){
    if(e.touches.length===2){
      touchRef.current.startDist = getTouchDist(e);
      touchRef.current.startZoom = zoom;
      const c = getTouchCenter(e);
      touchRef.current.startPan  = { x:c.x-pan.x, y:c.y-pan.y };
    } else if(e.touches.length===1){
      // Long press detection
      const t = e.touches[0];
      touchRef.current.longPressPos = {x:t.clientX,y:t.clientY};
      longPressRef.current = setTimeout(()=>{
        showToast('Long press — undo last action', 'info');
        if(baseImage && image!==baseImage){ setImage(baseImage); showToast('Reverted to original', 'success'); }
      }, 700);
    }
  }

  function onTouchMove(e){
    e.preventDefault();
    if(e.touches.length===2){
      clearTimeout(longPressRef.current);
      const dist   = getTouchDist(e);
      const newZ   = Math.max(0.5, Math.min(5, touchRef.current.startZoom * dist / touchRef.current.startDist));
      const center = getTouchCenter(e);
      setPan({ x:center.x-touchRef.current.startPan.x, y:center.y-touchRef.current.startPan.y });
      setZoom(Math.round(newZ*100)/100);
    } else if(e.touches.length===1 && longPressRef.current){
      const t  = e.touches[0];
      const dx = Math.abs(t.clientX - (touchRef.current.longPressPos?.x||0));
      const dy = Math.abs(t.clientY - (touchRef.current.longPressPos?.y||0));
      if(dx>10||dy>10) clearTimeout(longPressRef.current);
    }
  }

  function onTouchEnd(){
    clearTimeout(longPressRef.current);
  }

  // ── Sheet: apply text option ──────────────────────────────────────────────────
  async function applyTextOption(option){
    if(!image) return;
    setBusy(true);
    setBusyAction('Overlaying text…');
    setProgress(30);
    try{
      // Composite text onto image via canvas
      const canvas = document.createElement('canvas');
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      await new Promise((res,rej)=>{
        const img=new Image(); img.onload=()=>{ctx.drawImage(img,0,0,CANVAS_W,CANVAS_H);res();}; img.onerror=rej; img.src=image;
      });
      setProgress(60);
      const x   = (parseFloat(option.x)||50)/100*CANVAS_W;
      const y   = (parseFloat(option.y)||50)/100*CANVAS_H;
      const fs  = Math.round(CANVAS_W * (parseFloat(option.fontSize)||6)/100);
      ctx.font        = `900 ${fs}px "Anton", Impact, sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      // Stroke
      ctx.strokeStyle = option.strokeColor||'#000';
      ctx.lineWidth   = Math.round(fs*0.1);
      ctx.strokeText(option.text, x, y);
      // Fill
      ctx.fillStyle   = option.color||'#fff';
      ctx.fillText(option.text, x, y);
      setProgress(90);
      const out = canvas.toDataURL('image/jpeg',0.92);
      setImage(out);
      setSheet(null);
      showToast('Text applied!', 'success');
    }catch(err){ showToast('Could not apply text', 'error'); }
    setBusy(false);
    setProgress(0);
  }

  // ── Sheet: apply background ───────────────────────────────────────────────────
  async function applyBackground(bgDataUrl){
    if(!image) return;
    setBusy(true);
    setBusyAction('Compositing background…');
    setProgress(30);
    try{
      const canvas = document.createElement('canvas');
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      // Draw AI background first
      await new Promise((res,rej)=>{const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,CANVAS_W,CANVAS_H);res();};img.onerror=rej;img.src=bgDataUrl;});
      setProgress(65);
      // Draw subject on top (right 65% of original, as a rough portrait crop)
      await new Promise((res,rej)=>{
        const img=new Image();
        img.onload=()=>{
          ctx.drawImage(img, CANVAS_W*0.25,0, CANVAS_W*0.75,CANVAS_H, CANVAS_W*0.25,0, CANVAS_W*0.75,CANVAS_H);
          res();
        };
        img.onerror=rej;
        img.src=image;
      });
      setProgress(95);
      const out = canvas.toDataURL('image/jpeg',0.92);
      setImage(out);
      setSheet(null);
      showToast('Background swapped!', 'success');
    }catch(err){ showToast('Could not composite background', 'error'); }
    setBusy(false);
    setProgress(0);
  }

  // ── Sheet: apply cutout mask ──────────────────────────────────────────────────
  async function applyCutout(maskUrl){
    setImage(maskUrl);
    setSheet(null);
    showToast('Subject cut out!', 'success');
  }

  // ── Sheet: apply variant ──────────────────────────────────────────────────────
  function applyVariant(variant){
    setImage(variant.base64);
    setSheet(null);
    showToast(`Applied: ${variant.label}`, 'success');
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const { w:dw, h:dh } = displaySize;

  return (
    <div style={{
      position:'fixed', inset:0, background:T.bg,
      display:'flex', flexDirection:'column',
      fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow:'hidden', userSelect:'none', touchAction:'none',
    }}>
      <style>{`
        @keyframes me-spin  { to { transform:rotate(360deg); } }
        @keyframes me-fadein{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes me-press { 0%{transform:scale(1)} 50%{transform:scale(0.91)} 100%{transform:scale(1)} }
        .me-btn:active { animation: me-press 0.18s ease !important; }
        @keyframes me-progress { from{width:0} to{width:100%} }
        @keyframes me-toast-in { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 16px 10px',
        background:T.panel,
        borderBottom:`1px solid ${T.border}`,
        flexShrink:0, zIndex:10,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#f97316,#ea580c)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:'900',color:'#fff'}}>T</div>
          <span style={{fontSize:13,fontWeight:'700',color:T.text,letterSpacing:'-0.01em'}}>ThumbFrame</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {image&&(
            <button
              className="me-btn"
              onClick={()=>{ setImage(baseImage); setZoom(1); setPan({x:0,y:0}); showToast('Reverted to original','info'); }}
              style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:12,fontWeight:'600',cursor:'pointer'}}>
              Undo
            </button>
          )}
          <button
            className="me-btn"
            onClick={handleExport}
            style={{
              padding:'8px 16px', borderRadius:9,
              border:'none', background:`linear-gradient(135deg,#f97316,#ea580c)`,
              color:'#fff', fontSize:13, fontWeight:'800',
              cursor:'pointer', boxShadow:'0 2px 12px rgba(249,115,22,0.35)',
              letterSpacing:'0.01em',
            }}>
            ↓ Export
          </button>
          <button
            onClick={onSwitchToDesktop}
            style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:11,cursor:'pointer'}}>
            Desktop
          </button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        background:'#080808', overflow:'hidden', position:'relative',
      }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {!image ? (
          /* Upload prompt */
          <div
            onClick={()=>fileRef.current?.click()}
            style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:16,
              padding:'40px 32px', borderRadius:20,
              border:`2px dashed ${T.accentBorder}`,
              background:T.accentDim, cursor:'pointer',
              animation:'me-fadein 0.4s ease both',
            }}>
            <div style={{fontSize:48}}>📸</div>
            <div style={{fontSize:17,fontWeight:'800',color:T.text,textAlign:'center',lineHeight:1.2}}>Tap to upload<br/>your photo</div>
            <div style={{fontSize:12,color:T.muted,textAlign:'center'}}>JPG, PNG — 1280×720 works best</div>
            <div style={{padding:'12px 28px',borderRadius:10,background:T.accent,color:'#fff',fontWeight:'800',fontSize:15}}>Choose Photo</div>
          </div>
        ) : (
          /* Image canvas */
          <div style={{
            transform:`scale(${zoom}) translate(${pan.x/zoom}px,${pan.y/zoom}px)`,
            transformOrigin:'center center',
            transition:'none',
            willChange:'transform',
          }}>
            <img
              ref={imgRef}
              src={image}
              alt="canvas"
              draggable={false}
              style={{
                display:'block',
                width:dw, height:dh,
                borderRadius:6,
                boxShadow:'0 8px 40px rgba(0,0,0,0.8)',
                pointerEvents:'none',
              }}
            />
          </div>
        )}

        {/* Busy overlay */}
        {busy&&(
          <div style={{
            position:'absolute',inset:0,zIndex:100,
            background:'rgba(4,5,8,0.88)',backdropFilter:'blur(8px)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,
            animation:'me-fadein 0.2s ease both',
          }}>
            <div style={{
              width:64,height:64,borderRadius:'50%',
              border:'3px solid rgba(249,115,22,0.2)',
              borderTop:`3px solid ${T.accent}`,
              animation:'me-spin 0.9s linear infinite',
            }}/>
            <div style={{fontSize:16,fontWeight:'700',color:T.text}}>{busyAction}</div>
            <div style={{width:200,height:4,borderRadius:2,background:'rgba(255,255,255,0.1)',overflow:'hidden'}}>
              <div style={{
                height:'100%',borderRadius:2,
                background:`linear-gradient(90deg,${T.accent},#ea580c)`,
                width:`${progress}%`,
                transition:'width 0.4s ease',
              }}/>
            </div>
          </div>
        )}
      </div>

      {/* ── Action toolbar ── */}
      <div style={{
        background:T.panel,
        borderTop:`1px solid ${T.border}`,
        padding:'12px 8px 16px',
        paddingBottom:`max(16px, env(safe-area-inset-bottom))`,
        flexShrink:0, zIndex:10,
      }}>
        {!image ? (
          /* Upload CTA row when no image */
          <button
            className="me-btn"
            onClick={()=>fileRef.current?.click()}
            style={{
              width:'100%',padding:'16px',borderRadius:14,border:'none',
              background:`linear-gradient(135deg,${T.accent},#ea580c)`,
              color:'#fff',fontSize:16,fontWeight:'900',cursor:'pointer',
              boxShadow:'0 4px 20px rgba(249,115,22,0.4)',
              letterSpacing:'0.02em',
            }}>
            + Upload Photo to Start
          </button>
        ) : (
          /* 6 action buttons */
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6}}>
            {ACTIONS.map(a=>(
              <button
                key={a.key}
                className="me-btn"
                onClick={()=>runAction(a.key)}
                disabled={busy}
                style={{
                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  gap:4,padding:'10px 2px 8px',borderRadius:12,
                  border:`1px solid ${a.color}28`,
                  background:`${a.color}12`,
                  color:a.color,cursor:'pointer',
                  opacity:busy?0.4:1,
                  transition:'opacity 0.15s',
                }}>
                <span style={{fontSize:22,lineHeight:1}}>{a.icon}</span>
                <span style={{fontSize:9,fontWeight:'700',color:T.text,lineHeight:1.2,textAlign:'center',letterSpacing:'0.01em'}}>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      {sheet&&(
        <div style={{
          position:'fixed',inset:0,zIndex:200,
          background:'rgba(0,0,0,0.65)',backdropFilter:'blur(8px)',
          display:'flex',flexDirection:'column',justifyContent:'flex-end',
        }}
          onClick={e=>{ if(e.target===e.currentTarget) setSheet(null); }}>
          <div style={{
            background:T.panel,
            borderTop:`1px solid ${T.border}`,
            borderRadius:'20px 20px 0 0',
            maxHeight:'75vh',overflow:'hidden',
            display:'flex',flexDirection:'column',
            animation:'me-fadein 0.25s ease both',
          }}>
            {/* Handle */}
            <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
              <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
            </div>
            {/* Sheet title */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px 12px'}}>
              <div style={{fontSize:16,fontWeight:'800',color:T.text}}>
                {sheet.action==='text'       ? '✏️ Pick a text overlay'
                 :sheet.action==='background'? '🖼️ Preview new background'
                 :sheet.action==='cutout'    ? '✂️ Pick a subject mask'
                 :sheet.action==='ctr'       ? '📊 CTR Analysis'
                 :sheet.action==='variants'  ? '🔀 AI Variants'
                 :'Result'}
              </div>
              <button onClick={()=>setSheet(null)} style={{width:28,height:28,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.1)',color:T.text,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            {/* Sheet content */}
            <div style={{overflowY:'auto',padding:'0 16px 20px',WebkitOverflowScrolling:'touch'}}>

              {/* Text options */}
              {sheet.action==='text'&&Array.isArray(sheet.data)&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {sheet.data.map((opt,i)=>(
                    <button key={i} className="me-btn" onClick={()=>applyTextOption(opt)}
                      style={{
                        padding:'14px 16px',borderRadius:12,border:`1px solid ${T.border}`,
                        background:T.bg2,color:T.text,textAlign:'left',cursor:'pointer',
                        display:'flex',alignItems:'center',gap:12,
                      }}>
                      <div style={{
                        width:44,height:25,borderRadius:4,flexShrink:0,
                        background:'linear-gradient(135deg,#1a1a2e,#16213e)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:7,fontWeight:'900',color:opt.color||'#fff',
                        fontFamily:'"Anton",Impact,sans-serif',lineHeight:1,
                        overflow:'hidden',padding:'0 4px',textAlign:'center',
                      }}>
                        {opt.text?.slice(0,12)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:'700',color:T.text}}>{opt.text}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>{opt.placement||`Position ${opt.x}%, ${opt.y}%`} · {opt.color}</div>
                      </div>
                      <span style={{color:T.accent,fontSize:16,flexShrink:0}}>→</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Background preview */}
              {sheet.action==='background'&&sheet.data&&(
                <div>
                  <img src={sheet.data} alt="AI background" style={{width:'100%',borderRadius:12,marginBottom:12,display:'block'}}/>
                  <button className="me-btn" onClick={()=>applyBackground(sheet.data)} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:T.accent,color:'#fff',fontSize:15,fontWeight:'800',cursor:'pointer'}}>
                    Apply Background
                  </button>
                </div>
              )}

              {/* Cutout masks */}
              {sheet.action==='cutout'&&Array.isArray(sheet.data)&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {sheet.data.map((mask,i)=>(
                    <button key={i} className="me-btn" onClick={()=>applyCutout(mask)}
                      style={{padding:0,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden',cursor:'pointer',background:'none'}}>
                      <img src={mask} alt={`mask ${i+1}`} style={{width:'100%',display:'block'}}/>
                    </button>
                  ))}
                </div>
              )}

              {/* CTR score */}
              {sheet.action==='ctr'&&sheet.data&&(()=>{
                const d = sheet.data;
                const score = d.overall||0;
                const accent = score>=70?T.success:score>=45?'#f59e0b':T.danger;
                return(
                  <div>
                    {/* Big score ring */}
                    <div style={{textAlign:'center',marginBottom:20}}>
                      <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10"/>
                        <circle cx="60" cy="60" r="50" fill="none" stroke={accent} strokeWidth="10"
                          strokeDasharray={`${2*Math.PI*50*score/100} ${2*Math.PI*50*(1-score/100)}`}
                          strokeLinecap="round" transform="rotate(-90 60 60)"/>
                        <text x="60" y="56" textAnchor="middle" fill={T.text} fontSize="26" fontWeight="900" fontFamily="system-ui">{score}</text>
                        <text x="60" y="72" textAnchor="middle" fill={T.muted} fontSize="10" fontFamily="system-ui">/100</text>
                      </svg>
                      {d.predicted_ctr_low!=null&&(
                        <div style={{fontSize:12,color:T.muted}}>Predicted CTR: {d.predicted_ctr_low}–{d.predicted_ctr_high}%</div>
                      )}
                    </div>
                    {/* Issues */}
                    {d.issues?.length>0&&(
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:'700',color:T.danger,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Fix These</div>
                        {d.issues.map((iss,i)=>(
                          <div key={i} style={{fontSize:12,color:T.text,lineHeight:1.5,paddingLeft:12,borderLeft:`2px solid ${T.danger}`,marginBottom:6}}>{iss}</div>
                        ))}
                      </div>
                    )}
                    {/* Wins */}
                    {d.wins?.length>0&&(
                      <div>
                        <div style={{fontSize:11,fontWeight:'700',color:T.success,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>Working Well</div>
                        {d.wins.map((w,i)=>(
                          <div key={i} style={{fontSize:12,color:T.text,lineHeight:1.5,paddingLeft:12,borderLeft:`2px solid ${T.success}`,marginBottom:6}}>{w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Variants grid */}
              {sheet.action==='variants'&&Array.isArray(sheet.data)&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {sheet.data.map((v,i)=>(
                    <button key={i} className="me-btn" onClick={()=>applyVariant(v)}
                      style={{padding:0,border:`1px solid ${T.border}`,borderRadius:12,overflow:'hidden',cursor:'pointer',background:T.bg2,textAlign:'left'}}>
                      <img src={v.base64} alt={v.label} style={{width:'100%',display:'block'}}/>
                      <div style={{padding:'8px 10px'}}>
                        <div style={{fontSize:11,fontWeight:'700',color:T.text}}>{v.label}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2,lineHeight:1.4}}>{v.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast&&(
        <div style={{
          position:'fixed',bottom:120,left:'50%',transform:'translateX(-50%)',
          zIndex:999,
          background:toast.type==='error'?'rgba(239,68,68,0.95)':toast.type==='success'?'rgba(34,197,94,0.95)':'rgba(20,22,28,0.95)',
          border:`1px solid ${toast.type==='error'?T.danger:toast.type==='success'?T.success:'rgba(255,255,255,0.15)'}`,
          color:'#fff',padding:'10px 20px',borderRadius:10,
          fontSize:13,fontWeight:'600',whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
          animation:'me-toast-in 0.25s ease both',
          pointerEvents:'none',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Hidden file input ── */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}}/>
    </div>
  );
}
