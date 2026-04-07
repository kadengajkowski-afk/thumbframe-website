// src/ai/ThumbnailAnalyzer.js
// Core analysis engine — pixel analysis + lazy-loaded ML models.
// Falls back gracefully to pixel-only if TF.js/models fail to load.

let blazefaceModel = null;
let cocoModel = null;
let modelsLoading = false;
let modelsLoadPromise = null;

async function ensureModels() {
  if (blazefaceModel && cocoModel) return;
  if (modelsLoadPromise) { await modelsLoadPromise; return; }

  modelsLoadPromise = (async () => {
    modelsLoading = true;
    try {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const [blazeface, cocoSsd] = await Promise.all([
        import('@tensorflow-models/blazeface'),
        import('@tensorflow-models/coco-ssd'),
      ]);
      [blazefaceModel, cocoModel] = await Promise.all([
        blazeface.load(),
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
      ]);
    } catch (err) {
      console.warn('[ThumbnailAnalyzer] ML models failed to load — pixel-only mode:', err.message);
    } finally {
      modelsLoading = false;
    }
  })();

  await modelsLoadPromise;
}

// ═══════════════════════════════════════════════════════
// MASTER ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════
export async function analyzeImage(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Pixel analyses — synchronous, no models needed
  const brightnessAnalysis  = analyzeBrightness(data, width, height);
  const saturationAnalysis  = analyzeSaturation(data, width, height);
  const colorAnalysis       = analyzeColors(data, width, height);
  const contrastAnalysis    = analyzeContrast(data, width, height);
  const textAnalysis        = analyzeTextPresence(data, width, height);
  const compositionAnalysis = analyzeComposition(data, width, height);
  const edgeAnalysis        = analyzeEdgeDensity(data, width, height);
  const safeZoneAnalysis    = analyzeSafeZones(data, width, height);
  const dimensionAnalysis   = analyzeDimensions(width, height);

  // ML analyses — lazy load, graceful fallback
  let faceAnalysis   = { faces: [], hasFaces: false, faceCount: 0, largestFaceRatio: 0 };
  let objectAnalysis = { objects: [], categories: [], hasPerson: false };

  try {
    await ensureModels();
    if (blazefaceModel && cocoModel) {
      // Run inference on a 512px-wide copy for speed
      const inferCanvas = document.createElement('canvas');
      inferCanvas.width = 512;
      inferCanvas.height = Math.round(512 * height / width);
      const inferCtx = inferCanvas.getContext('2d');
      inferCtx.drawImage(canvas, 0, 0, inferCanvas.width, inferCanvas.height);
      const scaleX = width / inferCanvas.width;
      const scaleY = height / inferCanvas.height;

      const [faces, objects] = await Promise.all([
        blazefaceModel.estimateFaces(inferCanvas, false),
        cocoModel.detect(inferCanvas),
      ]);

      faceAnalysis = {
        faces: faces.map(f => ({
          x: f.topLeft[0] * scaleX,
          y: f.topLeft[1] * scaleY,
          width:  (f.bottomRight[0] - f.topLeft[0]) * scaleX,
          height: (f.bottomRight[1] - f.topLeft[1]) * scaleY,
          confidence: f.probability[0],
          areaRatio: ((f.bottomRight[0] - f.topLeft[0]) * scaleX *
                      (f.bottomRight[1] - f.topLeft[1]) * scaleY) / (width * height),
        })),
        hasFaces: faces.length > 0,
        faceCount: faces.length,
        largestFaceRatio: faces.length > 0
          ? Math.max(...faces.map(f =>
              ((f.bottomRight[0] - f.topLeft[0]) * scaleX *
               (f.bottomRight[1] - f.topLeft[1]) * scaleY) / (width * height)))
          : 0,
      };

      objectAnalysis = {
        objects: objects.map(o => ({
          class: o.class,
          score: o.score,
          bbox: {
            x: o.bbox[0] * scaleX, y: o.bbox[1] * scaleY,
            width: o.bbox[2] * scaleX, height: o.bbox[3] * scaleY,
          },
        })),
        categories: [...new Set(objects.map(o => o.class))],
        hasPerson: objects.some(o => o.class === 'person' && o.score > 0.5),
      };
    }
  } catch (err) {
    console.warn('[ThumbnailAnalyzer] ML inference failed:', err.message);
  }

  const nicheAnalysis = detectNiche(objectAnalysis, colorAnalysis, edgeAnalysis, faceAnalysis);

  const ctrScore = calculateCTRScore({
    brightnessAnalysis, saturationAnalysis, colorAnalysis, contrastAnalysis,
    textAnalysis, compositionAnalysis, edgeAnalysis, safeZoneAnalysis,
    dimensionAnalysis, faceAnalysis, objectAnalysis, nicheAnalysis,
  });

  const recommendations = generateRecommendations({
    brightnessAnalysis, saturationAnalysis, colorAnalysis, contrastAnalysis,
    textAnalysis, compositionAnalysis, edgeAnalysis, safeZoneAnalysis,
    dimensionAnalysis, faceAnalysis, objectAnalysis, nicheAnalysis, ctrScore,
  });

  return {
    ctrScore,
    recommendations,
    details: {
      brightnessAnalysis, saturationAnalysis, colorAnalysis, contrastAnalysis,
      textAnalysis, compositionAnalysis, edgeAnalysis, safeZoneAnalysis,
      dimensionAnalysis, faceAnalysis, objectAnalysis, nicheAnalysis,
    },
  };
}

