import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import MemesPanel from './Memes';
import BrushTool, { BrushOverlay } from './Brush';
import BrandKitSetupModal from './BrandKit';
import SidebarBrandKit from './SidebarBrandKit';
import supabase from './supabaseClient';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const PLATFORMS = {
  youtube:   { label:'YouTube',   width:1280, height:720,  preview:{ w:640, h:360 } },
  tiktok:    { label:'TikTok',    width:1080, height:1920, preview:{ w:152, h:270 } },
  instagram: { label:'Instagram', width:1080, height:1080, preview:{ w:270, h:270 } },
  twitter:   { label:'Twitter',   width:1600, height:900,  preview:{ w:480, h:270 } },
  linkedin:  { label:'LinkedIn',  width:1200, height:627,  preview:{ w:480, h:251 } },
};

const FONTS = [
  'Anton','Burbank','Komika Axis','Bangers','Bebas Neue','Oswald',
  'Impact','Arial Black','Arial','Georgia','Courier New','Verdana',
  'Trebuchet MS','Times New Roman','Comic Sans MS','Palatino',
  'Garamond','Tahoma','Lucida Console','Century Gothic','Candara',
  'Franklin Gothic Medium','Rockwell','Copperplate','Papyrus',
  'Helvetica','Segoe UI','Calibri','Cambria','Brush Script MT',
];

function resolveFontFamily(fontFamily){
  if(fontFamily==='Burbank') return 'Bangers, Anton, sans-serif';
  if(fontFamily==='Komika Axis') return 'Comic Neue, Bangers, cursive';
  if(fontFamily==='Anton') return 'Anton, sans-serif';
  return fontFamily;
}

// ── Pro Rendering Utilities ────────────────────────────────────────────────

/**
 * drawProText — Professional outer-stroke text rendering.
 * Standard ctx.strokeText() bleeds inward, destroying font weight.
 * This draws 12 circular offset fills for the stroke, then one clean fill on top.
 */
function drawProText(ctx, text, x, y, opts={}){
  const {fill='#ffffff', stroke='#000000', strokeWidth=0,
         glowColor, glowBlur=0,
         shadowColor, shadowBlur=0, shadowX=0, shadowY=0} = opts;

  ctx.save();

  // CRITICAL: Clear any inherited shadow state first — stroke passes must be shadow-free
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Pass 1: Drop shadow (single dedicated pass, not applied to strokes)
  if(shadowColor && shadowBlur>0){
    ctx.save();
    ctx.shadowColor   = shadowColor;
    ctx.shadowBlur    = shadowBlur;
    ctx.shadowOffsetX = shadowX;
    ctx.shadowOffsetY = shadowY;
    ctx.fillStyle     = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
    // Shadow is now rendered — clear for remaining passes
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
  }

  // Pass 2: Multi-pass glow (if enabled)
  if(glowColor && glowBlur>0){
    for(let pass=0; pass<3; pass++){
      ctx.save();
      ctx.shadowColor   = glowColor;
      ctx.shadowBlur    = glowBlur * (pass+1)/3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle     = glowColor;
      ctx.fillText(text, x, y);
      ctx.restore();
    }
  }

  // Pass 3: Circular offset stroke (12 directions) — NO shadow, NO glow
  if(strokeWidth > 0){
    ctx.fillStyle = stroke;
    const steps = 12;
    for(let i=0; i<steps; i++){
      const angle = (i/steps) * Math.PI * 2;
      const dx = Math.cos(angle) * strokeWidth;
      const dy = Math.sin(angle) * strokeWidth;
      ctx.fillText(text, x + dx, y + dy);
    }
  }

  // Pass 4: Clean fill on top — crisp, no bleed
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * ensureFontLoaded — Wait for a Google Font to be ready before rendering.
 * Uses the native FontFace API. Falls back silently if the font isn't available.
 */
async function ensureFontLoaded(fontFamily, weight=900){
  try{
    const resolved = resolveFontFamily(fontFamily).split(',')[0].trim().replace(/['"]/g,'');
    await document.fonts.load(`${weight} 48px "${resolved}"`);
  }catch(e){
    // Font may not be available — render will use fallback
  }
}

/**
 * drawGlowImage — Multi-pass glow for image layers (subject isolation).
 * Draws the image 3 times with increasing shadowBlur for density,
 * then one clean pass with no blur for the sharp final image.
 */
function drawGlowImage(ctx, img, x, y, w, h, glowColor='#ffffff', glowBlur=20){
  for(let pass=0; pass<3; pass++){
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = glowBlur * (pass+1) / 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(img, x, y, w, h);
  }
  // Final clean pass
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.drawImage(img, x, y, w, h);
}

const FONT_WEIGHTS = [
  {label:'Thin',value:100},{label:'Light',value:300},{label:'Regular',value:400},
  {label:'Medium',value:500},{label:'SemiBold',value:600},{label:'Bold',value:700},
  {label:'ExtraBold',value:800},{label:'Black',value:900},
];

const GRADIENTS = [
  ['#f97316','#1a1a2e'],['#FF416C','#FF4B2B'],['#0F6E56','#9FE1CB'],
  ['#185FA5','#00BFFF'],['#FFD700','#FF6347'],['#FF1493','#FF8C00'],
  ['#00FA9A','#006400'],['#9400D3','#4B0082'],['#2a2a2a','#888780'],
  ['#851c1c','#FAC775'],['#00C9FF','#92FE9D'],['#FC466B','#3F5EFB'],
  ['#f7971e','#ffd200'],['#11998e','#38ef7d'],['#4776E6','#8E54E9'],
  ['#eb3349','#f45c43'],['#D4537E','#FBEAF0'],['#FF6347','#FFD700'],
];

const BLEND_MODES = [
  'normal','multiply','screen','overlay','darken','lighten',
  'color-dodge','color-burn','hard-light','soft-light','difference','exclusion',
];

// Text hook swap tables for A/B variant generator
const TEXT_FLIP_HOOKS = [
  ['I WON',               'THEY LOST'],
  ['I WIN',               'THEY LOSE'],
  ['WE WON',              'THEY FAILED'],
  ["YOU WON'T BELIEVE",   'NOBODY EXPECTED'],
  ["YOU WON'T",           'NOBODY'],
  ['BELIEVE THIS',        'EXPECTED THIS'],
  ['EPIC',                'INSANE'],
  ['EPIC MOMENT',         'UNREAL CLIP'],
  ['MOMENT',              'CLIP'],
  ['GONE WRONG',          'BACKFIRED'],
  ['GONE',                'BACKFIRED'],
  ['DO THIS',             'NEVER DO THIS'],
  ['HOW I MADE',          'HOW THEY LOST'],
  ['HOW TO',              'WHY NOT TO'],
  ['THE TRUTH',           'THE REAL STORY'],
  ['WAIT...',             'IMPOSSIBLE.'],
  ['WHAT?!',              'NO WAY!'],
  ['WATCH THIS',          'THEY DID WHAT'],
  ['RESULTS',             'THE PROOF'],
  ['MY STORY',            'THEIR SECRET'],
  ['SIMPLE',              'COMPLEX'],
  ['WRONG',               'DISASTER'],
  ['STORY',               'SECRET'],
  ['I SURVIVED',          'GONE WRONG!'],
  ['SURVIVED',            'TOTAL FAILURE'],
  ['I FAILED',            'THEY LAUGHED'],
  ['CHALLENGE',           'DISASTER CHALLENGE'],
  ['24 HOURS',            'OVERNIGHT FAIL'],
  ['LAST TO LEAVE',       'FIRST TO QUIT'],
  ['I TRIED',             'IT BACKFIRED'],
];

// (TEXT_DRAMA_HOOKS removed — variant C now uses text hiding instead of hook swaps)

function getProjectIdFromUrl(){
  return new URLSearchParams(window.location.search).get('project');
}

function syncProjectIdToUrl(projectId){
  if(!projectId)return;
  const url = new URL(window.location.href);
  url.searchParams.set('project', projectId);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function clearProjectIdFromUrl(){
  const url = new URL(window.location.href);
  url.searchParams.delete('project');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function getProjectStorageKey(projectId){
  return `project_state_${projectId}`;
}

function generateProjectId(){
  if(window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `project_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

const TEXT_TEMPLATES = [
  // ── Premium Text Presets ────────────────────────────────────────────────
  { label:'🔥 MrBeast Bold',  text:'WATCH THIS',        fontSize:62, fontFamily:'Anton',      fontWeight:900, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:8,  shadowEnabled:true,  shadowBlur:28, shadowX:4, shadowY:4, shadowColor:'#000000', glowEnabled:false, glowColor:'#f97316', letterSpacing:3,  lineHeight:1.1, textAlign:'center' },
  { label:'💎 Neon Glow',     text:'LIVE NOW',           fontSize:52, fontFamily:'Anton',      fontWeight:900, textColor:'#00FFFF', strokeColor:'#003333', strokeWidth:2,  shadowEnabled:false, shadowBlur:0,  shadowX:0, shadowY:0, shadowColor:'#000000', glowEnabled:true,  glowColor:'#00FFFF', letterSpacing:4,  lineHeight:1.2, textAlign:'center' },
  { label:'🪙 Chrome',        text:'PREMIUM',            fontSize:54, fontFamily:'Bebas Neue', fontWeight:900, textColor:'#E8E8E8', strokeColor:'#666666', strokeWidth:3,  shadowEnabled:true,  shadowBlur:6,  shadowX:2, shadowY:3, shadowColor:'#333333', glowEnabled:false, glowColor:'#ffffff', letterSpacing:6,  lineHeight:1.2, textAlign:'center' },
  { label:'🔴 Fire',          text:'GONE WRONG',         fontSize:56, fontFamily:'Anton',      fontWeight:900, textColor:'#FF4400', strokeColor:'#000000', strokeWidth:6,  shadowEnabled:false, shadowBlur:0,  shadowX:0, shadowY:0, shadowColor:'#000000', glowEnabled:true,  glowColor:'#FF6600', letterSpacing:2,  lineHeight:1.1, textAlign:'center' },
  { label:'⚡ Glitch',        text:'ERROR 404',           fontSize:48, fontFamily:'Anton',      fontWeight:900, textColor:'#00FFFF', strokeColor:'#000000', strokeWidth:4,  shadowEnabled:true,  shadowBlur:0,  shadowX:3, shadowY:-2, shadowColor:'#FF0050', glowEnabled:false, glowColor:'#00FFFF', letterSpacing:2,  lineHeight:1.2, textAlign:'center' },
  { label:'✨ Clean Pro',     text:'How I Did It',        fontSize:42, fontFamily:'Oswald',     fontWeight:700, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:0,  shadowEnabled:true,  shadowBlur:16, shadowX:0, shadowY:4, shadowColor:'rgba(0,0,0,0.8)', glowEnabled:false, glowColor:'#ffffff', letterSpacing:1,  lineHeight:1.3, textAlign:'left' },
  { label:'🟣 Dark Drama',    text:'THE TRUTH',           fontSize:52, fontFamily:'Anton',      fontWeight:900, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:7,  shadowEnabled:false, shadowBlur:0,  shadowX:0, shadowY:0, shadowColor:'#000000', glowEnabled:true,  glowColor:'#9333EA', letterSpacing:3,  lineHeight:1.1, textAlign:'center' },
  { label:'🌸 Retro Pop',     text:'NEW VIDEO',           fontSize:48, fontFamily:'Anton',      fontWeight:900, textColor:'#FF69B4', strokeColor:'#000000', strokeWidth:5,  shadowEnabled:true,  shadowBlur:0,  shadowX:4, shadowY:4, shadowColor:'#4400FF', glowEnabled:false, glowColor:'#FF69B4', letterSpacing:2,  lineHeight:1.2, textAlign:'center' },
  { label:'🚨 Breaking',      text:'BREAKING',            fontSize:58, fontFamily:'Anton',      fontWeight:900, textColor:'#FF0000', strokeColor:'#FFD700', strokeWidth:6,  shadowEnabled:true,  shadowBlur:24, shadowX:0, shadowY:0, shadowColor:'#FF0000', glowEnabled:true,  glowColor:'#FF0000', letterSpacing:4,  lineHeight:1.1, textAlign:'center' },
  { label:'💰 Gold Luxury',   text:'$10,000',             fontSize:54, fontFamily:'Bebas Neue', fontWeight:900, textColor:'#FFD700', strokeColor:'#8B6914', strokeWidth:4,  shadowEnabled:true,  shadowBlur:20, shadowX:0, shadowY:0, shadowColor:'#FFD700', glowEnabled:true,  glowColor:'#FFD700', letterSpacing:3,  lineHeight:1.2, textAlign:'center' },
  { label:'🦠 Viral',         text:'GONE WRONG',           fontSize:64, fontFamily:'Anton',      fontWeight:900, textColor:'#ffffff', strokeColor:'#000000', strokeWidth:12, shadowEnabled:false, shadowBlur:0,  shadowX:0, shadowY:0, shadowColor:'#000000', glowEnabled:false, glowColor:'#ffffff', letterSpacing:2,  lineHeight:1.0, textAlign:'left' },
  { label:'💀 Exposed',       text:'THE TRUTH ABOUT',      fontSize:46, fontFamily:'Anton',      fontWeight:900, textColor:'#FF0000', strokeColor:'#ffffff', strokeWidth:8,  shadowEnabled:false, shadowBlur:0,  shadowX:0, shadowY:0, shadowColor:'#000000', glowEnabled:true,  glowColor:'#FF0000', letterSpacing:3,  lineHeight:1.1, textAlign:'center' },
];

const SHAPES_BASIC = [
  { key:'rect',      label:'Rectangle', icon:'▬' },
  { key:'roundrect', label:'Rounded',   icon:'▢' },
  { key:'circle',    label:'Circle',    icon:'●' },
  { key:'triangle',  label:'Triangle',  icon:'▲' },
  { key:'star',      label:'Star',      icon:'★' },
  { key:'star6',     label:'Star 6pt',  icon:'✦' },
  { key:'arrow',     label:'Arrow →',   icon:'➤' },
  { key:'arrowleft', label:'Arrow ←',   icon:'◄' },
  { key:'diamond',   label:'Diamond',   icon:'◆' },
  { key:'hexagon',   label:'Hexagon',   icon:'⬡' },
  { key:'pentagon',  label:'Pentagon',  icon:'⬠' },
  { key:'cross',     label:'Cross',     icon:'✚' },
  { key:'heart',     label:'Heart',     icon:'♥' },
  { key:'speech',    label:'Speech',    icon:'💬' },
  { key:'badge',     label:'Badge',     icon:'🏷' },
  { key:'line',      label:'Line',      icon:'—' },
];

const VIRAL_TEMPLATES = [
  {
    id:'mrbeast',
    label:'MrBeast Style',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#FFD700,#FF6B00)', text:'WATCH THIS' },
    layers:[
      { type:'background', bgColor:'#1a1a1a', bgGradient:null },
      { type:'text', text:'YOU WON\'T', fontSize:72, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:22, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:80 },
      { type:'text', text:'BELIEVE THIS', fontSize:72, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:22, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:170 },
      { type:'shape', shape:'star', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:60, height:60, x:20, y:60 },
      { type:'shape', shape:'star', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:40, height:40, x:360, y:80 },
    ],
  },
  {
    id:'mkbhd',
    label:'MKBHD Style',
    category:'Tech',
    preview:{ bg:'linear-gradient(135deg,#000000,#1a1a1a)', text:'REVIEW' },
    layers:[
      { type:'background', bgColor:'#000000', bgGradient:null },
      { type:'shape', shape:'rect', fillColor:'#FF0000',
        strokeColor:'#FF0000', width:8, height:200, x:40, y:60 },
      { type:'text', text:'THE TRUTH', fontSize:64, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'left', x:70, y:110 },
      { type:'text', text:'ABOUT THIS', fontSize:32, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#888888',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:10, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'left', x:70, y:160 },
    ],
  },
  {
    id:'gaming_epic',
    label:'Epic Gaming',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#2c2c54,#706fd3)', text:'EPIC WIN' },
    layers:[
      { type:'background', bgColor:'#0d0d1a',
        bgGradient:['#0d0d1a','#1a1a3e'] },
      { type:'shape', shape:'star6', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:80, height:80, x:30, y:30 },
      { type:'text', text:'EPIC', fontSize:96, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#FF6B00', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:30, shadowX:4, shadowY:4,
        glowEnabled:true, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:8, lineHeight:1.2, textAlign:'center', x:100, y:80 },
      { type:'text', text:'MOMENT', fontSize:56, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:120, y:190 },
    ],
  },
  {
    id:'minecraft_glow',
    label:'Minecraft Glow',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#1a472a,#2d6a4f)', text:'MINECRAFT' },
    layers:[
      { type:'background', bgColor:'#0a1628',
        bgGradient:['#0a1628','#1a3a2a'] },
      { type:'shape', shape:'rect', fillColor:'rgba(0,150,255,0.15)',
        strokeColor:'rgba(0,150,255,0.4)', width:400, height:120, x:40, y:180 },
      { type:'text', text:'MINECRAFT', fontSize:68, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#00ff88', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#00ff88', shadowBlur:30, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#00ff88', arcEnabled:false, arcRadius:120,
        letterSpacing:3, lineHeight:1.2, textAlign:'center', x:40, y:80 },
      { type:'text', text:'BUT EVERYTHING IS DIFFERENT', fontSize:28,
        fontFamily:'Oswald', fontWeight:700, fontItalic:false,
        textColor:'#88ddff', strokeColor:'#000000', strokeWidth:2,
        shadowEnabled:true, shadowColor:'#000000', shadowBlur:12,
        shadowX:2, shadowY:2, glowEnabled:false, glowColor:'#f97316',
        arcEnabled:false, arcRadius:120, letterSpacing:1, lineHeight:1.2,
        textAlign:'center', x:60, y:180 },
    ],
  },
  {
    id:'viral_reaction',
    label:'Reaction',
    category:'Viral',
    preview:{ bg:'linear-gradient(135deg,#FF416C,#FF4B2B)', text:'WAIT WHAT' },
    layers:[
      { type:'background', bgColor:'#FF4B2B',
        bgGradient:['#FF416C','#FF4B2B'] },
      { type:'text', text:'WAIT...', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:24, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:100, y:60 },
      { type:'text', text:'WHAT?!', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:24, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:110, y:170 },
      { type:'shape', shape:'arrow', fillColor:'#FFD700',
        strokeColor:'#000000', width:120, height:40, x:20, y:150 },
    ],
  },
  {
    id:'finance',
    label:'Finance/Business',
    category:'Business',
    preview:{ bg:'linear-gradient(135deg,#0f2027,#2c5364)', text:'$1,000,000' },
    layers:[
      { type:'background', bgColor:'#0a1628',
        bgGradient:['#0a1628','#0f2027'] },
      { type:'shape', shape:'rect', fillColor:'#00C853',
        strokeColor:'#00C853', width:300, height:4, x:80, y:155 },
      { type:'text', text:'HOW I MADE', fontSize:36, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#88bbdd',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:12, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:120, y:60 },
      { type:'text', text:'$1,000,000', fontSize:76, fontFamily:'Bebas Neue',
        fontWeight:900, fontItalic:false, textColor:'#00C853',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#00C853', shadowBlur:20, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#00C853', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:100 },
      { type:'text', text:'IN 30 DAYS', fontSize:36, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:12, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:130, y:180 },
    ],
  },
  {
    id:'vlog_warm',
    label:'Vlog Warm',
    category:'Vlog',
    preview:{ bg:'linear-gradient(135deg,#f7971e,#ffd200)', text:'MY STORY' },
    layers:[
      { type:'background', bgColor:'#1a0a00',
        bgGradient:['#2d1600','#1a0a00'] },
      { type:'shape', shape:'roundrect', fillColor:'#FF6B00',
        strokeColor:'#FF6B00', width:6, height:160, x:40, y:50 },
      { type:'text', text:'my honest', fontSize:40, fontFamily:'Oswald',
        fontWeight:400, fontItalic:true, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:12, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'left', x:60, y:80 },
      { type:'text', text:'STORY', fontSize:80, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#FF6B00', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'left', x:60, y:130 },
    ],
  },
  {
    id:'clickbait',
    label:'Clickbait',
    category:'Viral',
    preview:{ bg:'linear-gradient(135deg,#FF0000,#8B0000)', text:'GONE WRONG' },
    layers:[
      { type:'background', bgColor:'#0d0000',
        bgGradient:['#1a0000','#0d0000'] },
      { type:'shape', shape:'badge', fillColor:'#FF0000',
        strokeColor:'#FFD700', width:100, height:100, x:20, y:30 },
      { type:'text', text:'GONE', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FF0000',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#FF0000', shadowBlur:24, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#FF0000', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:80, y:60 },
      { type:'text', text:'WRONG', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#FF0000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:24, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:80, y:170 },
    ],
  },
  {
    id:'tutorial',
    label:'Tutorial',
    category:'Education',
    preview:{ bg:'linear-gradient(135deg,#4776E6,#8E54E9)', text:'HOW TO' },
    layers:[
      { type:'background', bgColor:'#0a0a2e',
        bgGradient:['#0a0a2e','#1a1a4e'] },
      { type:'shape', shape:'roundrect', fillColor:'#4776E6',
        strokeColor:'#8E54E9', width:380, height:70, x:40, y:50 },
      { type:'text', text:'HOW TO', fontSize:48, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:16, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:140, y:60 },
      { type:'text', text:'DO THIS', fontSize:80, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:22, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:100, y:150 },
      { type:'text', text:'(step by step)', fontSize:24,
        fontFamily:'Oswald', fontWeight:400, fontItalic:true,
        textColor:'#aaaaff', strokeColor:'#000000', strokeWidth:2,
        shadowEnabled:true, shadowColor:'#000000', shadowBlur:10,
        shadowX:2, shadowY:2, glowEnabled:false, glowColor:'#f97316',
        arcEnabled:false, arcRadius:120, letterSpacing:1, lineHeight:1.2,
        textAlign:'center', x:160, y:240 },
    ],
  },
  {
    id:'minimal_clean',
    label:'Minimal Clean',
    category:'Lifestyle',
    preview:{ bg:'linear-gradient(135deg,#f5f5f5,#e0e0e0)', text:'SIMPLE' },
    layers:[
      { type:'background', bgColor:'#f5f0e8', bgGradient:null },
      { type:'shape', shape:'line', fillColor:'#c45c2e',
        strokeColor:'#c45c2e', width:60, height:4, x:60, y:120 },
      { type:'text', text:'SIMPLE', fontSize:72, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#1a1612',
        strokeColor:'#c45c2e', strokeWidth:2, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:16, lineHeight:1.2, textAlign:'left', x:60, y:60 },
      { type:'text', text:'& effective', fontSize:32, fontFamily:'Oswald',
        fontWeight:400, fontItalic:true, textColor:'#c45c2e',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'left', x:60, y:145 },
    ],
  },
];

const STICKER_CATEGORIES = {
  'Gaming': [
    { label:'Lightning', svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M13 2L4.5 13.5H11L10 22l9.5-12H13.5L13 2z"/></svg>' },
    { label:'Star',      svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
    { label:'Fire',      svg:'<svg viewBox="0 0 24 24" fill="#FF4500"><path d="M12 2c0 0-5 5-5 10a5 5 0 0010 0c0-2-1-4-2-5 0 2-1 3-3 3 2-3 0-8 0-8z"/></svg>' },
    { label:'Diamond',   svg:'<svg viewBox="0 0 24 24" fill="#00BFFF"><path d="M12 2L2 9l10 13 10-13-10-7z"/></svg>' },
    { label:'Crown',     svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M3 18h18l-2-8-4 4-3-6-3 6-4-4-2 8z"/></svg>' },
    { label:'Explosion', svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2l2 4 4-2-2 4 4 2-4 2 2 4-4-2-2 4-2-4-4 2 2-4-4-2 4-2-2-4 4 2 2-4z"/></svg>' },
  ],
  'Business': [
    { label:'Rocket',  svg:'<svg viewBox="0 0 24 24" fill="#f97316"><path d="M12 2c0 0 4 4 4 10l-4 2-4-2c0-6 4-10 4-10z"/><path d="M8 16l-2 4 4-2M16 16l2 4-4-2" fill="#FF6347"/></svg>' },
    { label:'Target',  svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#FF4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#FF4444"/></svg>' },
    { label:'Money',   svg:'<svg viewBox="0 0 24 24" fill="#00C853"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>' },
    { label:'Trophy',  svg:'<svg viewBox="0 0 24 24"><path d="M8 21h8m-4-4v4M12 17c-4 0-7-3-7-7V4h14v6c0 4-3 7-7 7z" fill="#FFD700"/></svg>' },
    { label:'Chart',   svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#00C853" stroke-width="2"><path d="M2 20l5-7 4 3 5-8 5 5"/><path d="M15 8h5v5"/></svg>' },
    { label:'Diamond', svg:'<svg viewBox="0 0 24 24" fill="#00BCD4"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/></svg>' },
  ],
  'Nature': [
    { label:'Sun',      svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/></svg>' },
    { label:'Moon',     svg:'<svg viewBox="0 0 24 24" fill="#C0C0C0"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>' },
    { label:'Wave',     svg:'<svg viewBox="0 0 24 24" fill="#0088CC"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0v8H2v-8z"/></svg>' },
    { label:'Leaf',     svg:'<svg viewBox="0 0 24 24" fill="#00C853"><path d="M17 8C8 10 5 16 5 21c5-2 9-6 12-13z"/></svg>' },
    { label:'Snow',     svg:'<svg viewBox="0 0 24 24" stroke="#00BFFF" stroke-width="1.5" fill="none"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><circle cx="12" cy="12" r="2" fill="#00BFFF"/></svg>' },
    { label:'Mountain', svg:'<svg viewBox="0 0 24 24" fill="#6B8E23"><path d="M2 20L9 7l4 6 3-4 6 11H2z"/></svg>' },
  ],
  'Arrows': [
    { label:'Up',    svg:'<svg viewBox="0 0 24 24" fill="#00C853"><path d="M12 4l8 8h-5v8H9v-8H4l8-8z"/></svg>' },
    { label:'Right', svg:'<svg viewBox="0 0 24 24" fill="#2196F3"><path d="M20 12l-8 8v-5H4V9h8V4l8 8z"/></svg>' },
    { label:'Check', svg:'<svg viewBox="0 0 24 24" fill="#00C853"><circle cx="12" cy="12" r="10"/><path d="M7 12l4 4 6-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>' },
    { label:'Cross', svg:'<svg viewBox="0 0 24 24" fill="#FF4444"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>' },
    { label:'Burst', svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2l1.5 4 4-1.5-1.5 4 4 1.5-4 1.5 1.5 4-4-1.5-1.5 4-1.5-4-4 1.5 1.5-4-4-1.5 4-1.5-1.5-4 4 1.5L12 2z"/></svg>' },
    { label:'Badge', svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l2.5 7H22l-6 4.5 2.5 7L12 17l-6.5 3.5 2.5-7L2 9h7.5L12 2z"/></svg>' },
  ],
  'Food': [
    { label:'Pizza',   svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2L2 20h20L12 2z"/><circle cx="10" cy="14" r="1.5" fill="#8B0000"/><circle cx="14" cy="12" r="1.5" fill="#8B0000"/></svg>' },
    { label:'Coffee',  svg:'<svg viewBox="0 0 24 24" fill="#795548"><path d="M4 10h12v7a4 4 0 01-4 4H8a4 4 0 01-4-4v-7z"/><path d="M16 12h2a2 2 0 010 4h-2"/></svg>' },
    { label:'Burger',  svg:'<svg viewBox="0 0 24 24"><path d="M5 10c0-4 14-4 14 0" fill="#D2691E"/><rect x="3" y="12" width="18" height="3" rx="1" fill="#8B4513"/><path d="M5 18c0 2 14 2 14 0" fill="#D2691E"/></svg>' },
    { label:'Cake',    svg:'<svg viewBox="0 0 24 24" fill="#FFB6C1"><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 13V9a5 5 0 0110 0v4" fill="#FF69B4"/><circle cx="12" cy="3" r="1.5" fill="#FF4444"/></svg>' },
    { label:'Lemon',   svg:'<svg viewBox="0 0 24 24" fill="#FFE135"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>' },
    { label:'Avocado', svg:'<svg viewBox="0 0 24 24" fill="#90EE90"><path d="M12 2c-4 0-7 4-7 9s3 9 7 9 7-4 7-9-3-9-7-9z"/><circle cx="12" cy="13" r="3" fill="#8B4513"/></svg>' },
  ],
};

const ALL_COMMANDS = [
  { cmd:'text "..."',    desc:'Add text layer' },
  { cmd:'bg #color',     desc:'Set background color' },
  { cmd:'font Name',     desc:'Set font family' },
  { cmd:'size 48',       desc:'Set font size' },
  { cmd:'opacity 80',    desc:'Set layer opacity' },
  { cmd:'circle',        desc:'Add circle' },
  { cmd:'rect',          desc:'Add rectangle' },
  { cmd:'triangle',      desc:'Add triangle' },
  { cmd:'star',          desc:'Add star' },
  { cmd:'arrow',         desc:'Add arrow' },
  { cmd:'duplicate',     desc:'Duplicate selected' },
  { cmd:'delete',        desc:'Delete selected' },
  { cmd:'hide',          desc:'Hide selected' },
  { cmd:'show',          desc:'Show selected' },
  { cmd:'up',            desc:'Move layer up' },
  { cmd:'down',          desc:'Move layer down' },
  { cmd:'flip h',        desc:'Flip horizontal' },
  { cmd:'flip v',        desc:'Flip vertical' },
  { cmd:'align center',  desc:'Center on canvas' },
  { cmd:'align left',    desc:'Align left' },
  { cmd:'align right',   desc:'Align right' },
  { cmd:'align top',     desc:'Align top' },
  { cmd:'align bottom',  desc:'Align bottom' },
  { cmd:'blend multiply',desc:'Set blend mode' },
  { cmd:'zoom 150',      desc:'Set zoom %' },
  { cmd:'grid',          desc:'Toggle grid' },
  { cmd:'snap',          desc:'Toggle snap' },
  { cmd:'ruler',         desc:'Toggle rulers' },
  { cmd:'new',           desc:'New canvas' },
  { cmd:'save',          desc:'Save design' },
  { cmd:'undo',          desc:'Undo' },
  { cmd:'redo',          desc:'Redo' },
  { cmd:'help',          desc:'Show all commands' },
];

function defaultEffects(){
  return{
    layerBlur:0,brightness:100,contrast:100,saturation:100,
    shadow:{enabled:false,x:4,y:4,blur:12,color:'#000000',opacity:60},
    dropShadow:{enabled:false,x:0,y:0,blur:0,color:'#ffffff',opacity:100,spread:0},
    glow:{enabled:false,color:'#f97316',blur:20},
    outline:{enabled:false,color:'#ffffff',width:2},
    subjectOutline:{enabled:false,color:'#ffffff',width:5},
    mask:{enabled:false,inverted:false,data:null},
  };
}

function getEffectsStyle(effects){
  if(!effects)return{};
  const filters=[];
  if(effects.layerBlur>0)      filters.push(`blur(${effects.layerBlur}px)`);
  if(effects.brightness!==100) filters.push(`brightness(${effects.brightness}%)`);
  if(effects.contrast!==100)   filters.push(`contrast(${effects.contrast}%)`);
  if(effects.saturation!==100) filters.push(`saturate(${effects.saturation}%)`);
  const shadows=[];
  if(effects.shadow?.enabled){
    const r=parseInt(effects.shadow.color.slice(1,3),16)||0;
    const g=parseInt(effects.shadow.color.slice(3,5),16)||0;
    const b=parseInt(effects.shadow.color.slice(5,7),16)||0;
    const rgba=`rgba(${r},${g},${b},${(effects.shadow.opacity||60)/100})`;
    shadows.push(`${effects.shadow.x}px ${effects.shadow.y}px ${effects.shadow.blur}px ${rgba}`);
    filters.push(`drop-shadow(${effects.shadow.x||0}px ${effects.shadow.y||0}px ${effects.shadow.blur||12}px ${rgba})`);
  }
  if(effects.dropShadow?.enabled){
    const dsColor=effects.dropShadow.color||'#ffffff';
    const dsOpacity=(effects.dropShadow.opacity??100)/100;
    const r=parseInt(dsColor.slice(1,3),16)||255;
    const g=parseInt(dsColor.slice(3,5),16)||255;
    const b=parseInt(dsColor.slice(5,7),16)||255;
    const rgba=`rgba(${r},${g},${b},${dsOpacity})`;
    const spread=Math.max(0,Math.round(Number(effects.dropShadow.spread||0)));
    const blur=Math.max(0,Math.round(Number(effects.dropShadow.blur||0)));
    const x=Math.round(Number(effects.dropShadow.x||0));
    const y=Math.round(Number(effects.dropShadow.y||0));
    const singleBlur=Math.max(blur, spread*2);
    filters.push(`drop-shadow(${x}px ${y}px ${singleBlur}px ${rgba})`);
  }
  if(effects.glow?.enabled){
    shadows.push(`0 0 ${effects.glow.blur}px ${effects.glow.color}`);
    shadows.push(`0 0 ${effects.glow.blur*2}px ${effects.glow.color}`);
    filters.push(`drop-shadow(0 0 ${Math.ceil((effects.glow.blur||20)/3)}px ${effects.glow.color})`);
  }
  const style={};
  if(filters.length)style.filter=filters.join(' ');
  if(shadows.length)style.boxShadow=shadows.join(',');
  if(effects.outline?.enabled&&effects.outline.width>0){
    style.outline=`${effects.outline.width}px solid ${effects.outline.color}`;
    style.outlineOffset='2px';
  }
  if(effects.subjectOutline?.enabled&&effects.subjectOutline.width>0){
    const sc=effects.subjectOutline.color||'#ffffff';
    const glowBlur=Math.max(20, (effects.subjectOutline.width||5)*2);
    const outlineFilter=`drop-shadow(0 0 ${glowBlur}px ${sc})`;
    style.filter = style.filter ? `${outlineFilter} ${style.filter}` : outlineFilter;
  }
  return style;
}

function renderShapeSVG(shape,fillColor,strokeColor,width,height){
  const w=width||100,h=height||100,fill=fillColor||'#FF4500',stroke=strokeColor||'#000';
  switch(shape){
    case 'rect':      return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:3}}/>;
    case 'roundrect': return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:Math.min(w,h)*0.2}}/>;
    case 'circle':    return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:'50%'}}/>;
    case 'triangle':  return<div style={{width:0,height:0,borderLeft:`${w/2}px solid transparent`,borderRight:`${w/2}px solid transparent`,borderBottom:`${h}px solid ${fill}`}}/>;
    case 'star':      return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'star6':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,28 86,15 73,40 98,50 73,60 86,85 61,72 50,95 39,72 14,85 27,60 2,50 27,40 14,15 39,28" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'arrow':     return<svg width={w} height={40} viewBox={`0 0 ${w} 40`}><polygon points={`0,15 ${w-20},15 ${w-20},5 ${w},20 ${w-20},35 ${w-20},25 0,25`} fill={fill} stroke={stroke} strokeWidth="1"/></svg>;
    case 'arrowleft': return<svg width={w} height={40} viewBox={`0 0 ${w} 40`}><polygon points={`${w},15 20,15 20,5 0,20 20,35 20,25 ${w},25`} fill={fill} stroke={stroke} strokeWidth="1"/></svg>;
    case 'diamond':   return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'hexagon':   return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'pentagon':  return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 97,40 79,95 21,95 3,40" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'cross':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'heart':     return<svg width={w} height={h} viewBox="0 0 100 100"><path d="M50 85 C20 65 5 50 5 35 C5 20 15 10 30 10 C38 10 45 15 50 22 C55 15 62 10 70 10 C85 10 95 20 95 35 C95 50 80 65 50 85Z" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'speech':    return<svg width={w} height={h} viewBox="0 0 100 100"><path d="M10 10 Q10 5 15 5 L85 5 Q90 5 90 10 L90 65 Q90 70 85 70 L30 70 L15 90 L20 70 L15 70 Q10 70 10 65 Z" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'badge':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} stroke={stroke} strokeWidth="2"/><circle cx="50" cy="50" r="18" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
    case 'line':      return<svg width={w} height={8} viewBox={`0 0 ${w} 8`}><line x1="0" y1="4" x2={w} y2="4" stroke={fill} strokeWidth="4" strokeLinecap="round"/></svg>;
    default:          return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:3}}/>;
  }
}

let idCounter=1;
function newId(){return idCounter++;}
function getLayerIcon(obj){if(obj.type==='background')return'▣';if(obj.type==='text')return'T';if(obj.type==='shape')return'○';if(obj.type==='svg')return'◆';if(obj.type==='image')return'▤';return'▪';}
function getLayerColor(obj){if(obj.type==='background')return obj.bgColor||'#f97316';if(obj.type==='text')return obj.textColor||'#fff';if(obj.type==='shape')return obj.fillColor||'#FF4500';return'#555';}
function getLayerName(obj){if(obj.type==='background')return'Background';if(obj.type==='text')return obj.text?.slice(0,18)||'Text';if(obj.type==='shape')return(obj.shape?.charAt(0).toUpperCase()+obj.shape?.slice(1))||'Shape';if(obj.type==='svg')return obj.label||'Element';if(obj.type==='image')return'Image';return'Layer';}

function getSafeImageSrc(layer){
  const raw = (layer?.paintSrc || layer?.src || '').toString().trim();
  if(!raw) return null;
  if(/^data:image\//i.test(raw)) return raw;
  if(/^blob:/i.test(raw)) return raw;
  if(/^https?:\/\//i.test(raw)) return raw;
  if(raw.startsWith('/')) return raw;
  return null;
}

class CanvasErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }

  static getDerivedStateFromError(){
    return {hasError:true};
  }

  componentDidCatch(error, info){
    console.error('[Canvas ErrorBoundary] Canvas render failed:', error, info);
  }

  render(){
    if(this.state.hasError){
      return (
        <div style={{
          width:'100%',
          maxWidth:700,
          minHeight:220,
          border:'1px solid rgba(255,255,255,0.15)',
          borderRadius:8,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          flexDirection:'column',
          gap:8,
          color:'#d1d5db',
          background:'rgba(0,0,0,0.22)',
          padding:18,
          textAlign:'center',
        }}>
          <div style={{fontSize:16,fontWeight:'700'}}>Canvas render error</div>
          <div style={{fontSize:12,opacity:0.85}}>A layer failed to render. Remove the last edited image and try again.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ArcText({obj}){
  const ts=(()=>{const p=[];if(obj.shadowEnabled)p.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)p.push(`0 0 20px ${obj.glowColor||'#f97316'}`);return p.length?p.join(','):'none';})();
  const base={fontFamily:resolveFontFamily(obj.fontFamily),fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,fontStyle:obj.fontItalic?'italic':'normal',color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',paintOrder:'stroke fill',textShadow:ts,whiteSpace:'nowrap',letterSpacing:`${obj.letterSpacing||0}px`};
  if(!obj.arcEnabled||!obj.text)return<span style={base}>{obj.text}</span>;
  const radius=obj.arcRadius||120,chars=obj.text.split(''),step=(obj.fontSize||48)/radius*1.1,start=-(chars.length-1)*step/2;
  return(<div style={{position:'relative',width:radius*2+60,height:radius+60}}>{chars.map((ch,i)=>{const angle=start+i*step-Math.PI/2,x=radius+Math.cos(angle)*radius,y=radius+Math.sin(angle)*radius+30,rot=(angle+Math.PI/2)*180/Math.PI;return<span key={i} style={{position:'absolute',left:x,top:y,transform:`translate(-50%,-50%) rotate(${rot}deg)`,...base,lineHeight:1}}>{ch}</span>;})}</div>);
}

// ✅ Slider — uses pointer capture so drag works even when mouse leaves the element
function Slider({min,max,step,value,onChange,onCommit,style}){
  const ref=useRef(null);
  const dragging=useRef(false);
  useEffect(()=>{
    if(ref.current&&!dragging.current)ref.current.value=String(value);
  },[value]);
  return(
    <input ref={ref} type="range" min={min} max={max} step={step||1} defaultValue={value} style={style}
      onPointerDown={e=>{
        dragging.current=true;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e=>{
        if(!dragging.current)return;
        onChange(Number(e.currentTarget.value));
      }}
      onPointerUp={e=>{
        dragging.current=false;
        const v=Number(e.currentTarget.value);
        onChange(v);
        if(onCommit)onCommit(v);
      }}
    />
  );
}

function debounce(fn, wait){
  let timer = null;
  const debounced = (...args)=>{
    if(timer) clearTimeout(timer);
    timer = setTimeout(()=>fn(...args), wait);
  };
  debounced.cancel = ()=>{
    if(timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

export default function Editor({onExit, user, token, apiUrl, brandKit: initialBrandKit}){
  const resolvedApiUrl = (apiUrl || process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
  const [layers,setLayersRaw]              = useState([]);
  const canvasRef       = useRef(null);
  const brushOverlayRef = useRef(null);
  const cmdInputRef     = useRef(null);
  const justSelectedRef = useRef(false);
  const draggingRef     = useRef(null);
  const rimPaintingRef  = useRef(false);
  const resizingRef     = useRef(null);
  const dragOffsetRef   = useRef({x:0,y:0});
  const resizeStartRef  = useRef(null);
  const zoomRef         = useRef(1);
  const layersRef       = useRef(layers);
  const mountedRef = useRef(true);
  const currentDesignIdRef = useRef(null);
  const lastSavedSignatureRef = useRef('');
  const saveStatusTimerRef = useRef(null);
  const deletedIdsRef = useRef(new Set());
  const isSavingRef = useRef(false);
  const lassoDrawingRef = useRef(false);
  const lassoPointsRef  = useRef([]);
  const lassoSvgRef     = useRef(null);
  const lassoFeatherRef = useRef(0);
  const lassoInvertRef  = useRef(false);
  const freehandDrawingRef = useRef(false);
  const freehandPointsRef  = useRef([]);
  const freehandSvgRef     = useRef(null);
  const draftStateRef = useRef(null);
  const draftHydratedRef = useRef(false);
  const saveMetaRef = useRef({});
  // Performance: Mouse tracking refs to avoid re-renders
  const mouseRef        = useRef({x:0,y:0});
  const lastRimLightRef = useRef(0);
  const rafIdRef        = useRef(null);
  const wheelRafRef     = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const rafId = rafIdRef.current;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const [platform,setPlatform]             = useState('youtube');
  const [activeTool,setActiveTool]         = useState('select');
  const [activeCategory,setActiveCategory] = useState('Gaming');
  const [darkMode,setDarkMode]             = useState(true);
  const [selectedId,setSelectedId]         = useState(null);
  const [zoom,setZoom]                     = useState(1);
  const [panOffset,setPanOffset]           = useState({x:0,y:0});
  const [showGrid,setShowGrid]             = useState(false);
  const [showRuler,setShowRuler]           = useState(false);
  const [showSafeZones,setShowSafeZones]   = useState(false);
  const [showStampTest,setShowStampTest]   = useState(false);
  const [snapToGrid,setSnapToGrid]         = useState(false);
  const lockAspect                         = false;
  const [recentColors,setRecentColors]     = useState(['#ffffff','#000000','#FF4500','#f97316','#FFD700','#00C853']);
  const [savedPalette,setSavedPalette]     = useState([]);
  const [clipboard,setClipboard]           = useState(null);
  const [showFileTab,setShowFileTab]       = useState(false);
  const [showDownload,setShowDownload]     = useState(false);
  const [savedDesigns,setSavedDesigns]     = useState([]);
  const [designName,setDesignName]         = useState('My Design');
  const [transparentExport,setTransparentExport] = useState(false);
  const [textInput,setTextInput]           = useState('MY THUMBNAIL');
  const [fontSize,setFontSize]             = useState(48);
  const [fontFamily,setFontFamily]         = useState('Anton');
  const [fontWeight,setFontWeight]         = useState(900);
  const [fontItalic,setFontItalic]         = useState(false);
  const [letterSpacing,setLetterSpacing]   = useState(0);
  const [lineHeight,setLineHeight]         = useState(1.2);
  const [textAlign,setTextAlign]           = useState('left');
  const [shadowEnabled,setShadowEnabled]   = useState(true);
  const [shadowColor,setShadowColor]       = useState('#000000');
  const [shadowBlur,setShadowBlur]         = useState(15);
  const [shadowX,setShadowX]               = useState(3);
  const [shadowY,setShadowY]               = useState(3);
  const [glowEnabled,setGlowEnabled]       = useState(false);
  const [glowColor,setGlowColor]           = useState('#f97316');
  const [arcEnabled,setArcEnabled]         = useState(false);
  const [arcRadius,setArcRadius]           = useState(120);
  const [textColor,setTextColor]           = useState('#ffffff');
  const [strokeColor,setStrokeColor]       = useState('#000000');
  const [strokeWidth,setStrokeWidth]       = useState(5);
  const [fillColor,setFillColor]           = useState('#FF4500');
  const [brightness,setBrightness]         = useState(100);
  const [contrast,setContrast]             = useState(100);
  const [saturation,setSaturation]         = useState(100);
  const [hue,setHue]                       = useState(0);
  const [rgbR,setRgbR]                     = useState(108);
  const [rgbG,setRgbG]                     = useState(99);
  const [rgbB,setRgbB]                     = useState(255);
  const [cmdInput,setCmdInput]             = useState('');
  const [cmdLog,setCmdLog]                 = useState('');
  const [cmdHistory,setCmdHistory]         = useState([]);
  const [cmdHistoryIdx,setCmdHistoryIdx]   = useState(-1);
  const [cmdSuggestions,setCmdSuggestions] = useState([]);
  const [cmdOpen,setCmdOpen]               = useState(false);
  const [showCmdHelp,setShowCmdHelp]       = useState(false);
  const [history,setHistory]               = useState([]);
  const [historyIndex,setHistoryIndex]     = useState(-1);
  const historyRef                         = useRef([]);
  const historyIndexRef                    = useRef(-1);
  const historyDebounceRef                 = useRef(null);
  const [layerDragId,setLayerDragId]       = useState(null);
  const [layerDragOver,setLayerDragOver]   = useState(null);
  const [brushTypeState,setBrushTypeState]             = useState('blur');
  const [brushSizeState,setBrushSizeState]             = useState(20);
  const [brushStrengthState,setBrushStrengthState]     = useState(50);
  const [brushEdgeState,setBrushEdgeState]             = useState('soft');
  const [brushColorState,setBrushColorState]           = useState('#ff0000');
  const [brushColorAlpha,setBrushColorAlpha]           = useState(100);
  const [rimLightColor,setRimLightColor]       = useState('#00aaff');
  const [rimLightSize,setRimLightSize]         = useState(40);
  const [rimLightIntensity,setRimLightIntensity] = useState(80);
  const [rimLightSoftness,setRimLightSoftness] = useState(70);
  const [rimLightBlend,setRimLightBlend]       = useState('screen');
  const [rimPickingColor,setRimPickingColor] = useState(false);
  const [rimPickedFrom,setRimPickedFrom]     = useState(null);
  const [ctrScore,setCtrScore]     = useState(null);
  const [ctrBreakdown,setCtrBreakdown] = useState(null);
  const [ctrLoading,setCtrLoading] = useState(false);
  const [abVariants,setAbVariants]   = useState([]);
  const [abLoading,setAbLoading]     = useState(false);
  const [abSelected,setAbSelected]   = useState(null);
  const [resizeExporting,setResizeExporting] = useState(false);
  const [ytConnected,setYtConnected]       = useState(()=>{
    // Check if we have a stored YouTube token from a previous OAuth flow
    return !!localStorage.getItem('yt_access_token');
  });
  const [ytTests,setYtTests]               = useState([]);
  const [ytVideoUrl,setYtVideoUrl]         = useState('');
  const [ytTestDuration,setYtTestDuration] = useState('24h');
  const [ytTestStatus,setYtTestStatus]     = useState(null);
  const [resizeProgress,setResizeProgress]   = useState('');
  const [faceAnalysis,setFaceAnalysis]   = useState(null);
  const [faceLoading,setFaceLoading]     = useState(false);
  const [aiCmd,setAiCmd]           = useState('');
  const [aiCmdLoading,setAiCmdLoading] = useState(false);
  const [aiCmdLog,setAiCmdLog]     = useState('');
  const [showAiBar,setShowAiBar]   = useState(false);
  const aiCmdInputRef              = useRef(null);
  const [maskingLayerId,setMaskingLayerId] = useState(null); // eslint-disable-line no-unused-vars
  const [maskPaintColor,setMaskPaintColor] = useState('#000000'); // eslint-disable-line no-unused-vars
  const [isLassoMode,setIsLassoMode]       = useState(false);
  const [freeBrushColor,setFreeBrushColor] = useState('#ff4500');
  const [freeBrushSize,setFreeBrushSize]   = useState(8);
  const [brushFlowState,setBrushFlowState]             = useState(100);
  const [brushStabilizerState,setBrushStabilizerState] = useState(0);

  const [showBrandKitSetup,setShowBrandKitSetup]       = useState(false);
  const [brandKit,setBrandKit]                         = useState(initialBrandKit||null);
  const [brandKitColors,setBrandKitColors]             = useState({primary:'#c45c2e',secondary:'#f97316'});
  const [brandKitFace,setBrandKitFace]                 = useState(null);
  const [brandKitLoading,setBrandKitLoading]           = useState(false);

  const [showPaywall,setShowPaywall]                   = useState(false); // eslint-disable-line no-unused-vars
  const [showAlreadyPro,setShowAlreadyPro]             = useState(false);
  const [isProUser,setIsProUser]                       = useState(!!(token==='test-key-123'||user?.is_admin||user?.email==='kadengajkowski@gmail.com'));
  const [isLoading,setIsLoading]                       = useState(true);
  const [removeBgBusy,setRemoveBgBusy]                 = useState(false);
  const [segmentMasks,setSegmentMasks]                 = useState([]);
  const [segmentBusy,setSegmentBusy]                   = useState(false);
  const [segmentHoverIdx,setSegmentHoverIdx]           = useState(null);
  const [segmentStatus,setSegmentStatus]               = useState('');
  const [segmentError,setSegmentError]                 = useState('');
  const [saveStatus, setSaveStatus]                    = useState('Saved');
  const [aiPrompt,setAiPrompt]                         = useState('');
  const [lastGeneratedImageUrl,setLastGeneratedImageUrl] = useState('');
  const [projectId,setProjectId]                       = useState(null);
  const [currentDesignId,setCurrentDesignId]           = useState(null);
  const setCurrentProjectId = setCurrentDesignId;

  const [expandedCategories,setExpandedCategories]     = useState({Tools:true,Create:true,Paint:true,Design:true,Analyze:true,File:true,Canvas:true});
  const [showToast,setShowToast]                       = useState(false);
  const [toastMessage]                                 = useState('');
  const [toastType]                                    = useState('info');

  function setLayers(val){
    if(typeof val==='function'){
      setLayersRaw(prev=>{const next=val(prev);layersRef.current=next;return next;});
    }else{
      layersRef.current=val;
      setLayersRaw(val);
    }
  }

  useEffect(()=>{
    layersRef.current = layers;
  },[layers]);

  // ── Sprint 3: Layers Panel sync plan ──────────────────────────────────────
  useEffect(()=>{
    console.log(
`[LAYERS PANEL SYNC PLAN]
Architecture: Pure React state — NO Fabric.js required.

PHASE 1 — State Source of Truth:
  • layers[] is the single source of truth (React useState)
  • layersRef.current mirrors it for non-reactive contexts
  • Every mutation (add/remove/move/update) goes through setLayers()
  • No event listeners needed — React re-renders propagate all changes automatically

PHASE 2 — Dedicated Right Sidebar:
  • New 3rd flex column (w:210) added to the right of the tool-options panel
  • Layers rendered via [...layers].reverse() — top canvas layer appears first (Photoshop order)

PHASE 3 — Per-Layer Controls:
  • Eye (●/○)    → updateLayer(id, { hidden: !hidden })
  • Lock (🔒/🔓) → updateLayer(id, { locked: !locked })
  • ▲ Bring fwd  → moveLayerUp(id)   — swaps layer[idx] with layer[idx+1]
  • ▼ Send back  → moveLayerDown(id) — swaps layer[idx] with layer[idx-1]
  • 🗑 Delete    → deleteLayer(id)   — removes from layers[], pushes undo history

PHASE 4 — Selection Hook:
  • Click row → setSelectedId(id) → canvas re-renders with selection handles
  • Background layer click also triggers setActiveTool('background')

Guards:
  • Background layer: lock toggle + delete button are hidden
  • ▲ disabled at top of stack; ▼ disabled at bottom / for background layer`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // run once on mount

  // ── Sprint 4: Selected Object Specs panel + Freehand Brush plan ─────────
  useEffect(()=>{
    console.log(
`[SPRINT 4 — SELECTED OBJECT SPECS + FREEHAND BRUSH PLAN]

PHASE 1 — MrBeast Typography Defaults (addText()):
  • fontFamily : Anton (or brandKit.primary_font)
  • textColor  : #FFD700 (YouTube gold) — was #FFFFFF
  • strokeWidth: 8, strokeColor: #000000 (strokeUniform = CSS paint-order: stroke fill)
  • shadow     : color rgba(0,0,0,0.8), blur 15, offsetX 0, offsetY 10

PHASE 2 — Selected Object Specs / Neon Glow (Sprint 3 Layers Panel):
  • Renders when selectedLayer !== null
  • Shows layer name, type badge, and quick-action buttons
  • ⚡ Neon Glow button:
      text layers  → updateLayer(id, { glowEnabled: true, glowColor: '#00ffff' })
      image layers → updateLayerEffect(id, 'glow', { enabled: true, color: '#00ffff', blur: 30 })
  • Acts as a toggle: second click turns glow off

PHASE 3 — Freehand Brush (activeTool='freehand'):
  • New tool entry in Paint group: key='freehand', icon='✏'
  • State: freeBrushColor (#ff4500), freeBrushSize (8)
  • Refs:  freehandDrawingRef, freehandPointsRef, freehandSvgRef
  • onMouseDown  → start collecting points
  • onMouseMove  → push points, update live SVG polyline preview
  • onMouseUp    → render points to offscreen canvas (p.preview.w × p.preview.h)
                   → addLayer({ type:'image', src: dataUrl, ... })
                   → layer auto-appears in Sprint 3 panel (React state propagation)
  • pointerEvents on layers div: 'none' when freehand active (same as brush/zoom/lasso)
  • Layer sync: NO manual syncLayers() call needed — addLayer() calls setLayers() which
    re-renders the Sprint 3 Layers Panel automatically`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // run once on mount

  // ── Sprint 5: WebGL filter plan (printed before code modification) ───────
  useEffect(()=>{
    console.log(
`[SPRINT 5 — A/B VARIANT EXPORT ENGINE PLAN]

IMAGE FILTER ARCHITECTURE (HTML5 Canvas 2D — Fabric WebGL equivalents):
  Fabric Brightness filter: new fabric.filters.Brightness({ brightness: -0.2 })
    → Our equivalent: layer.imgBrightness = 80  (100 + (-0.2 * 100) = 80%)
    → Renderer: ctx.filter = "brightness(80%)" — applied per-image draw call

  Fabric Blur filter: new fabric.filters.Blur({ blur: 0.1 })
    → Our equivalent: layer.imgBlur = 8  (0.1 * 80px scale factor)
    → Renderer: ctx.filter = "blur(8px)" — applied per-image draw call

  obj.applyFilters() + canvas.renderAll() equivalent:
    → Our renderer reads imgBrightness/imgBlur from the layer object directly
    → No imperative "applyFilters" step needed — declarative layer state drives rendering

PHASE 1 — renderAtScale(layerSnapshot, multiplier):
  • multiplier=1  → p.width × p.height    (1280×720 YouTube native)
  • multiplier=2  → 2560×1440             (enterprise 2K)
  • renderLayersToCanvas handles all scaling internally

PHASE 2 — State Preservation:
  • originalState = JSON.parse(JSON.stringify(layersRef.current))
  • Variant arrays are NEW objects — React state is NEVER mutated during pipeline
  • Restore verification: layersRef.current.length === originalState.length

PHASE 3 — Variant Math:
  • A (Base)      : deep-clone of originalState — zero modifications
  • B (Panic)     : background imgBrightness=80, non-subject images dim to 80%,
                    subject +12% scale + cyan glow, text → #FFD700
  • C (Curiosity) : background images imgBlur=8 imgBrightness=70,
                    text/shapes hidden=true, subject contrast+sat boost + white glow

PHASE 4 — Toolbar button:
  • 'generateAndExportVariants()' triggered from top toolbar ⚡ button
  • Shows spinner via variantExporting state
  • Downloads JPEG ZIP at 2x (2560×1440) — no canvas mutation`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // run once on mount

  const saveProjectRef = useRef(null);
  const debouncedSaveRef = useRef(null);
  const triggerAutoSave = useCallback(() => {
    if(debouncedSaveRef.current){
      debouncedSaveRef.current();
    }
  }, []);

  const p  = PLATFORMS[platform];

  saveMetaRef.current = {
    aiPrompt,
    brandKitColors,
    brightness,
    contrast,
    designName,
    fillColor,
    hue,
    lastGeneratedImageUrl,
    platform,
    projectId,
    saturation,
    strokeColor,
    textColor,
  };

  const buildProjectSnapshot = useCallback((layerSnapshot = layersRef.current)=>(
    {
      projectId,
      currentDesignId: currentDesignIdRef.current,
      platform,
      layers: JSON.parse(JSON.stringify(layerSnapshot)),
      brightness,
      contrast,
      saturation,
      hue,
      designName,
      aiPrompt,
      lastGeneratedImageUrl,
      textColor,
      strokeColor,
      fillColor,
      brandKitColors,
    }
  ),[aiPrompt, brandKitColors, brightness, contrast, designName, fillColor, hue, lastGeneratedImageUrl, platform, projectId, saturation, strokeColor, textColor]);

  const buildSaveSignature = useCallback((snapshot)=>{
    return JSON.stringify({
      projectId: snapshot?.projectId || null,
      platform: snapshot?.platform || 'youtube',
      designName: snapshot?.designName || '',
      layers: snapshot?.layers || [],
      brightness: snapshot?.brightness ?? 100,
      contrast: snapshot?.contrast ?? 100,
      saturation: snapshot?.saturation ?? 100,
      hue: snapshot?.hue ?? 0,
      aiPrompt: snapshot?.aiPrompt || '',
      lastGeneratedImageUrl: snapshot?.lastGeneratedImageUrl || '',
    });
  },[]);

  function persistSavedDesigns(nextDesign){
    setSavedDesigns(prevList=>{
      const list = Array.isArray(prevList) ? prevList : [];
      const targetId = nextDesign?.id || nextDesign?.currentDesignId || nextDesign?.projectId || null;
      if(!targetId){
        return [...list, nextDesign].slice(0,20);
      }

      const existingIndex = list.findIndex(item => (
        item?.id===targetId ||
        item?.currentDesignId===targetId ||
        item?.projectId===targetId
      ));

      if(existingIndex>=0){
        return list.map((item, idx)=>idx===existingIndex
          ? {
              ...item,
              ...nextDesign,
              last_edited: nextDesign?.last_edited || new Date().toISOString(),
            }
          : item);
      }

      return [...list, {
        ...nextDesign,
        last_edited: nextDesign?.last_edited || new Date().toISOString(),
      }].slice(0,20);
    });
  }

  const generateDesignThumbnail = useCallback(async (quality=1.0)=>{
    try{
      const layerSnapshot = JSON.parse(JSON.stringify(layersRef.current));
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 640;
      tmpCanvas.height = Math.round(640 * p.preview.h / p.preview.w);
      const tctx = tmpCanvas.getContext('2d');
      if(!tctx)return null;

      const sx = tmpCanvas.width / p.preview.w;
      const sy = tmpCanvas.height / p.preview.h;
      const bgLayer = layerSnapshot.find(l=>l.type==='background');

      if(bgLayer){
        if(bgLayer.bgGradient){
          const gradient=tctx.createLinearGradient(0,0,0,tmpCanvas.height);
          gradient.addColorStop(0,bgLayer.bgGradient[0]);
          gradient.addColorStop(1,bgLayer.bgGradient[1]);
          tctx.fillStyle=gradient;
        }else{
          tctx.fillStyle=bgLayer.bgColor||'#f97316';
        }
        tctx.fillRect(0,0,tmpCanvas.width,tmpCanvas.height);
      }

      const imageLayers = layerSnapshot.filter(layer=>layer.type==='image'&&!layer.hidden);
      await Promise.all(imageLayers.map(layer=>
        new Promise(resolve=>{
          const imageSrc = getSafeImageSrc(layer);
          if(!imageSrc){
            resolve();
            return;
          }
          const img=new Image();
          img.crossOrigin='Anonymous';
          img.onload=()=>{
            tctx.drawImage(img, layer.x*sx, layer.y*sy, layer.width*sx, layer.height*sy);
            resolve();
          };
          img.onerror=()=>resolve();
          img.src=imageSrc;
        })
      ));

      let dataUrl;
      try{
        dataUrl = tmpCanvas.toDataURL('image/jpeg',quality);
      }catch(err){
        console.error('[THUMBNAIL] toDataURL failed:', {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        });
        throw err;
      }
      console.log('[THUMBNAIL] Generated OK, length:', dataUrl?.length);
      return dataUrl;
    }catch(err){
      console.error('[SAVE PROJECT] Thumbnail generation failed:', err?.message || err, err);
      return null;
    }
  },[p.preview.h, p.preview.w]);

  const fetchSavedDesigns = useCallback(async ()=>{
    const userEmail = user?.email;
    if(!userEmail){
      setSavedDesigns([]);
      return;
    }

    try{
      const endpoint = `${resolvedApiUrl}/designs/list?email=${encodeURIComponent(userEmail)}`;
      const response = await fetch(endpoint);
      if(!response.ok){
        throw new Error(`Design list request failed (${response.status})`);
      }

      const payload = await response.json().catch(()=>[]);
      const rows = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : []);

      const normalized = rows.map((row)=>{
        const jsonData = row?.json_data;
        const layersFromJson = Array.isArray(jsonData)
          ? jsonData
          : (Array.isArray(jsonData?.layers) ? jsonData.layers : []);
        const normalizedName =
          row?.name ||
          (typeof jsonData?.name==='string' && jsonData.name.trim() ? jsonData.name.trim() : '') ||
          'Untitled Project';

        return {
          id:row?.id,
          currentDesignId:row?.id,
          projectId:row?.id,
          name:normalizedName,
          created:row?.last_edited ? new Date(row.last_edited).toLocaleString() : 'Just now',
          platform:jsonData?.platform || row?.platform || 'youtube',
          layers:layersFromJson,
          brightness:jsonData?.brightness ?? row?.brightness ?? 100,
          contrast:jsonData?.contrast ?? row?.contrast ?? 100,
          saturation:jsonData?.saturation ?? row?.saturation ?? 100,
          hue:jsonData?.hue ?? row?.hue ?? 0,
          thumbnail:row?.thumbnail || null,
          json_data:jsonData,
          last_edited:row?.last_edited || null,
        };
      });

      setSavedDesigns(normalized);
    }catch(err){
      console.error('[FETCH SAVED DESIGNS] Failed:', err);
      setSavedDesigns([]);
    }
  },[resolvedApiUrl, user?.email]);

  useEffect(()=>{
    currentDesignIdRef.current=currentDesignId;
  },[currentDesignId]);

  useEffect(()=>{
    if(user?.email) return;
    setSavedDesigns([]);
    setLayers([]);
    layersRef.current=[];
    setSelectedId(null);
  },[user?.email]);
  const T  = {
    bg:     darkMode?'#06070a':'#f0f2f5',
    bg2:    darkMode?'#0d0f14':'#e8eaed',
    panel:  darkMode?'#0c0d11':'#ffffff',
    sidebar:darkMode?'#08090d':'#f7f8fa',
    input:  darkMode?'#13151c':'#ffffff',
    border: darkMode?'#1c1f2b':'#e2e5ec',
    text:   darkMode?'#e8eaf2':'#111827',
    muted:  darkMode?'#454e6b':'#9ca3af',
    accent: '#f97316',
    accentDim: darkMode?'rgba(249,115,22,0.1)':'rgba(249,115,22,0.08)',
    accentBorder: darkMode?'rgba(249,115,22,0.25)':'rgba(249,115,22,0.3)',
    danger: '#ef4444',success:'#22c55e',warning:'#f59e0b',
    glow: darkMode?'0 0 0 1px rgba(249,115,22,0.15), 0 4px 24px rgba(249,115,22,0.08)':'none',
  };

  const selectedLayer   = layers.find(l=>l.id===selectedId);
  const bg              = layers.find(l=>l.type==='background');
  const currentUserId   = user?.id;
  const canvasFilter    = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
  const canDrag         = activeTool!=='brush' && activeTool!=='rimlight' && activeTool!=='zoom';
  // ✅ When brush active on image — that image is ONLY shown in brush overlay, nowhere else
  const brushingImageId = activeTool==='brush'&&(selectedLayer?.type==='image'||selectedLayer?.type==='background')&&!selectedLayer?.isRimLight ? selectedId : null;

  // Auto-select first real image when brush tool is active but selected layer is rimlight or nothing
  useEffect(()=>{
    if(activeTool==='brush'){
      if(!selectedLayer || selectedLayer.isRimLight){
        const realImage = layers.find(l=>l.type==='image'&&!l.isRimLight&&!l.hidden);
        if(realImage) setSelectedId(realImage.id);
      }
    }
  },[activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isMobile,setIsMobile] = useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',check);
    return()=>window.removeEventListener('resize',check);
  },[]);

  useEffect(()=>{zoomRef.current=zoom;},[zoom]);

  useEffect(()=>{
    let cancelled=false;

    async function fetchBrandKitForUser(){
      if (!currentUserId) return;

      setBrandKitLoading(true);
      try{
        const { data, error } = await supabase
          .from('brand_kits')
          .select('*')
          .eq('user_id', currentUserId)
          .limit(1);

        if(cancelled) return;
        if(error) throw error;

        const fallbackBrandKit = { primary_font: 'Anton', brand_colors: ['#FF0000'] };
        const firstBrandKit = Array.isArray(data) ? (data[0] || null) : (data || null);
        const normalizedBrandKit = firstBrandKit || fallbackBrandKit;

        setBrandKit(normalizedBrandKit);
        if(Array.isArray(firstBrandKit?.brand_colors) && firstBrandKit.brand_colors.length>0){
          setBrandKitColors({
            primary:firstBrandKit.brand_colors[0] || '#c45c2e',
            secondary:firstBrandKit.brand_colors[1] || firstBrandKit.brand_colors[0] || '#f97316',
          });
        }
        if(firstBrandKit?.primary_color || firstBrandKit?.secondary_color){
          setBrandKitColors({
            primary:firstBrandKit.primary_color || '#c45c2e',
            secondary:firstBrandKit.secondary_color || '#f97316',
          });
        }
        setBrandKitFace(firstBrandKit?.subject_image_url || firstBrandKit?.subject_url || firstBrandKit?.face_image_url || null);
      }catch(err){
        if(!cancelled) console.error('Brand Kit fetch failed:', err);
      }finally{
        if(!cancelled) setBrandKitLoading(false);
      }
    }

    fetchBrandKitForUser();
    return()=>{cancelled=true;};
  },[currentUserId]);

  useEffect(()=>{
    let cancelled=false;

    async function bootstrapEditor(){
      const safeUser = user;
      const safeToken = token || '';
      if (!safeUser || !safeUser.id) return;

      setIsLoading(true);
      setBrandKitLoading(true);

      try{
        // ── Resolve project ID synchronously before any await ──
        const urlDesignId = getProjectIdFromUrl();
        const resolvedProjectId = urlDesignId || generateProjectId();
        if(!cancelled){
          setProjectId(resolvedProjectId);
          if(!urlDesignId) syncProjectIdToUrl(resolvedProjectId);
        }

        // ── Read localStorage draft synchronously (no network, instant) ──
        let restoredDraft = null;
        if(urlDesignId){
          // If there's a URL project ID we'll prefer the remote — skip draft for now
        } else {
          try{
            const rawDraft = localStorage.getItem(getProjectStorageKey(resolvedProjectId));
            if(rawDraft) restoredDraft = JSON.parse(rawDraft);
          }catch(e){
            console.error('Draft restore failed:', e);
            localStorage.removeItem(getProjectStorageKey(resolvedProjectId));
          }
        }

        // ── Fire ALL network requests in parallel ──
        const isAdmin = safeUser?.is_admin || safeUser?.email === 'kadengajkowski@gmail.com';
        const [savedDesignsResult, remoteDesignResult, brandKitResult, profileResult] = await Promise.allSettled([
          // 1. Saved designs list (Railway API)
          fetchSavedDesigns(),
          // 2. Remote design from Supabase (if URL has project ID)
          urlDesignId
            ? supabase.from('thumbnails').select('*').eq('id', urlDesignId).single()
            : Promise.resolve({ data: null, error: null }),
          // 3. Brand kit
          supabase.from('brand_kits').select('*').eq('user_id', safeUser.id).limit(1),
          // 4. Pro profile
          safeUser?.email
            ? supabase.from('profiles').select('is_pro').eq('email', safeUser.email).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if(cancelled)return;

        // ── Process remote design result ──
        let remoteDesign = null;
        if(urlDesignId){
          if(remoteDesignResult.status==='fulfilled'){
            const { data: remoteData, error: remoteError } = remoteDesignResult.value;
            if(remoteError){
              console.error('[BOOTSTRAP] Failed to load remote design:', remoteError.message);
            }else if(remoteData){
              console.log('[BOOTSTRAP] Remote design loaded:', remoteData.name);
              remoteDesign = remoteData;
            }
          }else{
            console.error('[BOOTSTRAP] Exception loading remote design:', remoteDesignResult.reason);
          }
        }

        // If no remote design and we skipped draft earlier, try localStorage now
        if(!remoteDesign && urlDesignId && !restoredDraft){
          try{
            const rawDraft = localStorage.getItem(getProjectStorageKey(resolvedProjectId));
            if(rawDraft) restoredDraft = JSON.parse(rawDraft);
          }catch(e){ /* ignore */ }
        }

        try{
          if(savedDesignsResult.status==='rejected'){
            console.error('Saved designs fetch failed:', savedDesignsResult.reason);
          }

          if(safeToken==='test-key-123' || isAdmin){
            setIsProUser(true);
          }else if(profileResult.status==='fulfilled'){
            const { data: profileData, error: profileError } = profileResult.value;
            if(profileError){
              console.error('[PRO PROFILE] Failed to fetch profiles.is_pro:', {
                email:safeUser?.email,
                message:profileError?.message,
                details:profileError?.details,
                hint:profileError?.hint,
                code:profileError?.code,
                status:profileError?.status,
              });
              setIsProUser(false);
            }else{
              setIsProUser(!!profileData?.is_pro);
            }
          }else{
            console.error('[PRO PROFILE] Promise rejected while fetching profiles.is_pro:', profileResult.reason);
            setIsProUser(false);
          }

          if(brandKitResult.status==='fulfilled'){
            const { data, error } = brandKitResult.value;
            if(error)throw error;

            const fallbackBrandKit = { primary_font: 'Anton', brand_colors: ['#FF0000'] };
            const firstBrandKit = Array.isArray(data) ? (data[0] || null) : (data || null);
            const normalizedBrandKit = firstBrandKit || fallbackBrandKit;

            setBrandKit(normalizedBrandKit);
            if(Array.isArray(firstBrandKit?.brand_colors) && firstBrandKit.brand_colors.length>0){
              setBrandKitColors({
                primary:firstBrandKit.brand_colors[0] || '#c45c2e',
                secondary:firstBrandKit.brand_colors[1] || firstBrandKit.brand_colors[0] || '#f97316',
              });
            }
            if(firstBrandKit?.primary_color||firstBrandKit?.secondary_color){
              setBrandKitColors({
                primary:firstBrandKit?.primary_color||'#c45c2e',
                secondary:firstBrandKit?.secondary_color||'#f97316',
              });
            }
            setBrandKitFace(firstBrandKit?.subject_image_url||firstBrandKit?.subject_url||firstBrandKit?.face_image_url||null);
          }else{
            throw brandKitResult.reason;
          }
        }catch(brandKitErr){
          if(!cancelled)console.error('Brand Kit/Profile bootstrap failed:',brandKitErr);
        }

        const stateToRestore = restoredDraft;

        if(remoteDesign){
          // ── Path A: Hydrate from Supabase remote design (Dashboard → Editor nav) ──
          const jsonData = remoteDesign.json_data || {};
          const remoteLayers = Array.isArray(jsonData.layers) && jsonData.layers.length > 0
            ? jsonData.layers
            : [makeBg(PLATFORMS[jsonData.platform || 'youtube'] || p)];
          const remotePlatform = jsonData.platform || remoteDesign.platform || 'youtube';
          const remoteBrightness = jsonData.brightness ?? 100;
          const remoteContrast   = jsonData.contrast   ?? 100;
          const remoteSaturation = jsonData.saturation ?? 100;
          const remoteHue        = jsonData.hue        ?? 0;
          const remoteName       = remoteDesign.name   || jsonData.name || 'My Design';

          const maxRemoteId = remoteLayers.reduce((m,l)=>Math.max(m,typeof l.id==='number'?l.id:0),0);
          if(maxRemoteId>=idCounter) idCounter=maxRemoteId+1;

          setPlatform(remotePlatform);
          setLayers(remoteLayers);
          layersRef.current=remoteLayers;
          setBrightness(remoteBrightness);
          setContrast(remoteContrast);
          setSaturation(remoteSaturation);
          setHue(remoteHue);
          setDesignName(remoteName);
          setProjectId(resolvedProjectId);
          currentDesignIdRef.current=remoteDesign.id;
          setCurrentDesignId(remoteDesign.id);
          syncProjectIdToUrl(remoteDesign.id);

          const snapshot = JSON.parse(JSON.stringify(remoteLayers));
          historyRef.current=[snapshot];
          historyIndexRef.current=0;
          setHistory([snapshot]);
          setHistoryIndex(0);
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:resolvedProjectId,
            platform:remotePlatform,
            layers:remoteLayers,
            brightness:remoteBrightness,
            contrast:remoteContrast,
            saturation:remoteSaturation,
            hue:remoteHue,
            designName:remoteName,
            aiPrompt:'',
            lastGeneratedImageUrl:'',
          });
        }else if(stateToRestore){
          const restoredPlatform = stateToRestore.platform||'youtube';
          const restoredLayers = Array.isArray(stateToRestore.layers) && stateToRestore.layers.length>0
            ? stateToRestore.layers
            : [makeBg(PLATFORMS[restoredPlatform]||p)];
          const restoredCurrentDesignId = stateToRestore.currentDesignId||stateToRestore.currentId||null;
          // Advance idCounter past any restored IDs to prevent collisions when adding new layers
          const maxRestoredId = restoredLayers.reduce((m,l)=>Math.max(m,typeof l.id==='number'?l.id:0),0);
          if(maxRestoredId>=idCounter) idCounter=maxRestoredId+1;
          setPlatform(restoredPlatform);
          setLayers(restoredLayers);
          layersRef.current=restoredLayers;
          setBrightness(stateToRestore.brightness||100);
          setContrast(stateToRestore.contrast||100);
          setSaturation(stateToRestore.saturation||100);
          setHue(stateToRestore.hue||0);
          setDesignName(stateToRestore.designName||stateToRestore.name||'My Design');
          setAiPrompt(stateToRestore.aiPrompt||stateToRestore.prompt||'');
          setLastGeneratedImageUrl(stateToRestore.lastGeneratedImageUrl||stateToRestore.result_image_url||'');
          setProjectId(stateToRestore.projectId||resolvedProjectId);
          currentDesignIdRef.current=restoredCurrentDesignId;
          setCurrentDesignId(restoredCurrentDesignId);
          if(stateToRestore.textColor)setTextColor(stateToRestore.textColor);
          if(stateToRestore.strokeColor)setStrokeColor(stateToRestore.strokeColor);
          if(stateToRestore.fillColor)setFillColor(stateToRestore.fillColor);
          if(stateToRestore.brandKitColors){
            setBrandKitColors(stateToRestore.brandKitColors);
          }

          const snapshot = JSON.parse(JSON.stringify(restoredLayers));
          historyRef.current=[snapshot];
          historyIndexRef.current=0;
          setHistory([snapshot]);
          setHistoryIndex(0);
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:stateToRestore.projectId||resolvedProjectId,
            platform:restoredPlatform,
            layers:restoredLayers,
            brightness:stateToRestore.brightness||100,
            contrast:stateToRestore.contrast||100,
            saturation:stateToRestore.saturation||100,
            hue:stateToRestore.hue||0,
            designName:stateToRestore.designName||stateToRestore.name||'My Design',
            aiPrompt:stateToRestore.aiPrompt||stateToRestore.prompt||'',
            lastGeneratedImageUrl:stateToRestore.lastGeneratedImageUrl||stateToRestore.result_image_url||'',
          });
        }else{
          const b=makeBg(p);
          setLayers([b]);
          layersRef.current=[b];
          historyRef.current=[[b]];
          historyIndexRef.current=0;
          setHistory([[b]]);
          setHistoryIndex(0);
          setProjectId(resolvedProjectId);
          currentDesignIdRef.current=null;
          setCurrentDesignId(null);
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:resolvedProjectId,
            platform,
            layers:[b],
            brightness:100,
            contrast:100,
            saturation:100,
            hue:0,
            designName:'My Design',
            aiPrompt:'',
            lastGeneratedImageUrl:'',
          });
        }

        draftHydratedRef.current=true;
      }catch(e){
        if(!cancelled)console.error('Editor bootstrap failed:',e);

        if(!draftHydratedRef.current){
          const b=makeBg(p);
          setLayers([b]);
          layersRef.current=[b];
          historyRef.current=[[b]];
          historyIndexRef.current=0;
          setHistory([[b]]);
          setHistoryIndex(0);
          draftHydratedRef.current=true;
        }
      }finally{
        if(!cancelled){
          setBrandKitLoading(false);
          setIsLoading(false);
        }
      }
    }

    bootstrapEditor();
    return()=>{cancelled=true;};
  },[buildSaveSignature, fetchSavedDesigns, p, platform, token, user]);

  useEffect(()=>{
    if(!showFileTab)return;
    fetchSavedDesigns();
  },[fetchSavedDesigns, showFileTab]);

  // ✅ Window drag handlers — ONLY fire when draggingRef or resizingRef is set
  // This means sidebar sliders are completely unaffected
  useEffect(()=>{
    function onMove(e){
      if(!draggingRef.current&&!resizingRef.current)return;
      const rs=resizeStartRef.current;
      const z=zoomRef.current;
      if(resizingRef.current&&rs){
        const dx=(e.clientX-rs.mouseX)/z,dy=(e.clientY-rs.mouseY)/z;
        setLayers(prev=>{
          const layer=prev.find(l=>l.id===resizingRef.current);if(!layer)return prev;
          if(layer.type==='text')return prev.map(l=>l.id===resizingRef.current?{...l,fontSize:Math.max(8,Math.round(rs.origFontSize+dx*0.5))}:l);
          const nw=Math.max(20,Math.round(rs.origW+dx));
          const nh=lockAspect?Math.round(nw/rs.aspect):Math.max(20,Math.round(rs.origH+dy));
          return prev.map(l=>l.id===resizingRef.current?{...l,width:nw,height:nh}:l);
        });
        return;
      }
      if(!draggingRef.current||!canvasRef.current)return;
      const rect=canvasRef.current.getBoundingClientRect();
      let x=(e.clientX-rect.left)/z-dragOffsetRef.current.x;
      let y=(e.clientY-rect.top)/z-dragOffsetRef.current.y;
      if(snapToGrid){x=Math.round(x/10)*10;y=Math.round(y/10)*10;}
      x=Math.max(-p.preview.w+10,Math.min(p.preview.w-10,x));
      y=Math.max(-p.preview.h+10,Math.min(p.preview.h-10,y));
      setLayers(prev=>prev.map(l=>l.id===draggingRef.current?{...l,x,y}:l));
    }
    function onUp(){
      if(!draggingRef.current&&!resizingRef.current)return;
      const clone=JSON.parse(JSON.stringify(layersRef.current));
      const newHist=[...historyRef.current.slice(0,historyIndexRef.current+1),clone];
      historyRef.current=newHist;
      historyIndexRef.current=newHist.length-1;
      setHistory(newHist);
      setHistoryIndex(newHist.length-1);
      draggingRef.current=null;
      resizingRef.current=null;
      resizeStartRef.current=null;
      triggerAutoSave();
    }
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};
  },[snapToGrid,lockAspect,p.preview.w,p.preview.h,triggerAutoSave]);

  useEffect(()=>{
    const handler=(e)=>{
      const active=document.activeElement;
      const typing=active.tagName==='INPUT'||active.tagName==='TEXTAREA'||active.tagName==='SELECT';
      if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
      if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo();}
      if((e.ctrlKey||e.metaKey)&&e.key==='c'){if(selectedId){const l=layers.find(x=>x.id===selectedId);if(l)setClipboard(l);}}
      if((e.ctrlKey||e.metaKey)&&e.key==='v'){if(clipboard)duplicateLayerFromObj(clipboard);}
      if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();if(selectedId)duplicateLayer(selectedId);}
      if(!typing&&(e.key==='Delete'||e.key==='Backspace')){if(selectedId)deleteLayer(selectedId);}
      if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault();setZoom(z=>Math.min(16,+(z+0.1).toFixed(1)));}
      if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)));}
      if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();setZoom(1);}
      if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();setCmdOpen(o=>!o);setTimeout(()=>cmdInputRef.current?.focus(),50);}
      if((e.ctrlKey||e.metaKey)&&e.key==='i'){
        e.preventDefault();
        setShowAiBar(o=>!o);
        setTimeout(()=>aiCmdInputRef.current?.focus(),50);
      }
      if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveDesign(designName);}
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedId,layers,clipboard,historyIndex,history,designName]);

  function makeBg(plat){return{id:newId(),type:'background',bgColor:'#ffffff',bgGradient:null,x:0,y:0,width:plat.preview.w,height:plat.preview.h,opacity:100,hidden:false,locked:true,blendMode:'normal',effects:defaultEffects()};}

  function pushHistory(nl){
    const clone=nl.map(l=>{
      if(l.type==='image'){const {src,...rest}=l;return{...JSON.parse(JSON.stringify(rest)),src};}
      return JSON.parse(JSON.stringify(l));
    });
    const newHist=[...historyRef.current.slice(0,historyIndexRef.current+1),clone].slice(-30);
    historyRef.current=newHist;
    historyIndexRef.current=newHist.length-1;
    setHistory(newHist);
    setHistoryIndex(newHist.length-1);
  }
  function pushHistoryDebounced(nl){
    if(historyDebounceRef.current)clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current=setTimeout(()=>pushHistory(nl),400);
  }

  function undo(){
    const ni=historyIndexRef.current-1;if(ni<0)return;
    historyIndexRef.current=ni;setHistoryIndex(ni);
    setLayers(JSON.parse(JSON.stringify(historyRef.current[ni])));
    triggerAutoSave();
  }
  function redo(){
    const ni=historyIndexRef.current+1;if(ni>=historyRef.current.length)return;
    historyIndexRef.current=ni;setHistoryIndex(ni);
    setLayers(JSON.parse(JSON.stringify(historyRef.current[ni])));
    triggerAutoSave();
  }

  function addLayer(obj){
    const id=newId();
    const sx=snapToGrid?Math.round((obj.x??40)/10)*10:(obj.x??40);
    const sy=snapToGrid?Math.round((obj.y??40)/10)*10:(obj.y??40);
    const layer={...obj,id,x:sx,y:sy,opacity:100,hidden:false,locked:false,blendMode:'normal',flipH:false,flipV:false,rotation:0,effects:{...defaultEffects(),...(obj.effects||{})}};
    setLayers(prev=>{const nl=[...prev,layer];pushHistory(nl);return nl;});
    setSelectedId(id);
    triggerAutoSave();
  }

  function updateLayer(id,updates){setLayers(prev=>{const nl=prev.map(l=>l.id===id?{...l,...updates}:l);pushHistoryDebounced(nl);return nl;});triggerAutoSave();}
  function updateLayerSilent(id,updates){setLayers(prev=>prev.map(l=>l.id===id?{...l,...updates}:l));}
  function updateLayerEffect(id,key,value){setLayers(prev=>{const nl=prev.map(l=>l.id===id?{...l,effects:{...(l.effects||defaultEffects()),[key]:value}}:l);pushHistory(nl);return nl;});triggerAutoSave();}
  function updateLayerEffectSilent(id,key,value){setLayers(prev=>prev.map(l=>l.id===id?{...l,effects:{...(l.effects||defaultEffects()),[key]:value}}:l));}
  function updateLayerEffectNested(id,ek,sk,value){setLayers(prev=>{const nl=prev.map(l=>{if(l.id!==id)return l;return{...l,effects:{...(l.effects||defaultEffects()),[ek]:{...((l.effects||defaultEffects())[ek]||{}),[sk]:value}}};});pushHistory(nl);return nl;});triggerAutoSave();}
  function updateLayerEffectNestedSilent(id,ek,sk,value){setLayers(prev=>prev.map(l=>{if(l.id!==id)return l;return{...l,effects:{...(l.effects||defaultEffects()),[ek]:{...((l.effects||defaultEffects())[ek]||{}),[sk]:value}}};}));}
  function deleteLayer(id){
    const layer=layers.find(l=>l.id===id);
    if(!layer) return;
    // Allow background deletion only if there's another layer
    if(layer.type==='background'){
      if(layers.length<=1) return; // can't delete if only layer
    }
    setLayers(prev=>{const nl=prev.filter(l=>l.id!==id);pushHistory(nl);return nl;});setSelectedId(null);triggerAutoSave();
  }
  function moveLayerUp(id){const idx=layers.findIndex(l=>l.id===id);if(idx>=layers.length-1)return;const nl=[...layers];[nl[idx],nl[idx+1]]=[nl[idx+1],nl[idx]];setLayers(nl);pushHistory(nl);triggerAutoSave();}
  function moveLayerDown(id){const idx=layers.findIndex(l=>l.id===id);if(idx<=0)return;const nl=[...layers];[nl[idx],nl[idx-1]]=[nl[idx-1],nl[idx]];setLayers(nl);pushHistory(nl);triggerAutoSave();}
  function duplicateLayerFromObj(layer){const nl2={...layer,id:newId(),x:layer.x+16,y:layer.y+16};setLayers(prev=>{const nl=[...prev,nl2];pushHistory(nl);return nl;});setSelectedId(nl2.id);triggerAutoSave();}
  function duplicateLayer(id){const layer=layers.find(l=>l.id===id);if(!layer||layer.type==='background')return;duplicateLayerFromObj(layer);}
  function updateBg(updates){const bgL=layers.find(l=>l.type==='background');if(bgL)updateLayer(bgL.id,updates);}
  function getLayerSrc(layer){
    if(layer.type==='image')return layer.paintSrc || layer.src;
    if(layer.type==='background'){
      const tmp=document.createElement('canvas');
      tmp.width=p.preview.w;tmp.height=p.preview.h;
      const ctx=tmp.getContext('2d');
      if(layer.bgGradient){const g=ctx.createLinearGradient(0,0,0,tmp.height);g.addColorStop(0,layer.bgGradient[0]);g.addColorStop(1,layer.bgGradient[1]);ctx.fillStyle=g;}
      else{ctx.fillStyle=layer.bgColor||'#f97316';}
      ctx.fillRect(0,0,tmp.width,tmp.height);
      return tmp.toDataURL('image/png');
    }
    return null;
  }
  function addRecentColor(color){setRecentColors(prev=>[color,...prev.filter(c=>c!==color)].slice(0,12));}

  function applyBrandColorToSelected(color){
    if(!color) return;
    addRecentColor(color);
    if(!selectedLayer){
      setTextColor(color);
      setCmdLog('Brand color selected for the next layer');
      return;
    }
    if(selectedLayer.type==='background'){
      updateBg({bgColor:color,bgGradient:null});
      setCmdLog('Applied brand color to background');
      return;
    }
    if(selectedLayer.type==='text'){
      updateLayer(selectedLayer.id,{textColor:color});
      setTextColor(color);
      setCmdLog('Applied brand color to text');
      return;
    }
    if(selectedLayer.type==='shape'){
      updateLayer(selectedLayer.id,{fillColor:color});
      setFillColor(color);
      setCmdLog('Applied brand color to shape');
      return;
    }
    if(selectedLayer.type==='image'){
      updateLayer(selectedLayer.id,{effects:{...(selectedLayer.effects||defaultEffects()),subjectOutline:{enabled:true,color,width:selectedLayer.effects?.subjectOutline?.width||brandKit?.outline_width||5}}});
      setCmdLog('Applied brand color to subject outline');
      return;
    }
    setTextColor(color);
    setCmdLog('Brand color selected');
  }

  function loadTemplate(template){
    if(!window.confirm(`Load template "${template.label}"? This will replace your current canvas.`)) return;

    // ✅ Find if template has its own background layer
    const templateHasBg = template.layers.some(l=>l.type==='background');

    // Only add a fresh bg if template doesn't include one
    const bg = makeBg(p);

    const templateLayers = template.layers.map(l=>({
      ...l,
      id:newId(),
      x:l.x??40,
      y:l.y??40,
      opacity:100,
      hidden:false,
      locked:l.type==='background'?true:false,
      blendMode:'normal',
      flipH:false,
      flipV:false,
      rotation:0,
      effects:defaultEffects(),
    }));

    // ✅ Use template bg if it has one, otherwise use fresh white bg
    const newLayers = templateHasBg
      ? templateLayers
      : [bg, ...templateLayers];

    setLayers(newLayers);
    pushHistory(newLayers);
    setSelectedId(null);
    setCmdLog(`Loaded: ${template.label}`);
    setActiveTool('select');
  }

  async function executeAiCommand(cmd){
    if(!cmd.trim()) return;
    setAiCmdLoading(true);
    setAiCmdLog('');

    try{
      const canvasState = {
        platform,
        canvasWidth:  p.preview.w,
        canvasHeight: p.preview.h,
        globalBrightness: brightness,
        globalContrast:   contrast,
        globalSaturation: saturation,
        globalHue:        hue,
        selectedLayerId:  selectedId,
        selectedLayerType: selectedLayer?.type,
        layers: layers.map(l=>({
          id:         l.id,
          type:       l.type,
          isSelected: l.id === selectedId,
          isImage:    l.type === 'image',
          label:      l.type==='text' ? `text:"${l.text?.slice(0,30)}"` : l.type==='background' ? 'background' : `${l.type}-layer`,
          x:          l.x,
          y:          l.y,
          width:      l.width,
          height:     l.height,
          hidden:     l.hidden,
          opacity:    l.opacity,
          blendMode:  l.blendMode,
          text:       l.text,
          fontSize:   l.fontSize,
          fontFamily: l.fontFamily,
          fontWeight: l.fontWeight,
          textColor:  l.textColor,
          strokeWidth:l.strokeWidth,
          strokeColor:l.strokeColor,
          shadowEnabled:l.shadowEnabled,
          glowEnabled:l.glowEnabled,
          bgColor:    l.bgColor,
          bgGradient: l.bgGradient,
          imgBrightness: l.imgBrightness,
          imgContrast:   l.imgContrast,
          imgSaturate:   l.imgSaturate,
          imgBlur:       l.imgBlur,
        })),
      };

      const res = await fetch('https://thumbframe-api-production.up.railway.app/ai-command',{
        method:  'POST',
        headers: {'Content-Type':'application/json'},
        body:    JSON.stringify({ command:cmd, canvasState }),
      });
      const data = await res.json();

      if(data.error){
        setAiCmdLog(`Error: ${data.error}`);
        setAiCmdLoading(false);
        return;
      }

      const result = data.result;
      if(!result){
        setAiCmdLog('Could not understand. Try rephrasing.');
        setAiCmdLoading(false);
        return;
      }

      // Handle single or multiple actions
      const actions = result.actions || [result];
      const log = [];

      for(const action of actions){
        if(!action?.action) continue;

        switch(action.action){

          case 'adjustBrightness':
            setBrightness(Math.min(200,Math.max(0,Number(action.value)||100)));
            log.push(`Brightness → ${action.value}%`);
            break;

          case 'adjustContrast':
            setContrast(Math.min(300,Math.max(0,Number(action.value)||100)));
            log.push(`Contrast → ${action.value}%`);
            break;

          case 'adjustSaturation':
            setSaturation(Math.min(300,Math.max(0,Number(action.value)||100)));
            log.push(`Saturation → ${action.value}%`);
            break;

          case 'adjustHue':
            setHue(Math.min(360,Math.max(0,Number(action.value)||0)));
            log.push(`Hue → ${action.value}°`);
            break;

          case 'updateBackground':{
            const bgLayer = layers.find(l=>l.type==='background');
            if(bgLayer){
              updateLayer(bgLayer.id, action.updates||{});
              log.push('Background updated');
            }
            break;
          }

          case 'updateLayer':
            if(action.id){
              const target = layers.find(l=>l.id===action.id);
              if(target){
                updateLayer(action.id, action.updates||{});
                const changes = Object.keys(action.updates||{}).join(', ');
                log.push(`Updated ${target.type==='text'?`"${target.text?.slice(0,15)}"`:target.type}: ${changes}`);
              }
            }
            break;

          case 'addText':
            addLayer({
              type:         'text',
              text:         action.text         || 'NEW TEXT',
              fontSize:     action.fontSize      || 60,
              fontFamily:   action.fontFamily    || 'Impact',
              fontWeight:   action.fontWeight    || 900,
              fontItalic:   action.fontItalic    || false,
              textColor:    action.textColor     || '#ffffff',
              strokeColor:  action.strokeColor   || '#000000',
              strokeWidth:  action.strokeWidth   || 3,
              shadowEnabled:action.shadowEnabled !== false,
              shadowColor:  action.shadowColor   || '#000000',
              shadowBlur:   action.shadowBlur    || 20,
              shadowX:      action.shadowX       || 3,
              shadowY:      action.shadowY       || 3,
              glowEnabled:  action.glowEnabled   || false,
              glowColor:    action.glowColor     || '#f97316',
              arcEnabled:   false,
              arcRadius:    120,
              letterSpacing:action.letterSpacing || 2,
              lineHeight:   action.lineHeight    || 1.2,
              textAlign:    action.textAlign     || 'center',
              x:            action.x             || 60,
              y:            action.y             || 80,
            });
            log.push(`Added text: "${action.text}"`);
            break;

          case 'deleteLayer':
            if(action.id){
              const target = layers.find(l=>l.id===action.id);
              if(target && target.type!=='background'){
                deleteLayer(action.id);
                log.push('Layer deleted');
              }
            }
            break;

          case 'moveLayer':
            if(action.id){
              updateLayer(action.id,{
                x: action.x ?? layers.find(l=>l.id===action.id)?.x,
                y: action.y ?? layers.find(l=>l.id===action.id)?.y,
              });
              log.push('Layer moved');
            }
            break;

          case 'resizeLayer':
            if(action.id){
              updateLayer(action.id,{
                width:  action.width  || layers.find(l=>l.id===action.id)?.width,
                height: action.height || layers.find(l=>l.id===action.id)?.height,
              });
              log.push('Layer resized');
            }
            break;

          case 'message':
            setAiCmdLog(action.message||'Done');
            setAiCmdLoading(false);
            return;

          default:
            log.push(`Unknown action: ${action.action}`);
        }
      }

      setAiCmdLog(log.length>0 ? `✓ ${log.join(' · ')}` : '✓ Done');
      setAiCmd('');

    }catch(err){
      console.error('AI command error:',err);
      setAiCmdLog('Failed — make sure API is running on port 5000');
    }

    setAiCmdLoading(false);
  }

  async function analyzeFace(){
    setFaceLoading(true);
    setFaceAnalysis(null);

    try{
      // Find image layers that might have faces
      const imageLayers=layers.filter(l=>l.type==='image'&&!l.hidden);
      if(imageLayers.length===0){
        setFaceAnalysis({
          error:true,
          message:'No image layers found. Upload a photo with a face first.',
        });
        setFaceLoading(false);
        return;
      }

      // Render the canvas for analysis
      const canvas  = document.createElement('canvas');
      canvas.width  = p.preview.w;
      canvas.height = p.preview.h;
      const ctx     = canvas.getContext('2d');

      // Draw background
      const bg=layers.find(l=>l.type==='background');
      if(bg){
        ctx.fillStyle=bg.bgColor||'#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      // Draw image layers
      for(const obj of imageLayers){
        await new Promise(resolve=>{
          const img=new Image();
          img.crossOrigin='Anonymous';
          img.onload=()=>{
            ctx.save();
            ctx.globalAlpha=(obj.opacity??100)/100;
            ctx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
            ctx.restore();
            resolve();
          };
          img.onerror=()=>resolve();
          img.src=obj.paintSrc||obj.src;
        });
      }

      // Analyze pixel data for face-like features
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const data      = imageData.data;
      const w         = canvas.width, h = canvas.height;

      // ── Skin tone detection ──────────────────────────────────────────────────
      let skinPixels=0, totalPixels=0;
      let skinCenterX=0, skinCenterY=0, skinCount=0;
      for(let x=0;x<w;x+=2) for(let y=0;y<h;y+=2){
        const i=(y*w+x)*4;
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a<128) continue;
        totalPixels++;
        // Skin tone ranges (works for multiple skin tones)
        const isSkin=(
          r>60&&g>40&&b>20&&
          r>g&&r>b&&
          Math.abs(r-g)>10&&
          r-b>10&&
          r<250&&g<220&&b<200&&
          (r-g)<50
        );
        if(isSkin){
          skinPixels++;
          skinCenterX+=x;skinCenterY+=y;skinCount++;
        }
      }

      const skinRatio = totalPixels>0?skinPixels/totalPixels:0;
      const hasFace   = skinRatio>0.03;
      const faceX     = skinCount>0?skinCenterX/skinCount:w/2;
      const faceY     = skinCount>0?skinCenterY/skinCount:h/2;

      // ── Face position analysis ───────────────────────────────────────────────
      const isLeftThird   = faceX<w*0.33;
      const isRightThird  = faceX>w*0.66;
      const isCentered    = !isLeftThird&&!isRightThird;
      const isTopHalf     = faceY<h*0.5;

      // ── Face size analysis ───────────────────────────────────────────────────
      const faceArea = skinPixels*4; // approximate
      const canvasArea = w*h;
      const faceSizeRatio = faceArea/canvasArea;
      const faceIsTooSmall = faceSizeRatio<0.04;
      const faceIsGood     = faceSizeRatio>=0.04&&faceSizeRatio<0.35;

      // ── Brightness at face area ──────────────────────────────────────────────
      let faceBrightness=0, facePxCount=0;
      const fr=30;
      for(let x=Math.max(0,Math.round(faceX)-fr);
          x<Math.min(w,Math.round(faceX)+fr);x++){
        for(let y=Math.max(0,Math.round(faceY)-fr);
            y<Math.min(h,Math.round(faceY)+fr);y++){
          const i=(y*w+x)*4;
          const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
          faceBrightness+=lum;facePxCount++;
        }
      }
      const avgFaceBrightness=facePxCount>0?faceBrightness/facePxCount:128;
      const faceWellLit=avgFaceBrightness>80&&avgFaceBrightness<220;

      // ── Contrast around face ─────────────────────────────────────────────────
      let edgeStrength=0, edgeCount=0;
      for(let x=Math.max(1,Math.round(faceX)-fr);
          x<Math.min(w-1,Math.round(faceX)+fr);x++){
        for(let y=Math.max(1,Math.round(faceY)-fr);
            y<Math.min(h-1,Math.round(faceY)+fr);y++){
          const i=(y*w+x)*4;
          const dx=Math.abs(data[i]-data[(y*w+x+1)*4]);
          const dy=Math.abs(data[i]-data[((y+1)*w+x)*4]);
          edgeStrength+=dx+dy;edgeCount++;
        }
      }
      const avgEdge=edgeCount>0?edgeStrength/edgeCount:0;
      const hasGoodContrast=avgEdge>15;

      // ── Generate scores and tips ─────────────────────────────────────────────
      const scores=[];
      const tips=[];
      const goods=[];

      // Face presence
      if(!hasFace){
        scores.push({label:'Face detected',score:0,max:25});
        tips.push('No face detected. Thumbnails with faces get up to 38% more clicks.');
      } else {
        scores.push({label:'Face detected',score:25,max:25});
        goods.push('Face detected — great start!');
      }

      // Face size
      if(hasFace){
        if(faceIsTooSmall){
          scores.push({label:'Face size',score:5,max:20});
          tips.push('Face is too small. Fill at least 15% of the thumbnail for maximum impact.');
        } else if(faceIsGood){
          scores.push({label:'Face size',score:20,max:20});
          goods.push('Face size is perfect.');
        } else {
          scores.push({label:'Face size',score:12,max:20});
          tips.push('Face might be slightly too large. Leave room for text.');
        }
      } else {
        scores.push({label:'Face size',score:0,max:20});
      }

      // Face position
      if(hasFace){
        if(isRightThird&&isTopHalf){
          scores.push({label:'Positioning',score:20,max:20});
          goods.push('Face is top-right — perfect for text on the left.');
        } else if(isLeftThird&&isTopHalf){
          scores.push({label:'Positioning',score:18,max:20});
          goods.push('Face is top-left — good composition.');
        } else if(isCentered){
          scores.push({label:'Positioning',score:12,max:20});
          tips.push('Face is centered. Try moving it to the right third — leaves room for bold text on the left.');
        } else {
          scores.push({label:'Positioning',score:10,max:20});
          tips.push('Face is in the lower area. Move it higher — faces in the top half get more attention.');
        }
      } else {
        scores.push({label:'Positioning',score:0,max:20});
      }

      // Lighting
      if(hasFace){
        if(faceWellLit){
          scores.push({label:'Lighting',score:20,max:20});
          goods.push('Face is well lit — clear and visible.');
        } else if(avgFaceBrightness<=80){
          scores.push({label:'Lighting',score:8,max:20});
          tips.push('Face looks dark. Increase brightness or add rim lighting to make the face pop.');
        } else {
          scores.push({label:'Lighting',score:10,max:20});
          tips.push('Face may be overexposed. Reduce brightness slightly for a more natural look.');
        }
      } else {
        scores.push({label:'Lighting',score:0,max:20});
      }

      // Contrast
      if(hasFace){
        if(hasGoodContrast){
          scores.push({label:'Stands out',score:15,max:15});
          goods.push('Face stands out from the background.');
        } else {
          scores.push({label:'Stands out',score:5,max:15});
          tips.push('Face blends into background. Remove the background or add a contrasting color behind the subject.');
        }
      } else {
        scores.push({label:'Stands out',score:0,max:15});
      }

      // Calculate total
      const total=scores.reduce((a,s)=>a+s.score,0);
      const maxTotal=scores.reduce((a,s)=>a+s.max,0);
      const pct=Math.round((total/maxTotal)*100);

      // Emotion suggestions based on content
      const emotionTips=[];
      if(hasFace){
        emotionTips.push({
          emotion:'😱 Shocked',
          tip:'Works great for "You won\'t believe..." thumbnails. Wide eyes, open mouth.',
          ctr:'High CTR',
        });
        emotionTips.push({
          emotion:'😄 Excited',
          tip:'Best for positive content, reveals, giveaways. Big smile, eyebrows raised.',
          ctr:'High CTR',
        });
        emotionTips.push({
          emotion:'😤 Determined',
          tip:'Great for challenge/achievement videos. Strong jaw, focused eyes.',
          ctr:'Medium CTR',
        });
        emotionTips.push({
          emotion:'🤔 Curious',
          tip:'Works for "what if" and educational content. Head tilt, raised eyebrow.',
          ctr:'Medium CTR',
        });
      }

      setFaceAnalysis({
        hasFace,
        score:pct,
        total,maxTotal,
        scores,tips,goods,
        emotionTips,
        facePosition:{
          x:Math.round((faceX/w)*100),
          y:Math.round((faceY/h)*100),
        },
        skinRatio:Math.round(skinRatio*100),
      });

    }catch(err){
      console.error('Face analysis error:',err);
      setFaceAnalysis({error:true,message:'Analysis failed. Try again.'});
    }
    setFaceLoading(false);
  }

  // ── Shared canvas renderer (single source of truth) ──────────────────────
  // Used by: exportAllPlatforms, exportCanvas, downloadVariantsAsZip
  async function renderLayersToCanvas(canvas, layerArray, opts={}){
    const ctx = canvas.getContext('2d');
    const previewW = opts.previewW || p.preview.w;
    const previewH = opts.previewH || p.preview.h;
    const scaleX = canvas.width  / previewW;
    const scaleY = canvas.height / previewH;
    const transparent = opts.transparent || false;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;

    for(const obj of layerArray){
      if(obj.hidden) continue;
      if(transparent && obj.type==='background') continue;
      ctx.save();
      ctx.globalAlpha = (obj.opacity??100)/100;
      ctx.globalCompositeOperation = obj.blendMode||'normal';

      if(obj.type==='background'){
        ctx.filter='none';
        if(obj.bgGradient){
          const g=ctx.createLinearGradient(0,0,0,canvas.height);
          g.addColorStop(0,obj.bgGradient[0]);
          g.addColorStop(1,obj.bgGradient[1]);
          ctx.fillStyle=g;
        } else {
          ctx.fillStyle=obj.bgColor||'#f97316';
        }
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      else if(obj.type==='text'){
        const scale=Math.min(scaleX,scaleY);
        const centerX=(obj.x+(obj.width||100)/2)*scaleX;
        const centerY=(obj.y+(obj.fontSize||48)/2)*scaleY;
        ctx.translate(centerX,centerY);
        if(obj.rotation) ctx.rotate((obj.rotation||0)*Math.PI/180);
        ctx.translate(-centerX,-centerY);
        ctx.translate(obj.x*scaleX,obj.y*scaleY);
        if(obj.flipH||obj.flipV) ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
        const fs=(obj.fontSize||48)*scale;
        await ensureFontLoaded(obj.fontFamily, obj.fontWeight||700);
        ctx.font=`${obj.fontItalic?'italic ':''}${obj.fontWeight||700} ${fs}px ${resolveFontFamily(obj.fontFamily)}`;
        // All text rendering via drawProText — shadow, glow, stroke, fill
        drawProText(ctx, obj.text, 0, fs, {
          fill:        obj.textColor||'#ffffff',
          stroke:      obj.strokeColor||'#000000',
          strokeWidth: (obj.strokeWidth||0)*scale,
          glowColor:   obj.glowEnabled ? (obj.glowColor||'#f97316') : null,
          glowBlur:    obj.glowEnabled ? 24*scale : 0,
          shadowColor: obj.shadowEnabled ? (obj.shadowColor||'rgba(0,0,0,0.95)') : null,
          shadowBlur:  obj.shadowEnabled ? (obj.shadowBlur||14)*scale : 0,
          shadowX:     obj.shadowEnabled ? (obj.shadowX||2)*scale : 0,
          shadowY:     obj.shadowEnabled ? (obj.shadowY||2)*scale : 0,
        });
      }

      else if(obj.type==='image'){
        await new Promise(resolve=>{
          const img=new Image();
          img.crossOrigin='Anonymous';
          img.onload=()=>{
            const x=obj.x*scaleX;
            const y=obj.y*scaleY;
            const w=obj.width*scaleX;
            const h=obj.height*scaleY;
            const cl=(obj.cropLeft||0)*scaleX;
            const ct=(obj.cropTop||0)*scaleY;
            const cr=(obj.cropRight||0)*scaleX;
            const cb=(obj.cropBottom||0)*scaleY;

            ctx.save();
            if(obj.mask?.enabled&&obj.mask?.type==='lasso'&&obj.mask?.points?.length>=3){
              // Apply lasso clip path to export canvas
              const mpts=obj.mask.points;
              const cropWe=w-cl-cr, cropHe=h-ct-cb;
              ctx.beginPath();
              if(obj.mask.inverted){
                ctx.rect(x+cl,y+ct,cropWe,cropHe);
                ctx.moveTo(x+cl+mpts[0].x*scaleX, y+ct+mpts[0].y*scaleY);
                for(let i=1;i<mpts.length;i++) ctx.lineTo(x+cl+mpts[i].x*scaleX, y+ct+mpts[i].y*scaleY);
                ctx.closePath();
                ctx.clip('evenodd');
              } else {
                ctx.moveTo(x+cl+mpts[0].x*scaleX, y+ct+mpts[0].y*scaleY);
                for(let i=1;i<mpts.length;i++) ctx.lineTo(x+cl+mpts[i].x*scaleX, y+ct+mpts[i].y*scaleY);
                ctx.closePath();
                ctx.clip();
              }
              if(obj.flipH||obj.flipV){
                ctx.translate(x+w/2,y+h/2);
                ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                ctx.translate(-(x+w/2),-(y+h/2));
              }
              ctx.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${(obj.imgBlur||0)*Math.min(scaleX,scaleY)}px)`;
              if(obj.effects?.glow?.enabled){
                drawGlowImage(ctx,img,x-cl,y-ct,w,h,obj.effects.glow.color||'#ffffff',obj.effects.glow.blur||20);
              } else {
                ctx.drawImage(img,x-cl,y-ct,w,h);
              }
              ctx.restore();
              resolve();
            } else {
              ctx.save();
              if(obj.rotation){
                const cx2=x+w/2,cy2=y+h/2;
                ctx.translate(cx2,cy2);
                ctx.rotate((obj.rotation||0)*Math.PI/180);
                ctx.translate(-cx2,-cy2);
              }
              ctx.beginPath();
              ctx.rect(x+cl,y+ct,w-cl-cr,h-ct-cb);
              ctx.clip();
              if(obj.flipH||obj.flipV){
                ctx.translate(x+w/2,y+h/2);
                ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                ctx.translate(-(x+w/2),-(y+h/2));
              }
              ctx.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${(obj.imgBlur||0)*Math.min(scaleX,scaleY)}px)`;
              if(obj.effects?.glow?.enabled){
                drawGlowImage(ctx,img,x-cl,y-ct,w,h,obj.effects.glow.color||'#ffffff',(obj.effects.glow.blur||20)*Math.min(scaleX,scaleY));
              } else {
                ctx.drawImage(img,x-cl,y-ct,w,h);
              }
              ctx.restore();
              resolve();
            }
          };
          img.onerror=()=>resolve();
          img.src=obj.paintSrc||obj.src;
        });
      }

      else if(obj.type==='shape'){
        ctx.translate(obj.x*scaleX,obj.y*scaleY);
        if(obj.flipH||obj.flipV) ctx.scale(obj.flipH?-1:1,obj.flipV?-1:1);
        const sw=obj.width*scaleX,sh=obj.height*scaleY;
        ctx.fillStyle=obj.fillColor||'#FF4500';
        ctx.strokeStyle=obj.strokeColor||'#000';
        ctx.lineWidth=2*Math.min(scaleX,scaleY);
        ctx.beginPath();
        if(obj.shape==='circle'){
          ctx.ellipse(sw/2,sh/2,sw/2,sh/2,0,0,Math.PI*2);
        } else if(obj.shape==='rect'||obj.shape==='roundrect'){
          const rad=obj.shape==='roundrect'?Math.min(sw,sh)*0.2:0;
          ctx.roundRect(0,0,sw,sh,rad);
        } else {
          ctx.rect(0,0,sw,sh);
        }
        ctx.fill();ctx.stroke();
      }

      ctx.restore();
    }
    ctx.filter='none';
  }

  async function exportAllPlatforms(){
    setResizeExporting(true);

    const platformList=[
      {key:'youtube',   label:'YouTube',   width:1280, height:720,  preview:{w:480,h:270}},
      {key:'tiktok',    label:'TikTok',    width:1080, height:1920, preview:{w:152,h:270}},
      {key:'instagram', label:'Instagram', width:1080, height:1080, preview:{w:270,h:270}},
      {key:'twitter',   label:'Twitter',   width:1600, height:900,  preview:{w:480,h:270}},
      {key:'linkedin',  label:'LinkedIn',  width:1200, height:627,  preview:{w:480,h:251}},
    ];

    for(const plat of platformList){
      setResizeProgress(`Exporting ${plat.label}...`);

      const canvas  = document.createElement('canvas');
      canvas.width  = plat.width;
      canvas.height = plat.height;

      await renderLayersToCanvas(canvas, layers);

      // Download this platform
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.download=`${designName.replace(/\s+/g,'-')}-${plat.label}-${plat.width}x${plat.height}.png`;
      link.href=url;
      link.click();
      URL.revokeObjectURL(url);

      // Small delay between downloads
      await new Promise(r=>setTimeout(r,500));
    }

    setResizeProgress('All done! 5 files downloaded.');
    setResizeExporting(false);
    setTimeout(()=>setResizeProgress(''),3000);
  }

  function generateVariants(){
    setAbLoading(true);
    setAbVariants([]);
    setAbSelected(null);

    const bg = layers.find(l=>l.type==='background');

    function swapText(text, map){
      const upper=(text||'').toUpperCase().trim();
      for(const [a,b] of map){
        if(upper===a.toUpperCase()) return b;
        if(upper===b.toUpperCase()) return a;
      }
      return text;
    }

    // Detect subject layer (isSubject flag, or fallback to topmost image)
    const subjectLayer = layers.find(l=>l.isSubject&&l.type==='image')
      || [...layers].reverse().find(l=>l.type==='image'&&!l.hidden);
    const subjectId = subjectLayer?.id;

    // ── Variant A — Control (exact current state, no modifications) ──
    const variantA = layers.map(l=>({...l, id:newId()}));

    // ── Variant B — Panic Hook ──
    // Subject: +12% scale (centered), multi-pass cyan glow
    // Background: darken 25%
    // Text: gold (#FFD700), thick black stroke, hook swap
    const variantB = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-50),
        bgGradient:bg?.bgGradient?[
          shiftColor(bg.bgGradient[0],-50),
          shiftColor(bg.bgGradient[1],-50),
        ]:null,
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        text:swapText(l.text, TEXT_FLIP_HOOKS),
        fontFamily:'Anton',
        fontWeight:900,
        textColor:'#FFD700',
        strokeWidth:Math.max(l.strokeWidth||0, 6),
        strokeColor:'#000000',
        shadowEnabled:false,
        glowEnabled:false,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        fillColor:'#FFD700',
        strokeColor:'#000000',
      };
      if(l.type==='image'){
        if(l.id!==subjectId) return{
          ...l,id:newId(),
          imgBrightness:75,
        };
        // Subject: +12% scale centered on original position, cyan glow
        const zf=1.12;
        const nw=Math.round((l.width||200)*zf);
        const nh=Math.round((l.height||200)*zf);
        const dx=Math.round((nw-(l.width||200))/2);
        const dy=Math.round((nh-(l.height||200))/2);
        return{
          ...l,id:newId(),
          width:nw, height:nh,
          x:(l.x||0)-dx, y:(l.y||0)-dy,
          effects:{
            ...defaultEffects(),
            ...(l.effects||{}),
            glow:{enabled:true, color:'#00FFFF', blur:25},
          },
        };
      }
      return{...l,id:newId()};
    });

    // ── Variant C — Curiosity Gap ──
    // Background: heavy Gaussian blur (DSLR depth-of-field), desaturate, darken
    // Subject: right-third anchor, contrast +15%, saturate +20%, white glow isolation
    // Text + shapes: completely hidden — pure visual intrigue
    const variantC = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-40),
        bgGradient:bg?.bgGradient?[
          shiftColor(bg.bgGradient[0],-40),
          shiftColor(bg.bgGradient[1],-40),
        ]:null,
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        hidden:true,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        hidden:true,
      };
      if(l.type==='image'){
        if(l.id!==subjectId) return{
          ...l,id:newId(),
          imgBlur:8,
          imgBrightness:70,
          imgSaturate:60,
          imgContrast:110,
        };
        // Subject: boosted contrast/sat, white glow — stays in original position
        return{
          ...l,id:newId(),
          imgContrast:120,
          imgSaturate:125,
          effects:{
            ...defaultEffects(),
            ...(l.effects||{}),
            glow:{enabled:true, color:'#ffffff', blur:18},
            subjectOutline:{enabled:true, color:'#ffffff', width:4},
          },
        };
      }
      return{...l,id:newId()};
    });

    setTimeout(()=>{
      setAbVariants([
        { id:'a', label:'A — Control',        desc:'Your current design, unmodified — the baseline',                             layers:variantA },
        { id:'b', label:'B — Panic Hook',     desc:'Gold text, cyan subject glow, darkened background, +12% subject scale',      layers:variantB },
        { id:'c', label:'C — Curiosity Gap',  desc:'Blurred background (depth-of-field), hidden text, subject isolation at 115% contrast', layers:variantC },
      ]);
      setAbLoading(false);
    },600);
  }

  function shiftColor(hex,amount){
    try{
      const h=hex.replace('#','');
      const r=Math.min(255,Math.max(0,parseInt(h.slice(0,2),16)+amount));
      const g=Math.min(255,Math.max(0,parseInt(h.slice(2,4),16)+amount));
      const b=Math.min(255,Math.max(0,parseInt(h.slice(4,6),16)+amount));
      return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    }catch(e){ return hex; }
  }

  function applyVariant(variant){
    if(!window.confirm(`Apply variant ${variant.label}? This replaces your current canvas.`)) return;
    setLayers(variant.layers);
    pushHistory(variant.layers);
    setSelectedId(null);
    setAbVariants([]);
    setAbSelected(null);
    setCmdLog(`Applied: ${variant.label}`);
    setActiveTool('select');
    triggerAutoSave();
  }

  // ── A/B Variant ZIP Export ────────────────────────────────────────────────
  async function downloadVariantsAsZip(){
    if(abVariants.length===0) return;
    setAbLoading(true);

    async function renderVariantToDataURL(variantLayers){
      const canvas = document.createElement('canvas');
      canvas.width  = p.width;
      canvas.height = p.height;
      await renderLayersToCanvas(canvas, variantLayers);
      return canvas.toDataURL('image/png',1.0);
    }

    try{
      const zip = new JSZip();
      for(const variant of abVariants){
        const dataUrl = await renderVariantToDataURL(variant.layers);
        const base64  = dataUrl.split(',')[1];
        const safeName = variant.label.replace(/[^a-zA-Z0-9-_ ]/g,'').trim();
        zip.file(`${safeName}.png`, base64, {base64:true});
      }
      const blob = await zip.generateAsync({type:'blob'});
      saveAs(blob, 'ThumbFrame-Variants.zip');
      setCmdLog('Downloaded A/B variants as ZIP');
    }catch(err){
      console.error('[AB ZIP] Export failed:', err);
      setCmdLog('ZIP export failed — check console');
    }finally{
      setAbLoading(false);
    }
  }

  // ── Sprint 5: High-Resolution Export Utility ────────────────────────────
  // renderAtScale(layerSnapshot, multiplier)
  //   multiplier=1 → native platform res (e.g. 1280×720 for YouTube)
  //   multiplier=2 → 2560×1440  (the "2x / enterprise" tier)
  // Uses HTML5 Canvas 2D ctx.filter for brightness/blur — equivalent to
  // Fabric.js WebGL Brightness/Blur filters but without a WebGL dependency.
  async function renderAtScale(layerSnapshot, multiplier=1){
    const expW = Math.round(p.width  * multiplier);
    const expH = Math.round(p.height * multiplier);
    const canvas = document.createElement('canvas');
    canvas.width  = expW;
    canvas.height = expH;
    await renderLayersToCanvas(canvas, layerSnapshot, {
      previewW: p.preview.w,
      previewH: p.preview.h,
    });
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // ── Sprint 5: One-Click A/B Export Pipeline ──────────────────────────────
  // Phase 2: originalState is a deep-clone of layersRef — React state is
  // NEVER mutated during the export pipeline. Variants are separate arrays.
  // Phase 2 restore: after ZIP download we verify layers === originalState.
  const [variantExporting, setVariantExporting] = useState(false);

  async function generateAndExportVariants(){
    if(variantExporting) return;
    setVariantExporting(true);
    setAbLoading(true);

    // ── PHASE 2: State preservation ──────────────────────────────────────
    const originalState = JSON.parse(JSON.stringify(layersRef.current));
    console.log('[SPRINT 5] generateAndExportVariants() — state preserved. Layers count:', originalState.length);

    try{
      const bg = layersRef.current.find(l=>l.type==='background');
      const subjectLayer = layersRef.current.find(l=>l.isSubject&&l.type==='image')
        || [...layersRef.current].reverse().find(l=>l.type==='image'&&!l.hidden);
      const subjectId = subjectLayer?.id;

      // ── PHASE 3: Variant A — Base (exact current state) ──────────────
      const varA = JSON.parse(JSON.stringify(originalState));

      // ── PHASE 3: Variant B — Panic (bright red/gold text, dark BG) ───
      // Background image: CSS brightness(80%) → ctx.filter equiv of Fabric Brightness(-0.2)
      // Text: #FF0000 or #FFD700 fill
      const varB = originalState.map(l=>{
        if(l.type==='background') return{...l,
          bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-50),
          bgGradient:bg?.bgGradient?[shiftColor(bg.bgGradient[0],-50),shiftColor(bg.bgGradient[1],-50)]:null};
        if(l.type==='text') return{...l,
          textColor:'#FFD700',strokeWidth:Math.max(l.strokeWidth||0,6),strokeColor:'#000000',
          shadowEnabled:false,glowEnabled:false,fontFamily:'Anton',fontWeight:900};
        if(l.type==='image'){
          if(l.id!==subjectId) return{...l,imgBrightness:80}; // Fabric Brightness(-0.2) ≡ CSS brightness(80%)
          const zf=1.12,nw=Math.round((l.width||200)*zf),nh=Math.round((l.height||200)*zf);
          return{...l,width:nw,height:nh,x:(l.x||0)-Math.round((nw-(l.width||200))/2),y:(l.y||0)-Math.round((nh-(l.height||200))/2),
            effects:{...defaultEffects(),...(l.effects||{}),glow:{enabled:true,color:'#00FFFF',blur:25}}};
        }
        return{...l};
      });

      // ── PHASE 3: Variant C — Curiosity (blurred BG, hidden text) ─────
      // Background image: CSS blur(8px) → ctx.filter equiv of Fabric Blur(0.1)
      // Text layers: visible=false
      const varC = originalState.map(l=>{
        if(l.type==='background') return{...l,
          bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-40),
          bgGradient:bg?.bgGradient?[shiftColor(bg.bgGradient[0],-40),shiftColor(bg.bgGradient[1],-40)]:null};
        if(l.type==='text'||l.type==='shape') return{...l,hidden:true};
        if(l.type==='image'){
          if(l.id!==subjectId) return{...l,imgBlur:8,imgBrightness:70,imgSaturate:60}; // Fabric Blur(0.1) ≡ CSS blur(8px)
          return{...l,imgContrast:120,imgSaturate:125,
            effects:{...defaultEffects(),...(l.effects||{}),
              glow:{enabled:true,color:'#ffffff',blur:18},
              subjectOutline:{enabled:true,color:'#ffffff',width:4}}};
        }
        return{...l};
      });

      const variants=[
        {id:'a',label:'A-Base',      layers:varA},
        {id:'b',label:'B-Panic',     layers:varB},
        {id:'c',label:'C-Curiosity', layers:varC},
      ];

      // ── PHASE 1: exportCanvas(2) — 2560×1440 JPEG for each variant ───
      const zip = new JSZip();
      for(const v of variants){
        console.log(`[SPRINT 5] Rendering variant ${v.id} at 2x (${p.width*2}×${p.height*2})…`);
        const dataUrl = await renderAtScale(v.layers, 2);
        zip.file(`${designName.replace(/\s+/g,'-')}-${v.label}-2x.jpg`, dataUrl.split(',')[1], {base64:true});
      }

      const blob = await zip.generateAsync({type:'blob'});
      saveAs(blob, `${designName.replace(/\s+/g,'-')}-AB-Variants-2x.zip`);
      setCmdLog('✓ A/B Variants exported at 2x (2560×1440)');
      console.log('[SPRINT 5] ZIP downloaded. Original state intact — layers unchanged:', layersRef.current.length===originalState.length);

    }catch(err){
      console.error('[SPRINT 5] generateAndExportVariants failed:', err);
      setCmdLog('Export failed — check console');
    }finally{
      setVariantExporting(false);
      setAbLoading(false);
    }
  }

  function saveDesign(name){
    saveProject({nameOverride:name, silent:false}).catch(()=>{});
  }

  const saveProject = useCallback(async ({nameOverride, silent=true} = {})=>{
    // Keep silent saves in the background to avoid interrupting canvas interactions.
    if(!silent){
      clearTimeout(saveStatusTimerRef.current);
      setSaveStatus('Saving...');
      setCmdLog('Saving project...');
    }

    // ── Step 2: Check lock ────────────────────────────────────────────────────
    if(isSavingRef.current){
      console.warn('[STORAGE] Save skipped — a save is already in progress.');
      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('Unsaved');
      }
      return null;
    }

    // ── Step 3: All pre-flight checks — UNLOCKED ─────────────────────────────
    const nextName = (nameOverride||saveMetaRef.current.designName||'Untitled Project').trim()||'Untitled Project';
    const snapshot = {
      projectId: saveMetaRef.current.projectId,
      currentDesignId: currentDesignIdRef.current,
      platform: saveMetaRef.current.platform,
      layers: JSON.parse(JSON.stringify(layersRef.current)),
      brightness: saveMetaRef.current.brightness,
      contrast: saveMetaRef.current.contrast,
      saturation: saveMetaRef.current.saturation,
      hue: saveMetaRef.current.hue,
      designName: saveMetaRef.current.designName,
      aiPrompt: saveMetaRef.current.aiPrompt,
      lastGeneratedImageUrl: saveMetaRef.current.lastGeneratedImageUrl,
      textColor: saveMetaRef.current.textColor,
      strokeColor: saveMetaRef.current.strokeColor,
      fillColor: saveMetaRef.current.fillColor,
      brandKitColors: saveMetaRef.current.brandKitColors,
    };
    const signature = buildSaveSignature({...snapshot, designName: nextName});

    // Resurrection guard — synchronous, immune to React state lag.
    const targetId = currentDesignIdRef.current;
    if(targetId && deletedIdsRef.current.has(targetId)){
      console.warn('[STORAGE] Resurrection guard: save aborted — ID', targetId, 'was deleted.');
      currentDesignIdRef.current = null;
      lastSavedSignatureRef.current = '';
      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('');
      }
      return null;
    }

    // ── Step 4: Engage lock — right before any network activity ──────────────
    isSavingRef.current = true;
    try{
      // Session and auth checks are inside the lock-protected try block.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const email = session?.user?.email;
      const userId = session?.user?.id;
      const resolvedPlatform = snapshot.platform || 'youtube';

      console.log('[DEBUG] Sending token to backend:', token ? token.substring(0, 10) + '...' : 'NO TOKEN – session is null');
      console.log('[DEBUG] user_id:', userId || 'NULL – session.user.id missing');
      if(!token){
        console.error('[STORAGE] Cannot save: no active session token.');
        if(!silent){
          clearTimeout(saveStatusTimerRef.current);
          setSaveStatus('Error');
          setCmdLog('Save failed: not logged in');
        }
        return null;
      }

      let thumbnailData = null;
      try{
        const quality = silent ? 0.7 : 1.0;
        thumbnailData = await generateDesignThumbnail(quality);
      }catch(imgErr){
        console.warn('[STORAGE] Thumbnail generation failed, continuing without preview:', imgErr);
      }
      console.log('[SAVE] thumbnail result:', thumbnailData ? `data URL (${thumbnailData.length} chars)` : 'NULL/falsy');

      const freshestLayers = JSON.parse(JSON.stringify(layersRef.current));
      let persistedId = currentDesignIdRef.current;
      let persistedEditedAt = new Date().toISOString();

      const response = await fetch('https://thumbframe-api-production.up.railway.app/designs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          id: currentDesignIdRef.current || undefined,
          name: nextName,
          platform: resolvedPlatform,
          user_email: email,
          user_id: userId,
          json_data: {
            name: nextName,
            platform: resolvedPlatform,
            layers: freshestLayers,
            brightness: snapshot.brightness,
            contrast: snapshot.contrast,
            saturation: snapshot.saturation,
            hue: snapshot.hue,
          },
          thumbnail: thumbnailData,
        }),
      });

      if(!response.ok){
        const errText = await response.text().catch(()=>'');
        console.error('[STORAGE] Request failed. Status:', response.status, 'Body:', errText);
        throw new Error(`Save failed with status ${response.status}: ${errText}`);
      }

      const payload = await response.json().catch(()=>({}));
      const returnedId = payload?.data?.id || payload?.id || payload?.design?.id || null;
      persistedEditedAt = payload?.data?.last_edited || payload?.last_edited || payload?.design?.last_edited || persistedEditedAt;
      console.log('[STORAGE] Save succeeded. ID:', returnedId, '| Name:', nextName, '| Platform:', resolvedPlatform);

      // Update ref and sync URL if the server returned a new ID.
      if(returnedId && returnedId !== currentDesignIdRef.current){
        currentDesignIdRef.current = returnedId;
        setCurrentProjectId(returnedId);
      }
      if(returnedId){
        const urlId = new URLSearchParams(window.location.search).get('project');
        if(urlId !== String(returnedId)){
          syncProjectIdToUrl(returnedId);
        }
      }
      persistedId = returnedId || persistedId;

      const savedDesign = {
        id: persistedId || snapshot.projectId || Date.now(),
        projectId: snapshot.projectId,
        currentDesignId: persistedId || null,
        name: nextName,
        created: new Date().toLocaleString(),
        platform: resolvedPlatform,
        layers: freshestLayers,
        brightness: snapshot.brightness,
        contrast: snapshot.contrast,
        saturation: snapshot.saturation,
        hue: snapshot.hue,
        last_edited: persistedEditedAt,
        json_data: {
          name: nextName,
          platform: resolvedPlatform,
          layers: freshestLayers,
          brightness: snapshot.brightness,
          contrast: snapshot.contrast,
          saturation: snapshot.saturation,
          hue: snapshot.hue,
        },
        thumbnail: thumbnailData,
      };

      lastSavedSignatureRef.current = signature;

      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('Saved');
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus(''), 3000);
      }

      if(!silent){
        persistSavedDesigns(savedDesign);
        setCmdLog(`✓ Saved: ${nextName}`);
      }

      return { id: persistedId || null, design: savedDesign };
    }catch(err){
      console.error('[STORAGE] Save failed:', err);
      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('Error');
        setCmdLog('Save failed');
      }
      return null;
    }finally{
      // THIS MUST EXECUTE NO MATTER WHAT — releases the lock unconditionally.
      isSavingRef.current = false;
    }
  },[buildSaveSignature, generateDesignThumbnail, setCurrentProjectId]);

  useEffect(()=>{
    saveProjectRef.current = saveProject;
  },[saveProject]);

  useEffect(() => {
    const currentDebouncer = debounce(() => {
      if(saveProjectRef.current){
        saveProjectRef.current({ silent:true });
      }
    }, 1500);

    debouncedSaveRef.current = currentDebouncer;

    return () => {
      if(currentDebouncer){
        currentDebouncer.cancel();
      }
      debouncedSaveRef.current = null;
    };
  }, []);

  useEffect(()=>{
    if(isLoading || !draftHydratedRef.current)return;

    const currentState = buildProjectSnapshot(layers);

    // Keep latest draft in memory to avoid localStorage quota crashes.
    draftStateRef.current = currentState;
  },[aiPrompt, brightness, brandKitColors, buildProjectSnapshot, contrast, currentDesignId, designName, fillColor, hue, isLoading, lastGeneratedImageUrl, layers, platform, projectId, saturation, strokeColor, textColor]);

  async function loadProject(d){
    try{
      let projectData=d;
      const loadedId=d?.currentDesignId||d?.id||null;

      if(!projectData?.json_data && !projectData?.canvas_data && token && loadedId){
        const response = await fetch(`${resolvedApiUrl}/designs/load?id=${encodeURIComponent(loadedId)}`,
          { headers:{ authorization:`Bearer ${token}` } });
        if(response.ok){
          const payload=await response.json().catch(()=>({}));
          projectData = payload?.design || payload?.data || payload || d;
        }
      }

      const sourceJsonData = projectData?.json_data || projectData?.canvas_data || [];
      const clonedJsonData = JSON.parse(JSON.stringify(sourceJsonData));
      const hydratedLayersRaw = Array.isArray(clonedJsonData)
        ? clonedJsonData
        : (Array.isArray(clonedJsonData?.layers) ? clonedJsonData.layers : []);
      const hydratedLayers = Array.isArray(hydratedLayersRaw) ? hydratedLayersRaw : [];
      const jsonMeta = Array.isArray(clonedJsonData) ? {} : (clonedJsonData || {});

      const nextProjectId=projectData?.projectId||projectData?.project_id||d?.projectId||generateProjectId();
      const nextPlatform=projectData?.platform||jsonMeta?.platform||'youtube';
      const nextName=projectData?.name||jsonMeta?.name||'Untitled';
      const nextBrightness=projectData?.brightness??jsonMeta?.brightness??100;
      const nextContrast=projectData?.contrast??jsonMeta?.contrast??100;
      const nextSaturation=projectData?.saturation??jsonMeta?.saturation??100;
      const nextHue=projectData?.hue??jsonMeta?.hue??0;

      setLayers([]);
      layersRef.current=[];
      await new Promise(resolve=>setTimeout(resolve,0));

      setLayers(hydratedLayers);
      layersRef.current=hydratedLayers;
      setPlatform(nextPlatform);
      setBrightness(nextBrightness);
      setContrast(nextContrast);
      setSaturation(nextSaturation);
      setHue(nextHue);
      setDesignName(nextName);

      const nextPersistedId=projectData?.id||d?.currentDesignId||d?.id||null;
      currentDesignIdRef.current=nextPersistedId;
      setCurrentDesignId(nextPersistedId);

      setProjectId(nextProjectId);
      syncProjectIdToUrl(nextProjectId);
      setSelectedId(null);
      setShowFileTab(false);

      const snapshot = JSON.parse(JSON.stringify(hydratedLayers));
      historyRef.current=[snapshot];
      historyIndexRef.current=0;
      setHistory([snapshot]);
      setHistoryIndex(0);

      lastSavedSignatureRef.current=buildSaveSignature({
        projectId:nextProjectId,
        platform:nextPlatform,
        layers:hydratedLayers,
        brightness:nextBrightness,
        contrast:nextContrast,
        saturation:nextSaturation,
        hue:nextHue,
        designName:nextName,
        aiPrompt:'',
        lastGeneratedImageUrl:'',
      });

      setCmdLog(`Loaded: ${nextName}`);
    }catch(err){
      console.error('[LOAD PROJECT] Error:', err);
      setCmdLog('Load failed');
    }
  }

  function newCanvas(){
    const b=makeBg(p);
    const nextProjectId=generateProjectId();
    setLayers([b]);
    historyRef.current=[[b]];
    historyIndexRef.current=0;
    setHistory([[b]]);
    setHistoryIndex(0);
    currentDesignIdRef.current=null;
    setCurrentDesignId(null);
    setProjectId(nextProjectId);
    syncProjectIdToUrl(nextProjectId);
    setSelectedId(null);
    setShowFileTab(false);
    lastSavedSignatureRef.current=buildSaveSignature({
      projectId:nextProjectId,
      platform,
      layers:[b],
      brightness:100,
      contrast:100,
      saturation:100,
      hue:0,
      designName:'My Design',
      aiPrompt:'',
      lastGeneratedImageUrl:'',
    });
  }

  async function deleteDesign(id){
    // Validate: never send a DELETE without a real ID.
    if(!id){
      console.error('[DELETE] Cannot delete: Project ID is missing.');
      return;
    }

    // Step 1 — Flag the ID synchronously before anything async so the
    // resurrection guard fires immediately on any queued auto-save.
    deletedIdsRef.current.add(id);

    const isActive = currentDesignIdRef.current === id;

    if(isActive){
      // Clear the ref + signature before the await so no in-flight save can
      // sneak through with the stale ID while we wait for the network.
      currentDesignIdRef.current = null;
      lastSavedSignatureRef.current = '';
      clearProjectIdFromUrl();
    }

    // Step 2 — Call the backend DELETE, with auth, uuid-validated.
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if(token){
        const res = await fetch(`${resolvedApiUrl}/designs/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if(!res.ok){
          const errText = await res.text().catch(()=>'');
          console.error('[DELETE] Backend DELETE failed:', res.status, errText);
        } else {
          console.log('[DELETE] Backend confirmed deletion of ID:', id);
        }
      } else {
        console.warn('[DELETE] No session token — skipping backend DELETE for ID:', id);
      }
    }catch(err){
      console.error('[DELETE] Network error during DELETE:', err);
    }

    // Step 3 — Update local React state regardless of backend outcome so the
    // UI reflects the deletion immediately without requiring a page refresh.
    setSavedDesigns(prev => prev.filter(d => d.id !== id && d.currentDesignId !== id));

    // Step 4 — Redirect if the deleted project was the one being edited.
    if(isActive){
      window.location.replace('/editor');
    }
  }

  async function analyzeCTR(){
    setCtrLoading(true);
    setCtrScore(null);
    setCtrBreakdown(null);

    try{
      // Render full canvas using the shared renderer (CORS-safe)
      const canvas  = document.createElement('canvas');
      canvas.width  = p.preview.w;
      canvas.height = p.preview.h;
      await renderLayersToCanvas(canvas, layers);
      const ctx = canvas.getContext('2d');

      // ── Analyze pixel data ──────────────────────────────────────────────────
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const data      = imageData.data;
      const total     = canvas.width*canvas.height;

      // 1. Contrast score — measure luminance variance
      let lumSum=0, lumSumSq=0;
      for(let i=0;i<data.length;i+=4){
        const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
        lumSum+=lum; lumSumSq+=lum*lum;
      }
      const lumMean = lumSum/total;
      const lumVar  = lumSumSq/total - lumMean*lumMean;
      const lumStd  = Math.sqrt(lumVar);
      const contrastScore = Math.min(100, Math.round((lumStd/80)*100));

      // 2. Color vibrancy — measure saturation
      let satSum=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
        const max=Math.max(r,g,b), min=Math.min(r,g,b);
        satSum+=(max+min>0)?(max-min)/(1-Math.abs(max+min-1)):0;
      }
      const avgSat       = satSum/total;
      const vibrancyScore = Math.min(100, Math.round(avgSat*180));

      // 3. Text presence score — check if text layers exist and are readable
      const textLayers  = layers.filter(l=>l.type==='text'&&!l.hidden);
      const hasText     = textLayers.length>0;
      const hasBoldText = textLayers.some(l=>(l.fontWeight||400)>=700);
      const hasLargeText = textLayers.some(l=>(l.fontSize||0)>=36);
      const hasStroke    = textLayers.some(l=>(l.strokeWidth||0)>0);
      const hasShadow    = textLayers.some(l=>l.shadowEnabled);
      let textScore = 0;
      if(hasText)     textScore+=25;
      if(hasBoldText) textScore+=25;
      if(hasLargeText)textScore+=20;
      if(hasStroke)   textScore+=15;
      if(hasShadow)   textScore+=15;
      textScore = Math.min(100, textScore);

      // 4. Face/subject presence — check if there's an image with transparency
      // (removed background = subject cutout)
      const hasSubject = layers.some(l=>l.type==='image'&&!l.hidden);
      const hasCutout  = layers.some(l=>{
        if(l.type!=='image'||l.hidden) return false;
        // Rough check — if image is smaller than canvas it's probably a cutout
        return l.width<p.preview.w*0.95||l.height<p.preview.h*0.95;
      });
      const subjectScore = hasSubject?(hasCutout?100:60):20;

      // 5. Composition score — check layer count and variety
      const layerCount  = layers.filter(l=>!l.hidden&&l.type!=='background').length;
      const hasShape    = layers.some(l=>l.type==='shape'&&!l.hidden);
      const layerVariety = new Set(layers.filter(l=>!l.hidden).map(l=>l.type)).size;
      let compScore = 0;
      if(layerCount>=2) compScore+=30;
      if(layerCount>=3) compScore+=20;
      if(hasShape)      compScore+=20;
      if(layerVariety>=3) compScore+=30;
      compScore = Math.min(100, compScore);

      // 6. Safe zone score — check if important layers are in safe zone
      const safeTop=20, safeBottom=p.preview.h-40, safeLeft=20, safeRight=p.preview.w-20;
      const layersInSafeZone = layers.filter(l=>{
        if(l.hidden||l.type==='background') return false;
        return l.x>=safeLeft&&l.y>=safeTop&&(l.x+(l.width||100))<=safeRight&&(l.y+(l.height||50))<=safeBottom;
      }).length;
      const totalActiveLayers = layers.filter(l=>!l.hidden&&l.type!=='background').length;
      const safeScore = totalActiveLayers>0
        ? Math.round((layersInSafeZone/totalActiveLayers)*100)
        : 50;

      // ── Calculate overall score (weighted) ─────────────────────────────────
      const weights = {
        contrast:  0.25,
        vibrancy:  0.20,
        text:      0.25,
        subject:   0.15,
        comp:      0.10,
        safe:      0.05,
      };

      const overall = Math.round(
        contrastScore  * weights.contrast  +
        vibrancyScore  * weights.vibrancy  +
        textScore      * weights.text      +
        subjectScore   * weights.subject   +
        compScore      * weights.comp      +
        safeScore      * weights.safe
      );

      // ── Generate tips ───────────────────────────────────────────────────────
      const tips = [];
      if(contrastScore<60)  tips.push({type:'warn', text:'Low contrast — viewers scroll past low-contrast thumbnails. Try a darker background or brighter subject.'});
      if(vibrancyScore<50)  tips.push({type:'warn', text:'Muted colors — saturated thumbnails get 34% more clicks. Boost saturation in Adjustments.'});
      if(!hasText)          tips.push({type:'bad',  text:'No text — thumbnails with bold text get significantly more clicks.'});
      if(hasText&&!hasBoldText) tips.push({type:'warn', text:'Text weight too light — use Bold or Black weight for maximum readability.'});
      if(hasText&&!hasLargeText) tips.push({type:'warn', text:'Text too small — should be at least 36px to read at mobile size.'});
      if(hasText&&!hasStroke)   tips.push({type:'tip',  text:'Add a text outline — makes text readable on any background.'});
      if(!hasSubject)       tips.push({type:'warn', text:'No image layer — thumbnails with a clear subject get more clicks.'});
      if(hasCutout)         tips.push({type:'good', text:'Background removed — great! Subject stands out clearly.'});
      if(compScore<50)      tips.push({type:'tip',  text:'Add more elements — shapes, stickers, or a background image add visual interest.'});
      if(safeScore<70)      tips.push({type:'warn', text:'Elements near edges — YouTube UI covers corners. Keep important content in the center.'});
      if(overall>=80)       tips.push({type:'good', text:'Strong thumbnail! This has the key ingredients for high CTR.'});
      if(overall>=90)       tips.push({type:'good', text:'Excellent! This thumbnail has everything a viral video needs.'});

      // ── Generate attention heatmap ──────────────────────────────────────────
      const heatW=canvas.width, heatH=canvas.height;
      const heatCanvas=document.createElement('canvas');
      heatCanvas.width=heatW; heatCanvas.height=heatH;
      const hctx=heatCanvas.getContext('2d');

      // Build attention map: higher values = more visual attention expected
      const gridSize=8;
      const cols=Math.ceil(heatW/gridSize), rows=Math.ceil(heatH/gridSize);
      const attention=new Float32Array(cols*rows);

      // Factor 1: Local contrast (edges/boundaries draw eyes)
      for(let gy=0;gy<rows;gy++){
        for(let gx=0;gx<cols;gx++){
          const px=gx*gridSize, py=gy*gridSize;
          const idx=((py*heatW)+px)*4;
          const lum=0.299*data[idx]+0.587*data[idx+1]+0.114*data[idx+2];
          // Compare to neighbors
          let diff=0, count=0;
          for(let dy=-1;dy<=1;dy++){
            for(let dx=-1;dx<=1;dx++){
              if(dx===0&&dy===0) continue;
              const nx=gx+dx, ny=gy+dy;
              if(nx<0||ny<0||nx>=cols||ny>=rows) continue;
              const npx=nx*gridSize, npy=ny*gridSize;
              const nidx=((npy*heatW)+npx)*4;
              const nlum=0.299*data[nidx]+0.587*data[nidx+1]+0.114*data[nidx+2];
              diff+=Math.abs(lum-nlum);
              count++;
            }
          }
          attention[gy*cols+gx]+=(count>0?diff/count:0)/255;
        }
      }

      // Factor 2: Saturation hotspots (vivid colors attract)
      for(let gy=0;gy<rows;gy++){
        for(let gx=0;gx<cols;gx++){
          const px=gx*gridSize, py=gy*gridSize;
          const idx=((py*heatW)+px)*4;
          const r=data[idx]/255, g=data[idx+1]/255, b=data[idx+2]/255;
          const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
          const sat=(mx+mn>0)?(mx-mn)/(1-Math.abs(mx+mn-1)):0;
          attention[gy*cols+gx]+=sat*0.3;
        }
      }

      // Factor 3: Text/subject layer positions (known attention anchors)
      for(const l of layers){
        if(l.hidden) continue;
        if(l.type==='text'||l.type==='image'){
          const lx=Math.max(0,Math.floor((l.x||0)/gridSize));
          const ly=Math.max(0,Math.floor((l.y||0)/gridSize));
          const lw=Math.ceil((l.width||(l.type==='text'?200:100))/gridSize);
          const lh=Math.ceil((l.height||(l.type==='text'?60:100))/gridSize);
          const boost=l.type==='text'?0.6:0.4;
          for(let gy=ly;gy<Math.min(ly+lh,rows);gy++){
            for(let gx=lx;gx<Math.min(lx+lw,cols);gx++){
              attention[gy*cols+gx]+=boost;
            }
          }
        }
      }

      // Factor 4: Center bias (eyes land center-ish first)
      const cx=cols/2, cy=rows/2, maxDist=Math.sqrt(cx*cx+cy*cy);
      for(let gy=0;gy<rows;gy++){
        for(let gx=0;gx<cols;gx++){
          const dist=Math.sqrt((gx-cx)**2+(gy-cy)**2);
          attention[gy*cols+gx]+=(1-dist/maxDist)*0.25;
        }
      }

      // Normalize to 0-1
      let maxAtt=0;
      for(let i=0;i<attention.length;i++) if(attention[i]>maxAtt) maxAtt=attention[i];
      if(maxAtt>0) for(let i=0;i<attention.length;i++) attention[i]/=maxAtt;

      // Render heatmap with smooth interpolation
      for(let gy=0;gy<rows;gy++){
        for(let gx=0;gx<cols;gx++){
          const v=attention[gy*cols+gx];
          // Cold (blue) → Warm (green) → Hot (red)
          const r=v<0.5?0:Math.round((v-0.5)*2*255);
          const g=v<0.5?Math.round(v*2*255):Math.round((1-v)*2*255);
          const b=v<0.5?Math.round((1-v*2)*255):0;
          hctx.fillStyle=`rgba(${r},${g},${b},${0.35+v*0.25})`;
          hctx.fillRect(gx*gridSize,gy*gridSize,gridSize,gridSize);
        }
      }

      const heatmapDataUrl=heatCanvas.toDataURL('image/png');

      setCtrScore(overall);
      setCtrBreakdown({
        contrast:  contrastScore,
        vibrancy:  vibrancyScore,
        text:      textScore,
        subject:   subjectScore,
        comp:      compScore,
        safe:      safeScore,
        tips,
        heatmap:   heatmapDataUrl,
      });
    } catch(err){
      console.error('CTR analyze error:',err);
      setCtrScore(0);
    }
    setCtrLoading(false);
  }

  // Performance: Throttled rimlight to max 60fps
  const applyRimLightThrottled = (x, y) => {
    const now = Date.now();
    if (now - lastRimLightRef.current < 16) return; // 60fps limit
    lastRimLightRef.current = now;
    applyRimLight(x, y);
  };

  function applyRimLight(x, y){
    try{
      if(!selectedLayer || selectedLayer.type!=='image') return;

      const layerSnapshot={...selectedLayer};
      const baseSrc=getSafeImageSrc({src:layerSnapshot.src});
      if(!baseSrc) throw new Error('Invalid base image source');

      const hex=rimLightColor.replace('#','');
      const lr=parseInt(hex.slice(0,2),16);
      const lg=parseInt(hex.slice(2,4),16);
      const lb=parseInt(hex.slice(4,6),16);
      const lightR=Math.round((rimLightSize/100)*Math.max(layerSnapshot.width,layerSnapshot.height)*0.7);
      const intensity=rimLightIntensity/100;
      const softness=rimLightSoftness/100;

      const baseImg=new Image();
      baseImg.crossOrigin='Anonymous';
      baseImg.onload=()=>{
        try{
          const tmp=document.createElement('canvas');
          tmp.width=baseImg.naturalWidth;
          tmp.height=baseImg.naturalHeight;
          const ctx=tmp.getContext('2d');
          if(!ctx) throw new Error('Canvas context unavailable');

          ctx.drawImage(baseImg,0,0,tmp.width,tmp.height);

          const applyGradient=()=>{
            try{
              const scaleX=tmp.width/layerSnapshot.width;
              const scaleY=tmp.height/layerSnapshot.height;
              const scaledX=x*scaleX;
              const scaledY=y*scaleY;
              const scaledR=lightR*Math.max(scaleX,scaleY);

              const gradient=ctx.createRadialGradient(scaledX,scaledY,0,scaledX,scaledY,scaledR);
              gradient.addColorStop(0,`rgba(${lr},${lg},${lb},${intensity*0.6})`);
              gradient.addColorStop(softness*0.5,`rgba(${lr},${lg},${lb},${intensity*0.3})`);
              gradient.addColorStop(1,`rgba(${lr},${lg},${lb},0)`);
              ctx.fillStyle=gradient;
              ctx.fillRect(0,0,tmp.width,tmp.height);

              const nextSrc=tmp.toDataURL('image/png');
              if(!getSafeImageSrc({src:nextSrc})) throw new Error('Invalid rim-light output source');

              setLayers(prev=>{
                const hasTarget=prev.some(layer=>layer.id===layerSnapshot.id&&layer.type==='image');
                if(!hasTarget) return prev;
                const nl=prev.map(layer=>layer.id===layerSnapshot.id&&layer.type==='image'
                  ? {...layer,src:nextSrc,paintSrc:null}
                  : layer);
                pushHistoryDebounced(nl);
                return nl;
              });
            }catch(err){
              console.error('[RIM LIGHT] Apply failed:', err);
              alert('Rim light failed to apply. Please try again.');
            }
          };

          const paintSrc=getSafeImageSrc({src:layerSnapshot.paintSrc});
          if(paintSrc){
            const paintImg=new Image();
            paintImg.crossOrigin='Anonymous';
            paintImg.onload=()=>{
              try{ ctx.drawImage(paintImg,0,0,tmp.width,tmp.height); }catch(err){ console.error('[RIM LIGHT] Paint overlay draw failed:', err); }
              applyGradient();
            };
            paintImg.onerror=()=>applyGradient();
            paintImg.src=paintSrc;
          }else{
            applyGradient();
          }
        }catch(err){
          console.error('[RIM LIGHT] Processing failed:', err);
          alert('Rim light failed to apply. Please try again.');
        }
      };
      baseImg.onerror=()=>alert('Rim light failed to load the image source.');
      baseImg.src=baseSrc;
    }catch(err){
      console.error('[RIM LIGHT] Error:', err);
      alert('Rim light failed to apply. Please try again.');
    }
  }

  async function removeBackgroundFromSelected(){
    const layer=selectedLayer;
    if(!layer || layer.type!=='image'){
      alert('Select an image layer first.');
      return;
    }

    const targetId=layer.id;
    try{
      setRemoveBgBusy(true);
      let base64Src=getSafeImageSrc(layer);
      if(!base64Src) throw new Error('Selected layer has no valid source');

      if(!base64Src.startsWith('data:image/')){
        const response=await fetch(base64Src);
        if(!response.ok) throw new Error(`Image fetch failed (${response.status})`);
        const blob=await response.blob();
        base64Src=await readBlobAsDataUrl(blob);
      }

      if(!base64Src || !base64Src.startsWith('data:image/')){
        throw new Error('Failed to normalize source image');
      }

      const res=await fetch('https://thumbframe-api-production.up.railway.app/remove-bg',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({image:base64Src}),
      });
      if(!res.ok) throw new Error(`Remove background request failed (${res.status})`);

      const data=await res.json();
      if(data?.error) throw new Error(data.error);

      const candidateSrc=typeof data?.image==='string' ? data.image.trim() : '';
      if(!candidateSrc || !getSafeImageSrc({src:candidateSrc})){
        throw new Error('Remove background returned invalid image data');
      }

      const safeDataUrl=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.crossOrigin='Anonymous';
        img.onload=()=>{
          try{
            const tmp=document.createElement('canvas');
            tmp.width=img.naturalWidth;
            tmp.height=img.naturalHeight;
            const ctx=tmp.getContext('2d');
            if(!ctx) throw new Error('Canvas context unavailable');
            ctx.drawImage(img,0,0,tmp.width,tmp.height);
            const next=tmp.toDataURL('image/png');
            if(!getSafeImageSrc({src:next})) throw new Error('Invalid processed image output');
            resolve(next);
          }catch(err){
            reject(err);
          }
        };
        img.onerror=()=>reject(new Error('Processed image could not be loaded'));
        img.src=candidateSrc;
      });

      setLayers(prev=>{
        const hasTarget=prev.some(item=>item.id===targetId&&item.type==='image');
        if(!hasTarget) return prev;
        const subjectShadowColor=brandKit?.outline_color||'#FFFFFF';
        const nl=prev.map(item=>item.id===targetId&&item.type==='image'
          ? {...item,src:safeDataUrl,paintSrc:null,isSubject:true,effects:{...(item.effects||defaultEffects()),shadow:{enabled:true,x:0,y:0,blur:20,color:subjectShadowColor,opacity:100},dropShadow:{enabled:false,x:0,y:0,blur:0,color:subjectShadowColor,opacity:100,spread:0},subjectOutline:{enabled:false,color:subjectShadowColor,width:0}}}
          : item);
        pushHistoryDebounced(nl);
        return nl;
      });

      setCmdLog('Background removed');
    }catch(err){
      console.error('[REMOVE BG] Error:', err);
      alert('Failed to remove background. Check your connection and try again.');
    }finally{
      setRemoveBgBusy(false);
    }
  }

  // ── Smart Cutout: run SAM 2 segmentation ─────────────────────────────────
  async function runSegmentation(){
    setSegmentBusy(true);
    setSegmentMasks([]);
    setSegmentError('');
    setSegmentStatus('Rendering canvas...');
    try{
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w;
      flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);
      const imageDataUrl=flatCanvas.toDataURL('image/jpeg',0.92);

      setSegmentStatus('Analyzing objects in your thumbnail...');

      const res=await fetch(`${resolvedApiUrl}/api/segment`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(token?{'Authorization':`Bearer ${token}`}:{}),
        },
        body:JSON.stringify({image:imageDataUrl}),
      });
      const data=await res.json();

      if(!res.ok){
        if(res.status===429){setSegmentError(data.error||'Daily limit reached. Upgrade to continue.');return;}
        throw new Error(data.error||'Segmentation failed');
      }
      if(!data.success||!Array.isArray(data.masks)||data.masks.length===0){
        throw new Error('No objects detected in this thumbnail');
      }

      setSegmentMasks(data.masks);
      setCmdLog(`Detected ${data.masks.length} object${data.masks.length!==1?'s':''} — click on canvas to isolate`);
    }catch(err){
      console.error('[SEGMENT]',err);
      setSegmentError(err.message||'Segmentation failed. Please try again.');
    }finally{
      setSegmentBusy(false);
      setSegmentStatus('');
    }
  }

  // ── Smart Cutout: apply a mask → new isolated layer ──────────────────────
  async function applySegmentMask(maskIdx){
    const maskUrl=segmentMasks[maskIdx];
    if(!maskUrl)return;
    try{
      setCmdLog('Isolating object...');

      // 1. Full composited image
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w;
      flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);

      // 2. Load mask PNG
      const maskImg=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error('Mask load failed'));
        img.src=maskUrl;
      });

      // 3. Apply mask as alpha channel
      const out=document.createElement('canvas');
      out.width=p.preview.w;
      out.height=p.preview.h;
      const ctx=out.getContext('2d');
      ctx.drawImage(flatCanvas,0,0);
      ctx.globalCompositeOperation='destination-in';
      ctx.drawImage(maskImg,0,0,out.width,out.height);
      ctx.globalCompositeOperation='source-over';

      // 4. Compute tight bounding box from mask pixels
      const mCanvas=document.createElement('canvas');
      mCanvas.width=p.preview.w;
      mCanvas.height=p.preview.h;
      mCanvas.getContext('2d').drawImage(maskImg,0,0,p.preview.w,p.preview.h);
      const mData=mCanvas.getContext('2d').getImageData(0,0,p.preview.w,p.preview.h).data;
      let minX=p.preview.w,maxX=0,minY=p.preview.h,maxY=0;
      for(let y=0;y<p.preview.h;y++){
        for(let x=0;x<p.preview.w;x++){
          const i=(y*p.preview.w+x)*4;
          if(mData[i]>24||mData[i+3]>24){
            if(x<minX)minX=x; if(x>maxX)maxX=x;
            if(y<minY)minY=y; if(y>maxY)maxY=y;
          }
        }
      }
      const cropW=Math.max(1,maxX-minX+1);
      const cropH=Math.max(1,maxY-minY+1);

      // 5. Crop to tight bounds
      const cropped=document.createElement('canvas');
      cropped.width=cropW;
      cropped.height=cropH;
      cropped.getContext('2d').drawImage(out,minX,minY,cropW,cropH,0,0,cropW,cropH);

      // 6. Add as new layer
      addLayer({
        type:'image',
        src:cropped.toDataURL('image/png'),
        width:cropW,
        height:cropH,
        x:minX,
        y:minY,
        cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
        imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
        isSubject:true,
        effects:defaultEffects(),
      });

      setSegmentMasks([]);
      setSegmentHoverIdx(null);
      setActiveTool('select');
      setCmdLog('Object isolated as new layer');
    }catch(err){
      console.error('[SEGMENT APPLY]',err);
      setCmdLog('Failed to isolate object. Try again.');
    }
  }

  function addMaskToLayer(id){ // eslint-disable-line no-unused-vars
    const layer=layers.find(l=>l.id===id);
    if(!layer||layer.type==='background') return;
    // Create a white mask canvas (white = show, black = hide)
    const tmp=document.createElement('canvas');
    tmp.width=layer.width||p.preview.w;
    tmp.height=layer.height||p.preview.h;
    const ctx=tmp.getContext('2d');
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,tmp.width,tmp.height);
    updateLayer(id,{
      mask:{
        enabled:true,
        inverted:false,
        data:tmp.toDataURL('image/png'),
        width:tmp.width,
        height:tmp.height,
      }
    });
    setCmdLog('Mask added — paint black to hide, white to reveal');
  }

  function removeMaskFromLayer(id){ // eslint-disable-line no-unused-vars
    updateLayer(id,{mask:{enabled:false,inverted:false,data:null}});
    if(maskingLayerId===id) setMaskingLayerId(null);
  }

  function applyMaskToLayer(id){ // eslint-disable-line no-unused-vars
    const layer=layers.find(l=>l.id===id);
    if(!layer?.mask?.enabled||!layer.mask.data) return;
    // Flatten mask into image permanently
    const img=new Image();
    img.onload=()=>{
      const mask=new Image();
      mask.onload=()=>{
        const tmp=document.createElement('canvas');
        tmp.width=layer.width;tmp.height=layer.height;
        const ctx=tmp.getContext('2d');
        ctx.drawImage(img,0,0,layer.width,layer.height);
        ctx.globalCompositeOperation='destination-in';
        ctx.drawImage(mask,0,0,layer.width,layer.height);
        updateLayer(id,{src:tmp.toDataURL('image/png'),mask:{enabled:false,inverted:false,data:null}});
      };
      mask.src=layer.mask.data;
    };
    img.src=layer.src;
  }


  function alignLayer(id,dir){
    const layer=layers.find(l=>l.id===id);if(!layer||layer.type==='background')return;
    const w=layer.width||100,h=layer.height||(layer.fontSize||48);
    let u={};
    if(dir==='center')  u={x:Math.round((p.preview.w-w)/2),y:Math.round((p.preview.h-h)/2)};
    if(dir==='center-h')u={x:Math.round((p.preview.w-w)/2)};
    if(dir==='center-v')u={y:Math.round((p.preview.h-h)/2)};
    if(dir==='left')u={x:0};if(dir==='right')u={x:p.preview.w-w};
    if(dir==='top') u={y:0};if(dir==='bottom')u={y:p.preview.h-h};
    updateLayer(id,u);
  }
  function flipLayer(id,axis){const layer=layers.find(l=>l.id===id);if(!layer)return;if(axis==='h')updateLayer(id,{flipH:!layer.flipH});if(axis==='v')updateLayer(id,{flipV:!layer.flipV});}

  function applyTextTemplate(t){
    setTextInput(t.text);setFontSize(t.fontSize);setFontFamily(t.fontFamily);setFontWeight(t.fontWeight||700);
    setTextColor(t.textColor);setStrokeColor(t.strokeColor);setStrokeWidth(t.strokeWidth);setShadowEnabled(t.shadowEnabled);
    setShadowColor(t.shadowColor||'#000000');setShadowBlur(t.shadowBlur||14);setShadowX(t.shadowX||2);setShadowY(t.shadowY||2);
    setGlowEnabled(t.glowEnabled||false);setGlowColor(t.glowColor||'#f97316');
    setLetterSpacing(t.letterSpacing||0);setLineHeight(t.lineHeight||1.2);setTextAlign(t.textAlign||'left');
    addLayer({type:'text',text:t.text,fontSize:t.fontSize,fontFamily:t.fontFamily,fontWeight:t.fontWeight||700,fontItalic:false,textColor:t.textColor,strokeColor:t.strokeColor,strokeWidth:t.strokeWidth,shadowEnabled:t.shadowEnabled,shadowColor:t.shadowColor||'#000000',shadowBlur:t.shadowBlur||14,shadowX:t.shadowX||2,shadowY:t.shadowY||2,glowEnabled:t.glowEnabled||false,glowColor:t.glowColor||'#f97316',arcEnabled:false,arcRadius:120,letterSpacing:t.letterSpacing||0,lineHeight:t.lineHeight||1.2,textAlign:t.textAlign||'left'});
  }
  function addText(){
    // ── Sprint 4: MrBeast-style defaults ──────────────────────────────────
    const nextFontFamily=brandKit?.primary_font||'Anton';
    const nextTextColor=brandKit?.brand_colors?.[0]||'#FFD700'; // YouTube gold
    const nextStrokeColor='#000000';
    const nextStrokeWidth=8;                  // strokeUniform equivalent (CSS scales with element)
    const nextShadowColor='rgba(0,0,0,0.8)';  // heavy drop shadow
    const nextShadowBlur=15;
    const nextShadowX=0;
    const nextShadowY=10;
    addRecentColor(nextTextColor);
    addLayer({type:'text',text:textInput||'MY THUMBNAIL',fontSize,fontFamily:nextFontFamily,fontWeight:900,fontItalic,textColor:nextTextColor,strokeColor:nextStrokeColor,strokeWidth:nextStrokeWidth,shadowEnabled:true,shadowColor:nextShadowColor,shadowBlur:nextShadowBlur,shadowX:nextShadowX,shadowY:nextShadowY,glowEnabled,glowColor,arcEnabled,arcRadius,letterSpacing,lineHeight,textAlign});
    setTextColor(nextTextColor);
    setFontFamily(nextFontFamily);
    setFontWeight(900);
    setStrokeColor(nextStrokeColor);
    setStrokeWidth(nextStrokeWidth);
    setShadowEnabled(true);
    setShadowColor(nextShadowColor);
    setShadowBlur(nextShadowBlur);
    setShadowX(nextShadowX);
    setShadowY(nextShadowY);
  }
  function addShape(type){
    addRecentColor(fillColor);
    const id=newId();
    const x=snapToGrid?Math.round(40/10)*10:40;
    const y=snapToGrid?Math.round(40/10)*10:40;
    const shapeLayer={
      id,
      type:'shape',
      shape:type,
      fillColor,
      strokeColor,
      width:100,
      height:100,
      x,
      y,
      opacity:100,
      hidden:false,
      locked:false,
      blendMode:'normal',
      flipH:false,
      flipV:false,
      rotation:0,
      effects:defaultEffects(),
    };
    setLayers(prev=>{
      const nl=[...prev,shapeLayer];
      pushHistory(nl);
      return nl;
    });
    setSelectedId(id);
  }
  function addSvgSticker(svg,label){addLayer({type:'svg',svg,label,width:64,height:64});}
  function injectBrandSubject(kit){
    const subjectUrl=kit?.subject_image_url||kit?.subject_url||kit?.face_image_url||brandKitFace;
    if(!subjectUrl)return;
    const outlineColor=kit?.outline_color||'#FFFFFF';
    const img=new Image();
    img.crossOrigin='Anonymous';
    img.onload=()=>{
      const cW=p.preview.w,cH=p.preview.h,aspect=img.naturalWidth/img.naturalHeight,ca=cW/cH;
      let w,h;
      if(aspect>ca){w=cW*0.5;h=w/aspect;}else{h=cH*0.5;w=h*aspect;}
      addLayer({
        type:'image',src:subjectUrl,width:Math.round(w),height:Math.round(h),
        originalWidth:img.naturalWidth,originalHeight:img.naturalHeight,
        x:Math.round((cW-w)/2),y:Math.round((cH-h)/2),
        cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
        imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
        isSubject:true,
        effects:{
          ...defaultEffects(),
          shadow:{enabled:true,x:0,y:0,blur:20,color:outlineColor,opacity:100},
          dropShadow:{enabled:false,x:0,y:0,blur:0,color:outlineColor,opacity:100,spread:0},
          subjectOutline:{enabled:false,color:outlineColor,width:0},
        },
      });
    };
    img.src=subjectUrl;
  }

  function readBlobAsDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');
      reader.onerror=()=>reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  }

  function addImageFromFile(file){
    if(!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try{
        const base64Src = typeof reader.result==='string' ? reader.result : '';
        if(!getSafeImageSrc({src:base64Src})) throw new Error('Invalid image source from FileReader');

        const img = new Image();
        img.crossOrigin='Anonymous';
        img.onload = () => {
          try{
            const cW=p.preview.w,cH=p.preview.h,ia=img.naturalWidth/img.naturalHeight,ca=cW/cH;
            if(!Number.isFinite(ia) || ia<=0) throw new Error('Image dimensions are invalid');

            let w,h;if(ia>ca){h=cH;w=h*ia;}else{w=cW;h=w/ia;}

            const id=newId();
            const newLayerObj={
              id,
              type:'image',
              src:base64Src,
              width:Math.round(w),
              height:Math.round(h),
              originalWidth:img.naturalWidth,
              originalHeight:img.naturalHeight,
              x:Math.round((cW-w)/2),
              y:Math.round((cH-h)/2),
              cropTop:0,
              cropBottom:0,
              cropLeft:0,
              cropRight:0,
              imgBrightness:100,
              imgContrast:100,
              imgSaturate:100,
              imgBlur:0,
              opacity:100,
              hidden:false,
              locked:false,
              blendMode:'normal',
              flipH:false,
              flipV:false,
              rotation:0,
              effects:defaultEffects(),
            };

            setLayers(prevLayers=>{
              const nextLayers=[...prevLayers,newLayerObj];
              pushHistory(nextLayers);
              return nextLayers;
            });
            setSelectedId(id);
          }catch(err){
            console.error('[ADD IMAGE] Image processing failed:', err);
            alert('Failed to add image. Please try a different file.');
          }
        };

        img.onerror = () => {
          console.error('[ADD IMAGE] Image decode failed');
          alert('Failed to decode image file. Please try another image.');
        };

        img.src = base64Src;
      }catch(err){
        console.error('[ADD IMAGE] FileReader onload failed:', err);
        alert('Failed to add image. Please try a different file.');
      }
    };

    reader.onerror = (error) => {
      console.error('[ADD IMAGE] FileReader error:', error);
      alert('Failed to read image file. Please try another file.');
    };

    reader.readAsDataURL(file);
  }

  function handleImageUpload(e){
    const files = Array.from(e.target.files||[]);
    files.forEach(file=>addImageFromFile(file));
    e.target.value='';
  }

  function updateSuggestions(val){if(!val.trim()){setCmdSuggestions([]);return;}const v=val.toLowerCase();setCmdSuggestions(ALL_COMMANDS.filter(c=>c.cmd.toLowerCase().startsWith(v)||c.desc.toLowerCase().includes(v)).slice(0,6));}
  function handleCmdKey(e){
    if(e.key==='Enter'){runCommand(cmdInput);return;}
    if(e.key==='ArrowUp'){e.preventDefault();const i=Math.min(cmdHistoryIdx+1,cmdHistory.length-1);setCmdHistoryIdx(i);if(cmdHistory[i])setCmdInput(cmdHistory[i]);return;}
    if(e.key==='ArrowDown'){e.preventDefault();const i=Math.max(cmdHistoryIdx-1,-1);setCmdHistoryIdx(i);setCmdInput(i===-1?'':cmdHistory[i]||'');return;}
    if(e.key==='Escape'){setCmdOpen(false);setCmdSuggestions([]);return;}
    if(e.key==='Tab'&&cmdSuggestions.length>0){e.preventDefault();setCmdInput(cmdSuggestions[0].cmd.split(' ')[0]+' ');setCmdSuggestions([]);return;}
  }
  function runCommand(raw){
    const cmd=raw.trim().toLowerCase();if(!cmd)return;
    let log='';
    setCmdHistory(prev=>[raw,...prev.slice(0,19)]);setCmdHistoryIdx(-1);setCmdInput('');setCmdSuggestions([]);
    if(cmd==='help'){setShowCmdHelp(h=>!h);log='Toggled help';}
    else if(cmd==='new'||cmd==='clear'){newCanvas();log='New canvas';}
    else if(cmd==='save'){saveDesign(designName);log=`Saved: ${designName}`;}
    else if(cmd==='undo'){undo();log='Undone';}
    else if(cmd==='redo'){redo();log='Redone';}
    else if(cmd==='dark'){setDarkMode(true);log='Dark mode';}
    else if(cmd==='light'){setDarkMode(false);log='Light mode';}
    else if(cmd==='grid'){setShowGrid(g=>!g);log='Grid toggled';}
    else if(cmd==='ruler'){setShowRuler(r=>!r);log='Ruler toggled';}
    else if(cmd==='snap'){setSnapToGrid(s=>!s);log='Snap toggled';}
    else if(cmd==='delete'){if(selectedId){deleteLayer(selectedId);log='Deleted';}}
    else if(cmd==='duplicate'){if(selectedId){duplicateLayer(selectedId);log='Duplicated';}}
    else if(cmd==='hide'){if(selectedId){updateLayer(selectedId,{hidden:true});log='Hidden';}}
    else if(cmd==='show'){if(selectedId){updateLayer(selectedId,{hidden:false});log='Shown';}}
    else if(cmd==='up'){if(selectedId)moveLayerUp(selectedId);log='Layer up';}
    else if(cmd==='down'){if(selectedId)moveLayerDown(selectedId);log='Layer down';}
    else if(cmd==='flip h'){if(selectedId)flipLayer(selectedId,'h');log='Flipped H';}
    else if(cmd==='flip v'){if(selectedId)flipLayer(selectedId,'v');log='Flipped V';}
    else if(cmd.startsWith('align ')){const dir=cmd.slice(6).trim();if(selectedId)alignLayer(selectedId,dir);log=`Aligned ${dir}`;}
    else if(cmd.startsWith('blend ')){const mode=cmd.slice(6).trim();if(selectedId&&BLEND_MODES.includes(mode)){updateLayer(selectedId,{blendMode:mode});log=`Blend: ${mode}`;}else log='Unknown blend mode';}
    else if(cmd.startsWith('bg ')){const c=raw.slice(3);updateBg({bgColor:c,bgGradient:null});log=`BG: ${c}`;}
    else if(cmd.startsWith('text ')){const t=raw.slice(5);addLayer({type:'text',text:t,fontSize,fontFamily,fontWeight,fontItalic,textColor,strokeColor,strokeWidth,shadowEnabled,shadowColor,shadowBlur,shadowX,shadowY,glowEnabled,glowColor,arcEnabled,arcRadius,letterSpacing,lineHeight,textAlign});log='Added text';}
    else if(cmd.startsWith('font ')){setFontFamily(raw.slice(5));log=`Font: ${raw.slice(5)}`;}
    else if(cmd.startsWith('size ')){const s=parseInt(cmd.slice(5));if(!isNaN(s)){setFontSize(s);log=`Size: ${s}px`;}}
    else if(cmd.startsWith('opacity ')){const o=parseInt(cmd.slice(8));if(!isNaN(o)&&selectedId){updateLayer(selectedId,{opacity:o});log=`Opacity: ${o}%`;}}
    else if(cmd.startsWith('zoom ')){const z=parseInt(cmd.slice(5));if(!isNaN(z)){setZoom(z/100);if(z<=100)setPanOffset({x:0,y:0});log=`Zoom: ${z}%`;}}
    else if(['circle','rect','roundrect','triangle','star','arrow','diamond','hexagon','heart','cross','line'].includes(cmd)){addShape(cmd);log=`Added ${cmd}`;}
    else log='Unknown — type "help"';
    setCmdLog(log);
  }

  function onLayerMouseDown(e,id){
    if(activeTool==='rimlight') return;
    if(activeTool==='brush') return;
    if(activeTool==='lasso' && isLassoMode) return;
    const layer=layers.find(l=>l.id===id);if(!layer)return;
    console.log('🖱️ Layer clicked:', layer.type, 'id:', id, 'z-index:', layers.indexOf(layer)+1);
    e.stopPropagation();
    justSelectedRef.current=true;
    setSelectedId(id);
    console.log('✅ Layer selected:', id, 'canDrag:', canDrag, 'activeTool:', activeTool);
    if(layer.type==='background'){setActiveTool('background');return;}
    if(!canDrag||layer.locked)return;
    const rect=canvasRef.current.getBoundingClientRect();
    draggingRef.current=id;
    dragOffsetRef.current={x:(e.clientX-rect.left)/zoomRef.current-layer.x,y:(e.clientY-rect.top)/zoomRef.current-layer.y};
  }

  function onResizeStart(e,id){
    if(!canDrag)return;
    e.stopPropagation();e.preventDefault();
    justSelectedRef.current=true;
    const layer=layers.find(l=>l.id===id);
    resizingRef.current=id;
    resizeStartRef.current={mouseX:e.clientX,mouseY:e.clientY,origW:layer.width||100,origH:layer.height||100,origFontSize:layer.fontSize||48,aspect:(layer.width||100)/(layer.height||100)};
  }

  function onLayerDragStart(e,id){setLayerDragId(id);e.dataTransfer.effectAllowed='move';}
  function onLayerDragOver(e,id){e.preventDefault();if(id!==layerDragId)setLayerDragOver(id);}
  function onLayerDrop(e,targetId){
    e.preventDefault();if(!layerDragId||layerDragId===targetId)return;
    const fromIdx=layers.findIndex(l=>l.id===layerDragId);
    const toIdx=layers.findIndex(l=>l.id===targetId);
    if(fromIdx<0||toIdx<0)return;
    const nl=[...layers];const[removed]=nl.splice(fromIdx,1);nl.splice(toIdx,0,removed);
    setLayers(nl);pushHistory(nl);setLayerDragId(null);setLayerDragOver(null);
  }
  function onLayerDragEnd(){setLayerDragId(null);setLayerDragOver(null);}

  async function handleDownload({ tier='basic', transparent=transparentExport }={}){
    try{
      const target = document.getElementById('thumbnail-canvas');
      if(!target){
        alert('Canvas container not found');
        return;
      }

      const hasProAccess = isProUser || token==='test-key-123' || user?.is_admin || user?.email==='kadengajkowski@gmail.com';
      const wantsProDownload = tier==='pro';
      const isActuallyPro = wantsProDownload && hasProAccess;

      if(wantsProDownload && !hasProAccess){
        fetch('https://thumbframe-api-production.up.railway.app/checkout',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email: user?.email, plan:'pro'}),
        }).then(r=>r.json()).then(d=>{
          if(d?.url)window.location.href=d.url;
          else alert('Upgrade to Pro to unlock 4K downloads.');
        }).catch(()=>alert('Upgrade to Pro to unlock 4K downloads.'));
        return;
      }

      const scale = isActuallyPro ? 3 : 0.6;
      const imageQuality = isActuallyPro ? 1.0 : 0.5;

      const capturedCanvas = await html2canvas(target, {
        backgroundColor: transparent ? null : '#000000',
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale,
      });

      if(!isActuallyPro){
        // Basic tier intentionally degrades output and applies watermark.
        const ctx = capturedCanvas.getContext('2d');
        if(ctx){
          ctx.imageSmoothingEnabled = false;
          const watermark = 'Created with ThumbFrame';
          const size = Math.max(14, Math.round(capturedCanvas.width * 0.024));
          const margin = Math.max(12, Math.round(capturedCanvas.width * 0.02));
          ctx.font = `700 ${size}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.58)';
          const textWidth = ctx.measureText(watermark).width;
          ctx.fillText(watermark, capturedCanvas.width - textWidth - margin, capturedCanvas.height - margin);
        }
      }

      const fileBase = `${designName.replace(/\s+/g,'-')}-${isActuallyPro ? 'pro' : 'basic'}`;
      const link = document.createElement('a');
      link.download = `${fileBase}.jpg`;
      link.href = capturedCanvas.toDataURL('image/jpeg', imageQuality);
      link.click();

      setShowDownload(false);
    }catch(err){
      console.error('Download failed:', err);
      alert('Failed to download image. Please try again.');
    }
  }

  // eslint-disable-next-line no-unused-vars
  async function exportCanvas(format='png', transparent=false){
    // ✅ Free = 640×360 preview res, Pro = full resolution
    const isPro   = isProUser || token==='test-key-123';
    const isAdmin = user?.email === 'kadengajkowski@gmail.com';
    const hasProAccess = isPro || isAdmin;
    const exportW = hasProAccess ? p.width  : Math.round(p.width  * 0.5);
    const exportH = hasProAccess ? p.height : Math.round(p.height * 0.5);
    const canvas  = document.createElement('canvas');
    canvas.width  = exportW;
    canvas.height = exportH;

    await renderLayersToCanvas(canvas, layers, { transparent });

    // Generate download
    const fname = `${designName.replace(/\s+/g,'-')}-${p.width}x${p.height}`;

    if(format==='webp'){
      const blob = await new Promise(r=>canvas.toBlob(r,'image/webp',0.92));
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fname}.webp`;
      link.href     = url;
      link.click();
      URL.revokeObjectURL(url);
    } else if(format==='jpg'){
      const link = document.createElement('a');
      link.download = `${fname}.jpg`;
      link.href     = canvas.toDataURL('image/jpeg',0.95);
      link.click();
    } else {
      const blob = await new Promise(r=>canvas.toBlob(r,'image/png'));
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fname}.png`;
      link.href     = url;
      link.click();
      URL.revokeObjectURL(url);
    }

    setShowDownload(false);
  }

  function renderCropHandles(obj){
    if(activeTool!=='crop') return null;
    const hs={
      position:'absolute',
      width:10,height:10,
      background:'#fff',
      border:`2px solid ${T.accent}`,
      borderRadius:2,
      zIndex:1002,
      pointerEvents:'all',
    };
    function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,Math.round(v)));}
    function makeDragHandle(onDrag){
      return (e)=>{
        e.stopPropagation();e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const sx=e.clientX,sy=e.clientY;
        const sc={
          cropLeft:obj.cropLeft||0,cropTop:obj.cropTop||0,
          cropRight:obj.cropRight||0,cropBottom:obj.cropBottom||0,
        };
        function onMove(mv){
          const dx=(mv.clientX-sx)/zoomRef.current;
          const dy=(mv.clientY-sy)/zoomRef.current;
          updateLayerSilent(obj.id,onDrag(dx,dy,sc,obj));
        }
        function onUp(uev){
          const dx=(uev.clientX-sx)/zoomRef.current;
          const dy=(uev.clientY-sy)/zoomRef.current;
          updateLayer(obj.id,onDrag(dx,dy,sc,obj));
          window.removeEventListener('pointermove',onMove);
          window.removeEventListener('pointerup',onUp);
        }
        window.addEventListener('pointermove',onMove);
        window.addEventListener('pointerup',onUp);
      };
    }
    const handles=[
      {s:{top:-5,left:-5,cursor:'nw-resize'},   fn:(dx,dy,s,o)=>({cropLeft:clamp(s.cropLeft+dx,0,o.width-s.cropRight-1),  cropTop:clamp(s.cropTop+dy,0,o.height-s.cropBottom-1)})},
      {s:{top:-5,left:'50%',transform:'translateX(-50%)',cursor:'n-resize'},  fn:(dx,dy,s,o)=>{const minH=20;const newCropTop=clamp(s.cropTop+dy,0,o.height-s.cropBottom-minH);const actualDy=newCropTop-s.cropTop;return{cropTop:newCropTop,y:o.y+actualDy};}},
      {s:{top:-5,right:-5,cursor:'ne-resize'},  fn:(dx,dy,s,o)=>({cropRight:clamp(s.cropRight-dx,0,o.width-s.cropLeft-1), cropTop:clamp(s.cropTop+dy,0,o.height-s.cropBottom-1)})},
      {s:{top:'50%',left:-5,transform:'translateY(-50%)',cursor:'w-resize'},  fn:(dx,dy,s,o)=>({cropLeft:clamp(s.cropLeft+dx,0,o.width-s.cropRight-1)})},
      {s:{top:'50%',right:-5,transform:'translateY(-50%)',cursor:'e-resize'}, fn:(dx,dy,s,o)=>({cropRight:clamp(s.cropRight-dx,0,o.width-s.cropLeft-1)})},
      {s:{bottom:-5,left:-5,cursor:'sw-resize'},  fn:(dx,dy,s,o)=>({cropLeft:clamp(s.cropLeft+dx,0,o.width-s.cropRight-1),   cropBottom:clamp(s.cropBottom-dy,0,o.height-s.cropTop-1)})},
      {s:{bottom:-5,left:'50%',transform:'translateX(-50%)',cursor:'s-resize'},fn:(dx,dy,s,o)=>({cropBottom:clamp(s.cropBottom-dy,0,o.height-s.cropTop-1)})},
      {s:{bottom:-5,right:-5,cursor:'se-resize'}, fn:(dx,dy,s,o)=>({cropRight:clamp(s.cropRight-dx,0,o.width-s.cropLeft-1),  cropBottom:clamp(s.cropBottom-dy,0,o.height-s.cropTop-1)})},
    ];
    return(
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:1002}}>
        <div style={{position:'absolute',inset:0,border:`1.5px dashed ${T.accent}`,pointerEvents:'none'}}/>
        {handles.map((h,i)=>(
          <div
            key={i}
            onMouseDown={e=>e.stopPropagation()}
            onPointerDown={makeDragHandle(h.fn)}
            style={{...hs,...h.s}}
          />
        ))}
      </div>
    );
  }

  function renderResizeHandles(obj){
    if(!canDrag)return null;
    const hs={position:'absolute',width:8,height:8,background:'#fff',border:`1.5px solid ${T.accent}`,borderRadius:2,zIndex:1000};
    return(<>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,bottom:-4,right:-4,cursor:'se-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,bottom:-4,left:-4,cursor:'sw-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,top:-4,right:-4,cursor:'ne-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,top:-4,left:-4,cursor:'nw-resize'}}/>
      <div style={{
        position:'absolute',top:-20,left:'50%',
        width:2,height:20,
        background:T.accent,
        transform:'translateX(-50%)',
        pointerEvents:'none',
        zIndex:1000,
      }}/>
      <div
        onPointerDown={e=>{
          console.log(' Rotation handle clicked for object:', obj.id, 'type:', obj.type);
          e.stopPropagation();e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const startAngle=Math.atan2(
            e.clientY-(canvasRef.current.getBoundingClientRect().top+zoomRef.current*(obj.y+(obj.height||50)/2)),
            e.clientX-(canvasRef.current.getBoundingClientRect().left+zoomRef.current*(obj.x+(obj.width||100)/2))
          )*180/Math.PI;
          const startRotation=obj.rotation||0;
          const currentRotation={value:startRotation};
          console.log(' Starting rotation from:', startRotation, 'degrees');
          function onMove(ev){
            const angle=Math.atan2(
              ev.clientY-(canvasRef.current.getBoundingClientRect().top+zoomRef.current*(obj.y+(obj.height||50)/2)),
              ev.clientX-(canvasRef.current.getBoundingClientRect().left+zoomRef.current*(obj.x+(obj.width||100)/2))
            )*180/Math.PI;
            const newRot=startRotation+(angle-startAngle);
            currentRotation.value=newRot;
            updateLayerSilent(obj.id,{rotation:newRot});
          }
          function onUp(){
            console.log(' Rotation complete. Final angle:', currentRotation.value, 'degrees');
            updateLayer(obj.id,{rotation:currentRotation.value});
            window.removeEventListener('pointermove',onMove);
            window.removeEventListener('pointerup',onUp);
          }
          window.addEventListener('pointermove',onMove);
          window.addEventListener('pointerup',onUp);
        }}
        style={{
          position:'absolute',top:-32,left:'50%',
          transform:'translateX(-50%)',
          width:24,height:24,
          background:'#fff',
          border:`3px solid ${T.accent}`,
          borderRadius:'50%',
          cursor:'grab',
          zIndex:1001,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:12,userSelect:'none',
          boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
          transition:'transform 0.1s',
        }}
        onMouseEnter={e=>e.currentTarget.style.transform='translateX(-50%) scale(1.15)'}
        onMouseLeave={e=>e.currentTarget.style.transform='translateX(-50%) scale(1)'}
        title="Rotate (drag to rotate)">↻</div>
    </>);
  }
  function getLayerCursor(obj){if(activeTool==='brush'||activeTool==='rimlight')return'crosshair';if(canDrag&&!obj.locked)return'grab';return'pointer';}

  function renderLayerElement(obj){
    if(obj.hidden)return null;
    const isSelected=selectedId===obj.id;
    const zIndex=layers.indexOf(obj)+1;
    const opacityVal=(obj.opacity??100)/100;
    const selStyle=isSelected&&obj.type!=='image'?{outline:`1.5px solid ${T.accent}`,outlineOffset:2}:{};
    const flipStyle={transform:`rotate(${obj.rotation||0}deg) scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`};
    const blendStyle={mixBlendMode:obj.blendMode||'normal',userSelect:'none',WebkitUserSelect:'none'};
    const cursor=getLayerCursor(obj);
    const effectsStyle=getEffectsStyle(obj.effects);
    const DelBtn=()=>isSelected&&obj.type!=='background'?(<div onClick={e=>{e.stopPropagation();deleteLayer(obj.id);}} style={{position:'absolute',top:-10,right:-10,width:20,height:20,background:T.danger,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',cursor:'pointer',zIndex:999,fontWeight:'bold',userSelect:'none'}}>×</div>):null;

    if(obj.type==='background')return(
      <div key={obj.id} onMouseDown={e=>{e.stopPropagation();justSelectedRef.current=true;setSelectedId(obj.id);setActiveTool('background');}}
        style={{position:'absolute',left:0,top:0,width:p.preview.w,height:p.preview.h,zIndex:0,opacity:opacityVal,background:obj.bgGradient?`linear-gradient(180deg,${obj.bgGradient[0]},${obj.bgGradient[1]})`:obj.bgColor,cursor:'pointer',...flipStyle}}>
        {isSelected&&<div style={{position:'absolute',inset:0,border:`1.5px dashed ${T.accent}`,pointerEvents:'none'}}/>}
        {showGrid&&<div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:'20px 20px'}}/>}
        {showRuler&&<>
          <div style={{position:'absolute',top:0,left:0,right:0,height:16,background:'rgba(0,0,0,0.5)',pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.w/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',left:i*40,fontSize:7,color:'rgba(255,255,255,0.7)',paddingLeft:2,top:4}}>{i*40}</div>))}</div>
          <div style={{position:'absolute',top:0,left:0,bottom:0,width:16,background:'rgba(0,0,0,0.5)',pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.h/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',top:i*40+4,left:1,fontSize:7,color:'rgba(255,255,255,0.7)'}}>{i*40}</div>))}</div>
        </>}
        {isSelected&&renderResizeHandles(obj)}
      </div>
    );
    if(obj.type==='text'){
      const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)pts.push(`0 0 20px ${obj.glowColor||'#f97316'}`);return pts.length?pts.join(','):'none';})();
      return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,userSelect:'none',...selStyle,...blendStyle,...flipStyle,...effectsStyle}}><span style={{fontFamily:resolveFontFamily(obj.fontFamily),fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,fontStyle:obj.fontItalic?'italic':'normal',color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',paintOrder:'stroke fill',textShadow:ts,whiteSpace:'nowrap',letterSpacing:`${obj.letterSpacing||0}px`,lineHeight:obj.lineHeight||1.2,display:'block'}}>{obj.arcEnabled?<ArcText obj={obj}/>:obj.text}</span>{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    }
    if(obj.type==='shape')return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,...selStyle,...blendStyle,...flipStyle,...effectsStyle}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    if(obj.type==='svg')return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,width:obj.width,height:obj.height,...selStyle,...blendStyle,...flipStyle,...effectsStyle}}><div style={{width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:obj.svg}}/>{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    if(obj.type==='image'){
      const cropW=obj.width-(obj.cropLeft||0)-(obj.cropRight||0);
      const cropH=obj.height-(obj.cropTop||0)-(obj.cropBottom||0);
      const hasMask=obj.mask?.enabled&&obj.mask?.points?.length>=3;
      const maskInverted=hasMask&&obj.mask?.inverted;
      // Build clip-path polygon from stored lasso points (relative to the cropped div)
      let clipPathValue='none';
      if(hasMask){
        const mpts=obj.mask.points;
        if(maskInverted){
          // SVG path with two subpaths + evenodd: outer rect is "kept", lasso interior is "cut"
          const outerRect=`M 0,0 H ${cropW} V ${cropH} H 0 Z`;
          const innerPath=`M ${mpts[0].x},${mpts[0].y} `+mpts.slice(1).map(p=>`L ${p.x},${p.y}`).join(' ')+' Z';
          clipPathValue=`path(evenodd, '${outerRect} ${innerPath}')`;
        } else {
          const pts=mpts.map(p=>`${p.x}px ${p.y}px`).join(',');
          clipPathValue=`polygon(${pts})`;
        }
      }
      const imageSrc = getSafeImageSrc(obj);
      return(
        <div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)}
          style={{
            position:'absolute',left:obj.x,top:obj.y,zIndex,
            opacity:opacityVal,cursor,...selStyle,...blendStyle,
            overflow:'hidden',width:cropW,height:cropH,...effectsStyle,
            clipPath: clipPathValue,
            WebkitClipPath: clipPathValue,
          }}>
          {imageSrc ? (
            <img src={imageSrc} alt="" style={{
              width:obj.width,height:obj.height,display:'block',
              pointerEvents:'none',userSelect:'none',WebkitUserSelect:'none',
              marginLeft:-(obj.cropLeft||0),marginTop:-(obj.cropTop||0),
              transform:`scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`,
              filter:`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${obj.imgBlur||0}px)`,
            }}/>
          ) : (
            <div style={{
              width:cropW,height:cropH,display:'flex',alignItems:'center',justifyContent:'center',
              border:'1px dashed rgba(255,255,255,0.35)',background:'rgba(0,0,0,0.2)',
              color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'600',textTransform:'uppercase',
            }}>
              Missing image source
            </div>
          )}
          {isSelected&&renderResizeHandles(obj)}
          {isSelected&&renderCropHandles(obj)}
          <DelBtn/>
          {obj.mask?.enabled&&(
            <div style={{
              position:'absolute',bottom:-18,left:0,fontSize:9,
              background:'rgba(249,115,22,0.9)',color:'#fff',
              padding:'2px 6px',borderRadius:3,pointerEvents:'none',
              whiteSpace:'nowrap',
            }}>⊡ Mask active</div>
          )}
        </div>
      );
    }
  }

  const css={
    label:   {fontSize:'9px',color:T.muted,marginBottom:5,marginTop:16,letterSpacing:'1px',fontWeight:'700',textTransform:'uppercase',display:'block'},
    input:   {padding:'8px 11px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',transition:'border-color 0.15s'},
    color:   {width:'100%',height:34,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer',background:'none'},
    pill:    (a)=>({padding:'4px 11px',borderRadius:6,border:`1px solid ${a?T.accent:T.border}`,background:a?T.accent:T.input,color:a?'#fff':T.muted,fontSize:11,cursor:'pointer',fontWeight:a?'600':'400',transition:'all 0.12s'}),
    iconBtn: (a)=>({padding:'5px 10px',borderRadius:6,border:`1px solid ${a?T.accentBorder:T.border}`,background:a?T.accentDim:'transparent',color:a?T.accent:T.muted,cursor:'pointer',fontSize:12,fontWeight:a?'600':'400',transition:'all 0.12s'}),
    toolBtn: (a)=>({
      padding:'7px 10px',borderRadius:7,border:'none',
      background:a?T.accentDim:'transparent',
      color:a?T.accent:T.muted,
      fontSize:11,cursor:'pointer',textAlign:'left',width:'100%',
      fontWeight:a?'600':'500',
      display:'flex',alignItems:'center',gap:8,marginBottom:1,
      borderLeft:a?`2px solid ${T.accent}`:'2px solid transparent',
      transition:'all 0.1s',
    }),
    addBtn:  {padding:'9px 12px',borderRadius:8,background:T.accent,color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:'600',width:'100%',marginTop:12,transition:'opacity 0.15s'},
    section: {padding:10,background:T.bg2,borderRadius:8,border:`1px solid ${T.border}`,marginTop:8},
    row:     {display:'flex',gap:6,alignItems:'center'},
    divider: {height:1,background:T.border,margin:'12px 0'},
  };

  if(isLoading){
    return (
      <div style={{
        minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
        background:T.bg,
        fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <style>{`
          @keyframes editor-spin { to { transform: rotate(360deg); } }
          @keyframes editor-fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        `}</style>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20,animation:'editor-fade-up 0.4s ease both'}}>
          {/* Logo mark */}
          <div style={{position:'relative',width:52,height:52}}>
            <div style={{
              position:'absolute',inset:0,borderRadius:14,
              background:'linear-gradient(135deg,#f97316,#ea580c)',
              boxShadow:'0 0 40px rgba(249,115,22,0.35)',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>
              <span style={{fontSize:22,fontWeight:'900',color:'#fff',letterSpacing:'-1px'}}>T</span>
            </div>
            <div style={{
              position:'absolute',bottom:-2,right:-2,width:18,height:18,
              borderRadius:'50%',border:`3px solid ${T.bg}`,
              borderTopColor:'transparent',
              background:'transparent',
              animation:'editor-spin 0.75s linear infinite',
              boxSizing:'border-box',
              borderColor:`${T.accent} transparent transparent transparent`,
            }}/>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:'700',color:T.text,letterSpacing:'-0.3px',marginBottom:4}}>ThumbFrame</div>
            <div style={{fontSize:12,color:T.muted,fontWeight:'400'}}>Loading your workspace…</div>
          </div>
          {/* Progress bar */}
          <div style={{width:160,height:2,borderRadius:2,background:T.border,overflow:'hidden'}}>
            <div style={{height:'100%',width:'40%',borderRadius:2,background:T.accent,animation:'editor-spin 1.5s ease-in-out infinite',transformOrigin:'left center'}}/>
          </div>
        </div>
      </div>
    );
  }

  const tools=[
    {key:'select',    label:'Select',       icon:'↖',  group:'Tools'},
    {key:'move',      label:'Move',         icon:'✋',  group:'Tools'},
    {key:'crop',      label:'Crop',         icon:'⊡',  group:'Tools'},
    {key:'zoom',      label:'Zoom',         icon:'🔍', group:'Tools'},
    null,
    {key:'text',      label:'Text',         icon:'T',   group:'Create'},
    {key:'shapes',    label:'Shapes',       icon:'○',   group:'Create'},
    {key:'stickers',  label:'Elements',     icon:'◆',   group:'Create'},
    {key:'memes',     label:'Memes & GIFs', icon:'▣',   group:'Create'},
    null,
    {key:'brush',     label:'Brush',        icon:'⌀',  group:'Paint'},
    {key:'freehand',  label:'Draw',         icon:'✏',  group:'Paint'},
    {key:'rimlight',  label:'Rim Light',    icon:'☀',  group:'Paint'},
    {key:'removebg',  label:'Remove BG',    icon:'✂',  group:'Paint'},
    {key:'segment',   label:'Smart Cutout', icon:'◎',  group:'Paint'},
    {key:'lasso',     label:'Lasso Mask',   icon:'✂️', group:'Paint'},
    null,
    {key:'background',label:'Background',   icon:'▨',   group:'Design'},
    {key:'effects',   label:'Effects',      icon:'✦',   group:'Design'},
    {key:'brandkit',  label:'Brand Kit',    icon:'◐',   group:'Design'},
    null,
    {key:'templates', label:'Templates',    icon:'⊞',   group:'Analyze'},
    {key:'ctr',       label:'CTR Score',    icon:'◈',   group:'Analyze'},
    {key:'face',      label:'Face Score',   icon:'◉',   group:'Analyze'},
    {key:'ab',        label:'A/B Variants', icon:'⊟',   group:'Analyze'},
    {key:'yttest',    label:'YouTube Test', icon:'▶',   group:'Analyze'},
    {key:'resize',    label:'All Sizes',    icon:'⊠',   group:'Analyze'},
    null,
    {key:'upload',    label:'Upload',       icon:'↑',   group:'File'},
  ];

  const StampLayer=memo(function StampLayer({obj,scale}){
    if(obj.hidden||obj.type==='background')return null;
    if(obj.type==='text'){
      const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${(obj.shadowX||2)*scale}px ${(obj.shadowY||2)*scale}px ${(obj.shadowBlur||14)*scale}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);return pts.length?pts.join(','):'none';})();
      return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,fontSize:obj.fontSize*scale,fontFamily:resolveFontFamily(obj.fontFamily),fontWeight:obj.fontWeight||700,color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth*scale}px ${obj.strokeColor}`:'none',paintOrder:'stroke fill',textShadow:ts,whiteSpace:'nowrap',pointerEvents:'none',opacity:(obj.opacity||100)/100}}>{obj.text}</div>;
    }
    if(obj.type==='image'){
      const cropW=(obj.width-(obj.cropLeft||0)-(obj.cropRight||0))*scale;
      const cropH=(obj.height-(obj.cropTop||0)-(obj.cropBottom||0))*scale;
      const imageSrc = getSafeImageSrc(obj);
      if(!imageSrc){
        return <div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:cropW,height:cropH,opacity:(obj.opacity||100)/100,pointerEvents:'none',border:'1px dashed rgba(255,255,255,0.35)',background:'rgba(0,0,0,0.2)'}}/>;
      }
      return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:cropW,height:cropH,overflow:'hidden',opacity:(obj.opacity||100)/100,pointerEvents:'none'}}><img src={imageSrc} alt="" style={{width:obj.width*scale,height:obj.height*scale,display:'block',marginLeft:-(obj.cropLeft||0)*scale,marginTop:-(obj.cropTop||0)*scale}}/></div>;
    }
    if(obj.type==='shape')return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,opacity:(obj.opacity||100)/100,transform:`scale(${scale})`,transformOrigin:'top left',pointerEvents:'none'}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}</div>;
    if(obj.type==='svg')return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:obj.width*scale,height:obj.height*scale,opacity:(obj.opacity||100)/100,pointerEvents:'none'}} dangerouslySetInnerHTML={{__html:obj.svg}}/>;
    return null;
  });

  const CanvasLayerRenderer = memo(function CanvasLayerRenderer({ layers, renderLayerElement }) {
    return <>{layers.map(obj=>renderLayerElement(obj))}</>;
  }, (prevProps, nextProps) => prevProps.layers === nextProps.layers);

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:T.bg,color:T.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',overflow:'hidden'}}>

      {showFileTab&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowFileTab(false);}}>
          <div style={{width:560,maxHeight:'80vh',background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:14,fontWeight:'700'}}>File</div>
              <button onClick={()=>setShowFileTab(false)} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11}}>Close</button>
            </div>
            <div style={{display:'flex',flex:1,overflow:'hidden'}}>
              <div style={{width:200,borderRight:`1px solid ${T.border}`,
                padding:'12px',display:'flex',flexDirection:'column',gap:4}}>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  New
                </div>
                <button onClick={newCanvas} style={{...css.addBtn,marginTop:0,
                  background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>
                  + New canvas
                </button>

                <div style={{height:1,background:T.border,margin:'10px 0'}}/>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  Save
                </div>
                <input value={designName} onChange={e=>setDesignName(e.target.value)} onBlur={triggerAutoSave}
                  style={css.input} placeholder="Design name..."/>
                <button onClick={()=>saveProject({ silent: false, nameOverride: designName })}
                  style={{...css.addBtn,marginTop:6}}>
                  💾 Save design
                </button>

                <div style={{height:1,background:T.border,margin:'10px 0'}}/>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  Export
                </div>
                <button onClick={()=>{setShowFileTab(false);setShowDownload(true);}}
                  style={{...css.addBtn,marginTop:0,background:T.success}}>
                  ↓ Download PNG/JPG
                </button>
                <button onClick={()=>exportAllPlatforms()}
                  style={{...css.addBtn,marginTop:4,background:'transparent',
                    color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>
                  ⊠ Export all platforms
                </button>
              </div>
              <div style={{flex:1,padding:'12px',overflowY:'auto'}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:10}}>Saved ({savedDesigns.length})</div>
                {savedDesigns.length===0&&<div style={{fontSize:12,color:T.muted,padding:'20px 0',textAlign:'center'}}>No saved designs yet.</div>}
                {savedDesigns.map(d=>(
                  <div key={d.id} style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.input,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                      {d.thumbnail&&(
                        <img src={d.thumbnail} alt="thumb" style={{width:56,height:32,objectFit:'cover',borderRadius:4,border:`1px solid ${T.border}`,flexShrink:0}}/>
                      )}
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:'600',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.name||'Untitled'}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>{d.created||'Just now'} · {d.platform||'youtube'}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:5,flexShrink:0}}>
                      <button onClick={()=>loadProject(d)} style={{padding:'5px 10px',borderRadius:5,border:`1px solid ${T.accent}`,background:'transparent',color:T.accent,fontSize:11,cursor:'pointer',fontWeight:'600'}}>Open</button>
                      <button onClick={()=>deleteDesign(d.id)} style={{padding:'5px 8px',borderRadius:5,border:`1px solid ${T.danger}`,background:'transparent',color:T.danger,fontSize:11,cursor:'pointer'}}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiBar&&(
        <div style={{
          position:'fixed',inset:0,zIndex:1000,
          display:'flex',alignItems:'flex-start',justifyContent:'center',
          paddingTop:80,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',
        }} onClick={e=>{if(e.target===e.currentTarget)setShowAiBar(false);}}>
          <div style={{
            width:600,background:T.panel,borderRadius:14,
            border:`1px solid ${T.border}`,
            boxShadow:'0 24px 80px rgba(0,0,0,0.6)',overflow:'hidden',
          }}>
            <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,
              display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:14}}>⚡</span>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input
                    ref={aiCmdInputRef}
                    value={aiCmd}
                    onChange={e=>setAiCmd(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==='Enter') executeAiCommand(aiCmd);
                      if(e.key==='Escape') setShowAiBar(false);
                    }}
                    placeholder='Try: "make it cinematic" or "add gold text EPIC"...'
                    style={{flex:1,background:'transparent',border:'none',
                      outline:'none',fontSize:14,color:T.text,fontFamily:'inherit'}}
                    autoFocus
                  />
                  <div style={{
                    fontSize:9,fontWeight:'700',color:'#f59e0b',
                    background:'rgba(245,158,11,0.12)',
                    border:'1px solid rgba(245,158,11,0.3)',
                    padding:'2px 8px',borderRadius:10,
                    letterSpacing:'0.5px',flexShrink:0,
                    textTransform:'uppercase',
                  }}>
                    Experimental
                  </div>
                </div>
              </div>
              {aiCmdLoading&&(
                <span style={{fontSize:12,color:T.muted,flexShrink:0}}>thinking...</span>
              )}
            </div>
            {aiCmdLog&&(
              <div style={{padding:'10px 20px',fontSize:12,
                color:aiCmdLog.startsWith('✓')?T.success:T.warning,
                borderBottom:`1px solid ${T.border}`,fontWeight:'600'}}>
                {aiCmdLog}
              </div>
            )}
            <div style={{padding:'12px 20px'}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:10,fontWeight:'600',
                textTransform:'uppercase',letterSpacing:'0.5px'}}>
                Example commands
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[
                  'Make it cinematic',
                  'Make the colors more vibrant',
                  'Make it darker and more dramatic',
                  'Make the text bigger and bolder',
                  'Add gold glowing text that says EPIC',
                  'Change the background to dark blue',
                  'Make it look like a gaming thumbnail',
                  'Add a text layer that says WATCH THIS',
                  'Delete the top text layer',
                  'Make the image pop more',
                  'Add a drop shadow to the text',
                  'Make it brighter',
                ].map((example,i)=>(
                  <div key={i}
                    onClick={()=>{ setAiCmd(example); aiCmdInputRef.current?.focus(); }}
                    style={{padding:'7px 10px',borderRadius:6,
                      background:T.input,border:`1px solid ${T.border}`,
                      fontSize:11,color:T.muted,cursor:'pointer',lineHeight:1.4}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                    {example}
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'10px 20px',borderTop:`1px solid ${T.border}`,
              display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={()=>executeAiCommand(aiCmd)} disabled={aiCmdLoading}
                style={{padding:'8px 20px',borderRadius:7,border:'none',
                  background:T.accent,color:'#fff',cursor:'pointer',
                  fontSize:13,fontWeight:'700',opacity:aiCmdLoading?0.6:1}}>
                {aiCmdLoading?'Working...':'Run command'}
              </button>
              <button onClick={()=>setShowAiBar(false)}
                style={{padding:'8px 14px',borderRadius:7,
                  border:`1px solid ${T.border}`,background:'transparent',
                  color:T.muted,cursor:'pointer',fontSize:12}}>
                Close
              </button>
              <span style={{fontSize:10,color:T.muted,marginLeft:'auto'}}>
                Ctrl+I to open · Enter to run · Esc to close
              </span>
            </div>
          </div>
        </div>
      )}

      {showDownload&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowDownload(false);}}>
          <div style={{width:380,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,padding:'24px',boxShadow:'0 24px 80px rgba(0,0,0,0.8)'}}>
            <div style={{fontSize:15,fontWeight:'700',marginBottom:4}}>Download image</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:10}}>
              {p.label} · {p.width}×{p.height}px
            </div>
            <div style={{...css.section,marginTop:0,marginBottom:10,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:12,fontWeight:'700',color:T.text,marginBottom:4}}>Basic Download</div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8}}>Low quality export for all users (scale: 0.6) with watermark.</div>
              <button onClick={()=>handleDownload({tier:'basic'})}
                style={{...css.addBtn,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`}}>
                Download Basic JPG (Watermarked)
              </button>
            </div>
            <div style={{...css.section,marginTop:0,marginBottom:8,border:`1px solid ${T.warning}`}}>
              <div style={{fontSize:12,fontWeight:'700',color:T.warning,marginBottom:4}}>Pro Download (4K)</div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8}}>4K-grade export for Pro users only (scale: 3), no watermark.</div>
              <button onClick={()=>handleDownload({tier:'pro'})}
                style={{...css.addBtn,marginTop:0,background:T.warning,color:'#000'}}>
                Download Pro 4K JPG
              </button>
              <div style={{fontSize:10,color:T.muted,marginTop:6}}>Non-Pro users will be redirected to upgrade.</div>
            </div>
            <div style={css.section}><div style={css.row}><input type="checkbox" id="transp" checked={transparentExport} onChange={e=>setTransparentExport(e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/><label htmlFor="transp" style={{fontSize:12,color:T.text,cursor:'pointer',flex:1}}>Transparent background</label></div></div>
            <button onClick={()=>handleDownload({tier:'basic',transparent:true})} style={{...css.addBtn,background:T.success,marginTop:8}}>Basic JPG with transparency</button>
            <button onClick={()=>setShowDownload(false)} style={{width:'100%',padding:9,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:12,cursor:'pointer',marginTop:8}}>Cancel</button>
          </div>
        </div>
      )}



      {cmdOpen&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:80,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget){setCmdOpen(false);setCmdSuggestions([]);}}}>
          <div style={{width:560,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:14,color:T.muted,fontFamily:'monospace'}}>⌘</span>
              <input ref={cmdInputRef} value={cmdInput} onChange={e=>{setCmdInput(e.target.value);updateSuggestions(e.target.value);}} onKeyDown={handleCmdKey} placeholder='text "Hello", bg #ff0000, save, align center, help...' style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:14,color:T.text,fontFamily:'inherit'}} autoFocus/>
              <span style={{fontSize:10,color:T.muted,background:T.input,padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`}}>Esc</span>
            </div>
            {cmdLog&&<div style={{padding:'6px 16px',fontSize:11,color:T.success,borderBottom:`1px solid ${T.border}`}}>✓ {cmdLog}</div>}
            {cmdSuggestions.length>0&&cmdSuggestions.map((s,i)=>(<div key={i} onClick={()=>{setCmdInput(s.cmd);runCommand(s.cmd);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',cursor:'pointer',borderBottom:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontSize:13,color:T.text,fontFamily:'monospace'}}>{s.cmd}</span><span style={{fontSize:11,color:T.muted}}>{s.desc}</span></div>))}
            {cmdInput===''&&!showCmdHelp&&(<div style={{padding:'10px 16px'}}><div style={{fontSize:10,color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:8}}>Recent</div>{cmdHistory.slice(0,5).map((h,i)=>(<div key={i} onClick={()=>{setCmdInput(h);runCommand(h);}} style={{padding:'6px 8px',fontSize:12,color:T.text,cursor:'pointer',borderRadius:5,fontFamily:'monospace'}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{h}</div>))}{cmdHistory.length===0&&<div style={{fontSize:12,color:T.muted,padding:'4px 8px'}}>No recent commands</div>}</div>)}
            {showCmdHelp&&(<div style={{maxHeight:360,overflowY:'auto',padding:'8px 0'}}>{ALL_COMMANDS.map((c,i)=>(<div key={i} onClick={()=>setCmdInput(c.cmd)} style={{display:'flex',justifyContent:'space-between',padding:'7px 16px',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontSize:12,color:T.accent,fontFamily:'monospace'}}>{c.cmd}</span><span style={{fontSize:11,color:T.muted}}>{c.desc}</span></div>))}</div>)}
            <div style={{padding:'8px 16px',borderTop:`1px solid ${T.border}`,display:'flex',gap:12}}>{[['↑↓','History'],['Tab','Complete'],['Enter','Run'],['Esc','Close']].map(([k,d])=>(<div key={k} style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:10,background:T.input,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`,color:T.text,fontFamily:'monospace'}}>{k}</span><span style={{fontSize:10,color:T.muted}}>{d}</span></div>))}</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{
        display:'flex',alignItems:'center',
        height:isMobile?42:50,
        padding:isMobile?'0 10px':'0 14px',
        background:T.panel,
        borderBottom:`1px solid ${T.border}`,
        gap:isMobile?4:8,
        flexShrink:0,
        overflowX:isMobile?'auto':'visible',
        boxShadow:'0 1px 0 rgba(255,255,255,0.02)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {onExit&&(
            <button onClick={onExit} style={{
              padding:'5px 8px',borderRadius:6,
              border:`1px solid ${T.border}`,
              background:'transparent',color:T.muted,cursor:'pointer',fontSize:12,
              lineHeight:1,
            }}>←</button>
          )}
          {/* Brand mark */}
          <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
            <div style={{
              width:24,height:24,borderRadius:6,
              background:'linear-gradient(135deg,#f97316,#ea580c)',
              display:'flex',alignItems:'center',justifyContent:'center',
              flexShrink:0,
              boxShadow:'0 2px 8px rgba(249,115,22,0.3)',
            }}>
              <span style={{fontSize:11,fontWeight:'900',color:'#fff',letterSpacing:'-0.5px'}}>T</span>
            </div>
            <span style={{fontSize:13,fontWeight:'700',color:T.text,letterSpacing:'-0.4px'}}>ThumbFrame</span>
          </div>
          {!isMobile&&(
            <div style={{width:1,height:16,background:T.border,margin:'0 2px'}}/>
          )}
          {!isMobile&&(
            <button onClick={()=>setShowFileTab(true)}
              style={{
                padding:'5px 11px',borderRadius:6,
                border:`1px solid ${T.border}`,
                background:'transparent',color:T.muted,
                cursor:'pointer',fontSize:11,fontWeight:'500',
                display:'flex',alignItems:'center',gap:4,
              }}
              onMouseEnter={e=>{e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor=T.border;}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.muted;e.currentTarget.style.borderColor=T.border;}}>
              File
            </button>
          )}
        </div>
        {!isMobile&&(
          <button onClick={()=>{setCmdOpen(true);setTimeout(()=>cmdInputRef.current?.focus(),50);}}
            style={{
              flex:1,maxWidth:320,
              display:'flex',alignItems:'center',gap:8,
              padding:'7px 12px',borderRadius:8,
              border:`1px solid ${T.border}`,
              background:T.input,
              color:T.muted,cursor:'pointer',fontSize:12,textAlign:'left',
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(249,115,22,0.3)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <span style={{fontSize:12,color:T.muted,fontFamily:'monospace'}}>⌘</span>
            <span style={{flex:1,color:T.muted,fontSize:11}}>Search commands…</span>
            {cmdLog&&<span style={{fontSize:10,color:T.success,fontWeight:'600',flexShrink:0,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✓ {cmdLog}</span>}
            <span style={{fontSize:9,background:T.bg2,padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`,color:T.muted,flexShrink:0,letterSpacing:'0.3px'}}>⌃K</span>
          </button>
        )}
        {!isMobile&&(
          <button
            onClick={()=>{setShowAiBar(true);setTimeout(()=>aiCmdInputRef.current?.focus(),50);}}
            style={{
              display:'flex',alignItems:'center',gap:5,
              padding:'6px 12px',borderRadius:7,
              border:`1px solid ${T.accentBorder}`,
              background:T.accentDim,
              color:T.accent,cursor:'pointer',fontSize:11,fontWeight:'600',
              flexShrink:0,letterSpacing:'0.1px',
            }}
            title="AI command bar (Ctrl+I)">
            ⚡ AI
            <span style={{
              fontSize:8,fontWeight:'700',color:'#f59e0b',
              background:'rgba(245,158,11,0.12)',
              border:'1px solid rgba(245,158,11,0.25)',
              padding:'1px 4px',borderRadius:4,letterSpacing:'0.5px',
            }}>BETA</span>
          </button>
        )}
        {!isMobile&&(
          <button
            onClick={()=>{
              const isPro=isProUser;
              const isAdmin=user?.is_admin||user?.email==='kadengajkowski@gmail.com';
              if(!isPro&&!isAdmin){setShowPaywall(true);return;}
              setActiveTool('ai');
            }}
            style={{
              display:'flex',alignItems:'center',gap:5,
              padding:'6px 12px',borderRadius:7,
              border:'1px solid rgba(245,158,11,0.25)',
              background:'rgba(245,158,11,0.07)',
              color:'#f59e0b',cursor:'pointer',fontSize:11,fontWeight:'600',
              flexShrink:0,
            }}
            title="AI Generate thumbnail from text prompt">
            ✦ Generate
            <span style={{
              fontSize:8,fontWeight:'700',color:'#fff',
              background:'linear-gradient(135deg,#f59e0b,#ef4444)',
              padding:'1px 5px',borderRadius:4,letterSpacing:'0.5px',
            }}>PRO</span>
          </button>
        )}
        <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0,marginLeft:'auto'}}>
          {/* Save status pill */}
          <div style={{
            padding:'3px 9px',
            borderRadius:6,
            border:`1px solid ${
              saveStatus==='Error'?`${T.danger}44`
              :saveStatus==='Saving...'?`${T.warning}44`
              :saveStatus==='Unsaved'?T.border
              :`${T.success}33`}`,
            background:saveStatus==='Error'?`${T.danger}12`
              :saveStatus==='Saving...'?`${T.warning}12`
              :saveStatus==='Unsaved'?'transparent'
              :`${T.success}10`,
            color:saveStatus==='Error'?T.danger
              :saveStatus==='Saving...'?T.warning
              :saveStatus==='Unsaved'?T.muted
              :T.success,
            fontSize:10,fontWeight:'600',letterSpacing:'0.2px',
            minWidth:52,textAlign:'center',
          }}>{saveStatus}</div>
          {/* Undo / Redo */}
          <div style={{display:'flex',gap:1,background:T.input,borderRadius:7,padding:'2px',border:`1px solid ${T.border}`}}>
            <button onClick={undo} disabled={historyIndex<=0}
              style={{padding:'4px 8px',borderRadius:5,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13,opacity:historyIndex<=0?0.25:0.7,lineHeight:1}}>↩</button>
            <button onClick={redo} disabled={historyIndex>=history.length-1}
              style={{padding:'4px 8px',borderRadius:5,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13,opacity:historyIndex>=history.length-1?0.25:0.7,lineHeight:1}}>↪</button>
          </div>
          <button onClick={()=>saveDesign(designName)}
            style={{
              padding:'6px 13px',borderRadius:7,
              border:`1px solid ${T.border}`,
              background:T.input,color:T.text,
              cursor:'pointer',fontSize:11,fontWeight:'600',
              display:'flex',alignItems:'center',gap:5,
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            Save
          </button>
          <button onClick={()=>selectedId&&duplicateLayer(selectedId)}
            disabled={!selectedId||selectedLayer?.type==='background'}
            style={{
              padding:'6px 12px',borderRadius:7,
              border:`1px solid ${T.border}`,
              background:'transparent',
              color:(!selectedId||selectedLayer?.type==='background')?T.muted:T.muted,
              cursor:'pointer',fontSize:11,fontWeight:'500',
              opacity:(!selectedId||selectedLayer?.type==='background')?0.3:1,
            }}>
            ⧉
          </button>
          <div style={{width:1,height:18,background:T.border,margin:'0 1px'}}/>
          {/* Zoom control */}
          <div style={{display:'flex',gap:0,alignItems:'center',background:T.input,borderRadius:7,padding:'2px 4px',border:`1px solid ${T.border}`}}>
            <button onClick={()=>setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)))} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13}}>−</button>
            <input
              type="number"
              value={Math.round(zoom*100)}
              onChange={e=>{
                const v=Number(e.target.value);
                if(!isNaN(v)&&v>=10&&v<=1600) setZoom(v/100);
              }}
              style={{
                width:46,textAlign:'center',
                background:'transparent',border:'none',
                outline:'none',fontSize:11,color:T.text,
                fontFamily:'inherit',cursor:'text',
              }}
              onPointerDown={e=>e.stopPropagation()}
              min={10} max={1600}
            />
            <span style={{fontSize:11,color:T.muted}}>%</span>
            <button onClick={()=>setZoom(z=>Math.min(16,+(z+0.1).toFixed(1)))} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13}}>+</button>
            <button onClick={()=>setZoom(1)} style={{padding:'2px 5px',borderRadius:4,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:10}}>fit</button>
          </div>
          {!isMobile&&(
            <div style={{display:'flex',gap:1,background:T.input,borderRadius:7,padding:'2px',border:`1px solid ${T.border}`}}>
              <button onClick={()=>setShowGrid(g=>!g)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showGrid?T.accentDim:'transparent',color:showGrid?T.accent:T.muted,cursor:'pointer',fontSize:11,fontWeight:'500'}} title="Grid">⊞</button>
              <button onClick={()=>setShowRuler(r=>!r)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showRuler?T.accentDim:'transparent',color:showRuler?T.accent:T.muted,cursor:'pointer',fontSize:11}} title="Ruler">⊢</button>
              <button onClick={()=>setSnapToGrid(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:snapToGrid?T.accentDim:'transparent',color:snapToGrid?T.accent:T.muted,cursor:'pointer',fontSize:11}} title="Snap to grid">⊡</button>
              <button onClick={()=>setShowSafeZones(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showSafeZones?T.accentDim:'transparent',color:showSafeZones?T.accent:T.muted,cursor:'pointer',fontSize:10,whiteSpace:'nowrap'}} title="Safe zones">Zones</button>
              <button onClick={()=>setShowStampTest(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showStampTest?T.accentDim:'transparent',color:showStampTest?T.accent:T.muted,cursor:'pointer',fontSize:10,whiteSpace:'nowrap'}} title="Mobile preview">Mobile</button>
              <button onClick={()=>setDarkMode(!darkMode)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:11}} title="Toggle theme">{darkMode?'○':'●'}</button>
            </div>
          )}
          <div style={{width:1,height:18,background:T.border,margin:'0 1px',flexShrink:0}}/>
          <label style={{
            padding:isMobile?'5px 10px':'6px 13px',
            borderRadius:7,
            border:`1px solid ${T.border}`,
            background:T.input,color:T.muted,
            cursor:'pointer',fontSize:11,fontWeight:'500',
            display:'flex',alignItems:'center',gap:4,flexShrink:0,
          }}>
            ↑ {isMobile?'':'Upload'}
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{display:'none'}}/>
          </label>
          <button onClick={()=>setShowDownload(true)}
            style={{
              padding:isMobile?'5px 12px':'6px 16px',
              borderRadius:7,border:'none',
              background:'#22c55e',color:'#fff',
              cursor:'pointer',fontSize:11,fontWeight:'700',
              display:'flex',alignItems:'center',gap:5,
              boxShadow:'0 2px 12px rgba(34,197,94,0.25)',flexShrink:0,
            }}
            onMouseEnter={e=>e.currentTarget.style.background='#16a34a'}
            onMouseLeave={e=>e.currentTarget.style.background='#22c55e'}>
            ↓ {isMobile?'':'Export'}
          </button>
          {!isMobile&&(
            <button
              onClick={generateAndExportVariants}
              disabled={variantExporting}
              title="Generate A/B/C variants and download as 2x JPEG ZIP"
              style={{
                padding:'6px 13px',borderRadius:7,
                border:'1px solid rgba(124,58,237,0.3)',
                background:variantExporting?'transparent':'rgba(124,58,237,0.1)',
                color:variantExporting?T.muted:'#a78bfa',
                cursor:variantExporting?'not-allowed':'pointer',
                fontSize:11,fontWeight:'600',
                display:'flex',alignItems:'center',gap:5,
                flexShrink:0,opacity:variantExporting?0.5:1,
                transition:'all 0.15s',
              }}>
              {variantExporting
                ?<><span style={{display:'inline-block',animation:'editor-spin 0.8s linear infinite'}}>◌</span> Exporting…</>
                :<>⚡ A/B Export</>
              }
            </button>
          )}
          <button onClick={()=>{
            const isPro = isProUser;
            const isAdmin = user?.is_admin || user?.email === 'kadengajkowski@gmail.com';
            if (isPro || isAdmin) {
              setShowAlreadyPro(true);
              return;
            }
            fetch('https://thumbframe-api-production.up.railway.app/checkout',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({email: user?.email, plan:'pro'}),
            }).then(r=>r.json()).then(d=>{if(d.url)window.location.href=d.url;});
          }}
            style={{
              padding:'6px 13px',borderRadius:7,
              border:'1px solid rgba(249,115,22,0.3)',
              background:'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(234,88,12,0.1))',
              color:T.accent,cursor:'pointer',fontSize:11,fontWeight:'700',
              display:'flex',alignItems:'center',gap:5,flexShrink:0,
              letterSpacing:'0.1px',
            }}>
            ⚡ Pro
          </button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',flexDirection:isMobile?'column':'row'}}>

        {/* Left sidebar — hidden on mobile */}
        {!isMobile&&<div style={{width:148,background:T.sidebar,borderRight:`1px solid ${T.border}`,padding:'6px 5px',display:'flex',flexDirection:'column',overflowY:'auto',flexShrink:0}}>
          {(()=>{
            let lastGroup = null;
            const grouped = [];
            tools.forEach((t,i)=>{
              if(t===null) return;
              if(t.group !== lastGroup){
                lastGroup = t.group;
                grouped.push({type:'header',group:t.group});
              }
              grouped.push({type:'tool',tool:t});
            });
            
            return grouped.map((item,i)=>{
              if(item.type==='header'){
                const isExpanded = expandedCategories[item.group];
                return(
                  <div key={`header-${item.group}`}
                    onClick={()=>setExpandedCategories(prev=>({...prev,[item.group]:!prev[item.group]}))}
                    style={{
                      fontSize:'8px',color:T.muted,fontWeight:'700',
                      letterSpacing:'1.2px',textTransform:'uppercase',
                      padding:'10px 10px 3px',
                      cursor:'pointer',
                      display:'flex',alignItems:'center',justifyContent:'space-between',
                      userSelect:'none',
                    }}>
                    <span style={{letterSpacing:'0.9px'}}>{item.group}</span>
                    <span style={{
                      fontSize:'9px',
                      transform:isExpanded?'rotate(90deg)':'rotate(0deg)',
                      transition:'transform 0.15s',
                      color:T.muted,opacity:0.6,
                    }}>›</span>
                  </div>
                );
              }

              const t = item.tool;
              const isExpanded = expandedCategories[t.group];
              if(!isExpanded) return null;
              const isLassoActive = t.key==='lasso'&&isLassoMode;
              const isActive = activeTool===t.key;

              return(
                <button key={t.key}
                  onClick={()=>{setActiveTool(t.key);if(t.key!=='lasso')setIsLassoMode(false);}}
                  title={t.label}
                  style={{
                    ...css.toolBtn(isActive||isLassoActive),
                    ...(isLassoActive?{background:'rgba(249,115,22,0.15)',color:T.accent}:{}),
                  }}>
                  <span style={{
                    fontSize:12,width:14,textAlign:'center',flexShrink:0,
                    color:isLassoActive?T.accent:isActive?T.accent:T.muted,
                    opacity:isActive||isLassoActive?1:0.7,
                  }}>{t.icon}</span>
                  <span style={{
                    fontSize:11,flex:1,
                    color:isActive||isLassoActive?T.text:T.muted,
                  }}>{t.label}</span>
                  {t.pro&&(
                    <span style={{
                      fontSize:7,background:'rgba(249,115,22,0.15)',
                      color:T.accent,padding:'1px 4px',borderRadius:3,
                      fontWeight:'700',flexShrink:0,letterSpacing:'0.3px',
                      border:'1px solid rgba(249,115,22,0.2)',
                    }}>PRO</span>
                  )}
                </button>
              );
            });
          })()}
          <div style={css.divider}/>
          <div 
            onClick={()=>setExpandedCategories(prev=>({...prev,Canvas:!prev.Canvas}))}
            style={{
              fontSize:'8px',color:'#e5e5e5',fontWeight:'700',
              letterSpacing:'0.8px',textTransform:'uppercase',
              padding:'6px 10px 2px',marginTop:4,
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              justifyContent:'space-between',
              userSelect:'none',
            }}>
            <span>Canvas size</span>
            <span style={{
              fontSize:'10px',
              transform:expandedCategories.Canvas?'rotate(90deg)':'rotate(0deg)',
              transition:'transform 0.2s',
              color:T.muted,
            }}>›</span>
          </div>
          {expandedCategories.Canvas&&Object.entries(PLATFORMS).map(([key,val])=>(
            <button key={key} onClick={()=>setPlatform(key)} style={{...css.toolBtn(platform===key),flexDirection:'column',alignItems:'flex-start',gap:1,padding:'6px 10px'}}>
              <span style={{fontSize:11,fontWeight:'600',color:platform===key?T.accent:'#e5e5e5'}}>{val.label}</span>
              <span style={{fontSize:'9px',color:T.muted}}>{val.width}×{val.height}</span>
            </button>
          ))}
        </div>}

        {/* Canvas */}
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:darkMode?'#080808':'#d0d0d0',overflow:'hidden',position:'relative',minHeight:isMobile?200:undefined}}
          onClick={(e)=>{
            // Click on canvas background (not on a layer) deselects
            if(e.target===e.currentTarget) setSelectedId(null);
          }}
          onWheel={(e)=>{
            if(!(activeTool==='zoom'||e.ctrlKey||e.metaKey)) return;
            e.preventDefault();

            // Capture all values synchronously from the DOM — zoomRef gives the
            // latest zoom even when multiple wheel events fire in the same frame.
            const curZoom = zoomRef.current;
            const containerRect = e.currentTarget.getBoundingClientRect();
            const canvasRect    = canvasRef.current.getBoundingClientRect();

            // Mouse position relative to the scroll container.
            const mouseX = e.clientX - containerRect.left;
            const mouseY = e.clientY - containerRect.top;

            // Container-relative position of the canvas top-left corner
            // (the "pan" origin in world-coordinate terms).
            const panX = canvasRect.left - containerRect.left;
            const panY = canvasRect.top  - containerRect.top;

            // World coordinates: the canvas pixel that sits under the cursor.
            const worldX = (mouseX - panX) / curZoom;
            const worldY = (mouseY - panY) / curZoom;

            const factor  = e.deltaY > 0 ? -0.15 : 0.15;
            const newZoom = Math.max(0.1, Math.min(5,
              Math.round((curZoom + factor) * 100) / 100));

            // New canvas-origin position that keeps worldX/Y pinned under cursor.
            const newPanX = mouseX - worldX * newZoom;
            const newPanY = mouseY - worldY * newZoom;

            // Convert back to the panOffset coordinate system the rest of the app
            // uses.  The transform is scale(z) translate(panOffset, …) with
            // transformOrigin:center, so:
            //   canvasOriginX = containerW/2 + z*(panOffset.x − canvasW/2)
            // Solving for newPanOffset:
            //   newPanOffset.x = (newPanX − containerW/2) / newZoom + canvasW/2
            const cw2 = containerRect.width  / 2;
            const ch2 = containerRect.height / 2;
            const newPanOffsetX = (newPanX - cw2) / newZoom + p.preview.w / 2;
            const newPanOffsetY = (newPanY - ch2) / newZoom + p.preview.h / 2;

            // Cancel any pending frame so rapid scrolling doesn't stack stale updates.
            if(wheelRafRef.current) cancelAnimationFrame(wheelRafRef.current);
            wheelRafRef.current = requestAnimationFrame(()=>{
              wheelRafRef.current = null;
              if(newZoom <= 1){
                setPanOffset({x:0,y:0});
              } else {
                setPanOffset({x:newPanOffsetX, y:newPanOffsetY});
              }
              setZoom(newZoom);
            });
          }}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <CanvasErrorBoundary>
            <div style={{transform:`scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,transformOrigin:'center center',imageRendering:zoom>1?'pixelated':'high-quality'}}>
              <div id="thumbnail-canvas" ref={canvasRef}
                onMouseMove={(e)=>{
                  if(activeTool==='rimlight'){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const cursor=document.getElementById('rim-cursor');
                    if(cursor){
                      cursor.style.display='block';
                      cursor.style.left=(e.clientX-rect.left)/zoom+'px';
                      cursor.style.top=(e.clientY-rect.top)/zoom+'px';
                      // ✅ Show eyedropper cursor when picking
                      if(rimPickingColor){
                        cursor.style.width='20px';
                        cursor.style.height='20px';
                        cursor.style.border='2px solid #fff';
                        cursor.style.background='rgba(255,255,255,0.3)';
                        cursor.style.boxShadow='0 0 0 1px #000, 0 0 8px rgba(0,0,0,0.5)';
                      } else {
                        const size=(rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8;
                        cursor.style.width=size+'px';
                        cursor.style.height=size+'px';
                        cursor.style.border=`2px solid ${rimLightColor}`;
                        cursor.style.background=`radial-gradient(circle, ${rimLightColor}22 0%, transparent 70%)`;
                        cursor.style.boxShadow=`0 0 12px ${rimLightColor}88`;
                      }
                    }
                    if(rimPaintingRef.current){
                      const x=(e.clientX-rect.left)/zoom;
                      const y=(e.clientY-rect.top)/zoom;
                      mouseRef.current={x,y};
                      applyRimLightThrottled(x,y);
                    }
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode && lassoDrawingRef.current){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    lassoPointsRef.current.push({x,y});
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points', lassoPointsRef.current.map(p=>`${p.x},${p.y}`).join(' '));
                    return;
                  }
                  if(activeTool==='freehand' && freehandDrawingRef.current){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    freehandPointsRef.current.push({x,y});
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points', freehandPointsRef.current.map(pt=>`${pt.x},${pt.y}`).join(' '));
                    return;
                  }
                }}
                onMouseDown={(e)=>{
                  if(activeTool==='rimlight'){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;

                    if(rimPickingColor){
                      // ✅ Eyedropper mode — sample color from canvas at click position
                      const sampleCanvas=document.createElement('canvas');
                      sampleCanvas.width=p.preview.w;
                      sampleCanvas.height=p.preview.h;
                      const sCtx=sampleCanvas.getContext('2d');

                      // Draw all visible layers to sample from
                      const drawNext=(index)=>{
                        if(index>=layers.length){
                          // Sample the pixel
                          const px=Math.round(x),py=Math.round(y);
                          const pixel=sCtx.getImageData(
                            Math.max(0,Math.min(px,p.preview.w-1)),
                            Math.max(0,Math.min(py,p.preview.h-1)),
                            1,1
                          ).data;
                          const r=pixel[0],g=pixel[1],b=pixel[2];
                          const hex='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
                          setRimLightColor(hex);
                          setRimPickedFrom({x:px,y:py,color:hex});
                          setRimPickingColor(false);
                          setCmdLog(`Color picked: ${hex} — now paint to apply`);
                          return;
                        }
                        const obj=layers[index];
                        if(obj.hidden){drawNext(index+1);return;}
                        if(obj.type==='background'){
                          if(obj.bgGradient){
                            const g=sCtx.createLinearGradient(0,0,0,p.preview.h);
                            g.addColorStop(0,obj.bgGradient[0]);
                            g.addColorStop(1,obj.bgGradient[1]);
                            sCtx.fillStyle=g;
                          } else sCtx.fillStyle=obj.bgColor||'#000';
                          sCtx.fillRect(0,0,p.preview.w,p.preview.h);
                          drawNext(index+1);
                        } else if(obj.type==='image'){
                          const imageSrc = getSafeImageSrc(obj);
                          if(!imageSrc){
                            drawNext(index+1);
                            return;
                          }
                          const img=new Image();
                          img.crossOrigin='Anonymous';
                          img.onload=()=>{
                            sCtx.save();
                            sCtx.globalAlpha=(obj.opacity??100)/100;
                            sCtx.globalCompositeOperation=obj.blendMode||'normal';
                            sCtx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
                            sCtx.restore();
                            drawNext(index+1);
                          };
                          img.onerror=()=>drawNext(index+1);
                          img.src=imageSrc;
                        } else {
                          drawNext(index+1);
                        }
                      };
                      drawNext(0);
                      return;
                    }

                    // Normal paint mode
                    rimPaintingRef.current=true;
                    applyRimLight(x,y);
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    lassoDrawingRef.current=true;
                    lassoPointsRef.current=[{x,y}];
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points',`${x},${y}`);
                    return;
                  }
                  if(activeTool==='freehand'){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    freehandDrawingRef.current=true;
                    freehandPointsRef.current=[{x,y}];
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points',`${x},${y}`);
                    return;
                  }
                }}
                onMouseUp={(e)=>{
                  if(activeTool==='rimlight'){
                    rimPaintingRef.current=false;
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode && lassoDrawingRef.current){
                    lassoDrawingRef.current=false;
                    const points=lassoPointsRef.current;
                    if(points.length>=3 && selectedLayer && selectedLayer.type==='image'){
                      const cropL=selectedLayer.cropLeft||0;
                      const cropT=selectedLayer.cropTop||0;
                      const cropW=selectedLayer.width-cropL-(selectedLayer.cropRight||0);
                      const cropH=selectedLayer.height-cropT-(selectedLayer.cropBottom||0);
                      // Convert canvas-space points to coordinates relative to the image div
                      const ox=selectedLayer.x+cropL;
                      const oy=selectedLayer.y+cropT;
                      // Simplify path: keep 1 point per 3px of movement to reduce polygon complexity
                      const simplified=[];
                      let lastX=null,lastY=null;
                      for(const p of points){
                        const rx=p.x-ox, ry=p.y-oy;
                        if(lastX===null||Math.hypot(rx-lastX,ry-lastY)>3){
                          simplified.push({x:Math.round(rx*10)/10, y:Math.round(ry*10)/10});
                          lastX=rx; lastY=ry;
                        }
                      }
                      if(simplified.length>=3){
                        updateLayer(selectedLayer.id,{
                          mask:{
                            enabled:true,
                            type:'lasso',
                            inverted:lassoInvertRef.current||false,
                            points:simplified,
                            w:Math.round(cropW),
                            h:Math.round(cropH),
                          }
                        });
                      }
                    }
                    setIsLassoMode(false);
                    lassoPointsRef.current=[];
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points','');
                    return;
                  }
                  if(activeTool==='freehand' && freehandDrawingRef.current){
                    freehandDrawingRef.current=false;
                    const pts=freehandPointsRef.current.slice();
                    freehandPointsRef.current=[];
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points','');
                    if(pts.length>=2){
                      const tmpCanvas=document.createElement('canvas');
                      tmpCanvas.width=p.preview.w;
                      tmpCanvas.height=p.preview.h;
                      const ctx2=tmpCanvas.getContext('2d');
                      ctx2.strokeStyle=freeBrushColor;
                      ctx2.lineWidth=freeBrushSize;
                      ctx2.lineCap='round';
                      ctx2.lineJoin='round';
                      ctx2.beginPath();
                      ctx2.moveTo(pts[0].x,pts[0].y);
                      for(let i=1;i<pts.length;i++) ctx2.lineTo(pts[i].x,pts[i].y);
                      ctx2.stroke();
                      const dataUrl=tmpCanvas.toDataURL('image/png');
                      addLayer({type:'image',src:dataUrl,width:p.preview.w,height:p.preview.h,x:0,y:0,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
                      console.log('[FREEHAND] Stroke committed as new image layer. Sprint 3 panel auto-syncs via setLayers().');
                    }
                    return;
                  }
                  triggerAutoSave();
                }}
                onTouchEnd={()=>{
                  triggerAutoSave();
                }}
                onMouseLeave={(e)=>{
                  if(activeTool==='rimlight'){
                    rimPaintingRef.current=false;
                    const cursor=document.getElementById('rim-cursor');
                    if(cursor) cursor.style.display='none';
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode && lassoDrawingRef.current){
                    lassoDrawingRef.current=false;
                    lassoPointsRef.current=[];
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points','');
                    return;
                  }
                  if(activeTool==='freehand' && freehandDrawingRef.current){
                    freehandDrawingRef.current=false;
                    freehandPointsRef.current=[];
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points','');
                    return;
                  }
                }}
                onClick={(e)=>{
                  if(activeTool==='rimlight') return;
                  if(activeTool==='lasso') return;
                  if(justSelectedRef.current){justSelectedRef.current=false;return;}
                  if(activeTool==='brush') return;
                  if(activeTool==='zoom'){
                    e.stopPropagation();
                    // Same DOM-based coordinate system as the wheel handler:
                    // container = flex scroll div that wraps the transform wrapper.
                    const canvasRect    = canvasRef.current.getBoundingClientRect();
                    const containerElem = canvasRef.current.parentElement.parentElement;
                    const containerRect = containerElem.getBoundingClientRect();
                    const curZoom       = zoomRef.current;

                    // Mouse position relative to the scroll container
                    const mouseX = e.clientX - containerRect.left;
                    const mouseY = e.clientY - containerRect.top;

                    // Canvas top-left relative to container (already encodes current pan+zoom)
                    const panX = canvasRect.left - containerRect.left;
                    const panY = canvasRect.top  - containerRect.top;

                    // World coordinate (canvas pixel) under the cursor
                    const worldX = (mouseX - panX) / curZoom;
                    const worldY = (mouseY - panY) / curZoom;

                    const newZoom = (e.shiftKey||e.altKey)
                      ? Math.max(0.25, Math.round((curZoom - 0.5) * 10) / 10)
                      : Math.min(8,    Math.round((curZoom + 0.5) * 10) / 10);

                    if(newZoom <= 1){
                      setZoom(newZoom);
                      setPanOffset({x:0,y:0});
                    } else {
                      // New canvas-origin position that keeps worldX/Y pinned under cursor
                      const newPanX = mouseX - worldX * newZoom;
                      const newPanY = mouseY - worldY * newZoom;
                      // Convert viewport-relative origin → panOffset coord system:
                      //   canvasOriginX = cw2 + newZoom*(panOffset.x - canvasW/2)
                      //   => panOffset.x = (newPanX - cw2) / newZoom + canvasW/2
                      const cw2 = containerRect.width  / 2;
                      const ch2 = containerRect.height / 2;
                      setZoom(newZoom);
                      setPanOffset({
                        x: (newPanX - cw2) / newZoom + p.preview.w / 2,
                        y: (newPanY - ch2) / newZoom + p.preview.h / 2,
                      });
                    }
                    return;
                  }
                  setSelectedId(null);
                }}
                style={{width:p.preview.w,height:p.preview.h,position:'relative',overflow:'hidden',borderRadius:4,boxShadow:'0 8px 40px rgba(0,0,0,0.8)',flexShrink:0,cursor:activeTool==='brush'?'crosshair':
                       activeTool==='rimlight'?(rimPickingColor?'crosshair':'crosshair'):
                       activeTool==='zoom'?'zoom-in':
                       (activeTool==='lasso'&&isLassoMode)?'crosshair':
                       'default'}}>

                <div style={{position:'absolute',inset:0,filter:canvasFilter,zIndex:0}}>
                  <div style={{position:'absolute',inset:0,
                    pointerEvents: (activeTool==='brush'||activeTool==='zoom'||activeTool==='freehand'||(activeTool==='lasso'&&isLassoMode)) ? 'none' : 'auto',
                  }}>
                    <CanvasLayerRenderer layers={layers} renderLayerElement={renderLayerElement} />
                  </div>

                  {/* Paint overlay for non-active brush images */}
                  {layers.map(obj=>{
                    if(obj.hidden||!obj.paintSrc||obj.type==='background')return null;
                    const overlaySrc = getSafeImageSrc({ src: obj.paintSrc });
                    if(!overlaySrc)return null;
                    if(obj.id===brushingImageId)return null;
                    const cropW=obj.width-(obj.cropLeft||0)-(obj.cropRight||0);
                    const cropH=obj.height-(obj.cropTop||0)-(obj.cropBottom||0);
                    return(
                      <div key={`paint-${obj.id}`} style={{
                        position:'absolute',left:obj.x,top:obj.y,
                        width:cropW,height:cropH,
                        zIndex:layers.indexOf(obj)+2,
                        overflow:'hidden',pointerEvents:'none',
                      }}>
                        <img src={overlaySrc} alt="" style={{
                          position:'absolute',top:0,left:0,
                          width:obj.width,height:obj.height,
                          display:'block',
                          marginLeft:-(obj.cropLeft||0),marginTop:-(obj.cropTop||0),
                        }}/>
                      </div>
                    );
                  })}
                </div>

                {/* Lasso mask SVG overlay */}
                {isLassoMode&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10000}}>
                    <polyline ref={lassoSvgRef} points="" fill="rgba(249,115,22,0.12)" stroke="#f97316" strokeWidth="2" strokeDasharray="6,4"/>
                  </svg>
                )}
                {/* Freehand draw SVG overlay */}
                {activeTool==='freehand'&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10000}}>
                    <polyline ref={freehandSvgRef} points="" fill="none" stroke={freeBrushColor} strokeWidth={freeBrushSize} strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
                  </svg>
                )}

                {/* Smart Cutout — segmentation overlays */}
                {activeTool==='segment'&&(
                  <>
                    {segmentBusy&&(
                      <div style={{position:'absolute',inset:0,zIndex:9996,pointerEvents:'none',overflow:'hidden'}}>
                        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.28)'}}/>
                        <div style={{
                          position:'absolute',left:0,right:0,height:2,
                          background:'linear-gradient(90deg,transparent,#f97316 30%,#ff8c00 50%,#f97316 70%,transparent)',
                          boxShadow:'0 0 14px 5px rgba(249,115,22,0.55)',
                          animation:'tf-scan 1.8s ease-in-out infinite',
                        }}/>
                        <div style={{
                          position:'absolute',top:'50%',left:'50%',
                          transform:'translate(-50%,-50%)',
                          background:'rgba(10,10,15,0.85)',
                          border:'1px solid rgba(249,115,22,0.4)',
                          borderRadius:10,padding:'10px 18px',
                          fontSize:12,fontWeight:'700',color:'#f97316',
                          display:'flex',alignItems:'center',gap:8,
                          letterSpacing:'0.2px',
                        }}>
                          <span style={{display:'inline-block',animation:'editor-spin 1s linear infinite',fontSize:14}}>◌</span>
                          {segmentStatus||'Analyzing objects...'}
                        </div>
                      </div>
                    )}
                    {!segmentBusy&&segmentMasks.map((maskUrl,idx)=>(
                      <div
                        key={idx}
                        onClick={e=>{e.stopPropagation();applySegmentMask(idx);}}
                        onMouseEnter={()=>setSegmentHoverIdx(idx)}
                        onMouseLeave={()=>setSegmentHoverIdx(null)}
                        style={{
                          position:'absolute',inset:0,
                          zIndex:9990+idx,
                          cursor:'pointer',
                          mixBlendMode:'screen',
                          opacity:segmentHoverIdx===idx?0.95:0.5,
                          transition:'opacity 0.12s',
                        }}>
                        <img
                          src={maskUrl}
                          alt=""
                          style={{
                            width:'100%',height:'100%',objectFit:'fill',
                            filter:`hue-rotate(${idx*47}deg) saturate(6) brightness(${segmentHoverIdx===idx?1.5:0.7})`,
                            pointerEvents:'none',display:'block',
                          }}
                        />
                        {segmentHoverIdx===idx&&(
                          <div style={{
                            position:'absolute',inset:0,
                            border:'2px solid #f97316',
                            borderRadius:2,
                            boxShadow:'inset 0 0 0 1px rgba(249,115,22,0.4)',
                            pointerEvents:'none',
                            animation:'tf-pulse-outline 1.2s ease-in-out infinite',
                          }}>
                            <div style={{
                              position:'absolute',bottom:6,left:'50%',
                              transform:'translateX(-50%)',
                              background:'rgba(249,115,22,0.95)',
                              color:'#fff',fontSize:10,fontWeight:'800',
                              padding:'2px 10px',borderRadius:20,
                              whiteSpace:'nowrap',letterSpacing:'0.3px',
                            }}>
                              Click to isolate
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* ✅ Brush overlay — no CSS width/height, no filter, canvas sizes itself */}
                {brushingImageId&&selectedLayer&&!maskingLayerId&&(
                  <div style={{
                    position:'absolute',
                    left:  selectedLayer.type==='background' ? 0 : selectedLayer.x,
                    top:   selectedLayer.type==='background' ? 0 : selectedLayer.y,
                    width: selectedLayer.type==='background' ? p.preview.w  : selectedLayer.width-(selectedLayer.cropLeft||0)-(selectedLayer.cropRight||0),
                    height:selectedLayer.type==='background' ? p.preview.h  : selectedLayer.height-(selectedLayer.cropTop||0)-(selectedLayer.cropBottom||0),
                    zIndex:9999,
                    overflow:'hidden',
                    pointerEvents:'auto',
                  }}>
                    <BrushOverlay
                      ref={brushOverlayRef}
                      layer={selectedLayer ? {
                        ...selectedLayer,
                        src: getLayerSrc(selectedLayer),
                        width:  selectedLayer.type==='background' ? p.preview.w  : selectedLayer.width,
                        height: selectedLayer.type==='background' ? p.preview.h  : selectedLayer.height,
                        x: selectedLayer.type==='background' ? 0 : selectedLayer.x,
                        y: selectedLayer.type==='background' ? 0 : selectedLayer.y,
                      } : null}
                      active={true}
                      zoom={zoom}
                      brushType={brushTypeState}
                      brushSize={brushSizeState}
                      brushStrength={brushStrengthState}
                      brushEdge={brushEdgeState}
                      brushFlow={brushFlowState}
                      brushStabilizer={brushStabilizerState}
                      paintColor={brushColorState}
                      paintAlpha={brushColorAlpha}
                      onUpdate={(updates)=>{
                        if(selectedLayer?.type==='background'){
                          updateLayer(selectedId,{bgColor:'transparent',bgGradient:null,paintSrc:updates.src,src:updates.src,type:'image',
                            x:0,y:0,width:p.preview.w,height:p.preview.h,
                            cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
                            imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0
                          });
                        } else {
                          updateLayer(selectedId,{paintSrc:updates.src});
                        }
                      }}
                    />
                  </div>
                )}



                {activeTool==='rimlight'&&selectedLayer?.type==='image'&&(
                  <div style={{
                    position:'absolute',
                    inset:0,
                    zIndex:9998,
                    cursor:'crosshair',
                    pointerEvents:'none',
                  }}>
                    <div id="rim-cursor" style={{
                      position:'absolute',
                      width: (rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8+'px',
                      height:(rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8+'px',
                      borderRadius:'50%',
                      border:`2px solid ${rimLightColor}`,
                      background:`radial-gradient(circle, ${rimLightColor}22 0%, transparent 70%)`,
                      transform:'translate(-50%,-50%)',
                      pointerEvents:'none',
                      display:'none',
                      boxShadow:`0 0 12px ${rimLightColor}88`,
                    }}/>
                  </div>
                )}

                {/* Safe zones */}
                {showSafeZones&&(
                  <div style={{position:'absolute',inset:0,zIndex:9998,pointerEvents:'none'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,padding:'3px 6px',background:'rgba(0,0,0,0.65)',display:'flex',gap:10,alignItems:'center'}}>
                      <span style={{fontSize:7,color:'#ff6666',fontWeight:'700'}}>● TIMESTAMP</span>
                      <span style={{fontSize:7,color:'#ff6666',fontWeight:'700'}}>● WATCH LATER</span>
                      <span style={{fontSize:7,color:'rgba(255,255,100,0.8)',fontWeight:'700'}}>- - SAFE ZONE</span>
                    </div>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,height:5,background:'rgba(255,0,0,0.45)',borderTop:'1px solid rgba(255,80,80,0.8)'}}/>
                    <div style={{position:'absolute',bottom:8,right:8,padding:'2px 6px',borderRadius:3,background:'rgba(0,0,0,0.75)',border:'1.5px solid #ff4444',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:8,color:'#ff8888',fontFamily:'monospace',fontWeight:'700'}}>0:00</span>
                    </div>
                    <div style={{position:'absolute',top:20,right:8,width:24,height:24,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'1.5px solid #ff4444',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:10,color:'#ff8888'}}>+</span>
                    </div>
                    <div style={{position:'absolute',top:20,left:8,right:8,bottom:20,border:'1px dashed rgba(255,255,80,0.55)',borderRadius:2}}/>
                  </div>
                )}
              </div>
            </div>
            </CanvasErrorBoundary>
            <div style={{fontSize:10,color:'#444',letterSpacing:'0.3px'}}>
              {p.label} · {p.width}×{p.height}px · {layers.length} layer{layers.length!==1?'s':''} · {Math.round(zoom*100)}%
            </div>
          </div>

          {/* Stamp test */}
          {showStampTest&&(
            <div style={{position:'absolute',bottom:16,right:16,zIndex:200}}>
              <div style={{background:'#111',borderRadius:10,padding:12,border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 8px 40px rgba(0,0,0,0.8)'}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:8,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',textAlign:'center'}}>📱 Mobile · 150×84px</div>
                <div style={{position:'relative',width:150,height:84,borderRadius:4,overflow:'hidden',border:'1px solid rgba(255,255,255,0.12)',background:bg?.bgGradient?`linear-gradient(180deg,${bg.bgGradient[0]},${bg.bgGradient[1]})`:bg?.bgColor||'#f97316'}}>
                  {layers.map(obj=><StampLayer key={obj.id} obj={obj} scale={150/p.preview.w}/>)}
                  <div style={{position:'absolute',bottom:3,right:3,padding:'1px 3px',borderRadius:2,background:'rgba(0,0,0,0.85)',fontSize:6,color:'#fff',fontFamily:'monospace',fontWeight:'700'}}>0:00</div>
                </div>
                <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'10px 0'}}/>
                <div style={{background:'#0f0f0f',borderRadius:6,padding:'8px',display:'flex',gap:8,alignItems:'flex-start',width:260}}>
                  <div style={{position:'relative',width:120,height:68,borderRadius:3,overflow:'hidden',flexShrink:0,background:bg?.bgColor||'#f97316'}}>
                    <div style={{position:'absolute',inset:0,background:bg?.bgGradient?`linear-gradient(180deg,${bg.bgGradient[0]},${bg.bgGradient[1]})`:bg?.bgColor||'#f97316'}}/>
                    {layers.map(obj=><StampLayer key={obj.id} obj={obj} scale={120/p.preview.w}/>)}
                    <div style={{position:'absolute',bottom:2,right:2,padding:'1px 3px',borderRadius:2,background:'rgba(0,0,0,0.85)',fontSize:5,color:'#fff',fontFamily:'monospace',fontWeight:'700'}}>0:00</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:9,color:'#fff',fontWeight:'600',lineHeight:1.3,marginBottom:2}}>Your video title goes here</div>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.45)'}}>Your Channel</div>
                    <div style={{fontSize:7,color:'rgba(255,255,255,0.3)',marginTop:1}}>1.2M views · 2 days ago</div>
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:8,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>Does your text read at this size?</div>
              </div>
            </div>
          )}
        </div>

        {/* ✅ Right sidebar — stopPropagation on pointer events so sliders never leak to canvas */}
        <div
          onPointerDown={e=>e.stopPropagation()}
          style={isMobile?{
            position:'absolute',bottom:0,left:0,right:0,
            maxHeight:'45vh',
            background:T.sidebar,borderTop:`1px solid ${T.border}`,
            display:'flex',flexDirection:'column',zIndex:100,
            borderRadius:'12px 12px 0 0',
            boxShadow:'0 -4px 20px rgba(0,0,0,0.3)',
          }:{
            width:272,background:T.sidebar,borderLeft:`1px solid ${T.border}`,
            display:'flex',flexDirection:'column',flexShrink:0,
          }}
        >
          <div style={{flex:1,padding:'10px 12px',overflowY:'auto'}}>

            {activeTool==='select'&&(
              <div>
                <span style={css.label}>Select tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600',lineHeight:1.8}}>
                  ↖ Click any layer to select it.<br/>
                  <span style={{color:T.muted,fontWeight:'400'}}>Switch to Move ✋ to drag.</span>
                </div>
                {selectedLayer&&selectedLayer.type!=='background'&&(<>
                  <span style={css.label}>Selected — {getLayerName(selectedLayer)}</span>
                  <div style={css.section}>
                    <div style={css.row}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>X</span>
                      <input type="number" value={Math.round(selectedLayer.x)} onChange={e=>updateLayer(selectedId,{x:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>Y</span>
                      <input type="number" value={Math.round(selectedLayer.y)} onChange={e=>updateLayer(selectedId,{y:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>
                    {selectedLayer.width&&(<div style={{...css.row,marginTop:6}}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>W</span>
                      <input type="number" value={Math.round(selectedLayer.width||0)} onChange={e=>updateLayer(selectedId,{width:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>H</span>
                      <input type="number" value={Math.round(selectedLayer.height||0)} onChange={e=>updateLayer(selectedId,{height:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>)}
                    <span style={{...css.label,marginTop:8}}>Opacity — {selectedLayer.opacity??100}%</span>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>updateLayer(selectedId,{opacity:v})}
                      style={{width:'100%'}}/>
                    {selectedLayer&&selectedLayer.type!=='background'&&(<>
                      <span style={css.label}>Rotation — {Math.round(selectedLayer.rotation||0)}°</span>
                      <div style={css.row}>
                        <Slider min={-180} max={180} value={selectedLayer.rotation||0}
                          onChange={v=>updateLayerSilent(selectedId,{rotation:v})}
                          onCommit={v=>updateLayer(selectedId,{rotation:v})}
                          style={{flex:1}}/>
                        <button onClick={()=>updateLayer(selectedId,{rotation:0})}
                          style={{padding:'3px 8px',borderRadius:4,border:`1px solid ${T.border}`,
                            background:T.input,color:T.muted,cursor:'pointer',fontSize:10}}>
                          Reset
                        </button>
                      </div>
                    </>)}
                    {selectedLayer?.type==='shape'&&(<>
                      <span style={{...css.label,marginTop:8}}>Fill color</span>
                      <input type="color" value={selectedLayer.fillColor||'#FF4500'}
                        onChange={e=>{updateLayer(selectedId,{fillColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                      <span style={css.label}>Border color</span>
                      <input type="color" value={selectedLayer.strokeColor||'#000000'}
                        onChange={e=>{updateLayer(selectedId,{strokeColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                    </>)}
                    {selectedLayer?.type==='text'&&(<>
                      <span style={{...css.label,marginTop:8}}>Text color</span>
                      <input type="color" value={selectedLayer.textColor||'#ffffff'}
                        onChange={e=>{updateLayer(selectedId,{textColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                      <span style={css.label}>Outline color</span>
                      <input type="color" value={selectedLayer.strokeColor||'#000000'}
                        onChange={e=>{updateLayer(selectedId,{strokeColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                      <span style={css.label}>Font size — {selectedLayer.fontSize}px</span>
                      <Slider min={8} max={120} value={selectedLayer.fontSize||48}
                        onChange={v=>updateLayerSilent(selectedId,{fontSize:v})}
                        onCommit={v=>updateLayer(selectedId,{fontSize:v})}
                        style={{width:'100%'}}/>
                    </>)}
                    {selectedLayer?.type==='image'&&(<>
                      <span style={{...css.label,marginTop:8}}>Scale</span>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        {[25,50,75,100].map(pct=>{
                          const curPct=Math.round((selectedLayer.width/(selectedLayer.originalWidth||selectedLayer.width))*100)||100;
                          return(
                            <button key={pct} onClick={()=>{
                              const ow=selectedLayer.originalWidth||selectedLayer.width;
                              const oh=selectedLayer.originalHeight||selectedLayer.height;
                              const nw=Math.round(ow*pct/100);
                              const nh=Math.round(oh*pct/100);
                              updateLayer(selectedId,{width:nw,height:nh});
                            }} style={{flex:1,padding:'5px 2px',borderRadius:5,border:`1px solid ${curPct===pct?T.accent:T.border}`,background:curPct===pct?`${T.accent}18`:T.input,color:curPct===pct?T.accent:T.text,fontSize:10,cursor:'pointer',fontWeight:curPct===pct?'700':'400'}}>{pct}%</button>
                          );
                        })}
                      </div>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        <button onClick={()=>{
                          const aspect=selectedLayer.width/selectedLayer.height;
                          const cW=p.preview.w,cH=p.preview.h;
                          let nw,nh;
                          if(aspect>cW/cH){nw=cW;nh=Math.round(cW/aspect);}
                          else{nh=cH;nw=Math.round(cH*aspect);}
                          updateLayer(selectedId,{width:nw,height:nh,x:Math.round((cW-nw)/2),y:Math.round((cH-nh)/2)});
                        }} style={{flex:1,padding:'6px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}>Fit canvas</button>
                        <button onClick={()=>{
                          const aspect=selectedLayer.width/selectedLayer.height;
                          const cW=p.preview.w,cH=p.preview.h;
                          let nw,nh;
                          if(aspect>cW/cH){nh=cH;nw=Math.round(cH*aspect);}
                          else{nw=cW;nh=Math.round(cW/aspect);}
                          updateLayer(selectedId,{width:nw,height:nh,x:Math.round((cW-nw)/2),y:Math.round((cH-nh)/2)});
                        }} style={{flex:1,padding:'6px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}>Fill canvas</button>
                        <button onClick={()=>{
                          updateLayer(selectedId,{x:Math.round((p.preview.w-selectedLayer.width)/2),y:Math.round((p.preview.h-selectedLayer.height)/2)});
                        }} style={{flex:1,padding:'6px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}>Center</button>
                      </div>
                      <span style={{...css.label}}>Brightness — {selectedLayer.imgBrightness||100}%</span>
                      <Slider min={50} max={200} value={selectedLayer.imgBrightness||100}
                        onChange={v=>updateLayerSilent(selectedId,{imgBrightness:v})}
                        onCommit={v=>updateLayer(selectedId,{imgBrightness:v})}
                        style={{width:'100%'}}/>
                      <span style={css.label}>Contrast — {selectedLayer.imgContrast||100}%</span>
                      <Slider min={50} max={200} value={selectedLayer.imgContrast||100}
                        onChange={v=>updateLayerSilent(selectedId,{imgContrast:v})}
                        onCommit={v=>updateLayer(selectedId,{imgContrast:v})}
                        style={{width:'100%'}}/>
                    </>)}
                    <div style={{display:'flex',gap:5,marginTop:10}}>
                      <button onClick={()=>duplicateLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>Duplicate</button>
                      <button onClick={()=>deleteLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:T.danger}}>Delete</button>
                    </div>
                  </div>
                </>)}
                <span style={css.label}>Shortcuts</span>
                <div style={css.section}>
                  {[['Delete','Remove'],['Ctrl+D','Duplicate'],['Ctrl+C/V','Copy/Paste'],['Ctrl+Z/Y','Undo/Redo'],['Ctrl+K','Commands'],['Ctrl+S','Save']].map(([k,d])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{fontSize:10,color:T.muted}}>{d}</span>
                      <span style={{fontSize:9,color:T.text,fontFamily:'monospace',background:T.bg,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`}}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTool==='move'&&(
              <div>
                <span style={css.label}>Move tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600',lineHeight:1.8}}>
                  ✋ Drag any layer to move it.<br/>
                  <span style={{color:T.muted,fontWeight:'400'}}>Corner handles to resize.</span>
                </div>
                {selectedLayer&&selectedLayer.type!=='background'&&(<>
                  <span style={css.label}>Align</span>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                    {[['Center','center'],['H ctr','center-h'],['V ctr','center-v'],['Left','left'],['Right','right'],['Top','top'],['Bottom','bottom']].map(([label,dir])=>(
                      <button key={dir} onClick={()=>alignLayer(selectedId,dir)} style={{padding:'6px 2px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:9,cursor:'pointer',textAlign:'center'}}>{label}</button>
                    ))}
                  </div>
                  <span style={css.label}>Flip</span>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>flipLayer(selectedId,'h')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↔ H</button>
                    <button onClick={()=>flipLayer(selectedId,'v')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↕ V</button>
                  </div>
                  <span style={css.label}>Blend mode</span>
                  <select value={selectedLayer.blendMode||'normal'} onChange={e=>{updateLayer(selectedId,{blendMode:e.target.value});triggerAutoSave();}} style={css.input}>{BLEND_MODES.map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}</select>
                  <span style={css.label}>Position</span>
                  <div style={css.section}>
                    <div style={css.row}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>X</span>
                      <input type="number" value={Math.round(selectedLayer.x)} onChange={e=>updateLayer(selectedId,{x:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>Y</span>
                      <input type="number" value={Math.round(selectedLayer.y)} onChange={e=>updateLayer(selectedId,{y:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>
                    {selectedLayer.width&&(<div style={{...css.row,marginTop:6}}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>W</span>
                      <input type="number" value={Math.round(selectedLayer.width||0)} onChange={e=>updateLayer(selectedId,{width:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>H</span>
                      <input type="number" value={Math.round(selectedLayer.height||0)} onChange={e=>updateLayer(selectedId,{height:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>)}
                    <span style={{...css.label,marginTop:8}}>Opacity — {selectedLayer.opacity??100}%</span>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>updateLayer(selectedId,{opacity:v})}
                      style={{width:'100%'}}/>
                    <div style={{display:'flex',gap:5,marginTop:10}}>
                      <button onClick={()=>duplicateLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>Duplicate</button>
                      <button onClick={()=>deleteLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:T.danger}}>Delete</button>
                    </div>
                  </div>
                </>)}
              </div>
            )}

            {activeTool==='crop'&&(
              <div>
                <span style={css.label}>Crop tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.7}}>
                  Drag the handles on the image to crop directly.<br/>
                  <span style={{color:T.text,fontWeight:'600'}}>Other layers stay interactive.</span>
                </div>
                {!selectedLayer||selectedLayer.type!=='image'?(
                  <div style={{...css.section,marginTop:8,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>⊡</div>Click an image to begin cropping</div>
                ):(
                  <div style={{...css.section,marginTop:8,padding:12}}>
                    <button onClick={()=>updateLayer(selectedId,{cropTop:0,cropBottom:0,cropLeft:0,cropRight:0})} style={{...css.addBtn,marginTop:0,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>Reset crop</button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='zoom'&&(
              <div>
                <span style={css.label}>Zoom tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.8}}>
                  <strong style={{color:T.text}}>Click</strong> to zoom in on a spot<br/>
                  <strong style={{color:T.text}}>Shift+Click</strong> to zoom out<br/>
                </div>

                <span style={css.label}>Zoom — {Math.round(zoom*100)}%</span>
                <div style={css.row}>
                  <button onClick={()=>{const z=Math.max(0.25,Math.round((zoom-0.25)*100)/100);setZoom(z);if(z<=1)setPanOffset({x:0,y:0});}} style={{padding:'4px 10px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:13,fontWeight:'700'}}>−</button>
                  <div style={{flex:1,height:4,background:T.border,borderRadius:2,position:'relative',margin:'0 4px'}}>
                    <div style={{position:'absolute',left:`${Math.min(100,((zoom-0.25)/7.75)*100)}%`,top:-4,width:12,height:12,borderRadius:'50%',background:T.accent,border:'2px solid #fff',transform:'translateX(-50%)'}}/>
                  </div>
                  <button onClick={()=>{setZoom(Math.min(8,Math.round((zoom+0.25)*100)/100));}} style={{padding:'4px 10px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:13,fontWeight:'700'}}>+</button>
                </div>

                <span style={css.label}>Quick zoom</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                  {[25,50,100,150,200,400].map(pct=>(
                    <button key={pct} onClick={()=>{setZoom(pct/100);if(pct<=100)setPanOffset({x:0,y:0});}}
                      style={{padding:'6px 2px',borderRadius:5,border:`1px solid ${Math.round(zoom*100)===pct?T.accent:T.border}`,background:Math.round(zoom*100)===pct?`${T.accent}18`:T.input,color:Math.round(zoom*100)===pct?T.accent:T.text,fontSize:10,cursor:'pointer',fontWeight:Math.round(zoom*100)===pct?'700':'400'}}>{pct}%</button>
                  ))}
                </div>

                <button onClick={()=>{setZoom(1);setPanOffset({x:0,y:0});}}
                  style={{...css.addBtn,marginTop:12,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>
                  Reset view
                </button>

                <span style={css.label}>Navigate</span>
                <div style={{...css.section,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
                  <div/>
                  <button onClick={()=>setPanOffset(p=>({...p,y:p.y+30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>↑</button>
                  <div/>
                  <button onClick={()=>setPanOffset(p=>({...p,x:p.x+30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>←</button>
                  <button onClick={()=>setPanOffset({x:0,y:0})} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:9}}>⊙</button>
                  <button onClick={()=>setPanOffset(p=>({...p,x:p.x-30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>→</button>
                  <div/>
                  <button onClick={()=>setPanOffset(p=>({...p,y:p.y-30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>↓</button>
                  <div/>
                </div>
              </div>
            )}

            {activeTool==='brush'&&(
              <div>
                <span style={css.label}>Brush tools</span>
                {!selectedLayer||(selectedLayer.type!=='image'&&selectedLayer.type!=='background')||selectedLayer.isRimLight?(
                  <div style={{...css.section,marginTop:0,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>⌀</div>Click an image on the canvas first</div>
                ):(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600'}}>✓ Image selected — paint on the canvas</div>
                )}
                <BrushTool
                  layer={(selectedLayer?.type==='image'||selectedLayer?.type==='background')&&!selectedLayer?.isRimLight?selectedLayer:null}
                  theme={T}
                  brushOverlayRef={brushOverlayRef}
                  brushType={brushTypeState}
                  brushSize={brushSizeState}
                  brushStrength={brushStrengthState}
                  brushEdge={brushEdgeState}
                  brushFlow={brushFlowState}
                  brushStabilizer={brushStabilizerState}
                  paintColor={brushColorState}
                  paintAlpha={brushColorAlpha}
                  onBrushTypeChange={setBrushTypeState}
                  onBrushSizeChange={setBrushSizeState}
                  onBrushStrengthChange={setBrushStrengthState}
                  onBrushEdgeChange={setBrushEdgeState}
                  onBrushFlowChange={setBrushFlowState}
                  onBrushStabilizerChange={setBrushStabilizerState}
                  onPaintColorChange={(c)=>{
                    setBrushColorState(c);
                  }}
                  onPaintAlphaChange={setBrushColorAlpha}
                  onUpdate={(updates)=>{if(selectedId)updateLayer(selectedId,updates);}}
                />
                {/* Mask — coming soon */}
                {selectedLayer?.type==='image'&&(
                  <div style={{marginTop:10}}>
                    <span style={css.label}>Layer mask</span>
                    <div style={{...css.section,textAlign:'center',padding:12,fontSize:10,color:T.muted}}>
                      Coming soon — paint to hide/reveal parts of an image
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTool==='text'&&(
              <div>
                <span style={css.label}>Templates</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:5,marginBottom:4}}>
                  {TEXT_TEMPLATES.map((t,i)=>(<button key={i} onClick={()=>applyTextTemplate(t)} style={{padding:'7px 6px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer',fontFamily:resolveFontFamily(t.fontFamily),fontWeight:t.fontWeight||700,textAlign:'center'}}>{t.label}</button>))}
                </div>
                <span style={css.label}>Content</span>
                <input value={textInput} onChange={e=>setTextInput(e.target.value)} style={css.input} placeholder="Enter text..."/>
                <span style={css.label}>Font family</span>
                <select value={fontFamily} onChange={e=>{setFontFamily(e.target.value);triggerAutoSave();}} style={css.input}>{FONTS.map(f=><option key={f}>{f}</option>)}</select>
                <span style={css.label}>Font weight</span>
                <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                  {FONT_WEIGHTS.map(fw=>(<button key={fw.value} onClick={()=>{setFontWeight(fw.value);triggerAutoSave();}} style={{padding:'4px 7px',borderRadius:4,border:`1px solid ${fontWeight===fw.value?T.accent:T.border}`,background:fontWeight===fw.value?T.accent:'transparent',color:fontWeight===fw.value?'#fff':T.text,fontSize:10,cursor:'pointer',fontWeight:fw.value}}>{fw.label}</button>))}
                </div>
                <span style={css.label}>Size — {fontSize}px</span>
                <div style={css.row}>
                  <Slider min={8} max={120} value={fontSize} onChange={v=>setFontSize(v)} onCommit={triggerAutoSave} style={{flex:1}}/>
                  <input type="number" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} onBlur={triggerAutoSave} style={{...css.input,width:50,padding:'5px 6px',textAlign:'center'}}/>
                </div>
                <span style={css.label}>Letter spacing — {letterSpacing}px</span>
                <Slider min={-5} max={30} value={letterSpacing} onChange={v=>setLetterSpacing(v)} onCommit={triggerAutoSave} style={{width:'100%'}}/>
                <span style={css.label}>Line height — {lineHeight}</span>
                <Slider min={0.8} max={3} step={0.1} value={lineHeight} onChange={v=>setLineHeight(v)} onCommit={triggerAutoSave} style={{width:'100%'}}/>
                <span style={css.label}>Alignment</span>
                <div style={{display:'flex',gap:4}}>
                  {[['left','Left'],['center','Center'],['right','Right']].map(([val,label])=>(<button key={val} onClick={()=>{setTextAlign(val);triggerAutoSave();}} style={{...css.iconBtn(textAlign===val),flex:1,textAlign:'center',fontSize:11}}>{label}</button>))}
                </div>
                <span style={css.label}>Style</span>
                <button onClick={()=>{setFontItalic(!fontItalic);triggerAutoSave();}} style={{...css.iconBtn(fontItalic),width:'100%',textAlign:'center',fontStyle:'italic'}}>Italic</button>
                <span style={css.label}>Text color</span>
                <input type="color" value={textColor} onChange={e=>{setTextColor(e.target.value);addRecentColor(e.target.value);triggerAutoSave();}} style={css.color}/>
                <span style={css.label}>Outline</span>
                <div style={css.row}>
                  <input type="color" value={strokeColor} onChange={e=>{setStrokeColor(e.target.value);triggerAutoSave();}} style={{...css.color,width:44,flexShrink:0}}/>
                  <Slider min={0} max={20} value={strokeWidth} onChange={v=>setStrokeWidth(v)} onCommit={triggerAutoSave} style={{flex:1}}/>
                  <span style={{fontSize:10,color:T.muted,minWidth:24}}>{strokeWidth}px</span>
                </div>
                <span style={css.label}>Drop shadow</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>{setShadowEnabled(!shadowEnabled);triggerAutoSave();}} style={css.iconBtn(shadowEnabled)}>{shadowEnabled?'On':'Off'}</button></div>
                  {shadowEnabled&&<>
                    <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:36}}>Color</span><input type="color" value={shadowColor} onChange={e=>{setShadowColor(e.target.value);triggerAutoSave();}} style={{...css.color,height:28}}/></div>
                    {[['Blur',shadowBlur,setShadowBlur,0,40],['X',shadowX,setShadowX,-20,20],['Y',shadowY,setShadowY,-20,20]].map(([l,v,sv,mn,mx])=>(<div key={l} style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:28}}>{l}</span><Slider min={mn} max={mx} value={v} onChange={sv} onCommit={triggerAutoSave} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:20,textAlign:'right'}}>{v}</span></div>))}
                  </>}
                </div>
                <span style={css.label}>Glow</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>{setGlowEnabled(!glowEnabled);triggerAutoSave();}} style={css.iconBtn(glowEnabled)}>{glowEnabled?'On':'Off'}</button></div>
                  {glowEnabled&&<div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:36}}>Color</span><input type="color" value={glowColor} onChange={e=>{setGlowColor(e.target.value);triggerAutoSave();}} style={{...css.color,height:28}}/></div>}
                </div>
                <span style={css.label}>Text on arc</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>{setArcEnabled(!arcEnabled);triggerAutoSave();}} style={css.iconBtn(arcEnabled)}>{arcEnabled?'On':'Off'}</button></div>
                  {arcEnabled&&<><span style={{...css.label,marginTop:8}}>Radius — {arcRadius}px</span><Slider min={60} max={300} value={arcRadius} onChange={v=>setArcRadius(v)} onCommit={triggerAutoSave} style={{width:'100%'}}/></>}
                </div>
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{recentColors.map((c,i)=>(<div key={i} onClick={()=>{setTextColor(c);triggerAutoSave();}} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>))}</div>
                {selectedLayer?.type==='text'&&(<>
                  <span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span>
                  <Slider min={0} max={100} value={selectedLayer.opacity??100}
                    onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                    onCommit={v=>updateLayer(selectedId,{opacity:v})}
                    style={{width:'100%'}}/>
                  <span style={css.label}>Live edit text</span>
                  <input value={selectedLayer.text} onChange={e=>updateLayer(selectedId,{text:e.target.value})} onBlur={triggerAutoSave} style={css.input} placeholder="Edit text..."/>
                  <span style={css.label}>Letter spacing</span>
                  <Slider min={-5} max={30} value={selectedLayer.letterSpacing||0}
                    onChange={v=>updateLayerSilent(selectedId,{letterSpacing:v})}
                    onCommit={v=>updateLayer(selectedId,{letterSpacing:v})}
                    style={{width:'100%'}}/>
                </>)}
                <button onClick={addText} style={css.addBtn}>Add text</button>
              </div>
            )}

            {activeTool==='shapes'&&(
              <div>
                <span style={css.label}>Shapes & icons</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                  {SHAPES_BASIC.map(({key,label,icon})=>(<button key={key} onClick={()=>addShape(key)} style={{padding:'10px 4px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:9,cursor:'pointer',textAlign:'center',lineHeight:1.5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=`${T.accent}12`;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.input;}}><div style={{fontSize:16,marginBottom:2}}>{icon}</div><div>{label}</div></button>))}
                </div>
                <span style={css.label}>Fill color</span>
                <input type="color" value={fillColor} onChange={e=>{setFillColor(e.target.value);addRecentColor(e.target.value);if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:e.target.value});}} style={css.color}/>
                <div style={css.section}>
                  {[['R',0],['G',1],['B',2]].map(([l,idx])=>{
                    const hex=fillColor.replace('#','');
                    const vals=[parseInt(hex.slice(0,2),16)||0,parseInt(hex.slice(2,4),16)||0,parseInt(hex.slice(4,6),16)||0];
                    const colors=['#f87171','#4ade80','#60a5fa'];
                    return(
                      <div key={l} style={{...css.row,marginBottom:6}}>
                        <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                        <Slider min={0} max={255} value={vals[idx]}
                          onChange={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setFillColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayerSilent(selectedId,{fillColor:newHex});
                          }}
                          onCommit={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setFillColor(newHex);addRecentColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:newHex});
                          }}
                          style={{flex:1}}/>
                        <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                      </div>
                    );
                  })}
                  <div style={{width:'100%',height:28,borderRadius:6,background:fillColor,margin:'4px 0 6px',border:`1px solid ${T.border}`}}/>
                </div>
                <span style={css.label}>Border color</span>
                <input type="color" value={strokeColor} onChange={e=>{setStrokeColor(e.target.value);if(selectedLayer?.type==='shape')updateLayer(selectedId,{strokeColor:e.target.value});}} style={css.color}/>
                <div style={css.section}>
                  {[['R',0],['G',1],['B',2]].map(([l,idx])=>{
                    const hex=strokeColor.replace('#','');
                    const vals=[parseInt(hex.slice(0,2),16)||0,parseInt(hex.slice(2,4),16)||0,parseInt(hex.slice(4,6),16)||0];
                    const colors=['#f87171','#4ade80','#60a5fa'];
                    return(
                      <div key={l} style={{...css.row,marginBottom:6}}>
                        <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                        <Slider min={0} max={255} value={vals[idx]}
                          onChange={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setStrokeColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayerSilent(selectedId,{strokeColor:newHex});
                          }}
                          onCommit={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setStrokeColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayer(selectedId,{strokeColor:newHex});
                          }}
                          style={{flex:1}}/>
                        <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                      </div>
                    );
                  })}
                  <div style={{width:'100%',height:28,borderRadius:6,background:strokeColor,margin:'4px 0 6px',border:`1px solid ${T.border}`}}/>
                </div>
                {selectedLayer?.type==='shape'&&(<>
                  <span style={css.label}>Blend mode</span>
                  <select value={selectedLayer.blendMode||'normal'} onChange={e=>updateLayer(selectedId,{blendMode:e.target.value})} style={css.input}>{BLEND_MODES.map(m=><option key={m} value={m}>{m}</option>)}</select>
                  <span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span>
                  <Slider min={0} max={100} value={selectedLayer.opacity??100}
                    onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                    onCommit={v=>updateLayer(selectedId,{opacity:v})}
                    style={{width:'100%'}}/>
                  <div style={{display:'flex',gap:5,marginTop:8}}>
                    <button onClick={()=>flipLayer(selectedId,'h')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↔ H</button>
                    <button onClick={()=>flipLayer(selectedId,'v')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↕ V</button>
                  </div>
                </>)}
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                  {recentColors.map((c,i)=>(
                    <div key={i} onClick={()=>{setFillColor(c);addRecentColor(c);if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:c});}}
                      style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>
                  ))}
                </div>
              </div>
            )}

            {activeTool==='effects'&&(
              <div>
                <span style={css.label}>Layer effects</span>
                {!selectedLayer||selectedLayer.type==='background'?(
                  <div style={{...css.section,marginTop:0,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>✦</div>Click any layer to apply effects</div>
                ):(
                  <>
                    <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600'}}>✦ Non-destructive — editable anytime</div>
                    <span style={css.label}>Blur — {selectedLayer.effects?.layerBlur||0}px</span>
                    <Slider min={0} max={30} value={selectedLayer.effects?.layerBlur||0}
                      onChange={v=>updateLayerEffectSilent(selectedId,'layerBlur',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'layerBlur',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Brightness — {selectedLayer.effects?.brightness||100}%</span>
                    <Slider min={0} max={200} value={selectedLayer.effects?.brightness||100}
                      onChange={v=>updateLayerEffectSilent(selectedId,'brightness',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'brightness',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Contrast — {selectedLayer.effects?.contrast||100}%</span>
                    <Slider min={0} max={300} value={selectedLayer.effects?.contrast||100}
                      onChange={v=>updateLayerEffectSilent(selectedId,'contrast',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'contrast',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Saturation — {selectedLayer.effects?.saturation||100}%</span>
                    <Slider min={0} max={300} value={selectedLayer.effects?.saturation||100}
                      onChange={v=>updateLayerEffectSilent(selectedId,'saturation',v)}
                      onCommit={v=>updateLayerEffect(selectedId,'saturation',v)}
                      style={{width:'100%'}}/>
                    <span style={css.label}>Drop shadow</span>
                    <div style={css.section}>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'shadow','enabled',!(selectedLayer.effects?.shadow?.enabled))} style={css.iconBtn(selectedLayer.effects?.shadow?.enabled)}>{selectedLayer.effects?.shadow?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.shadow?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects.shadow.color||'#000000'} onChange={e=>updateLayerEffectNested(selectedId,'shadow','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        {[['X','x',-20,20],['Y','y',-20,20],['Blur','blur',0,40],['Opacity','opacity',0,100]].map(([l,k,mn,mx])=>(<div key={k} style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>{l}</span><Slider min={mn} max={mx} value={selectedLayer.effects.shadow[k]??0} onChange={v=>updateLayerEffectNestedSilent(selectedId,'shadow',k,v)} onCommit={v=>updateLayerEffectNested(selectedId,'shadow',k,v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects.shadow[k]??0}</span></div>))}
                      </>}
                    </div>
                    <span style={css.label}>Glow</span>
                    <div style={css.section}>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'glow','enabled',!(selectedLayer.effects?.glow?.enabled))} style={css.iconBtn(selectedLayer.effects?.glow?.enabled)}>{selectedLayer.effects?.glow?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.glow?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects.glow.color||'#f97316'} onChange={e=>updateLayerEffectNested(selectedId,'glow','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>Blur</span><Slider min={0} max={60} value={selectedLayer.effects.glow.blur||20} onChange={v=>updateLayerEffectNestedSilent(selectedId,'glow','blur',v)} onCommit={v=>updateLayerEffectNested(selectedId,'glow','blur',v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects.glow.blur||20}</span></div>
                      </>}
                    </div>
                    <span style={css.label}>Outline</span>
                    <div style={css.section}>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'outline','enabled',!(selectedLayer.effects?.outline?.enabled))} style={css.iconBtn(selectedLayer.effects?.outline?.enabled)}>{selectedLayer.effects?.outline?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.outline?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects.outline.color||'#ffffff'} onChange={e=>updateLayerEffectNested(selectedId,'outline','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>Width</span><Slider min={0} max={20} value={selectedLayer.effects.outline.width||2} onChange={v=>updateLayerEffectNestedSilent(selectedId,'outline','width',v)} onCommit={v=>updateLayerEffectNested(selectedId,'outline','width',v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects.outline.width||2}px</span></div>
                      </>}
                    </div>
                    <span style={css.label}>Subject Glow Outline</span>
                    <div style={css.section}>
                      <div style={{fontSize:10,color:T.muted,marginBottom:6,lineHeight:1.5}}>Contour outline using stacked drop-shadows — works on PNG cutouts &amp; removed backgrounds.</div>
                      <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>updateLayerEffectNested(selectedId,'subjectOutline','enabled',!(selectedLayer.effects?.subjectOutline?.enabled))} style={css.iconBtn(selectedLayer.effects?.subjectOutline?.enabled)}>{selectedLayer.effects?.subjectOutline?.enabled?'On':'Off'}</button></div>
                      {selectedLayer.effects?.subjectOutline?.enabled&&<>
                        <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:40}}>Color</span><input type="color" value={selectedLayer.effects?.subjectOutline?.color||'#ffffff'} onChange={e=>updateLayerEffectNested(selectedId,'subjectOutline','color',e.target.value)} style={{...css.color,height:28}}/></div>
                        <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:40}}>Width</span><Slider min={1} max={20} value={selectedLayer.effects?.subjectOutline?.width||5} onChange={v=>updateLayerEffectNestedSilent(selectedId,'subjectOutline','width',v)} onCommit={v=>updateLayerEffectNested(selectedId,'subjectOutline','width',v)} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:24,textAlign:'right'}}>{selectedLayer.effects?.subjectOutline?.width||5}px</span></div>
                      </>}
                    </div>
                    <span style={css.label}>Layer mask</span>
                    <div style={{...css.section,textAlign:'center',padding:16}}>
                      <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>
                        Layer masks are coming soon. Paint black to hide, white to reveal — like Photoshop.
                      </div>
                    </div>
                    <button onClick={()=>updateLayer(selectedId,{effects:defaultEffects()})} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`,marginTop:10}}>Reset all effects</button>
                  </>
                )}
              </div>
            )}

            {activeTool==='stickers'&&(
              <div>
                <span style={css.label}>Category</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>{Object.keys(STICKER_CATEGORIES).map(cat=>(<button key={cat} onClick={()=>setActiveCategory(cat)} style={css.pill(activeCategory===cat)}>{cat}</button>))}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {STICKER_CATEGORIES[activeCategory].map((s,i)=>(<div key={i} onClick={()=>addSvgSticker(s.svg,s.label)} style={{padding:'9px 4px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}><div style={{width:32,height:32}} dangerouslySetInnerHTML={{__html:s.svg}}/><span style={{fontSize:9,color:T.muted,textAlign:'center'}}>{s.label}</span></div>))}
                </div>
              </div>
            )}

            {activeTool==='memes'&&(
              <MemesPanel theme={T} onAddSvg={addSvgSticker}
                onAddGif={(url,w,h)=>{
                  const aspect=w/h,cW=p.preview.w,cH=p.preview.h,ca=cW/cH;
                  let fw,fh;if(aspect>ca){fh=cH;fw=fh*aspect;}else{fw=cW;fh=fw/aspect;}
                  addLayer({type:'image',src:url,width:Math.round(fw),height:Math.round(fh),x:Math.round((cW-fw)/2),y:Math.round((cH-fh)/2),cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
                }}
              />
            )}

            {activeTool==='background'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Click the background on the canvas to select it.</div>
                <span style={css.label}>Solid color</span>
                <input type="color" value={bg?.bgColor||'#f97316'} onChange={e=>{updateBg({bgColor:e.target.value,bgGradient:null});addRecentColor(e.target.value);}} style={css.color}/>
                <span style={css.label}>RGB mixer</span>
                <div style={css.section}>
                  {[['R',rgbR,setRgbR,'#f87171'],['G',rgbG,setRgbG,'#4ade80'],['B',rgbB,setRgbB,'#60a5fa']].map(([l,v,sv,c])=>(<div key={l} style={{...css.row,marginBottom:6}}><span style={{fontSize:11,color:c,fontWeight:'700',width:12}}>{l}</span><Slider min={0} max={255} value={v} onChange={sv} onCommit={triggerAutoSave} style={{flex:1}}/><span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{Math.round(v)}</span></div>))}
                  <div style={{width:'100%',height:28,borderRadius:6,background:`rgb(${Math.round(rgbR)},${Math.round(rgbG)},${Math.round(rgbB)})`,margin:'4px 0 8px',border:`1px solid ${T.border}`}}/>
                  <button onClick={()=>{const hex='#'+[rgbR,rgbG,rgbB].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');updateBg({bgColor:hex,bgGradient:null});addRecentColor(hex);}} style={{...css.addBtn,marginTop:0}}>Apply</button>
                </div>
                <span style={css.label}>Gradients</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {GRADIENTS.map(([c1,c2],i)=>(<div key={i} onClick={()=>updateBg({bgGradient:[c1,c2]})} style={{height:36,borderRadius:6,background:`linear-gradient(135deg,${c1},${c2})`,cursor:'pointer',border:bg?.bgGradient?.[0]===c1?'2px solid #fff':`1px solid ${T.border}`}}/>))}
                </div>
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{recentColors.map((c,i)=>(<div key={i} onClick={()=>updateBg({bgColor:c,bgGradient:null})} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>))}</div>
                {bg&&(<><span style={css.label}>Opacity — {bg.opacity??100}%</span><Slider min={0} max={100} value={bg.opacity??100} onChange={v=>updateLayerSilent(bg.id,{opacity:v})} onCommit={v=>updateLayer(bg.id,{opacity:v})} style={{width:'100%'}}/></>)}
              </div>
            )}

            {activeTool==='brandkit'&&(
              <SidebarBrandKit
                T={T}
                user={user}
                brandKit={brandKit}
                brandKitLoading={brandKitLoading}
                brandKitFace={brandKitFace}
                brandKitColors={brandKitColors}
                selectedLayer={selectedLayer}
                onOpenSetup={()=>setShowBrandKitSetup(true)}
                onInjectSubject={()=>injectBrandSubject(brandKit||{face_image_url:brandKitFace,subject_url:brandKitFace,subject_image_url:brandKitFace})}
                onApplyColor={applyBrandColorToSelected}
              />
            )}

            {activeTool==='adjust'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Canvas-wide adjustments affect everything.</div>
                {[['Brightness',brightness,setBrightness,50,200,'%'],['Contrast',contrast,setContrast,50,300,'%'],['Saturation',saturation,setSaturation,0,300,'%'],['Hue',hue,setHue,0,360,'°']].map(([l,v,sv,mn,mx,u])=>(<div key={l}><span style={css.label}>{l} — {Math.round(v)}{u}</span><Slider min={mn} max={mx} value={v} onChange={sv} onCommit={triggerAutoSave} style={{width:'100%'}}/></div>))}
                {selectedLayer?.type==='image'&&(<>
                  <div style={css.divider}/>
                  <div style={{fontSize:11,color:T.accent,fontWeight:'600',marginBottom:4}}>Per-image filters</div>
                  {[['Brightness','imgBrightness',50,200,'%'],['Contrast','imgContrast',50,200,'%'],['Saturate','imgSaturate',0,300,'%'],['Blur','imgBlur',0,20,'px']].map(([l,k,mn,mx,u])=>(<div key={k}><span style={css.label}>{l} — {selectedLayer[k]??(k==='imgBlur'?0:100)}{u}</span><Slider min={mn} max={mx} value={selectedLayer[k]??(k==='imgBlur'?0:100)} onChange={v=>updateLayerSilent(selectedId,{[k]:v})} onCommit={v=>updateLayer(selectedId,{[k]:v})} style={{width:'100%'}}/></div>))}
                  <button onClick={()=>updateLayer(selectedId,{imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0})} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`,marginTop:6}}>Reset image</button>
                </>)}
                {selectedLayer&&selectedLayer.type!=='background'&&(<><div style={css.divider}/><span style={css.label}>Layer opacity — {selectedLayer.opacity??100}%</span><Slider min={0} max={100} value={selectedLayer.opacity??100} onChange={v=>updateLayerSilent(selectedId,{opacity:v})} onCommit={v=>updateLayer(selectedId,{opacity:v})} style={{width:'100%'}}/></>)}
                <button onClick={()=>{setBrightness(100);setContrast(100);setSaturation(100);setHue(0);triggerAutoSave();}} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>Reset canvas</button>
              </div>
            )}

            {activeTool==='upload'&&(
              <div>
                <span style={css.label}>Upload images</span>
                <label style={{padding:'20px 16px',borderRadius:8,border:`1.5px dashed ${T.border}`,color:T.muted,fontSize:12,cursor:'pointer',textAlign:'center',display:'block',lineHeight:1.9}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div style={{fontSize:24,marginBottom:6}}>↑</div>
                  Click to upload<br/>
                  <span style={{fontSize:10,color:T.muted}}>PNG · JPG · GIF · WEBP</span><br/>
                  <span style={{fontSize:10,color:T.success,fontWeight:'600'}}>Multiple files — each becomes a layer</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{display:'none'}}/>
                </label>
                <span style={css.label}>Color palette</span>
                <div style={css.section}>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                    {savedPalette.map((c,i)=>(<div key={i} style={{position:'relative'}}><div onClick={()=>addRecentColor(c)} style={{width:24,height:24,borderRadius:5,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/><div onClick={()=>setSavedPalette(prev=>prev.filter((_,j)=>j!==i))} style={{position:'absolute',top:-5,right:-5,width:12,height:12,background:T.danger,borderRadius:'50%',fontSize:8,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>×</div></div>))}
                    {savedPalette.length===0&&<div style={{fontSize:10,color:T.muted}}>No saved colors</div>}
                  </div>
                  <div style={css.row}><input type="color" style={{...css.color,width:44,flexShrink:0,height:32}} onChange={e=>setSavedPalette(prev=>[...prev.filter(c=>c!==e.target.value),e.target.value].slice(0,20))}/><span style={{fontSize:10,color:T.muted}}>Click to save color</span></div>
                </div>
                {selectedLayer?.type==='image'&&(<><div style={css.divider}/><span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span><Slider min={0} max={100} value={selectedLayer.opacity??100} onChange={v=>updateLayerSilent(selectedId,{opacity:v})} onCommit={v=>updateLayer(selectedId,{opacity:v})} style={{width:'100%'}}/></>)}
              </div>
            )}

            {activeTool==='face'&&(
              <div>
                <span style={css.label}>Face & emotion score</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Analyze your thumbnail's face placement, size, lighting and get emotion suggestions for maximum CTR.
                </div>

                <button onClick={analyzeFace} disabled={faceLoading}
                  style={{...css.addBtn,marginTop:10,
                    background:faceLoading?T.muted:T.accent,
                    opacity:faceLoading?0.6:1,fontSize:13,fontWeight:'700'}}>
                  {faceLoading?'Analyzing...':'◉ Analyze face & emotion'}
                </button>

                {faceAnalysis&&!faceAnalysis.error&&(
                  <div>
                    {/* Overall score */}
                    <div style={{textAlign:'center',padding:'16px 0 8px'}}>
                      <div style={{
                        fontSize:52,fontWeight:'900',letterSpacing:'-2px',
                        color:faceAnalysis.score>=80?T.success:
                              faceAnalysis.score>=60?T.warning:T.danger,
                      }}>
                        {faceAnalysis.score}
                      </div>
                      <div style={{fontSize:12,color:T.muted}}>face score / 100</div>
                      <div style={{fontSize:13,fontWeight:'700',marginTop:6,
                        color:faceAnalysis.score>=80?T.success:
                              faceAnalysis.score>=60?T.warning:T.danger}}>
                        {faceAnalysis.score>=80?'🔥 Thumbnail ready':
                         faceAnalysis.score>=60?'⚠️ Needs improvement':
                         faceAnalysis.score>=40?'❌ Weak face presence':
                         '❌ No face detected'}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div style={{height:6,borderRadius:3,background:T.border,
                      marginBottom:14,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,
                        width:`${faceAnalysis.score}%`,
                        background:faceAnalysis.score>=80?T.success:
                                   faceAnalysis.score>=60?T.warning:T.danger,
                        transition:'width 0.5s ease'}}/>
                    </div>

                    {/* Breakdown */}
                    <span style={css.label}>Breakdown</span>
                    <div style={css.section}>
                      {faceAnalysis.scores.map((s,i)=>(
                        <div key={i} style={{marginBottom:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>{s.label}</span>
                            <span style={{fontSize:11,fontWeight:'700',
                              color:s.score/s.max>=0.8?T.success:
                                    s.score/s.max>=0.5?T.warning:T.danger}}>
                              {s.score}/{s.max}
                            </span>
                          </div>
                          <div style={{height:4,borderRadius:2,background:T.border,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:2,
                              width:`${(s.score/s.max)*100}%`,
                              background:s.score/s.max>=0.8?T.success:
                                         s.score/s.max>=0.5?T.warning:T.danger}}/>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Good things */}
                    {faceAnalysis.goods.length>0&&(<>
                      <span style={css.label}>What's working</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {faceAnalysis.goods.map((g,i)=>(
                          <div key={i} style={{padding:'7px 10px',borderRadius:6,
                            fontSize:11,color:T.text,lineHeight:1.5,
                            background:`${T.success}18`,
                            border:`1px solid ${T.success}44`}}>
                            ✓ {g}
                          </div>
                        ))}
                      </div>
                    </>)}

                    {/* Tips */}
                    {faceAnalysis.tips.length>0&&(<>
                      <span style={css.label}>Improvements</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {faceAnalysis.tips.map((t,i)=>(
                          <div key={i} style={{padding:'7px 10px',borderRadius:6,
                            fontSize:11,color:T.text,lineHeight:1.5,
                            background:`${T.warning}18`,
                            border:`1px solid ${T.warning}44`}}>
                            → {t}
                          </div>
                        ))}
                      </div>
                    </>)}

                    {/* Emotion guide */}
                    {faceAnalysis.hasFace&&faceAnalysis.emotionTips.length>0&&(<>
                      <span style={css.label}>Emotion guide</span>
                      <div style={{...css.section,fontSize:11,color:T.muted,
                        marginBottom:4,lineHeight:1.5}}>
                        The emotion on a face drives clicks. Here are the highest-performing expressions for YouTube:
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {faceAnalysis.emotionTips.map((et,i)=>(
                          <div key={i} style={{padding:'8px 10px',borderRadius:7,
                            background:T.input,border:`1px solid ${T.border}`}}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              alignItems:'center',marginBottom:4}}>
                              <span style={{fontSize:12,fontWeight:'700',color:T.text}}>
                                {et.emotion}
                              </span>
                              <span style={{fontSize:9,fontWeight:'700',
                                color:et.ctr==='High CTR'?T.success:T.warning,
                                background:et.ctr==='High CTR'?`${T.success}20`:`${T.warning}20`,
                                padding:'2px 6px',borderRadius:8}}>
                                {et.ctr}
                              </span>
                            </div>
                            <div style={{fontSize:10,color:T.muted,lineHeight:1.5}}>{et.tip}</div>
                          </div>
                        ))}
                      </div>
                    </>)}

                    <button onClick={()=>setFaceAnalysis(null)}
                      style={{...css.addBtn,marginTop:10,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`}}>
                      Reset
                    </button>
                  </div>
                )}

                {faceAnalysis?.error&&(
                  <div style={{...css.section,marginTop:10,fontSize:12,
                    color:T.danger,textAlign:'center',lineHeight:1.6}}>
                    {faceAnalysis.message}
                  </div>
                )}

                {!faceAnalysis&&!faceLoading&&(
                  <div style={{...css.section,marginTop:10,fontSize:11,
                    color:T.muted,lineHeight:1.7}}>
                    <div style={{fontSize:20,textAlign:'center',marginBottom:8}}>◉</div>
                    Upload a photo with a face, then click analyze. You'll get:<br/><br/>
                    • Face detection and placement score<br/>
                    • Lighting quality analysis<br/>
                    • How well the face stands out<br/>
                    • Emotion suggestions for higher CTR
                  </div>
                )}
              </div>
            )}

            {activeTool==='yttest'&&(
              <div>
                <span style={css.label}>YouTube A/B Testing</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                  Test different thumbnails on a live YouTube video. ThumbFrame rotates them automatically and measures which one gets the most clicks.
                </div>

                {!ytConnected?(
                  <div>
                    <div style={{...css.section,textAlign:'center',padding:'20px 14px'}}>
                      <div style={{fontSize:32,marginBottom:10}}>▶</div>
                      <div style={{fontSize:13,fontWeight:'700',color:T.text,marginBottom:6}}>Connect your YouTube channel</div>
                      <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:14}}>
                        Authorize ThumbFrame to swap thumbnails on your videos. We only request thumbnail upload permissions — nothing else.
                      </div>
                      <button onClick={()=>{
                        // YouTube OAuth flow — opens Google consent screen
                        // Requires REACT_APP_GOOGLE_CLIENT_ID in .env
                        const clientId=process.env.REACT_APP_GOOGLE_CLIENT_ID;
                        if(!clientId){
                          setYtTestStatus('Set up Google OAuth credentials first. Add REACT_APP_GOOGLE_CLIENT_ID to your .env file.');
                          setYtConnected(false);
                          return;
                        }
                        const redirect=encodeURIComponent(window.location.origin+'/editor');
                        const scope=encodeURIComponent('https://www.googleapis.com/auth/youtube');
                        window.location.href=`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
                      }}
                        style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#FF0000,#CC0000)',fontSize:13,fontWeight:'700'}}>
                        Connect YouTube Channel
                      </button>
                      {ytTestStatus&&(
                        <div style={{marginTop:10,padding:'8px 10px',borderRadius:7,fontSize:11,lineHeight:1.5,
                          background:`${T.warning}18`,border:`1px solid ${T.warning}44`,color:T.text}}>
                          {ytTestStatus}
                        </div>
                      )}
                    </div>

                    <span style={css.label}>How it works</span>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {[
                        ['1. Connect','Authorize your YouTube channel via Google OAuth'],
                        ['2. Pick a video','Paste a YouTube video URL to test'],
                        ['3. Upload variants','Generate A/B variants or upload custom thumbnails'],
                        ['4. Set duration','Choose 24h, 48h, or 7-day test rotation'],
                        ['5. Get results','See real CTR data per thumbnail — auto-pick winner'],
                      ].map(([title,desc])=>(
                        <div key={title} style={{padding:'8px 10px',borderRadius:7,background:T.input,border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:11,fontWeight:'700',color:T.accent}}>{title}</div>
                          <div style={{fontSize:10,color:T.muted,marginTop:2}}>{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ):(
                  <div>
                    <div style={{padding:'8px 10px',borderRadius:7,background:`${T.success}18`,border:`1px solid ${T.success}44`,marginBottom:10}}>
                      <div style={{fontSize:11,color:T.success,fontWeight:'600'}}>✓ YouTube connected</div>
                    </div>

                    <span style={css.label}>Video URL</span>
                    <input value={ytVideoUrl} onChange={e=>setYtVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      style={{...css.input,marginBottom:8}}/>

                    <span style={css.label}>Test duration</span>
                    <div style={{display:'flex',gap:4,marginBottom:10}}>
                      {[['24h','24 hours'],['48h','48 hours'],['7d','7 days']].map(([val,label])=>(
                        <button key={val} onClick={()=>setYtTestDuration(val)}
                          style={css.pill(ytTestDuration===val)}>{label}</button>
                      ))}
                    </div>

                    <span style={css.label}>Variants to test</span>
                    <div style={{...css.section,fontSize:11,color:T.muted}}>
                      {abVariants.length>0
                        ? `${abVariants.length} variants ready from A/B engine`
                        : 'Generate variants first using the A/B Variants tool, or upload custom thumbnails'}
                    </div>

                    <button onClick={()=>{
                      if(!ytVideoUrl){setYtTestStatus('Enter a YouTube video URL');return;}
                      if(abVariants.length===0){setYtTestStatus('Generate A/B variants first');return;}
                      setYtTestStatus('Starting test... (YouTube API integration required)');
                      setYtTests(prev=>[...prev,{
                        id:Date.now(),
                        videoUrl:ytVideoUrl,
                        variants:abVariants.length,
                        duration:ytTestDuration,
                        startedAt:new Date().toISOString(),
                        status:'pending',
                      }]);
                    }}
                      style={{...css.addBtn,background:'linear-gradient(135deg,#f97316,#ea580c)',
                        fontSize:13,fontWeight:'700',
                        boxShadow:'0 0 20px rgba(249,115,22,0.3)'}}>
                      ▶ Start A/B Test
                    </button>

                    {ytTestStatus&&(
                      <div style={{marginTop:8,padding:'8px 10px',borderRadius:7,fontSize:11,
                        background:`${T.warning}18`,border:`1px solid ${T.warning}44`,color:T.text}}>
                        {ytTestStatus}
                      </div>
                    )}

                    {ytTests.length>0&&(<>
                      <span style={css.label}>Active tests</span>
                      {ytTests.map(test=>(
                        <div key={test.id} style={{...css.section,marginBottom:6}}>
                          <div style={{fontSize:11,fontWeight:'600',color:T.text,marginBottom:4}}>
                            {test.videoUrl.slice(0,40)}...
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:T.muted}}>
                            <span>{test.variants} variants · {test.duration}</span>
                            <span style={{color:T.warning,fontWeight:'600'}}>{test.status}</span>
                          </div>
                        </div>
                      ))}
                    </>)}
                  </div>
                )}
              </div>
            )}

            {activeTool==='resize'&&(
              <div>
                <span style={css.label}>Export all platforms</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Export your thumbnail at the correct size for every platform in one click.
                  Downloads 5 files automatically.
                </div>

                {/* Platform list */}
                <span style={css.label}>Platforms included</span>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {[
                    ['YouTube',   '1280×720',  '▶'],
                    ['TikTok',    '1080×1920', '♪'],
                    ['Instagram', '1080×1080', '◉'],
                    ['Twitter',   '1600×900',  '✦'],
                    ['LinkedIn',  '1200×627',  '⊞'],
                  ].map(([name,size,icon])=>(
                    <div key={name} style={{
                      display:'flex',alignItems:'center',gap:10,
                      padding:'8px 10px',borderRadius:7,
                      background:T.input,border:`1px solid ${T.border}`,
                    }}>
                      <span style={{fontSize:14,width:20,textAlign:'center'}}>{icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:'600',color:T.text}}>{name}</div>
                        <div style={{fontSize:10,color:T.muted}}>{size}px</div>
                      </div>
                      <div style={{width:8,height:8,borderRadius:'50%',
                        background:T.success}}/>
                    </div>
                  ))}
                </div>

                {resizeProgress&&(
                  <div style={{...css.section,marginTop:10,fontSize:12,
                    color:T.success,fontWeight:'600',textAlign:'center'}}>
                    {resizeProgress}
                  </div>
                )}

                <button onClick={exportAllPlatforms}
                  disabled={resizeExporting}
                  style={{...css.addBtn,marginTop:12,
                    background:resizeExporting?T.muted:T.success,
                    fontSize:13,fontWeight:'700',
                    opacity:resizeExporting?0.6:1}}>
                  {resizeExporting?resizeProgress||'Exporting...':'↓ Export all 5 platforms'}
                </button>

                <div style={{...css.section,marginTop:10,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  💡 Tip — design at YouTube 1280×720 first then export all.
                  Text and images scale proportionally to each platform size.
                </div>
              </div>
            )}

            {activeTool==='ab'&&(
              <div>
                <span style={css.label}>A/B Variants</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Generate 3 variations of your current thumbnail instantly.
                  Pick the one that feels strongest.
                </div>

                <button onClick={generateVariants} disabled={abLoading}
                  style={{...css.addBtn,marginTop:10,
                    background:abLoading?T.muted:T.accent,
                    opacity:abLoading?0.6:1,fontSize:13,fontWeight:'700'}}>
                  {abLoading?'Generating...':'⊟ Generate 3 variants'}
                </button>

                {abLoading&&(
                  <div style={{textAlign:'center',padding:'20px 0',
                    fontSize:12,color:T.muted}}>
                    Creating variations...
                  </div>
                )}

                {abVariants.length>0&&(
                  <div>
                    <span style={{...css.label,marginTop:16}}>Choose a variant</span>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {abVariants.map(variant=>{
                        const vBg=variant.layers.find(l=>l.type==='background');
                        const vText=variant.layers.find(l=>l.type==='text');
                        const isSelected=abSelected===variant.id;
                        return(
                          <div key={variant.id}
                            onClick={()=>setAbSelected(variant.id)}
                            style={{borderRadius:8,border:`2px solid ${isSelected?T.accent:T.border}`,
                              overflow:'hidden',cursor:'pointer',transition:'all 0.15s',
                              background:isSelected?`${T.accent}08`:'transparent'}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=isSelected?T.accent:T.border}>
                            {/* Mini preview */}
                            <div style={{
                              height:56,
                              background:vBg?.bgGradient
                                ?`linear-gradient(135deg,${vBg.bgGradient[0]},${vBg.bgGradient[1]})`
                                :vBg?.bgColor||'#1a1a1a',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              position:'relative',overflow:'hidden',
                            }}>
                              {variant.layers.filter(l=>l.type==='image'&&!l.hidden).map((img,idx)=>(
                                <img key={idx} src={img.paintSrc||img.src} alt="" style={{
                                  position:'absolute',
                                  left:img.x*(56/p.preview.h)||0,
                                  top:img.y*(56/p.preview.h)||0,
                                  height:img.height*(56/p.preview.h)||56,
                                  width:'auto',
                                  pointerEvents:'none',
                                  userSelect:'none',
                                }}/>
                              ))}
                              {vText&&(
                                <span style={{
                                  fontSize:14,fontWeight:vText.fontWeight||700,
                                  color:vText.textColor||'#fff',
                                  fontFamily:vText.fontFamily||'Impact',
                                  textShadow:vText.shadowEnabled?'2px 2px 0 #000':'none',
                                  WebkitTextStroke:vText.strokeWidth>0
                                    ?`${Math.min(vText.strokeWidth,2)}px ${vText.strokeColor}`:'none',
                                  letterSpacing:1,padding:'0 8px',
                                  textAlign:'center',position:'relative',zIndex:1,
                                }}>
                                  {vText.text?.slice(0,20)}
                                </span>
                              )}
                              <div style={{position:'absolute',top:4,left:4,
                                fontSize:9,fontWeight:'800',color:'#fff',
                                background:'rgba(0,0,0,0.6)',padding:'1px 6px',
                                borderRadius:8}}>
                                {variant.label.split(' — ')[0]}
                              </div>
                            </div>
                            {/* Info + apply */}
                            <div style={{padding:'8px 10px',display:'flex',
                              alignItems:'center',justifyContent:'space-between'}}>
                              <div>
                                <div style={{fontSize:11,fontWeight:'600',color:T.text}}>
                                  {variant.label}
                                </div>
                                <div style={{fontSize:10,color:T.muted,marginTop:1}}>
                                  {variant.desc}
                                </div>
                              </div>
                              <button onClick={e=>{e.stopPropagation();applyVariant(variant);}}
                                style={{padding:'5px 12px',borderRadius:5,border:'none',
                                  background:T.accent,color:'#fff',cursor:'pointer',
                                  fontSize:10,fontWeight:'700',flexShrink:0}}>
                                Use this
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{...css.section,marginTop:10,fontSize:11,
                      color:T.muted,lineHeight:1.6}}>
                      💡 Tip — generate variants multiple times for more options.
                      Each run creates different combinations.
                    </div>

                    <button onClick={downloadVariantsAsZip} disabled={abLoading}
                      style={{...css.addBtn,marginTop:8,
                        background:abLoading?T.muted:'linear-gradient(135deg,#f97316,#ea580c)',
                        color:'#fff',fontWeight:'700',fontSize:12,
                        boxShadow:abLoading?'none':'0 0 20px rgba(249,115,22,0.3)',
                        opacity:abLoading?0.6:1}}>
                      {abLoading?'Exporting...':'⬇ Download All as ZIP'}
                    </button>
                    <button onClick={()=>{setAbVariants([]);setAbSelected(null);}}
                      style={{...css.addBtn,marginTop:8,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`}}>
                      Clear variants
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='templates'&&(
              <div>
                <span style={css.label}>Viral templates</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Click any template to load it. You can customize everything after.
                </div>

                {/* Category filter */}
                {(()=>{
                  const cats=['All',...new Set(VIRAL_TEMPLATES.map(t=>t.category))];
                  const [activeCat,setActiveCat] = [
                    window._snapTemplateCat||'All',
                    (c)=>{ window._snapTemplateCat=c; setActiveTool('templates'); }
                  ];
                  const filtered = activeCat==='All'
                    ? VIRAL_TEMPLATES
                    : VIRAL_TEMPLATES.filter(t=>t.category===activeCat);
                  return(
                    <>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',margin:'8px 0'}}>
                        {cats.map(cat=>(
                          <button key={cat} onClick={()=>setActiveCat(cat)}
                            style={{padding:'3px 10px',borderRadius:10,fontSize:10,
                              border:`1px solid ${activeCat===cat?T.accent:T.border}`,
                              background:activeCat===cat?T.accent:'transparent',
                              color:activeCat===cat?'#fff':T.muted,cursor:'pointer',
                              fontWeight:activeCat===cat?'700':'400'}}>
                            {cat}
                          </button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {filtered.map(template=>(
                          <div key={template.id}
                            style={{borderRadius:8,border:`1px solid ${T.border}`,
                              overflow:'hidden',cursor:'pointer',transition:'all 0.15s'}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                            {/* Preview */}
                            <div onClick={()=>loadTemplate(template)}
                              style={{height:60,background:template.preview.bg,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                position:'relative',overflow:'hidden'}}>
                              <span style={{fontSize:16,fontWeight:'900',color:'#fff',
                                fontFamily:'Impact,sans-serif',
                                textShadow:'2px 2px 0 rgba(0,0,0,0.8)',
                                letterSpacing:1}}>
                                {template.preview.text}
                              </span>
                              <div style={{position:'absolute',top:4,right:4,
                                padding:'1px 6px',borderRadius:8,
                                background:'rgba(0,0,0,0.6)',
                                fontSize:8,color:'#fff',fontWeight:'600'}}>
                                {template.category}
                              </div>
                            </div>
                            {/* Info */}
                            <div style={{padding:'8px 10px',background:T.input,
                              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                              <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>
                                {template.label}
                              </span>
                              <button onClick={()=>loadTemplate(template)}
                                style={{padding:'3px 10px',borderRadius:5,border:'none',
                                  background:T.accent,color:'#fff',cursor:'pointer',
                                  fontSize:10,fontWeight:'700'}}>
                                Use
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {activeTool==='ctr'&&(
              <div>
                <span style={css.label}>CTR Score</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Analyze your thumbnail and get a click-through rate score based on contrast, text, subject and composition.
                </div>

                <button onClick={analyzeCTR} disabled={ctrLoading}
                  style={{...css.addBtn,background:ctrLoading?T.muted:T.accent,
                    marginTop:10,fontSize:13,fontWeight:'700',opacity:ctrLoading?0.6:1}}>
                  {ctrLoading?'Analyzing...':'◈ Analyze thumbnail'}
                </button>

                {ctrScore!==null&&(
                  <div>
                    <div style={{textAlign:'center',padding:'20px 0 10px'}}>
                      <div style={{
                        fontSize:56,fontWeight:'900',
                        color: ctrScore>=80?T.success:ctrScore>=60?T.warning:T.danger,
                        lineHeight:1,letterSpacing:'-2px',
                      }}>{ctrScore}</div>
                      <div style={{fontSize:13,color:T.muted,marginTop:4}}>
                        {ctrScore>=90?'S':''}
                        {ctrScore>=80&&ctrScore<90?'A':''}
                        {ctrScore>=70&&ctrScore<80?'B':''}
                        {ctrScore>=60&&ctrScore<70?'C':''}
                        {ctrScore>=40&&ctrScore<60?'D':''}
                        {ctrScore<40?'F':''}
                        {' — '}out of 100
                      </div>
                      <div style={{
                        fontSize:14,fontWeight:'700',marginTop:8,
                        color: ctrScore>=80?T.success:ctrScore>=60?T.warning:T.danger,
                      }}>
                        {ctrScore>=90?'🔥 Viral potential':
                         ctrScore>=80?'✅ Strong thumbnail':
                         ctrScore>=60?'⚠️ Needs work':
                         '❌ Low CTR risk'}
                      </div>
                    </div>

                    <div style={{height:8,borderRadius:4,background:T.border,marginBottom:16,overflow:'hidden'}}>
                      <div style={{
                        height:'100%',borderRadius:4,
                        width:`${ctrScore}%`,
                        background: ctrScore>=80?T.success:ctrScore>=60?T.warning:T.danger,
                        transition:'width 0.5s ease',
                      }}/>
                    </div>

                    <span style={css.label}>Breakdown</span>
                    <div style={css.section}>
                      {[
                        ['Contrast',   ctrBreakdown.contrast, 'How much light/dark variation'],
                        ['Vibrancy',   ctrBreakdown.vibrancy, 'Color saturation and pop'],
                        ['Text',       ctrBreakdown.text,     'Bold readable text present'],
                        ['Subject',    ctrBreakdown.subject,  'Clear main subject'],
                        ['Composition',ctrBreakdown.comp,     'Layer variety and depth'],
                        ['Safe zones', ctrBreakdown.safe,     'Content away from YouTube UI'],
                      ].map(([label,score,desc])=>(
                        <div key={label} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>{label}</span>
                            <span style={{fontSize:11,fontWeight:'700',
                              color:score>=80?T.success:score>=60?T.warning:T.danger}}>
                              {score}/100
                            </span>
                          </div>
                          <div style={{height:5,borderRadius:3,background:T.border,overflow:'hidden'}}>
                            <div style={{
                              height:'100%',borderRadius:3,
                              width:`${score}%`,
                              background:score>=80?T.success:score>=60?T.warning:T.danger,
                            }}/>
                          </div>
                          <div style={{fontSize:9,color:T.muted,marginTop:2}}>{desc}</div>
                        </div>
                      ))}
                    </div>

                    {ctrBreakdown.heatmap&&(<>
                      <span style={css.label}>Attention Heatmap</span>
                      <div style={{...css.section,padding:0,overflow:'hidden',position:'relative'}}>
                        <img src={ctrBreakdown.heatmap} alt="Attention heatmap"
                          style={{width:'100%',display:'block',borderRadius:7}}/>
                        <div style={{position:'absolute',bottom:6,right:6,display:'flex',gap:4,fontSize:8,color:'#fff'}}>
                          <span style={{background:'rgba(0,0,255,0.7)',padding:'1px 5px',borderRadius:3}}>Cold</span>
                          <span style={{background:'rgba(0,180,0,0.7)',padding:'1px 5px',borderRadius:3}}>Warm</span>
                          <span style={{background:'rgba(255,0,0,0.7)',padding:'1px 5px',borderRadius:3}}>Hot</span>
                        </div>
                      </div>
                    </>)}

                    {ctrBreakdown.tips.length>0&&(<>
                      <span style={css.label}>Suggestions</span>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {ctrBreakdown.tips.map((tip,i)=>(
                          <div key={i} style={{
                            padding:'8px 10px',borderRadius:7,fontSize:11,lineHeight:1.5,
                            background: tip.type==='good'?`${T.success}18`:
                                        tip.type==='bad'?`${T.danger}18`:`${T.warning}18`,
                            border:`1px solid ${
                              tip.type==='good'?T.success:
                              tip.type==='bad'?T.danger:T.warning}44`,
                            color:T.text,
                          }}>
                            <span style={{marginRight:6}}>
                              {tip.type==='good'?'✓':tip.type==='bad'?'✗':'→'}
                            </span>
                            {tip.text}
                          </div>
                        ))}
                      </div>
                    </>)}

                    <button onClick={()=>{setCtrScore(null);setCtrBreakdown(null);}}
                      style={{...css.addBtn,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`,marginTop:10}}>
                      Reset
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='rimlight'&&(
              <div>
                <span style={css.label}>Rim lighting</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.success,fontWeight:'600',lineHeight:1.6}}>
                  ☀ Click anywhere on your image to add light
                </div>

                {(!selectedLayer||selectedLayer.type!=='image')&&(
                  <div style={{...css.section,fontSize:11,color:T.muted,
                    textAlign:'center',padding:16,marginTop:8}}>
                    <div style={{fontSize:24,marginBottom:6}}>☀</div>
                    Select an image layer first
                  </div>
                )}

                <span style={css.label}>Light color</span>
                <div style={css.row}>
                  <input type="color" value={rimLightColor}
                    onChange={e=>{setRimLightColor(e.target.value);setRimPickingColor(false);}}
                    style={{...css.color,flex:1,height:36}}/>
                  <button
                    onClick={()=>setRimPickingColor(p=>!p)}
                    title="Pick color from canvas"
                    style={{
                      padding:'6px 10px',borderRadius:6,flexShrink:0,
                      border:`2px solid ${rimPickingColor?T.accent:T.border}`,
                      background:rimPickingColor?T.accent:'transparent',
                      color:rimPickingColor?'#fff':T.text,
                      cursor:'pointer',fontSize:14,fontWeight:'700',
                      transition:'all 0.15s',
                    }}>
                    🔍
                  </button>
                </div>

                {rimPickingColor&&(
                  <div style={{...css.section,marginTop:6,fontSize:11,
                    color:T.accent,fontWeight:'600',lineHeight:1.6,
                    border:`1px solid ${T.accent}`,textAlign:'center'}}>
                    🔍 Click anywhere on the canvas to pick that color
                  </div>
                )}

                {rimPickedFrom&&!rimPickingColor&&(
                  <div style={{...css.row,marginTop:6,gap:8}}>
                    <div style={{width:20,height:20,borderRadius:4,
                      background:rimPickedFrom.color,
                      border:`1px solid ${T.border}`,flexShrink:0}}/>
                    <span style={{fontSize:10,color:T.muted,fontFamily:'monospace'}}>
                      Picked: {rimPickedFrom.color}
                    </span>
                    <button onClick={()=>setRimPickedFrom(null)}
                      style={{marginLeft:'auto',background:'none',border:'none',
                        color:T.muted,cursor:'pointer',fontSize:12}}>×</button>
                  </div>
                )}

                <span style={css.label}>Presets</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                  {[
                    {label:'Blue',  color:'#0088ff', blend:'screen'},
                    {label:'Gold',  color:'#ffaa00', blend:'screen'},
                    {label:'Red',   color:'#ff2200', blend:'screen'},
                    {label:'Green', color:'#00ff88', blend:'screen'},
                    {label:'Pink',  color:'#ff00aa', blend:'screen'},
                    {label:'White', color:'#ffffff', blend:'soft-light'},
                    {label:'Neon',  color:'#00ffff', blend:'screen'},
                    {label:'Fire',  color:'#ff6600', blend:'overlay'},
                  ].map((preset,i)=>(
                    <button key={i} onClick={()=>{
                      setRimLightColor(preset.color);
                      setRimLightBlend(preset.blend);
                    }} style={{
                      padding:'8px 2px',borderRadius:6,
                      border:`2px solid ${rimLightColor===preset.color?'#fff':'transparent'}`,
                      background:preset.color,
                      fontSize:8,cursor:'pointer',
                      color: ['#ffffff','#ffaa00','#00ff88','#00ffff'].includes(preset.color)?'#000':'#fff',
                      fontWeight:'700',textAlign:'center',
                    }}>{preset.label}</button>
                  ))}
                </div>

                <span style={css.label}>Size — {rimLightSize}%</span>
                <Slider min={5} max={100} value={rimLightSize}
                  onChange={v=>setRimLightSize(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Intensity — {rimLightIntensity}%</span>
                <Slider min={5} max={100} value={rimLightIntensity}
                  onChange={v=>setRimLightIntensity(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Softness — {rimLightSoftness}%</span>
                <Slider min={10} max={100} value={rimLightSoftness}
                  onChange={v=>setRimLightSoftness(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Blend mode</span>
                <select value={rimLightBlend}
                  onChange={e=>setRimLightBlend(e.target.value)}
                  style={css.input}>
                  {['screen','overlay','soft-light','hard-light',
                    'color-dodge','lighten','add'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <div style={{...css.section,marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:'700',
                    color:T.text,marginBottom:6}}>💡 Tips</div>
                  <div style={{fontSize:11,color:T.muted,lineHeight:1.7}}>
                    • Click the edge of a subject for rim light<br/>
                    • Blue screen mode = Minecraft glow effect<br/>
                    • Gold overlay = warm sunset lighting<br/>
                    • White soft-light = natural fill light<br/>
                    • Stack multiple lights for drama<br/>
                    • Lower intensity + multiple clicks = build up gradually
                  </div>
                </div>

                <button onClick={()=>{
                  const rimLayer=layers.find(l=>l.isRimLight);
                  if(rimLayer){
                    setLayers(prev=>{
                      const nl=prev.filter(l=>!l.isRimLight);
                      pushHistory(nl);
                      return nl;
                    });
                    setSelectedId(null);
                    setCmdLog('Rim light cleared');
                  }
                }} style={{...css.addBtn,background:'transparent',
                  color:T.muted,border:`1px solid ${T.border}`,marginTop:8}}>
                  × Clear rim light
                </button>
              </div>
            )}

            {activeTool==='removebg'&&(
  <div>
    <span style={css.label}>Background remover</span>

    <div style={{...css.section,marginTop:0}}>
      <div style={{fontSize:13,color:T.text,fontWeight:'700',marginBottom:4}}>🎨 Background Remover</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:10,lineHeight:1.6}}>
        Remove backgrounds instantly. Select an image layer first.
      </div>
      {selectedLayer?.type==='image'?(
        <div>
          <button
            id="removebg-btn"
            onClick={removeBackgroundFromSelected}
            disabled={removeBgBusy}
            style={{width:'100%',padding:10,borderRadius:7,background:removeBgBusy?T.muted:T.accent,color:'#fff',border:'none',fontSize:12,cursor:removeBgBusy?'not-allowed':'pointer',fontWeight:'700',transition:'all 0.2s',opacity:removeBgBusy?0.7:1}}
          >
            {removeBgBusy?'Removing...':'Remove background'}
          </button>
          <div style={{fontSize:10,color:T.muted,marginTop:5,textAlign:'center'}}>
            Powered by remove.bg · 50 free/month
          </div>
        </div>
      ):(
        <div style={{...css.section,fontSize:11,color:T.muted,textAlign:'center',padding:16}}>
          <div style={{fontSize:20,marginBottom:6}}>✂️</div>
          Click an image on the canvas first
        </div>
      )}
    </div>

  </div>
)}

            {activeTool==='segment'&&(
  <div>
    <span style={css.label}>Smart Cutout</span>

    <div style={{...css.section,marginTop:0,border:`1px solid ${T.accentBorder}`,background:`linear-gradient(135deg,${T.bg2},rgba(249,115,22,0.04))`}}>
      <div style={{fontSize:13,fontWeight:'800',color:T.text,marginBottom:4,letterSpacing:'-0.2px'}}>◎ Smart Object Detection</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:12,lineHeight:1.65}}>
        AI scans your entire thumbnail and highlights every object. Click any highlighted region on the canvas to isolate it as a new layer.
      </div>

      {segmentError&&(
        <div style={{padding:'9px 11px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,fontSize:11,color:T.danger,marginBottom:10,lineHeight:1.55}}>
          ⚠ {segmentError}
          {segmentError.toLowerCase().includes('limit')&&(
            <div style={{marginTop:8}}>
              <button onClick={()=>{
                fetch(`${resolvedApiUrl}/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user?.email,plan:'pro'})})
                  .then(r=>r.json()).then(d=>{if(d.url)window.location.href=d.url;});
              }} style={{padding:'5px 14px',borderRadius:6,border:'none',background:T.accent,color:'#fff',fontSize:11,cursor:'pointer',fontWeight:'700'}}>
                Upgrade →
              </button>
            </div>
          )}
        </div>
      )}

      {!segmentBusy&&segmentMasks.length>0&&(
        <div style={{
          padding:'8px 11px',marginBottom:10,
          background:`${T.accent}12`,border:`1px solid ${T.accentBorder}`,
          borderRadius:8,fontSize:11,color:T.accent,fontWeight:'700',
          display:'flex',alignItems:'center',gap:7,
        }}>
          <span style={{width:7,height:7,borderRadius:'50%',background:T.accent,display:'inline-block',flexShrink:0}}/>
          {segmentMasks.length} object{segmentMasks.length!==1?'s':''} found — hover &amp; click on canvas
        </div>
      )}

      <button
        onClick={runSegmentation}
        disabled={segmentBusy}
        style={{
          width:'100%',padding:'11px 0',borderRadius:8,border:'none',
          background:segmentBusy?T.bg2:`linear-gradient(135deg,#f97316,#ea580c)`,
          color:segmentBusy?T.muted:'#fff',
          cursor:segmentBusy?'not-allowed':'pointer',
          fontSize:12,fontWeight:'800',letterSpacing:'0.3px',
          display:'flex',alignItems:'center',justifyContent:'center',gap:8,
          boxShadow:segmentBusy?'none':'0 4px 16px rgba(249,115,22,0.35)',
          transition:'all 0.2s',
        }}>
        {segmentBusy
          ?<><span style={{display:'inline-block',animation:'editor-spin 0.9s linear infinite',fontSize:14}}>◌</span>{segmentStatus||'Analyzing...'}</>
          :<>◎ {segmentMasks.length>0?'Re-scan Objects':'Scan for Objects'}</>
        }
      </button>

      {segmentMasks.length>0&&!segmentBusy&&(
        <button
          onClick={()=>{setSegmentMasks([]);setSegmentHoverIdx(null);}}
          style={{width:'100%',marginTop:6,padding:'7px 0',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11,fontWeight:'500'}}>
          × Clear overlays
        </button>
      )}

      <div style={{marginTop:10,fontSize:10,color:T.muted,lineHeight:1.5,textAlign:'center'}}>
        Powered by SAM 2 · Uses 1 AI action per scan
      </div>
    </div>

    {!segmentBusy&&segmentMasks.length===0&&!segmentError&&(
      <div style={{...css.section,marginTop:8}}>
        <div style={{fontSize:9,color:T.muted,fontWeight:'700',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.9px'}}>How it works</div>
        {[
          ['◎','Scan','AI finds every object in your thumbnail using SAM 2'],
          ['⊡','Select','Hover to preview, click any region on the canvas'],
          ['▤','Layer','The object becomes an isolated, editable layer'],
        ].map(([icon,title,desc])=>(
          <div key={title} style={{display:'flex',gap:9,marginBottom:9,alignItems:'flex-start'}}>
            <div style={{width:22,height:22,borderRadius:5,background:`${T.accent}12`,border:`1px solid ${T.accentBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0,color:T.accent,marginTop:1}}>{icon}</div>
            <div>
              <div style={{fontSize:11,fontWeight:'700',color:T.text,marginBottom:1}}>{title}</div>
              <div style={{fontSize:10,color:T.muted,lineHeight:1.45}}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

            {activeTool==='lasso'&&(
  <div>
    <span style={css.label}>Lasso Mask</span>

    {isLassoMode&&(
      <div style={{padding:'8px 12px',background:`${T.accent}18`,border:`1px solid ${T.accent}55`,borderRadius:8,fontSize:12,color:T.accent,fontWeight:'700',textAlign:'center',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:T.accent,display:'inline-block',animation:'pulse 1s infinite'}}/>
        Drawing — drag to trace, release to apply
      </div>
    )}

    {selectedLayer?.type==='image'?(
      <div>
        <div style={{...css.section,marginTop:0}}>
          <button
            onClick={()=>setIsLassoMode(v=>!v)}
            style={{width:'100%',padding:11,borderRadius:8,background:isLassoMode?T.accent:T.input,color:isLassoMode?'#fff':T.text,border:`1px solid ${isLassoMode?T.accent:T.border}`,fontSize:13,cursor:'pointer',fontWeight:'700',transition:'all 0.2s',marginBottom:8}}>
            {isLassoMode?'✕ Cancel':'✂️ Start Lasso'}
          </button>
          {!isLassoMode&&(
            <div style={{fontSize:10,color:T.muted,textAlign:'center',lineHeight:1.5}}>
              Draw around what you want to keep. Everything outside is cut out.
            </div>
          )}
        </div>

        <div style={css.section}>
          <div style={{...css.label,marginBottom:6}}>Feather — {lassoFeatherRef.current||0}px</div>
          <input type="range" min="0" max="40" defaultValue="0"
            onChange={e=>{ lassoFeatherRef.current=parseInt(e.target.value); e.target.previousSibling&&(e.target.previousSibling.textContent=`Feather — ${e.target.value}px`); }}
            style={{width:'100%',accentColor:T.accent}}/>
          <div style={{fontSize:10,color:T.muted,marginTop:4}}>Soft edges blend the cutout naturally</div>
        </div>

        <div style={css.section}>
          <div style={{...css.label,marginBottom:8}}>Options</div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:T.text,cursor:'pointer',marginBottom:10}}>
            <input type="checkbox" defaultChecked={false}
              onChange={e=>{ lassoInvertRef.current=e.target.checked; }}
              style={{accentColor:T.accent,width:14,height:14}}/>
            Invert selection (cut inside, keep outside)
          </label>
        </div>

        {selectedLayer?.mask?.enabled&&selectedLayer?.mask?.points?.length>=3&&(
          <div style={css.section}>
            <div style={{...css.label,marginBottom:8}}>Active mask</div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>{
                updateLayer(selectedLayer.id,{mask:{...selectedLayer.mask,inverted:!selectedLayer.mask?.inverted}});
              }} style={{flex:1,padding:'7px 0',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:11,cursor:'pointer',fontWeight:'600'}}>
                ↔ Invert
              </button>
              <button onClick={()=>{
                updateLayer(selectedLayer.id,{mask:{enabled:false,type:null,points:null,inverted:false}});
              }} style={{flex:1,padding:'7px 0',borderRadius:6,border:`1px solid ${T.danger}`,background:'transparent',color:T.danger,fontSize:11,cursor:'pointer',fontWeight:'600'}}>
                × Clear
              </button>
            </div>
          </div>
        )}
      </div>
    ):(
      <div style={{...css.section,fontSize:11,color:T.muted,textAlign:'center',padding:20}}>
        <div style={{fontSize:24,marginBottom:8}}>✂️</div>
        <div style={{fontWeight:600,marginBottom:4,color:T.text}}>Select an image first</div>
        Click any image layer on the canvas or in the layers panel
      </div>
    )}
  </div>
)}

            {activeTool==='freehand'&&(
  <div>
    <span style={css.label}>Freehand Draw</span>

    <div style={{padding:'8px 10px',background:`${T.accent}12`,border:`1px solid ${T.accent}44`,borderRadius:8,fontSize:11,color:T.accent,fontWeight:'700',textAlign:'center',marginBottom:10}}>
      ✏ Click &amp; drag on the canvas to draw
    </div>

    <div style={css.section}>
      <span style={css.label}>Brush color</span>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <input type="color" value={freeBrushColor} onChange={e=>setFreeBrushColor(e.target.value)}
          style={{...css.color,height:32,flex:1}}/>
        <div style={{width:32,height:32,borderRadius:6,border:`1px solid ${T.border}`,background:freeBrushColor,flexShrink:0}}/>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
        {['#ffffff','#000000','#FFD700','#f97316','#ef4444','#22c55e','#3b82f6','#a855f7','#ec4899','#00ffff'].map(c=>(
          <div key={c} onClick={()=>setFreeBrushColor(c)}
            style={{width:22,height:22,borderRadius:4,background:c,cursor:'pointer',border:freeBrushColor===c?'2px solid #f97316':'1px solid #374151'}}/>
        ))}
      </div>
    </div>

    <div style={css.section}>
      <span style={css.label}>Brush size — {freeBrushSize}px</span>
      <Slider min={1} max={80} value={freeBrushSize}
        onChange={v=>setFreeBrushSize(v)}
        style={{width:'100%',accentColor:T.accent}}/>
    </div>

    <div style={css.section}>
      <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>
        Each stroke is saved as a new image layer — visible in the Layers Panel. Undo with Ctrl+Z.
      </div>
    </div>
  </div>
)}

            {activeTool==='ai'&&(
  <div>
    <span style={css.label}>AI features</span>

    <div style={{...css.section,border:`1px solid ${T.warning}`,marginTop:10}}>
      <div style={{fontSize:13,color:T.warning,fontWeight:'700',marginBottom:4}}>⚡ AI Generate — Pro</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:8,lineHeight:1.6}}>
        Generate a thumbnail from a text prompt.
      </div>
      <input
        id="ai-prompt-input"
        value={aiPrompt}
        onChange={e=>setAiPrompt(e.target.value)}
        placeholder="Epic gaming moment, dramatic lighting..."
        style={{padding:'7px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',marginBottom:8}}
      />
      <button
        id="ai-generate-btn"
        onClick={async()=>{
          const isPro = isProUser;
          const isAdmin = user?.email === 'kadengajkowski@gmail.com';
          console.log(`Gating Check - isPro: ${isPro}, isAdmin: ${isAdmin}`);
          
          // SECURITY: Block non-Pro users from even attempting the fetch
          if (!isPro && !isAdmin) {
            console.log('[AI-GENERATE] Non-Pro user blocked - opening upgrade modal');
            setShowPaywall(true);
            return;
          }
          
          const btn=document.getElementById('ai-generate-btn');
          if(!aiPrompt.trim()){alert('Enter a prompt first');return;}
          btn.textContent='Generating...';btn.disabled=true;btn.style.opacity='0.6';
          try{
            const { data: { session } } = await supabase.auth.getSession();
            if(!session?.access_token){
              alert('Please log in again to use AI generation');
              btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
              return;
            }
            const res=await fetch('https://thumbframe-api-production.up.railway.app/ai-generate',{
              method:'POST',
              headers:{
                'Content-Type':'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body:JSON.stringify({
                prompt: aiPrompt,
                face_image_url: brandKit?.face_image_url || brandKitFace || null,
              }),
            });
            const data=await res.json();
            if(data.error){
              // Handle 403 from backend Pro check
              if(res.status === 403){
                alert('Upgrade to Pro to use AI generation');
                setShowPaywall(true);
              } else {
                alert('Error: '+data.error);
              }
              btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
              return;
            }
            const cW=p.preview.w,cH=p.preview.h;
            addLayer({
              type:'image',src:data.image,
              width:cW,height:cH,x:0,y:0,
              cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
              imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
            });
            setLastGeneratedImageUrl(data.image || '');
            btn.textContent='✓ Added!';btn.style.background=T.success;
            setTimeout(()=>{
              btn.textContent='Generate';btn.disabled=false;
              btn.style.opacity='1';btn.style.background=T.warning;
            },2000);
          }catch(e){
            alert('Failed — make sure API is running on port 5000');
            btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
          }
        }}
        style={{width:'100%',padding:9,borderRadius:7,background:T.warning,color:'#000',border:'none',fontSize:12,cursor:'pointer',fontWeight:'700'}}
      >
        Generate
      </button>
      <div style={{fontSize:10,color:T.muted,marginTop:5,textAlign:'center'}}>
        Pro only · $15/mo
      </div>
    </div>

  </div>
)}

          </div>

          {/* Layers panel */}
          <div style={{borderTop:`1px solid ${T.border}`,background:T.panel,flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px 5px'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:'10px',color:T.text,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase'}}>Layers</span>
                <span style={{fontSize:10,color:T.muted,background:T.input,padding:'1px 6px',borderRadius:10,border:`1px solid ${T.border}`}}>{layers.length}</span>
              </div>
              <div style={{display:'flex',gap:2}}>
                {[['↑',()=>selectedId&&moveLayerUp(selectedId),'Up'],['↓',()=>selectedId&&moveLayerDown(selectedId),'Down'],['⧉',()=>selectedId&&duplicateLayer(selectedId),'Dupe'],['×',()=>selectedId&&deleteLayer(selectedId),'Del']].map(([icon,action,title])=>(<button key={icon} onClick={action} title={title} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${icon==='×'?T.danger:T.border}`,background:'transparent',color:icon==='×'?T.danger:T.muted,fontSize:11,cursor:'pointer'}}>{icon}</button>))}
              </div>
            </div>
            <div style={{maxHeight:240,overflowY:'auto',padding:'0 6px 8px'}}>
              {[...layers].reverse().map(layer=>{
                const isDragOver=layerDragOver===layer.id;
                const isBeingDragged=layerDragId===layer.id;
                const color=getLayerColor(layer);
                const hasEffects=layer.effects&&(layer.effects.layerBlur>0||layer.effects.brightness!==100||layer.effects.contrast!==100||layer.effects.saturation!==100||layer.effects.shadow?.enabled||layer.effects.glow?.enabled||layer.effects.outline?.enabled);
                return(
                  <div key={layer.id}
                    draggable
                    onDragStart={e=>onLayerDragStart(e,layer.id)}
                    onDragOver={e=>onLayerDragOver(e,layer.id)}
                    onDrop={e=>onLayerDrop(e,layer.id)}
                    onDragEnd={onLayerDragEnd}
                    onClick={()=>{setSelectedId(layer.id);if(layer.type==='background')setActiveTool('background');}}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderRadius:7,marginBottom:2,cursor:'pointer',border:`1px solid ${selectedId===layer.id?T.accent:isDragOver?`${T.accent}66`:'transparent'}`,background:selectedId===layer.id?`${T.accent}12`:isDragOver?`${T.accent}06`:'transparent',opacity:isBeingDragged?0.4:1,transition:'all 0.1s'}}>
                    <div style={{color:T.muted,fontSize:10,cursor:'grab',flexShrink:0,opacity:0.4,userSelect:'none'}}>⠿</div>
                    <div style={{width:4,height:28,borderRadius:2,flexShrink:0,background:layer.type==='background'?(layer.bgGradient?`linear-gradient(180deg,${layer.bgGradient[0]},${layer.bgGradient[1]})`:color):color}}/>
                    <div style={{width:20,height:20,borderRadius:4,background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:'700',color:selectedId===layer.id?T.accent:T.muted,flexShrink:0,border:`1px solid ${T.border}`,fontFamily:'monospace'}}>{getLayerIcon(layer)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:layer.hidden?T.muted:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:layer.hidden?'line-through':'none',fontWeight:selectedId===layer.id?'600':'400'}}>{getLayerName(layer)}</div>
                      <div style={{display:'flex',gap:3,marginTop:1}}>
                        {layer.blendMode&&layer.blendMode!=='normal'&&<span style={{fontSize:7,color:T.accent,background:`${T.accent}15`,padding:'0 3px',borderRadius:2}}>{layer.blendMode.slice(0,5)}</span>}
                        {hasEffects&&<span style={{fontSize:7,color:'#f59e0b',background:'#f59e0b15',padding:'0 3px',borderRadius:2}}>fx</span>}
                        {layer.mask?.enabled&&<span style={{fontSize:7,color:'#60a5fa',background:'#60a5fa15',padding:'0 3px',borderRadius:2}}>mask</span>}
                        {layer.locked&&<span style={{fontSize:7,color:T.muted}}>🔒</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:1,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();updateLayer(layer.id,{hidden:!layer.hidden});}} style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',color:layer.hidden?T.danger:T.muted,fontSize:10,cursor:'pointer'}}>{layer.hidden?'○':'●'}</button>
                      {layer.type!=='background'&&(<button onClick={e=>{e.stopPropagation();updateLayer(layer.id,{locked:!layer.locked});}} style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>{layer.locked?'⊠':'⊡'}</button>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Sprint 3: Dedicated Layers Panel ──────────────────────────── */}
        {!isMobile&&(
          <div style={{
            width:210,
            background:T.panel,
            borderLeft:`1px solid ${T.border}`,
            display:'flex',flexDirection:'column',
            flexShrink:0,
            userSelect:'none',
          }}>
            {/* Header */}
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'9px 10px 7px',
              borderBottom:`1px solid ${T.border}`,
              flexShrink:0,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <span style={{fontSize:11,color:T.text,fontWeight:'700',letterSpacing:'0.6px',textTransform:'uppercase'}}>Layers</span>
                <span style={{fontSize:10,color:T.muted,background:T.bg2,padding:'1px 6px',borderRadius:10,border:`1px solid ${T.border}`}}>{layers.length}</span>
              </div>
              <div style={{display:'flex',gap:2}}>
                <button title="Delete selected layer" onClick={()=>selectedId&&deleteLayer(selectedId)}
                  style={{padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`,background:'transparent',color:selectedId?T.danger:T.border,fontSize:11,cursor:'pointer'}}>✕</button>
              </div>
            </div>

            {/* Layer list */}
            <div style={{flex:1,overflowY:'auto',padding:'4px 6px 8px'}}>
              {[...layers].reverse().map((layer,idx)=>{
                const realIdx=layers.length-1-idx;
                const isSelected=selectedId===layer.id;
                const isDragOver2=layerDragOver===layer.id;
                const isBeingDragged2=layerDragId===layer.id;
                const isHidden=layer.hidden;
                const isLocked=layer.locked;
                const atTop=realIdx===layers.length-1;
                const atBottom=layer.type==='background'||realIdx===0;
                const hasEffects=layer.effects&&(layer.effects.layerBlur>0||layer.effects.shadow?.enabled||layer.effects.glow?.enabled||layer.effects.outline?.enabled);
                return(
                  <div key={layer.id}
                    draggable
                    onDragStart={e=>onLayerDragStart(e,layer.id)}
                    onDragOver={e=>onLayerDragOver(e,layer.id)}
                    onDrop={e=>onLayerDrop(e,layer.id)}
                    onDragEnd={onLayerDragEnd}
                    onClick={()=>{setSelectedId(layer.id);if(layer.type==='background')setActiveTool('background');}}
                    style={{
                      display:'flex',alignItems:'center',gap:4,
                      padding:'5px 5px',borderRadius:6,marginBottom:1,
                      cursor:'pointer',
                      background:isSelected?T.accentDim:isDragOver2?'rgba(249,115,22,0.06)':'transparent',
                      border:`1px solid ${isSelected?T.accent:isDragOver2?T.accentBorder:'transparent'}`,
                      opacity:isBeingDragged2?0.3:1,
                      transition:'all 0.08s',
                    }}>
                    {/* Drag grip */}
                    <div style={{color:T.border,fontSize:9,cursor:'grab',flexShrink:0,opacity:0.7}}>⠿</div>
                    {/* Type icon */}
                    <div style={{
                      width:17,height:17,borderRadius:3,flexShrink:0,
                      background:isSelected?T.accentDim:T.bg2,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:8,fontWeight:'700',fontFamily:'monospace',
                      color:isSelected?T.accent:T.muted,
                      border:`1px solid ${T.border}`,
                    }}>{getLayerIcon(layer)}</div>
                    {/* Name + badges */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{
                        fontSize:11,
                        color:isHidden?T.border:(isSelected?T.text:T.muted),
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                        fontWeight:isSelected?'600':'400',
                        textDecoration:isHidden?'line-through':'none',
                      }}>{getLayerName(layer)}</div>
                      {(hasEffects||layer.mask?.enabled)&&(
                        <div style={{display:'flex',gap:2,marginTop:1}}>
                          {layer.mask?.enabled&&<span style={{fontSize:7,color:'#60a5fa',background:'rgba(96,165,250,0.1)',padding:'0 3px',borderRadius:2}}>mask</span>}
                          {hasEffects&&<span style={{fontSize:7,color:T.warning,background:'rgba(245,158,11,0.1)',padding:'0 3px',borderRadius:2}}>fx</span>}
                        </div>
                      )}
                    </div>
                    {/* Controls */}
                    <div style={{display:'flex',gap:0,flexShrink:0}}>
                      {/* Eye — visibility */}
                      <button title={isHidden?'Show':'Hide'} onClick={e=>{e.stopPropagation();updateLayer(layer.id,{hidden:!isHidden});}}
                        style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',color:isHidden?T.border:T.muted,fontSize:12,lineHeight:1}}>
                        {isHidden?'⊘':'⊙'}
                      </button>
                      {/* Lock */}
                      {layer.type!=='background'&&(
                        <button title={isLocked?'Unlock':'Lock'} onClick={e=>{e.stopPropagation();updateLayer(layer.id,{locked:!isLocked});}}
                          style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',color:isLocked?T.warning:T.border,fontSize:11,lineHeight:1}}>
                          {isLocked?'⊠':'⊡'}
                        </button>
                      )}
                      {/* Bring forward */}
                      <button title="Bring forward" onClick={e=>{e.stopPropagation();moveLayerUp(layer.id);}} disabled={atTop}
                        style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:atTop?'default':'pointer',color:atTop?T.border:T.muted,fontSize:10,lineHeight:1}}>▲</button>
                      {/* Send backward */}
                      <button title="Send backward" onClick={e=>{e.stopPropagation();moveLayerDown(layer.id);}} disabled={atBottom}
                        style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:atBottom?'default':'pointer',color:atBottom?T.border:T.muted,fontSize:10,lineHeight:1}}>▼</button>
                      {/* Delete */}
                      {layer.type!=='background'&&(
                        <button title="Delete layer" onClick={e=>{e.stopPropagation();deleteLayer(layer.id);}}
                          style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',color:T.border,fontSize:11,lineHeight:1}}
                          onMouseEnter={e=>e.currentTarget.style.color=T.danger}
                          onMouseLeave={e=>e.currentTarget.style.color=T.border}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Object Specs */}
            {selectedLayer&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:'8px 10px',flexShrink:0}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>
                  Selected — {getLayerName(selectedLayer)}
                </div>
                {/* Neon Glow quick-toggle */}
                {(()=>{
                  const isText=selectedLayer.type==='text';
                  const glowOn=isText
                    ?(selectedLayer.glowEnabled&&selectedLayer.glowColor==='#00ffff')
                    :(selectedLayer.effects?.glow?.enabled&&selectedLayer.effects?.glow?.color==='#00ffff');
                  return(
                    <button
                      title="Toggle cyan neon glow on selected layer"
                      onClick={()=>{
                        if(isText){
                          updateLayer(selectedLayer.id,{glowEnabled:!glowOn,glowColor:'#00ffff'});
                        } else {
                          updateLayerEffect(selectedLayer.id,'glow',{
                            enabled:!glowOn,color:'#00ffff',blur:30,
                          });
                        }
                      }}
                      style={{
                        width:'100%',padding:'6px 8px',borderRadius:6,
                        border:`1px solid ${glowOn?'#00ffff':T.border}`,
                        background:glowOn?'rgba(0,255,255,0.08)':'transparent',
                        color:glowOn?'#00ffff':'#6b7280',
                        fontSize:11,cursor:'pointer',fontWeight:'600',
                        display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                        marginBottom:4,transition:'all 0.15s',
                      }}>
                      ⚡ Neon Glow {glowOn?'— ON':''}
                    </button>
                  );
                })()}
                {/* Quick actions row */}
                <div style={{display:'flex',gap:4,marginTop:2}}>
                  {selectedLayer.type!=='background'&&(
                    <button onClick={()=>duplicateLayer(selectedLayer.id)}
                      title="Duplicate layer"
                      style={{flex:1,padding:'4px 0',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>
                      ⧉ Dupe
                    </button>
                  )}
                  {selectedLayer.type!=='background'&&(
                    <button onClick={()=>deleteLayer(selectedLayer.id)}
                      title="Delete layer"
                      style={{flex:1,padding:'4px 0',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.danger,fontSize:10,cursor:'pointer'}}>
                      ✕ Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{
              padding:'5px 10px',borderTop:`1px solid ${T.border}`,
              fontSize:9,color:T.border,textAlign:'center',flexShrink:0,
            }}>Drag rows to reorder</div>
          </div>
        )}

      </div>

      {/* Mobile bottom toolbar */}
      {isMobile&&(
        <div style={{
          display:'flex',gap:2,padding:'6px 8px',
          background:T.panel,borderTop:`1px solid ${T.border}`,
          overflowX:'auto',flexShrink:0,
          WebkitOverflowScrolling:'touch',
        }}>
          {[
            {key:'select',icon:'↖',label:'Select'},
            {key:'move',icon:'✋',label:'Move'},
            {key:'text',icon:'T',label:'Text'},
            {key:'brush',icon:'⌀',label:'Brush'},
            {key:'upload',icon:'↑',label:'Upload'},
            {key:'background',icon:'▨',label:'BG'},
            {key:'effects',icon:'✦',label:'FX'},
            {key:'zoom',icon:'🔍',label:'Zoom'},
          ].map(t=>(
            <button key={t.key} onClick={()=>setActiveTool(t.key)}
              style={{
                padding:'8px 12px',borderRadius:6,border:'none',
                background:activeTool===t.key?`${T.accent}22`:'transparent',
                color:activeTool===t.key?T.accent:T.muted,
                fontSize:9,cursor:'pointer',fontWeight:activeTool===t.key?'700':'400',
                display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                flexShrink:0,minWidth:44,
              }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {showBrandKitSetup && (
        <BrandKitSetupModal
          T={T}
          token={token}
          apiUrl={resolvedApiUrl}
          user={user}
          brandKit={brandKit}
          setBrandKit={setBrandKit}
          brandKitColors={brandKitColors}
          setBrandKitColors={setBrandKitColors}
          brandKitFace={brandKitFace}
          setBrandKitFace={setBrandKitFace}
          setShowBrandKitSetup={setShowBrandKitSetup}
          setCmdLog={setCmdLog}
        />
      )}

      {/* Upgrade to Pro Modal */}
      {showPaywall && (
        <div style={{position:'fixed',inset:0,zIndex:1001,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowPaywall(false);}}>
          <div style={{width:440,background:T.panel,borderRadius:16,border:`2px solid ${T.warning}`,padding:'32px',boxShadow:'0 32px 120px rgba(0,0,0,0.9)',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:16}}>⚡</div>
            <div style={{fontSize:24,fontWeight:'800',marginBottom:8,color:T.text}}>Upgrade to Pro</div>
            <div style={{fontSize:14,color:T.muted,lineHeight:1.7,marginBottom:24}}>
              AI thumbnail generation is a Pro feature. Unlock unlimited AI-powered thumbnails, HD exports, and priority support for just $15/month.
            </div>
            
            <div style={{background:T.bg2,borderRadius:10,padding:'16px',marginBottom:24,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:12,fontWeight:'700',color:T.accent,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.5px'}}>Pro Features</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,textAlign:'left'}}>
                {[
                  '⚡ Unlimited AI thumbnail generation',
                  '📸 HD 4K export (1280×720)',
                  '🎨 Brand Kit with face integration',
                  '⚙️ Priority support',
                  '🚀 Early access to new features'
                ].map((feature,i)=>(
                  <div key={i} style={{fontSize:13,color:T.text2,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:T.success,fontSize:11,fontWeight:'700'}}>✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={()=>{
                const isPro = isProUser;
                const isAdmin = user?.is_admin || user?.email === 'kadengajkowski@gmail.com';
                if (isPro || isAdmin) {
                  setShowPaywall(false);
                  setShowAlreadyPro(true);
                  return;
                }
                fetch('https://thumbframe-api-production.up.railway.app/checkout',{
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({email: user?.email, plan:'pro'}),
                }).then(r=>r.json()).then(d=>{if(d.url)window.location.href=d.url;});
              }}
              style={{
                width:'100%',padding:'14px 24px',borderRadius:10,border:'none',
                background:'linear-gradient(135deg, #f59e0b, #ef4444)',
                color:'#fff',cursor:'pointer',fontSize:15,fontWeight:'700',
                boxShadow:'0 4px 20px rgba(245,158,11,0.4)',
                marginBottom:12,transition:'transform 0.2s'
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
              Upgrade to Pro — $15/mo
            </button>
            
            <button onClick={()=>setShowPaywall(false)} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:13,cursor:'pointer'}}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Already Upgraded Notification */}
      {showAlreadyPro && (
        <div style={{position:'fixed',inset:0,zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowAlreadyPro(false);}}>
          <div style={{width:380,background:T.panel,borderRadius:16,border:`2px solid ${T.success}`,padding:'32px',boxShadow:'0 24px 80px rgba(0,0,0,0.8)',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:16}}>✓</div>
            <div style={{fontSize:22,fontWeight:'800',marginBottom:8,color:T.text}}>You've already upgraded to Pro!</div>
            <div style={{fontSize:14,color:T.muted,lineHeight:1.7,marginBottom:24}}>
              Enjoy your premium features including unlimited AI generation, HD exports, and priority support.
            </div>
            <button onClick={()=>setShowAlreadyPro(false)} style={{width:'100%',padding:'12px 24px',borderRadius:10,border:'none',background:T.success,color:'#fff',cursor:'pointer',fontSize:14,fontWeight:'700',boxShadow:'0 4px 16px rgba(34,197,94,0.3)'}}>
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:1003,minWidth:300,maxWidth:400,background:T.panel,borderRadius:12,border:`2px solid ${toastType==='success'?T.success:toastType==='error'?T.danger:T.accent}`,padding:'16px 20px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)',display:'flex',alignItems:'center',gap:12,animation:'slideIn 0.3s ease-out'}}>
          <div style={{fontSize:24}}>
            {toastType === 'success' && '✓'}
            {toastType === 'error' && '⚠'}
            {toastType === 'info' && 'ℹ'}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:T.text,fontWeight:'600',lineHeight:1.4}}>{toastMessage}</div>
          </div>
          <button onClick={()=>setShowToast(false)} style={{padding:'4px 8px',borderRadius:6,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:16,fontWeight:'700'}}>×</button>
        </div>
      )}
    </div>
  );
}
