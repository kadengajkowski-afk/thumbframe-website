/* eslint-disable no-restricted-globals */
// W3C Compositing & Blending Level 1 – non-separable blend modes
// Porter-Duff alpha compositing

function clamp(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

// Non-separable helpers (operate on 0-1 range)
function lum(r,g,b){ return 0.299*r + 0.587*g + 0.114*b; }
function clipColor(r,g,b){
  const l=lum(r,g,b);
  const n=Math.min(r,g,b);
  const x=Math.max(r,g,b);
  if(n<0){ const s=l/(l-n); r=l+(r-l)*s; g=l+(g-l)*s; b=l+(b-l)*s; }
  if(x>1){ const s=(1-l)/(x-l); r=l+(r-l)*s; g=l+(g-l)*s; b=l+(b-l)*s; }
  return [r,g,b];
}
function setLum(r,g,b,L){
  const d=L-lum(r,g,b);
  return clipColor(r+d,g+d,b+d);
}
function sat(r,g,b){ return Math.max(r,g,b)-Math.min(r,g,b); }
function setSat(r,g,b,S){
  // sort indices by value
  let idx=[0,1,2];
  const vals=[r,g,b];
  idx.sort((a,z)=>vals[a]-vals[z]);
  const [cMin,cMid,cMax]=idx;
  const res=[r,g,b];
  if(vals[cMax]>vals[cMin]){
    res[cMid]=(vals[cMid]-vals[cMin])*S/(vals[cMax]-vals[cMin]);
    res[cMax]=S;
  } else {
    res[cMid]=0;
    res[cMax]=0;
  }
  res[cMin]=0;
  return res;
}

function blendPixel(mode, dR,dG,dB, sR,sG,sB){
  if(mode==='hue'){
    return setLum(...setSat(sR,sG,sB, sat(dR,dG,dB)), lum(dR,dG,dB));
  }
  if(mode==='saturation'){
    return setLum(...setSat(dR,dG,dB, sat(sR,sG,sB)), lum(dR,dG,dB));
  }
  if(mode==='color'){
    return setLum(sR,sG,sB, lum(dR,dG,dB));
  }
  if(mode==='luminosity'){
    return setLum(dR,dG,dB, lum(sR,sG,sB));
  }
  return [dR,dG,dB]; // fallback
}

self.addEventListener('message', e => {
  const { dst, src, mode } = e.data;
  const dstArr = new Uint8ClampedArray(dst);
  const srcArr = new Uint8ClampedArray(src);
  const out = new Uint8ClampedArray(dstArr.length);

  for(let i=0;i<dstArr.length;i+=4){
    const dR=dstArr[i]/255,   dG=dstArr[i+1]/255,  dB=dstArr[i+2]/255,  dA=dstArr[i+3]/255;
    const sR=srcArr[i]/255,   sG=srcArr[i+1]/255,  sB=srcArr[i+2]/255,  sA=srcArr[i+3]/255;

    if(sA===0){
      out[i]=dstArr[i]; out[i+1]=dstArr[i+1]; out[i+2]=dstArr[i+2]; out[i+3]=dstArr[i+3];
      continue;
    }
    if(dA===0){
      out[i]=srcArr[i]; out[i+1]=srcArr[i+1]; out[i+2]=srcArr[i+2]; out[i+3]=srcArr[i+3];
      continue;
    }

    const [bR,bG,bB] = blendPixel(mode, dR,dG,dB, sR,sG,sB);

    // Porter-Duff source-over with blended colour
    const aOut = sA + dA*(1-sA);
    const rOut = (sA*(1-dA)*sR + sA*dA*bR + dA*(1-sA)*dR) / aOut;
    const gOut = (sA*(1-dA)*sG + sA*dA*bG + dA*(1-sA)*dG) / aOut;
    const bOut2= (sA*(1-dA)*sB + sA*dA*bB + dA*(1-sA)*dB) / aOut;

    out[i]   = clamp(rOut)*255;
    out[i+1] = clamp(gOut)*255;
    out[i+2] = clamp(bOut2)*255;
    out[i+3] = clamp(aOut)*255;
  }

  self.postMessage({ out: out.buffer }, [out.buffer]);
});