// ═══════════════════════════════════════════════════════
// PIXEL ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════

function analyzeBrightness(data, width, height) {
  const totalPixels = width * height;
  let totalBrightness = 0;
  const histogram = new Array(256).fill(0);
  const halfW = width / 2, halfH = height / 2;
  const quadrants = [0, 0, 0, 0];
  const quadCounts = [0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const b = Math.round(data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      totalBrightness += b;
      histogram[b]++;
      const q = (y < halfH ? 0 : 2) + (x < halfW ? 0 : 1);
      quadrants[q] += b;
      quadCounts[q]++;
    }
  }

  const avg = totalBrightness / totalPixels;
  let sumSqDiff = 0;
  for (let i = 0; i < data.length; i += 4) {
    const b = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
    sumSqDiff += (b - avg) ** 2;
  }
  const stdDev = Math.sqrt(sumSqDiff / totalPixels);

  let cumulative = 0, p1 = 0, p99 = 255;
  for (let i = 0; i <= 255; i++) {
    cumulative += histogram[i];
    if (cumulative / totalPixels >= 0.005 && p1 === 0) p1 = i;
    if (cumulative / totalPixels >= 0.995) { p99 = i; break; }
  }

  return {
    average: avg, stdDev, histogram,
    percentile1: p1, percentile99: p99,
    dynamicRange: p99 - p1,
    quadrants: quadrants.map((q, i) => q / (quadCounts[i] || 1)),
    isDark: avg < 60,
    isBright: avg > 200,
    isFlat: stdDev < 35,
    isMobileReadable: avg >= 50 && avg <= 210,
  };
}

function analyzeSaturation(data, width, height) {
  const totalPixels = width * height;
  let totalSat = 0, undersaturated = 0, oversaturated = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const sat = max > 0 ? (max-min)/max : 0;
    totalSat += sat;
    if (sat < 0.1) undersaturated++;
    if (sat > 0.8) oversaturated++;
  }
  const avg = totalSat / totalPixels;
  return {
    average: avg,
    undersaturatedRatio: undersaturated / totalPixels,
    oversaturatedRatio: oversaturated / totalPixels,
    isMuted: avg < 0.2,
    isVibrant: avg > 0.5,
    isOversaturated: avg > 0.7,
  };
}

