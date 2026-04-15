// src/editor/presets/nicheDNA.js
// Niche DNA presets — one-click style packages tuned for each major YouTube niche.
// colorGrade names must match keys in colorGrades.js.
// adjustments values are 0-centred deltas matching the store schema.

export const NICHE_PRESETS = [
  {
    id:          'minecraft',
    name:        'Minecraft',
    icon:        '⛏️',
    description: 'Bold, saturated, pixelated energy. High brightness for that blocky feel.',
    colorGrade:  { name: 'gaming', strength: 0.75 },
    adjustments: { brightness: 15, contrast: 20, saturation: 30, vibrance: 20, exposure: 5, temperature: 0, tint: 0, highlights: -10, shadows: 5, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 96, fontWeight: '900',
      fill: '#FFFF00',
      stroke: { enabled: true, color: '#000000', width: 6 },
      shadow: { enabled: true, color: '#000000', blur: 8, offsetX: 3, offsetY: 3, opacity: 0.9 },
      glow:   { enabled: false, color: '#FFFF00', blur: 10, strength: 2, opacity: 0.7 },
    },
    layoutGuide: {
      zones: [
        { label: 'Face / Character', x: 640, y: 80,  width: 600, height: 560, color: '#3b82f6' },
        { label: 'Text Zone',        x: 30,  y: 30,  width: 580, height: 200, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100, height: 24,  color: '#ef4444' },
      ],
    },
  },
  {
    id:          'fortnite',
    name:        'Fortnite',
    icon:        '🎯',
    description: 'Vibrant, neon-tinged. High energy with bold color contrast.',
    colorGrade:  { name: 'neon', strength: 0.65 },
    adjustments: { brightness: 10, contrast: 25, saturation: 40, vibrance: 30, exposure: 5, temperature: 0, tint: 0, highlights: -5, shadows: 5, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 96, fontWeight: '900',
      fill: '#00FFFF',
      stroke: { enabled: true, color: '#000000', width: 6 },
      shadow: { enabled: false, color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 },
      glow:   { enabled: true,  color: '#00FFFF', blur: 14, strength: 3, opacity: 0.8 },
    },
    layoutGuide: {
      zones: [
        { label: 'Character Zone',   x: 580, y: 60,  width: 660, height: 620, color: '#3b82f6' },
        { label: 'Logo / Text',      x: 30,  y: 530, width: 520, height: 160, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100, height: 24,  color: '#ef4444' },
      ],
    },
  },
  {
    id:          'horror',
    name:        'Horror',
    icon:        '💀',
    description: 'Dark, moody, desaturated. Red accents for tension.',
    colorGrade:  { name: 'moody', strength: 0.90 },
    adjustments: { brightness: -20, contrast: 30, saturation: -30, vibrance: -10, exposure: -5, temperature: -10, tint: 5, highlights: -20, shadows: 10, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 96, fontWeight: '900',
      fill: '#FF0000',
      stroke: { enabled: true, color: '#000000', width: 5 },
      shadow: { enabled: true, color: '#FF0000', blur: 12, offsetX: 0, offsetY: 0, opacity: 0.7 },
      glow:   { enabled: true,  color: '#FF0000', blur: 16, strength: 3, opacity: 0.8 },
    },
    layoutGuide: {
      zones: [
        { label: 'Face Zone',        x: 290, y: 80,  width: 700, height: 560, color: '#ef4444' },
        { label: 'Text Zone',        x: 30,  y: 560, width: 1220, height: 130, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100, height: 24,  color: '#ef4444' },
      ],
    },
  },
  {
    id:          'gta',
    name:        'GTA',
    icon:        '🌆',
    description: 'Cinematic, poster-like. High contrast with warm tones.',
    colorGrade:  { name: 'cinema', strength: 0.80 },
    adjustments: { brightness: 5, contrast: 35, saturation: 20, vibrance: 10, exposure: 0, temperature: 10, tint: 0, highlights: -15, shadows: 15, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 112, fontWeight: '900',
      fill: '#FFFFFF',
      stroke: { enabled: true, color: '#000000', width: 7 },
      shadow: { enabled: true, color: '#000000', blur: 10, offsetX: 4, offsetY: 4, opacity: 0.9 },
      glow:   { enabled: false, color: '#f97316', blur: 12, strength: 2, opacity: 0.6 },
    },
    layoutGuide: {
      zones: [
        { label: 'Character',        x: 380, y: 0,   width: 900, height: 720, color: '#3b82f6' },
        { label: 'Title Zone',       x: 20,  y: 570, width: 400, height: 130, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100, height: 24,  color: '#ef4444' },
      ],
    },
  },
  {
    id:          'vlog',
    name:        'Vlog',
    icon:        '📸',
    description: 'Warm, natural, authentic. Clean look that feels personal.',
    colorGrade:  { name: 'warm', strength: 0.60 },
    adjustments: { brightness: 10, contrast: 10, saturation: 15, vibrance: 15, exposure: 3, temperature: 15, tint: 0, highlights: -8, shadows: 5, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 80, fontWeight: '700',
      fill: '#FFFFFF',
      stroke: { enabled: true, color: '#000000', width: 4 },
      shadow: { enabled: true, color: '#000000', blur: 6, offsetX: 2, offsetY: 2, opacity: 0.7 },
      glow:   { enabled: false, color: '#f97316', blur: 8, strength: 1, opacity: 0.5 },
    },
    layoutGuide: {
      zones: [
        { label: 'Face Zone',        x: 180, y: 50,  width: 900, height: 620, color: '#3b82f6' },
        { label: 'Text Overlay',     x: 30,  y: 30,  width: 520, height: 130, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100, height: 24,  color: '#ef4444' },
      ],
    },
  },
  {
    id:          'tech',
    name:        'Tech',
    icon:        '💻',
    description: 'Clean, cool, precise. Blue tones and sharp contrast.',
    colorGrade:  { name: 'cool', strength: 0.70 },
    adjustments: { brightness: 15, contrast: 20, saturation: -10, vibrance: 5, exposure: 5, temperature: -15, tint: 0, highlights: -10, shadows: 8, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 80, fontWeight: '900',
      fill: '#00D4FF',
      stroke: { enabled: true, color: '#001133', width: 5 },
      shadow: { enabled: true, color: '#000033', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 },
      glow:   { enabled: true,  color: '#00D4FF', blur: 10, strength: 2, opacity: 0.7 },
    },
    layoutGuide: {
      zones: [
        { label: 'Product / Screen', x: 280, y: 60,  width: 720, height: 600, color: '#06b6d4' },
        { label: 'Title Zone',       x: 30,  y: 30,  width: 580, height: 170, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100, height: 24,  color: '#ef4444' },
      ],
    },
  },
  {
    id:          'cooking',
    name:        'Cooking',
    icon:        '🍳',
    description: 'Warm and appetizing. Golden tones, high brightness.',
    colorGrade:  { name: 'golden_hour', strength: 0.70 },
    adjustments: { brightness: 20, contrast: 15, saturation: 25, vibrance: 20, exposure: 5, temperature: 20, tint: 0, highlights: -5, shadows: 10, hue: 0, sharpness: 0 },
    textDefaults: {
      fontFamily: 'Impact', fontSize: 80, fontWeight: '900',
      fill: '#FFFFFF',
      stroke: { enabled: true, color: '#7B3F00', width: 5 },
      shadow: { enabled: true, color: '#4A2000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 },
      glow:   { enabled: false, color: '#FFD700', blur: 10, strength: 1, opacity: 0.6 },
    },
    layoutGuide: {
      zones: [
        { label: 'Food Zone',        x: 130, y: 60,  width: 1020, height: 600, color: '#eab308' },
        { label: 'Title Zone',       x: 30,  y: 30,  width: 580,  height: 130, color: '#f97316' },
        { label: 'Avoid (timestamp)',x: 1180, y: 696, width: 100,  height: 24,  color: '#ef4444' },
      ],
    },
  },
];
