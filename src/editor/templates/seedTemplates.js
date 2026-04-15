// src/editor/templates/seedTemplates.js
// 12 free starter templates for Phase 11 — Templates System.
// All coordinates are CENTER-based (x = topLeft + width/2, y = topLeft + height/2)
// matching the layer schema used by the Renderer and Store.
// Shape layers with gradients use { gradientFill: { type, angle, stops } }.
// Image/Text placeholder layers use { placeholder: { type, label, description, required } }.

export const SEED_TEMPLATES = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. MINECRAFT — EPIC BUILD
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_minecraft_epic',
    name: 'Minecraft: Epic Build',
    category: 'Gaming',
    subcategory: 'Minecraft',
    tags: ['gaming', 'minecraft', 'epic', 'build'],
    is_free: true,
    is_featured: true,
    gradientPreview: { from: '#1a3a1a', to: '#0a1a0a' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#1a3a1a' }, { offset: 1, color: '#0a1a0a' }] },
      },
      {
        type: 'image', name: 'Character / Face',
        x: 280, y: 360, width: 480, height: 560,
        placeholder: { type: 'image', label: 'ADD CHARACTER', description: 'Drop your Minecraft character or face here', required: true },
      },
      {
        type: 'text', name: 'Title',
        x: 900, y: 300, width: 680, height: 200,
        textData: { content: 'YOUR EPIC TITLE', fontFamily: 'Impact', fontSize: 88, fontWeight: '900', fill: '#FFFFFF', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#1a5e1a', width: 5 }, shadow: { enabled: true, color: '#000000', blur: 8, offsetX: 3, offsetY: 3, opacity: 0.8 }, glow: { enabled: false, color: '#00ff00', blur: 10, strength: 2, opacity: 0.6 } },
        placeholder: { type: 'text', label: 'YOUR EPIC TITLE', required: true },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. FORTNITE — VICTORY ROYALE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_fortnite_victory',
    name: 'Fortnite: Victory Royale',
    category: 'Gaming',
    subcategory: 'Fortnite',
    tags: ['gaming', 'fortnite', 'victory'],
    is_free: true,
    is_featured: true,
    gradientPreview: { from: '#4a0080', to: '#0a0010' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'radial', stops: [{ offset: 0, color: '#4a0080' }, { offset: 1, color: '#0a0010' }] },
      },
      {
        type: 'image', name: 'Character',
        x: 310, y: 380, width: 500, height: 680,
        placeholder: { type: 'image', label: 'ADD CHARACTER', required: true },
      },
      {
        type: 'text', name: 'Title',
        x: 910, y: 270, width: 660, height: 180,
        textData: { content: 'VICTORY ROYALE', fontFamily: 'Impact', fontSize: 82, fontWeight: '900', fill: '#FFFFFF', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#9333ea', width: 6 }, shadow: { enabled: false, color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 }, glow: { enabled: true, color: '#a855f7', blur: 16, strength: 3, opacity: 0.8 } },
        placeholder: { type: 'text', label: 'VICTORY ROYALE', required: false },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. HORROR — JUMP SCARE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_horror_jumpscare',
    name: 'Horror: Jump Scare',
    category: 'Horror',
    subcategory: null,
    tags: ['horror', 'scary', 'dark'],
    is_free: true,
    is_featured: true,
    gradientPreview: { from: '#1a0000', to: '#000000' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        shapeData: { shapeType: 'rect', fill: '#000000', stroke: null, strokeWidth: 0, cornerRadius: 0 },
      },
      {
        type: 'image', name: 'Scary Face',
        x: 640, y: 360, width: 600, height: 600,
        placeholder: { type: 'image', label: 'ADD SCARY FACE', required: true },
      },
      {
        type: 'text', name: 'Title',
        x: 290, y: 100, width: 500, height: 120,
        textData: { content: 'DONT WATCH ALONE', fontFamily: 'Impact', fontSize: 66, fontWeight: '900', fill: '#ef4444', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#000000', width: 4 }, shadow: { enabled: true, color: '#ff0000', blur: 12, offsetX: 0, offsetY: 0, opacity: 0.7 }, glow: { enabled: false, color: '#ff0000', blur: 16, strength: 3, opacity: 0.8 } },
        placeholder: { type: 'text', label: 'DONT WATCH ALONE', required: true },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. VLOG — DAY IN MY LIFE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_vlog_dayinlife',
    name: 'Vlog: Day In My Life',
    category: 'Vlog',
    subcategory: null,
    tags: ['vlog', 'lifestyle', 'daily'],
    is_free: true,
    is_featured: true,
    gradientPreview: { from: '#2a1500', to: '#1a0a00' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#1a0a00' }, { offset: 1, color: '#2a1500' }] },
      },
      {
        type: 'image', name: 'Your Face',
        x: 480, y: 360, width: 640, height: 600,
        placeholder: { type: 'image', label: 'ADD YOUR PHOTO', description: 'Best with a face taking up 40-60% of frame', required: true },
      },
      {
        type: 'text', name: 'Title',
        x: 1040, y: 360, width: 400, height: 160,
        textData: { content: 'DAY IN MY LIFE', fontFamily: 'Impact', fontSize: 66, fontWeight: '800', fill: '#FFFFFF', align: 'center', lineHeight: 1.2, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 4 }, shadow: { enabled: true, color: '#000000', blur: 12, offsetX: 0, offsetY: 4, opacity: 0.6 }, glow: { enabled: false, color: '#f97316', blur: 8, strength: 1, opacity: 0.5 } },
        placeholder: { type: 'text', label: 'DAY IN MY LIFE', required: true },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. FITNESS — WORKOUT
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_fitness_workout',
    name: 'Fitness: Workout',
    category: 'Fitness',
    subcategory: null,
    tags: ['fitness', 'workout', 'gym', 'sports'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#1a0000', to: '#0a0a0a' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 180, stops: [{ offset: 0, color: '#1a0000' }, { offset: 1, color: '#0a0a0a' }] },
      },
      {
        type: 'image', name: 'Action Pose',
        x: 640, y: 360, width: 800, height: 640,
        placeholder: { type: 'image', label: 'ADD ACTION PHOTO', required: true },
      },
      {
        type: 'text', name: 'Workout Name',
        x: 340, y: 640, width: 600, height: 120,
        textData: { content: 'CHEST DAY', fontFamily: 'Impact', fontSize: 96, fontWeight: '900', fill: '#f97316', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#000000', width: 4 }, shadow: { enabled: false, color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 }, glow: { enabled: false, color: '#f97316', blur: 10, strength: 2, opacity: 0.6 } },
        placeholder: { type: 'text', label: 'CHEST DAY', required: true },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. TUTORIAL — STEP BY STEP
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_tutorial_steps',
    name: 'Tutorial: Step by Step',
    category: 'Tutorial',
    subcategory: null,
    tags: ['tutorial', 'how-to', 'steps'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#0a0a1a', to: '#1a1a2e' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#0a0a1a' }, { offset: 1, color: '#1a1a2e' }] },
      },
      {
        type: 'shape', name: 'Number Circle',
        x: 140, y: 140, width: 200, height: 200,
        shapeData: { shapeType: 'ellipse', fill: '#f97316', stroke: null, strokeWidth: 0, cornerRadius: 0 },
      },
      {
        type: 'text', name: 'Number',
        x: 140, y: 140, width: 200, height: 160,
        textData: { content: '5', fontFamily: 'Impact', fontSize: 120, fontWeight: '900', fill: '#FFFFFF', align: 'center', lineHeight: 1.0, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
      },
      {
        type: 'text', name: 'Steps Label',
        x: 460, y: 80, width: 400, height: 80,
        textData: { content: 'EASY STEPS', fontFamily: 'Impact', fontSize: 44, fontWeight: '800', fill: '#FFFFFF', align: 'left', lineHeight: 1.1, letterSpacing: 2, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
      },
      {
        type: 'image', name: 'Your Face',
        x: 990, y: 360, width: 500, height: 520,
        placeholder: { type: 'image', label: 'ADD YOUR FACE', required: false },
      },
      {
        type: 'text', name: 'Title',
        x: 380, y: 620, width: 680, height: 120,
        textData: { content: 'HOW TO DO ANYTHING', fontFamily: 'Impact', fontSize: 52, fontWeight: '700', fill: 'rgba(245,245,247,0.65)', align: 'left', lineHeight: 1.2, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'HOW TO DO ANYTHING', required: true },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. REACTION — OMG
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_reaction_omg',
    name: 'Reaction: OMG',
    category: 'Reaction',
    subcategory: null,
    tags: ['reaction', 'response', 'omg'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#0f0f1a', to: '#1a0a2a' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#0f0f1a' }, { offset: 1, color: '#1a0a2a' }] },
      },
      {
        type: 'image', name: 'Content Preview',
        x: 340, y: 360, width: 600, height: 480,
        placeholder: { type: 'image', label: "WHAT YOU'RE REACTING TO", required: false },
      },
      {
        type: 'image', name: 'Reaction Face',
        x: 970, y: 360, width: 540, height: 560,
        placeholder: { type: 'image', label: 'YOUR REACTION FACE', required: true },
      },
      {
        type: 'text', name: 'Title',
        x: 360, y: 80, width: 640, height: 80,
        textData: { content: 'MY REACTION TO THIS', fontFamily: 'Impact', fontSize: 58, fontWeight: '900', fill: '#FFFFFF', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#000000', width: 3 }, shadow: { enabled: false, color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'MY REACTION TO THIS', required: false },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. MUSIC — COVER SONG
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_music_cover',
    name: 'Music: Cover Song',
    category: 'Music',
    subcategory: null,
    tags: ['music', 'cover', 'song'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#1a0a2a', to: '#0a0a0a' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#1a0a2a' }, { offset: 1, color: '#0a0a0a' }] },
      },
      {
        type: 'image', name: 'Artist Photo',
        x: 480, y: 360, width: 560, height: 600,
        placeholder: { type: 'image', label: 'YOUR PHOTO', required: true },
      },
      {
        type: 'text', name: 'Song Title',
        x: 1020, y: 320, width: 440, height: 160,
        textData: { content: 'SONG TITLE', fontFamily: 'Impact', fontSize: 68, fontWeight: '800', fill: '#FFFFFF', align: 'center', lineHeight: 1.2, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: true, color: '#000000', blur: 16, offsetX: 0, offsetY: 4, opacity: 0.8 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'SONG TITLE', required: true },
      },
      {
        type: 'text', name: 'Cover Label',
        x: 1020, y: 450, width: 440, height: 60,
        textData: { content: 'COVER', fontFamily: 'Impact', fontSize: 34, fontWeight: '600', fill: 'rgba(245,245,247,0.40)', align: 'center', lineHeight: 1.2, letterSpacing: 4, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. TECH — PHONE REVIEW
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_tech_review',
    name: 'Tech: Phone Review',
    category: 'Tech',
    subcategory: null,
    tags: ['tech', 'review', 'phone', 'gadget'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#0a0a14', to: '#14141e' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#0a0a14' }, { offset: 1, color: '#14141e' }] },
      },
      {
        type: 'image', name: 'Product',
        x: 640, y: 360, width: 720, height: 600,
        placeholder: { type: 'image', label: 'PRODUCT PHOTO', required: true },
      },
      {
        type: 'text', name: 'Product Name',
        x: 340, y: 90, width: 600, height: 100,
        textData: { content: 'IPHONE REVIEW', fontFamily: 'Impact', fontSize: 60, fontWeight: '800', fill: '#FFFFFF', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#00D4FF', blur: 10, strength: 2, opacity: 0.7 } },
        placeholder: { type: 'text', label: 'IPHONE REVIEW', required: true },
      },
      {
        type: 'text', name: 'Rating',
        x: 190, y: 650, width: 300, height: 60,
        textData: { content: '⭐⭐⭐⭐⭐', fontFamily: 'Impact', fontSize: 32, fontWeight: '600', fill: '#eab308', align: 'left', lineHeight: 1.2, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. SPORTS — HIGHLIGHTS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_sports_highlights',
    name: 'Sports: Highlights',
    category: 'Sports',
    subcategory: null,
    tags: ['sports', 'highlights', 'athlete'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#1a1a2e', to: '#0f0f23' },
    layers: [
      {
        type: 'image', name: 'Action Shot',
        x: 640, y: 360, width: 1280, height: 720,
        placeholder: { type: 'image', label: 'ACTION PHOTO (FULL BLEED)', description: 'Best with a dramatic sports action shot', required: true },
      },
      {
        type: 'shape', name: 'Gradient Overlay',
        x: 640, y: 560, width: 1280, height: 320,
        gradientFill: { type: 'linear', angle: 180, stops: [{ offset: 0, color: 'rgba(0,0,0,0)' }, { offset: 1, color: 'rgba(0,0,0,0.85)' }] },
      },
      {
        type: 'text', name: 'Player Name',
        x: 440, y: 610, width: 800, height: 100,
        textData: { content: 'PLAYER NAME', fontFamily: 'Impact', fontSize: 76, fontWeight: '900', fill: '#FFFFFF', align: 'left', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#000000', width: 3 }, shadow: { enabled: false, color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'PLAYER NAME', required: true },
      },
      {
        type: 'text', name: 'Subtitle',
        x: 340, y: 685, width: 600, height: 50,
        textData: { content: 'BEST HIGHLIGHTS 2026', fontFamily: 'Impact', fontSize: 30, fontWeight: '600', fill: 'rgba(245,245,247,0.65)', align: 'left', lineHeight: 1.2, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'BEST HIGHLIGHTS 2026', required: false },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. GENERAL — QUESTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_general_question',
    name: 'General: Question',
    category: 'General',
    subcategory: null,
    tags: ['general', 'question', 'curiosity'],
    is_free: true,
    is_featured: false,
    gradientPreview: { from: '#0f0f23', to: '#23230f' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        gradientFill: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#0f0f23' }, { offset: 1, color: '#23230f' }] },
      },
      {
        type: 'text', name: 'Question Mark',
        x: 240, y: 360, width: 400, height: 560,
        textData: { content: '?', fontFamily: 'Impact', fontSize: 460, fontWeight: '900', fill: 'rgba(249,115,22,0.15)', align: 'center', lineHeight: 1.0, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
      },
      {
        type: 'image', name: 'Curious Face',
        x: 920, y: 360, width: 640, height: 520,
        placeholder: { type: 'image', label: 'YOUR CURIOUS FACE', required: false },
      },
      {
        type: 'text', name: 'Question',
        x: 640, y: 630, width: 1200, height: 100,
        textData: { content: 'IS THIS ACTUALLY POSSIBLE?', fontFamily: 'Impact', fontSize: 68, fontWeight: '900', fill: '#FFFFFF', align: 'center', lineHeight: 1.1, letterSpacing: 0, stroke: { enabled: true, color: '#000000', width: 3 }, shadow: { enabled: false, color: '#000000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.8 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'IS THIS ACTUALLY POSSIBLE?', required: true },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. GENERAL — MINIMAL
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tpl_general_minimal',
    name: 'General: Minimal',
    category: 'General',
    subcategory: null,
    tags: ['general', 'minimal', 'clean', 'text-only'],
    is_free: true,
    is_featured: true,
    gradientPreview: { from: '#09090b', to: '#18181b' },
    layers: [
      {
        type: 'shape', name: 'Background',
        x: 640, y: 360, width: 1280, height: 720,
        shapeData: { shapeType: 'rect', fill: '#09090b', stroke: null, strokeWidth: 0, cornerRadius: 0 },
      },
      {
        type: 'shape', name: 'Accent Line',
        x: 640, y: 341, width: 960, height: 3,
        shapeData: { shapeType: 'rect', fill: '#f97316', stroke: null, strokeWidth: 0, cornerRadius: 0 },
      },
      {
        type: 'text', name: 'Title',
        x: 640, y: 270, width: 960, height: 140,
        textData: { content: 'YOUR TITLE', fontFamily: 'Impact', fontSize: 92, fontWeight: '800', fill: '#F5F5F7', align: 'center', lineHeight: 1.1, letterSpacing: 4, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'YOUR TITLE', required: true },
      },
      {
        type: 'text', name: 'Subtitle',
        x: 640, y: 410, width: 960, height: 60,
        textData: { content: 'subtitle text here', fontFamily: 'Impact', fontSize: 30, fontWeight: '400', fill: 'rgba(245,245,247,0.40)', align: 'center', lineHeight: 1.2, letterSpacing: 0, stroke: { enabled: false, color: '#000000', width: 0 }, shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 }, glow: { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 } },
        placeholder: { type: 'text', label: 'subtitle text here', required: false },
      },
    ],
  },
];

// Category list for the browser sidebar
export const TEMPLATE_CATEGORIES = [
  'All', 'Gaming', 'Vlog', 'Horror', 'Tech', 'Fitness', 'Tutorial', 'Reaction', 'Music', 'Sports', 'General',
];