function analyzeColors(data, width, height) {
  const step = Math.max(1, Math.floor(data.length / (4 * 10000)));
  const colorBuckets = {};
  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    totalR += r; totalG += g; totalB += b; count++;
    const key = `${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
    colorBuckets[key] = (colorBuckets[key] || 0) + 1;
  }
  const dominantColors = Object.entries(colorBuckets)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([key, freq]) => {
      const [r,g,b] = key.split(',').map(Number);
      return { rgb:{r,g,b}, hex:'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''), frequency: freq/count, hsl: rgbToHsl(r,g,b) };
    });
  const hues = dominantColors.slice(0,4).map(c => c.hsl.h);
  let harmonyType = 'none';
  if (hues.length >= 2) {
    const diff = Math.abs(hues[0] - hues[1]);
    if (diff > 150 && diff < 210) harmonyType = 'complementary';
    else if (diff > 100 && diff < 140) harmonyType = 'triadic';
    else if (diff < 40) harmonyType = 'analogous';
    else harmonyType = 'mixed';
  }
  const avgHue = hues.length ? hues.reduce((a,b)=>a+b,0)/hues.length : 0;
  const avgR = totalR/count, avgG = totalG/count, avgB = totalB/count;
  const maxAvg = Math.max(avgR,avgG,avgB), minAvg = Math.min(avgR,avgG,avgB);
  const colorCast = maxAvg - minAvg > 30
    ? (avgR>avgG&&avgR>avgB?'red':avgG>avgR&&avgG>avgB?'green':'blue') : 'none';
  return {
    dominantColors, harmonyType,
    isWarm: avgHue < 60 || avgHue > 300,
    isCool: avgHue > 180 && avgHue < 300,
    colorCast,
    avgColor: { r: avgR, g: avgG, b: avgB },
    palette: dominantColors.slice(0,5).map(c => c.hex),
  };
}

function analyzeContrast(data, width, height) {
  const centerPixels = [], edgePixels = [];
  const cx = width/2, cy = height/2;
  const centerR = Math.min(width, height) * 0.3;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const i = (y*width+x)*4;
      const brightness = data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114;
      const dist = Math.sqrt((x-cx)**2 + (y-cy)**2);
      if (dist < centerR) centerPixels.push(brightness);
      else edgePixels.push(brightness);
    }
  }
  const centerAvg = centerPixels.reduce((a,b)=>a+b,0) / (centerPixels.length||1);
  const edgeAvg   = edgePixels.reduce((a,b)=>a+b,0)   / (edgePixels.length||1);
  const subjectBackgroundContrast = Math.abs(centerAvg - edgeAvg);
  return {
    subjectBackgroundContrast,
    centerBrightness: centerAvg,
    edgeBrightness: edgeAvg,
    hasGoodSeparation: subjectBackgroundContrast > 30,
    subjectStandsOut: subjectBackgroundContrast > 50,
  };
}

function analyzeTextPresence(data, width, height) {
  const blockSize = 32;
  const blocks = [];
  let textLikeRegions = 0;
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      let blockEdges = 0, blockPixels = 0;
      for (let y = by; y < Math.min(by+blockSize, height-1); y++) {
        for (let x = bx; x < Math.min(bx+blockSize, width-1); x++) {
          const i = (y*width+x)*4;
          const gx = Math.abs((data[i]-data[i+4])+(data[i+1]-data[i+5])+(data[i+2]-data[i+6]))/3;
          const gy = Math.abs((data[i]-data[i+width*4])+(data[i+1]-data[i+width*4+1])+(data[i+2]-data[i+width*4+2]))/3;
          if (gx+gy > 40) blockEdges++;
          blockPixels++;
        }
      }
      const density = blockEdges / (blockPixels||1);
      if (density > 0.15 && density < 0.5) {
        textLikeRegions++;
        blocks.push({ x: bx, y: by, density });
      }
    }
  }
  const totalBlocks = Math.ceil(width/blockSize) * Math.ceil(height/blockSize);
  const textCoverage = textLikeRegions / (totalBlocks||1);
  const textBands = {};
  blocks.forEach(b => { const band = Math.floor(b.y/(blockSize*2)); textBands[band]=(textBands[band]||0)+1; });
  const maxBandSize = Math.max(0, ...Object.values(textBands));
  const hasLargeText = maxBandSize >= 3;
  return {
    hasLargeText, textCoverage, textLikeRegions, totalBlocks,
    hasTitle: hasLargeText && textCoverage > 0.05,
    tooMuchText: textCoverage > 0.4,
  };
}

function analyzeComposition(data, width, height) {
  let maxInterest = 0, focusX = width/2, focusY = height/2;
  const step = 4;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y*width+x)*4;
      const r=data[i],g=data[i+1],b=data[i+2];
      const brightness = r*0.299+g*0.587+b*0.114;
      const max=Math.max(r,g,b),min=Math.min(r,g,b);
      const sat = max>0?(max-min)/max:0;
      const interest = sat*brightness;
      if (interest > maxInterest) { maxInterest=interest; focusX=x; focusY=y; }
    }
  }
  const thirdsPoints = [
    {x:width/3,y:height/3},{x:2*width/3,y:height/3},
    {x:width/3,y:2*height/3},{x:2*width/3,y:2*height/3},
  ];
  const diagonal = Math.sqrt(width**2+height**2);
  const minThirdsDist = Math.min(...thirdsPoints.map(p=>Math.sqrt((focusX-p.x)**2+(focusY-p.y)**2)));
  const thirdsScore = 1-(minThirdsDist/(diagonal*0.3));
  let leftWeight=0, rightWeight=0;
  for (let y=0;y<height;y+=step) {
    for (let x=0;x<width;x+=step) {
      const i=(y*width+x)*4;
      const b=data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114;
      if (x<width/2) leftWeight+=b; else rightWeight+=b;
    }
  }
  const balance = 1-Math.abs(leftWeight-rightWeight)/Math.max(leftWeight,rightWeight,1);
  return {
    focusPoint: {x:focusX, y:focusY},
    thirdsAlignment: Math.max(0, thirdsScore),
    balance, isBalanced: balance>0.85,
    focusInCenter: Math.abs(focusX-width/2)<width*0.15 && Math.abs(focusY-height/2)<height*0.15,
  };
}

function analyzeEdgeDensity(data, width, height) {
  let edgeCount = 0;
  const totalPixels = (width-2)*(height-2);
  const gridSize = 4;
  const regionDensities = [];
  const regionW = Math.floor(width/gridSize), regionH = Math.floor(height/gridSize);
  for (let gy=0;gy<gridSize;gy++) {
    for (let gx=0;gx<gridSize;gx++) {
      let regionEdges=0, regionPixels=0;
      const startX=gx*regionW, endX=Math.min(startX+regionW,width-1);
      const startY=gy*regionH, endY=Math.min(startY+regionH,height-1);
      for (let y=startY;y<endY;y+=2) {
        for (let x=startX;x<endX;x+=2) {
          const i=(y*width+x)*4;
          if (x+1<width && y+1<height) {
            const gxv=Math.abs(data[i]-data[i+4]);
            const gyv=Math.abs(data[i]-data[i+width*4]);
            if (gxv+gyv>30) { regionEdges++; edgeCount++; }
          }
          regionPixels++;
        }
      }
      regionDensities.push(regionEdges/(regionPixels||1));
    }
  }
  const overallDensity = edgeCount/(totalPixels/4||1);
  return {
    overallDensity, regionDensities,
    highDensityRegions: regionDensities.filter(d=>d>0.3).length,
    totalRegions: gridSize*gridSize,
    isBusy: overallDensity>0.25,
    isVeryBusy: overallDensity>0.35,
    isSimple: overallDensity<0.1,
    complexityScore: Math.min(1, overallDensity/0.4),
  };
}

function analyzeSafeZones(data, width, height) {
  const scaleX = width/1280, scaleY = height/720;
  const tsX = Math.floor(width-(80*scaleX));
  const tsY = Math.floor(height-(28*scaleY));
  let edges=0, pixels=0;
  for (let y=tsY;y<height;y++) {
    for (let x=tsX;x<width;x++) {
      const i=(y*width+x)*4;
      if (x<width-1&&y<height-1) {
        const gx=Math.abs(data[i]-data[i+4]);
        const gy=Math.abs(data[i]-data[i+width*4]);
        if (gx+gy>40) edges++;
      }
      pixels++;
    }
  }
  return {
    hasContentInTimestamp: pixels>0 && (edges/pixels)>0.15,
    safeArea: { x:20*scaleX, y:20*scaleY, width:width-(100*scaleX), height:height-(40*scaleY) },
  };
}

function analyzeDimensions(width, height) {
  const isCorrectSize = width===1280 && height===720;
  const aspectRatio = width/height;
  return {
    width, height, aspectRatio,
    isCorrectSize,
    isCorrectRatio: Math.abs(aspectRatio-16/9)<0.05,
    isHighRes: width>=1280,
    issue: !isCorrectSize ? `Image is ${width}×${height}` : null,
  };
}

function detectNiche(objectAnalysis, colorAnalysis, edgeAnalysis, faceAnalysis) {
  const objects = objectAnalysis.categories || [];
  if (edgeAnalysis.isVeryBusy && !objectAnalysis.hasPerson && !faceAnalysis.hasFaces)
    return { niche:'gaming', confidence:0.7, label:'Gaming / Gameplay' };
  if (edgeAnalysis.isBusy && !objectAnalysis.hasPerson)
    return { niche:'gaming', confidence:0.5, label:'Gaming / Gameplay' };
  if (objects.includes('laptop')||objects.includes('cell phone')||objects.includes('keyboard'))
    return { niche:'tech', confidence:0.6, label:'Tech / Review' };
  if (faceAnalysis.hasFaces && faceAnalysis.largestFaceRatio>0.1 && !edgeAnalysis.isBusy)
    return { niche:'vlog', confidence:0.6, label:'Vlog / Talking Head' };
  if (objects.includes('bowl')||objects.includes('cup')||objects.includes('dining table'))
    return { niche:'food', confidence:0.5, label:'Food / Cooking' };
  if (objects.includes('car')||objects.includes('bicycle')||objects.includes('sports ball'))
    return { niche:'outdoor', confidence:0.4, label:'Outdoor / Sports' };
  return { niche:'general', confidence:0.3, label:'General' };
}

// ═══════════════════════════════════════════════════════
// CTR SCORE
// ═══════════════════════════════════════════════════════
function calculateCTRScore(analyses) {
  const {brightnessAnalysis,contrastAnalysis,saturationAnalysis,textAnalysis,
    faceAnalysis,dimensionAnalysis,edgeAnalysis,compositionAnalysis,
    safeZoneAnalysis,nicheAnalysis} = analyses;
  const breakdown = {};
  let score = 0;

  // Technical Quality (25pts)
  let tech = 0;
  if (brightnessAnalysis.isMobileReadable) tech+=6; else if (!brightnessAnalysis.isDark) tech+=3;
  if (brightnessAnalysis.dynamicRange>150) tech+=5; else if (brightnessAnalysis.dynamicRange>100) tech+=3;
  if (!brightnessAnalysis.isFlat) tech+=4;
  if (dimensionAnalysis.isCorrectSize) tech+=5; else if (dimensionAnalysis.isCorrectRatio) tech+=3;
  if (!saturationAnalysis.isMuted&&!saturationAnalysis.isOversaturated) tech+=5; else if (saturationAnalysis.isVibrant) tech+=3;
  breakdown.technical = Math.min(25, tech); score += breakdown.technical;

  // Face & Subject (25pts)
  let face = 0;
  if (faceAnalysis.hasFaces) {
    face += 10;
    if (faceAnalysis.largestFaceRatio>=0.05&&faceAnalysis.largestFaceRatio<=0.4) face+=8; else if (faceAnalysis.largestFaceRatio>0.01) face+=4;
    face += 7;
  } else {
    if (['gaming','food','tech'].includes(nicheAnalysis.niche)) face+=12;
    if (contrastAnalysis.subjectStandsOut) face+=8; else if (contrastAnalysis.hasGoodSeparation) face+=4;
  }
  breakdown.subject = Math.min(25, face); score += breakdown.subject;

  // Text & Clarity (20pts)
  let text = 0;
  if (textAnalysis.hasTitle) text+=12; else if (textAnalysis.hasLargeText) text+=8;
  if (!textAnalysis.tooMuchText) text+=5;
  if (!edgeAnalysis.isVeryBusy) text+=3; else if (!edgeAnalysis.isBusy) text+=5;
  breakdown.textClarity = Math.min(20, text); score += breakdown.textClarity;

  // Composition (15pts)
  let comp = 0;
  if (compositionAnalysis.thirdsAlignment>0.6) comp+=7; else if (compositionAnalysis.thirdsAlignment>0.3) comp+=4;
  if (compositionAnalysis.isBalanced) comp+=5;
  if (!safeZoneAnalysis.hasContentInTimestamp) comp+=3;
  breakdown.composition = Math.min(15, comp); score += breakdown.composition;

  // Color & Impact (15pts)
  let color = 0;
  if (saturationAnalysis.average>0.25&&saturationAnalysis.average<0.65) color+=6;
  if (brightnessAnalysis.average>70&&brightnessAnalysis.average<180) color+=5;
  if (contrastAnalysis.subjectBackgroundContrast>30) color+=4;
  breakdown.colorImpact = Math.min(15, color); score += breakdown.colorImpact;

  const overall = Math.min(100, Math.round(score));
  return {
    overall,
    breakdown,
    label: overall>=85?'Excellent':overall>=70?'Strong':overall>=50?'Good Start':overall>=30?'Needs Work':'Major Issues',
    color: overall>=85?'#4ade80':overall>=70?'#22d3ee':overall>=50?'#fbbf24':overall>=30?'#fb923c':'#ef4444',
  };
}

// ═══════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════
function generateRecommendations(analyses) {
  const recs = [];
  const {brightnessAnalysis,contrastAnalysis,saturationAnalysis,textAnalysis,
    faceAnalysis,dimensionAnalysis,edgeAnalysis,safeZoneAnalysis,
    nicheAnalysis,colorAnalysis} = analyses;

  if (brightnessAnalysis.isDark) {
    recs.push({id:'brightness',icon:'☀️',title:'Image Too Dark for Mobile',
      desc:`Average brightness is ${Math.round(brightnessAnalysis.average)}/255 — will look muddy on phone screens. Target: 80–180.`,
      priority:9,action:'auto_brighten',actionLabel:'Auto Brighten',impact:'high',category:'technical'});
  } else if (brightnessAnalysis.isBright) {
    recs.push({id:'brightness',icon:'🌙',title:'Image Washed Out',
      desc:`Average brightness is ${Math.round(brightnessAnalysis.average)}/255 — too bright, low contrast. Add depth with shadows.`,
      priority:7,action:'auto_contrast',actionLabel:'Add Depth',impact:'medium',category:'technical'});
  }

  if (brightnessAnalysis.isFlat) {
    recs.push({id:'contrast',icon:'⚡',title:'Low Contrast — Flat Image',
      desc:`Luminance std dev is ${Math.round(brightnessAnalysis.stdDev)} (target: >55). Thumbnails need punch to stand out.`,
      priority:8,action:'auto_contrast',actionLabel:'Boost Contrast',impact:'high',category:'technical'});
  }

  if (saturationAnalysis.isMuted) {
    recs.push({id:'saturation',icon:'🎨',title:'Colors Are Muted',
      desc:`Average saturation is ${(saturationAnalysis.average*100).toFixed(0)}% — colors fade at small sizes. Boost to 25–50%.`,
      priority:7,action:'auto_saturate',actionLabel:'Boost Colors',impact:'medium',category:'technical'});
  } else if (saturationAnalysis.isOversaturated) {
    recs.push({id:'saturation',icon:'🎨',title:'Oversaturated',
      desc:`Saturation at ${(saturationAnalysis.average*100).toFixed(0)}% looks unnatural. Dial back to 40–60%.`,
      priority:5,action:'auto_desaturate',actionLabel:'Tone Down',impact:'low',category:'technical'});
  }

  if (!textAnalysis.hasLargeText) {
    recs.push({id:'text',icon:'🔤',title:'Add Bold Text',
      desc:"No large text detected. Thumbnails with 1–3 bold words get higher CTR. Use the Text tool to add a title.",
      priority:8,action:null,actionLabel:null,impact:'high',category:'content'});
  }
  if (textAnalysis.tooMuchText) {
    recs.push({id:'text_overload',icon:'📝',title:'Too Much Text',
      desc:`Text covers ~${(textAnalysis.textCoverage*100).toFixed(0)}% of the image. Keep to 1–3 bold words max.`,
      priority:6,action:null,actionLabel:null,impact:'medium',category:'content'});
  }

  if (!faceAnalysis.hasFaces && (nicheAnalysis.niche==='vlog'||nicheAnalysis.niche==='general')) {
    recs.push({id:'face',icon:'😀',title:'Add a Face for Engagement',
      desc:'No faces detected. Thumbnails with faces get 20–38% higher CTR. Consider adding a reaction or portrait.',
      priority:6,action:null,actionLabel:null,impact:'high',category:'content'});
  }
  if (faceAnalysis.hasFaces && faceAnalysis.largestFaceRatio<0.05) {
    recs.push({id:'face_small',icon:'🔍',title:'Face Too Small',
      desc:`Face is only ${(faceAnalysis.largestFaceRatio*100).toFixed(1)}% of the image. Crop closer — aim for 15–25%.`,
      priority:7,action:null,actionLabel:null,impact:'high',category:'composition'});
  }

  if (!dimensionAnalysis.isCorrectSize) {
    recs.push({id:'dimensions',icon:'📐',title:'Wrong Dimensions',
      desc:`Image is ${dimensionAnalysis.width}×${dimensionAnalysis.height}. YouTube thumbnails should be 1280×720.`,
      priority:4,action:null,actionLabel:null,impact:'low',category:'technical'});
  }

  if (edgeAnalysis.isVeryBusy) {
    recs.push({id:'busy',icon:'👁️',title:'Too Visually Busy',
      desc:`Edge density is ${(edgeAnalysis.overallDensity*100).toFixed(0)}% — detail competes for attention. Add a vignette.`,
      priority:6,action:'auto_vignette',actionLabel:'Add Vignette',impact:'medium',category:'composition'});
  }

  if (safeZoneAnalysis.hasContentInTimestamp) {
    recs.push({id:'safezone',icon:'⚠️',title:'Content Hidden by Timestamp',
      desc:'Important content in the bottom-right will be covered by the video duration badge.',
      priority:7,action:'show_safe_zones',actionLabel:'Show Safe Zones',impact:'medium',category:'youtube'});
  }

  if (!contrastAnalysis.hasGoodSeparation) {
    recs.push({id:'separation',icon:'🎯',title:'Subject Blends into Background',
      desc:`Center-to-edge contrast is ${Math.round(contrastAnalysis.subjectBackgroundContrast)} (target: >50). Add vignette or rim light.`,
      priority:6,action:'auto_vignette',actionLabel:'Add Vignette',impact:'medium',category:'composition'});
  }

  if (colorAnalysis.colorCast!=='none') {
    recs.push({id:'whitebalance',icon:'🌡️',
      title:`${colorAnalysis.colorCast.charAt(0).toUpperCase()+colorAnalysis.colorCast.slice(1)} Color Cast`,
      desc:`Image has a ${colorAnalysis.colorCast} tint that may look off. Auto white balance can correct this.`,
      priority:5,action:'auto_white_balance',actionLabel:'Fix White Balance',impact:'medium',category:'technical'});
  }

  if (nicheAnalysis.niche==='gaming' && !saturationAnalysis.isVibrant) {
    recs.push({id:'niche_gaming',icon:'🎮',title:'Gaming Thumbnails Need Pop',
      desc:'Gaming content performs 23% better with vibrant, saturated colors. Boost saturation and contrast.',
      priority:5,action:'gaming_enhance',actionLabel:'Gaming Boost',impact:'medium',category:'niche'});
  }

  recs.sort((a,b)=>b.priority-a.priority);
  return recs.slice(0,6);
}

// ═══════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════
function rgbToHsl(r, g, b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s; const l=(max+min)/2;
  if (max===min) { h=s=0; }
  else {
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=((g-b)/d+(g<b?6:0))/6; break;
      case g: h=((b-r)/d+2)/6; break;
      default: h=((r-g)/d+4)/6;
    }
  }
  return {h:h*360,s,l};
}
