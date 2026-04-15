// Analyzes image color characteristics and maps to creator styles

export const CREATOR_STYLES = [
  { id: 'mr_beast',       name: 'MrBeast',          grade: 'high_contrast',  brightness: 15,  contrast: 20, saturation: 30,  palette: ['#FFD700','#FF4500','#1E90FF'] },
  { id: 'mkbhd',          name: 'MKBHD',            grade: 'cool_blue',      brightness: 0,   contrast: 10, saturation: -10, palette: ['#000000','#FF0000','#FFFFFF'] },
  { id: 'pewdiepie',      name: 'PewDiePie',         grade: 'cinematic',      brightness: -5,  contrast: 15, saturation: 10,  palette: ['#FF0000','#000000','#FFFFFF'] },
  { id: 'linus',          name: 'Linus Tech Tips',   grade: 'warm_golden',    brightness: 10,  contrast: 5,  saturation: 15,  palette: ['#FFA500','#FFFFFF','#000000'] },
  { id: 'mark_rober',     name: 'Mark Rober',         grade: 'cinematic',      brightness: 5,   contrast: 20, saturation: 25,  palette: ['#00CED1','#FFD700','#FF6347'] },
  { id: 'veritasium',     name: 'Veritasium',         grade: 'cool_blue',      brightness: -5,  contrast: 15, saturation: 5,   palette: ['#4169E1','#FFFFFF','#2F4F4F'] },
  { id: 'kurzgesagt',     name: 'Kurzgesagt',         grade: 'neon_glow',      brightness: 10,  contrast: 25, saturation: 40,  palette: ['#FF6B6B','#4ECDC4','#FFE66D'] },
  { id: 'casey_neistat',  name: 'Casey Neistat',      grade: 'vintage',        brightness: -10, contrast: 20, saturation: -15, palette: ['#8B7355','#D2B48C','#FFFFFF'] },
  { id: 'gary_vee',       name: 'GaryVee',            grade: 'high_contrast',  brightness: 5,   contrast: 30, saturation: 20,  palette: ['#800080','#FFFFFF','#000000'] },
  { id: 'andrew_huberman',name: 'Huberman Lab',       grade: 'cool_blue',      brightness: 0,   contrast: 10, saturation: 0,   palette: ['#2F4F4F','#FFFFFF','#4169E1'] },
  { id: 'valuetainment',  name: 'Valuetainment',      grade: 'warm_golden',    brightness: 10,  contrast: 15, saturation: 10,  palette: ['#FFD700','#8B0000','#FFFFFF'] },
  { id: 'ryan_trahan',    name: 'Ryan Trahan',         grade: 'high_contrast',  brightness: 20,  contrast: 20, saturation: 30,  palette: ['#FF69B4','#7CFC00','#FFD700'] },
  { id: 'yes_theory',     name: 'Yes Theory',          grade: 'cinematic',      brightness: 5,   contrast: 15, saturation: 20,  palette: ['#FFD700','#FF8C00','#FFFFFF'] },
  { id: 'graham_stephan', name: 'Graham Stephan',     grade: 'warm_golden',    brightness: 5,   contrast: 10, saturation: 5,   palette: ['#00A86B','#FFFFFF','#000000'] },
  { id: 'niche_gaming',   name: 'Neon Gaming',         grade: 'neon_glow',      brightness: -5,  contrast: 30, saturation: 50,  palette: ['#00FF00','#FF00FF','#00FFFF'] },
  { id: 'documentary',    name: 'Documentary',         grade: 'vintage',        brightness: -15, contrast: 25, saturation: -20, palette: ['#8B6914','#C4A265','#2F1B0E'] },
  { id: 'education',      name: 'Clean Education',     grade: 'cool_blue',      brightness: 20,  contrast: 5,  saturation: -5,  palette: ['#4169E1','#FFFFFF','#F0F8FF'] },
  { id: 'cooking',        name: 'Food & Cooking',      grade: 'warm_golden',    brightness: 15,  contrast: 10, saturation: 25,  palette: ['#FF8C00','#FFD700','#8B0000'] },
  { id: 'fitness',        name: 'Fitness & Sports',    grade: 'high_contrast',  brightness: 10,  contrast: 30, saturation: 20,  palette: ['#FF4500','#000000','#FFFFFF'] },
  { id: 'vlog',           name: 'Lifestyle Vlog',      grade: 'warm_golden',    brightness: 15,  contrast: 5,  saturation: 15,  palette: ['#DEB887','#F4A460','#FFDEAD'] },
];

export function analyzeImageStyle(imageElement) {
  if (!imageElement) return null;
  try {
    const off = document.createElement('canvas');
    off.width = 80; off.height = 45;
    const ctx = off.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, 80, 45);
    const { data } = ctx.getImageData(0, 0, 80, 45);
    let rSum = 0, gSum = 0, bSum = 0, lumSum = 0, pixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i]; gSum += data[i+1]; bSum += data[i+2];
      lumSum += 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
      pixels++;
    }
    const brightness = Math.round((lumSum / pixels / 255) * 200 - 100); // -100 to 100
    const saturation = Math.round(Math.max(rSum, gSum, bSum) / pixels - Math.min(rSum, gSum, bSum) / pixels) / 255 * 100;
    const dominantColors = [`rgb(${Math.round(rSum/pixels)},${Math.round(gSum/pixels)},${Math.round(bSum/pixels)})`];
    const suggestedGrade = brightness > 20 ? 'warm_golden' : brightness < -20 ? 'cool_blue' : saturation > 40 ? 'neon_glow' : 'cinematic';
    return { brightness, saturation: Math.round(saturation), dominantColors, suggestedGrade, adjustments: { brightness, contrast: 5, saturation: Math.round(saturation * 0.3) } };
  } catch { return null; }
}
