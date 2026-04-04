/**
 * CommandPalette.js — VS Code-style Ctrl+K command palette.
 *
 * Props:
 *   open        : bool
 *   onClose     : () => void
 *   onExecute   : (commandId: string) => void
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Command registry ─────────────────────────────────────────────────────────

const COMMANDS = [
  // Tools
  { id:'tool-select',    label:'Select',                   category:'Tool',       icon:'↖',  shortcut:'V',       kw:'move pointer arrow' },
  { id:'tool-move',      label:'Move / Hand',              category:'Tool',       icon:'✋',  shortcut:'H',       kw:'hand pan drag' },
  { id:'tool-text',      label:'Text',                     category:'Tool',       icon:'T',   shortcut:'T',       kw:'type font label caption title' },
  { id:'tool-brush',     label:'Brush',                    category:'Tool',       icon:'⌀',  shortcut:'B',       kw:'paint draw stroke' },
  { id:'tool-freehand',  label:'Eraser / Draw',            category:'Tool',       icon:'✏',  shortcut:'E',       kw:'eraser pencil freehand erase' },
  { id:'tool-crop',      label:'Crop',                     category:'Tool',       icon:'⊡',  shortcut:'C',       kw:'trim resize' },
  { id:'tool-zoom',      label:'Zoom',                     category:'Tool',       icon:'🔍', shortcut:'Z',       kw:'magnify in out' },
  { id:'tool-lasso',     label:'Lasso Mask',               category:'Tool',       icon:'✂️', shortcut:'L',       kw:'lasso mask selection freeform' },
  { id:'tool-segment',   label:'Magic Wand / Smart Cutout',category:'Tool',       icon:'◎',  shortcut:'W',       kw:'magic wand segment cutout smart select' },
  { id:'tool-removebg',  label:'Clone Stamp / Remove BG',  category:'Tool',       icon:'✂',  shortcut:'E',       kw:'clone stamp remove background erase' },
  { id:'tool-effects',   label:'Dodge / Burn',             category:'Tool',       icon:'✦',  shortcut:'O',       kw:'dodge burn lighten darken effects' },
  { id:'tool-eyedropper',label:'Eyedropper',               category:'Tool',       icon:'I',   shortcut:'I',       kw:'pick color sample dropper' },
  // Filters
  { id:'filter-blur',    label:'Gaussian Blur',            category:'Filter',     icon:'◌',  kw:'blur soften smooth' },
  { id:'filter-motion',  label:'Motion Blur',              category:'Filter',     icon:'◌',  kw:'motion blur speed' },
  { id:'filter-sharpen', label:'Sharpen',                  category:'Filter',     icon:'◈',  kw:'sharpen crisp detail' },
  { id:'filter-unsharp', label:'Unsharp Mask',             category:'Filter',     icon:'◈',  kw:'unsharp mask clarity' },
  { id:'filter-vignette',label:'Vignette',                 category:'Filter',     icon:'◉',  kw:'vignette dark edges border' },
  { id:'filter-grain',   label:'Film Grain',               category:'Filter',     icon:'◌',  kw:'grain noise film texture' },
  { id:'filter-chroma',  label:'Chromatic Aberration',     category:'Filter',     icon:'◑',  kw:'chromatic aberration fringe rgb split' },
  // Adjustments
  { id:'adj-curves',     label:'Curves',                   category:'Adjustment', icon:'◑',  kw:'curves tone lut rgb adjustment' },
  { id:'adj-brightness', label:'Brightness / Contrast',    category:'Adjustment', icon:'◕',  kw:'brightness contrast exposure' },
  { id:'adj-hue',        label:'Hue / Saturation',         category:'Adjustment', icon:'◕',  kw:'hue saturation color vibrance' },
  { id:'adj-colorbal',   label:'Color Balance',            category:'Adjustment', icon:'◕',  kw:'color balance grade shadows highlights' },
  { id:'adj-levels',     label:'Levels',                   category:'Adjustment', icon:'◕',  kw:'levels histogram tone black white point' },
  { id:'adj-vibrance',   label:'Vibrance',                 category:'Adjustment', icon:'◕',  kw:'vibrance saturation vivid pop' },
  // AI Features
  { id:'ai-pop',         label:'Make It Pop',              category:'AI Feature', icon:'✦',  kw:'make it pop enhance ai boost' },
  { id:'ai-bggen',       label:'Generate Background',      category:'AI Feature', icon:'⬡',  shortcut:'G',       kw:'ai background generate fill' },
  { id:'ai-style',       label:'Style Transfer',           category:'AI Feature', icon:'◑',  kw:'style transfer ai art filter' },
  { id:'ai-ctr',         label:'CTR Score',                category:'AI Feature', icon:'◈',  kw:'ctr click rate score analyze' },
  { id:'ai-aitext',      label:'Generate Text',            category:'AI Feature', icon:'✦',  kw:'ai text generate copy headline' },
  { id:'ai-face',        label:'Face Score',               category:'AI Feature', icon:'◉',  kw:'face score expression detect' },
  { id:'ai-segment',     label:'Segment Subject',          category:'AI Feature', icon:'◎',  shortcut:'W',       kw:'segment cutout subject remove background' },
  { id:'ai-variants',    label:'Generate Variants',        category:'AI Feature', icon:'⊟',  kw:'variants ab test generate alternate' },
  // Layer actions
  { id:'layer-new',      label:'New Text Layer',           category:'Layer',      icon:'T',   kw:'new add text layer create' },
  { id:'layer-duplicate',label:'Duplicate Layer',          category:'Layer',      icon:'⊟',  shortcut:'Ctrl+J',  kw:'copy clone duplicate' },
  { id:'layer-delete',   label:'Delete Layer',             category:'Layer',      icon:'×',   shortcut:'Delete',  kw:'remove trash delete' },
  { id:'layer-group',    label:'Group Layers',             category:'Layer',      icon:'⊕',  shortcut:'Ctrl+G',  kw:'group folder organize' },
  { id:'layer-merge',    label:'Merge Layers',             category:'Layer',      icon:'⊕',  kw:'merge flatten combine' },
  { id:'layer-flatten',  label:'Flatten Image',            category:'Layer',      icon:'▣',  kw:'flatten merge all bake' },
  // File actions
  { id:'file-export-png',label:'Export PNG',               category:'File',       icon:'↑',  shortcut:'Ctrl+E',  kw:'export save png download' },
  { id:'file-export-jpg',label:'Export JPEG',              category:'File',       icon:'↑',  kw:'export jpeg jpg save download' },
  { id:'file-save',      label:'Save Project',             category:'File',       icon:'↓',  shortcut:'Ctrl+S',  kw:'save store project' },
  { id:'file-new',       label:'New Project',              category:'File',       icon:'□',  kw:'new fresh reset blank' },
  // Canvas actions
  { id:'canvas-fit',     label:'Fit to Screen',            category:'Canvas',     icon:'⊡',  shortcut:'Ctrl+0',  kw:'fit zoom reset view' },
  { id:'canvas-100',     label:'Zoom to 100%',             category:'Canvas',     icon:'🔍', kw:'zoom 100 actual size pixels' },
  { id:'canvas-fliph',   label:'Flip Horizontal',          category:'Canvas',     icon:'↔',  kw:'flip mirror horizontal' },
  { id:'canvas-flipv',   label:'Flip Vertical',            category:'Canvas',     icon:'↕',  kw:'flip vertical upside' },
  { id:'canvas-shortcuts',label:'Show Keyboard Shortcuts', category:'View',       icon:'?',   shortcut:'?',       kw:'shortcuts keyboard help reference' },
];

// ── Fuzzy search ─────────────────────────────────────────────────────────────

function scoreCommand(cmd, query) {
  if (!query) return 1;
  const q = query.toLowerCase().trim();
  if (!q) return 1;

  const haystack = `${cmd.label} ${cmd.category} ${cmd.kw || ''}`.toLowerCase();

  // All tokens must match somewhere
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (!haystack.includes(tok)) return 0;
  }

  // Score: label prefix match scores highest
  const labelLow = cmd.label.toLowerCase();
  if (labelLow.startsWith(q)) return 3;
  if (labelLow.includes(q))   return 2;
  return 1;
}

function search(query) {
  return COMMANDS
    .map(cmd => ({ cmd, score: scoreCommand(cmd, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd);
}

// ── Category accent colors ───────────────────────────────────────────────────

const CAT_COLOR = {
  'Tool':       '#60a5fa',
  'Filter':     '#a78bfa',
  'Adjustment': '#34d399',
  'AI Feature': '#f97316',
  'Layer':      '#fbbf24',
  'File':       '#94a3b8',
  'Canvas':     '#22d3ee',
  'View':       '#94a3b8',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose, onExecute }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState(() => COMMANDS.slice(0, 8));
  const [activeIdx,setActiveIdx]= useState(0);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const itemRefs  = useRef([]);

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(COMMANDS.slice(0, 8));
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Live search
  const handleInput = useCallback(e => {
    const q = e.target.value;
    setQuery(q);
    const res = search(q);
    setResults(res.slice(0, 32)); // keep up to 32, show 8 via scroll
    setActiveIdx(0);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const execute = useCallback(id => {
    onExecute(id);
    onClose();
  }, [onExecute, onClose]);

  // Keyboard nav
  const handleKeyDown = useCallback(e => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) execute(results[activeIdx].id);
    }
  }, [results, activeIdx, execute, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:9000,
        background:'rgba(0,0,0,0.55)',
        backdropFilter:'blur(6px)',
        display:'flex', alignItems:'flex-start', justifyContent:'center',
        paddingTop:'12vh',
        animation:'cp-fade-in 0.12s ease',
      }}
    >
      <style>{`
        @keyframes cp-fade-in  { from { opacity:0; transform:scale(0.97) } to { opacity:1; transform:scale(1) } }
        .cp-item:hover { background: rgba(249,115,22,0.12) !important; }
      `}</style>

      <div style={{
        width:580, maxWidth:'90vw',
        background:'#111',
        borderRadius:12,
        border:'1px solid rgba(255,255,255,0.1)',
        boxShadow:'0 32px 80px rgba(0,0,0,0.9)',
        overflow:'hidden',
        animation:'cp-fade-in 0.12s ease',
        display:'flex', flexDirection:'column',
      }}>
        {/* Search input */}
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'14px 18px',
          borderBottom:'1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{fontSize:16, color:'rgba(255,255,255,0.35)', flexShrink:0}}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, tool, or action…"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              color:'#fff', fontSize:15, fontFamily:'inherit',
              caretColor:'#f97316',
            }}
          />
          <span style={{
            fontSize:10, color:'rgba(255,255,255,0.25)',
            border:'1px solid rgba(255,255,255,0.15)',
            borderRadius:4, padding:'2px 6px', flexShrink:0,
          }}>Esc</span>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            overflowY:'auto',
            maxHeight: 8 * 56,
          }}
        >
          {results.length === 0 ? (
            <div style={{
              padding:'32px 20px', textAlign:'center',
              color:'rgba(255,255,255,0.3)', fontSize:13,
            }}>
              <div style={{fontSize:24, marginBottom:8}}>◌</div>
              No commands found
            </div>
          ) : results.map((cmd, i) => {
            const isActive = i === activeIdx;
            const catColor = CAT_COLOR[cmd.category] || '#94a3b8';
            return (
              <div
                key={cmd.id}
                ref={el => { itemRefs.current[i] = el; }}
                className="cp-item"
                onClick={() => execute(cmd.id)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 18px',
                  cursor:'pointer',
                  background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                  borderLeft: isActive ? '2px solid #f97316' : '2px solid transparent',
                  transition:'background 0.08s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width:32, height:32, borderRadius:7, flexShrink:0,
                  background: isActive ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, color: isActive ? '#f97316' : 'rgba(255,255,255,0.6)',
                  fontWeight:'700',
                }}>{cmd.icon}</div>

                {/* Label + category */}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    fontSize:13, fontWeight:'600',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.88)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}>{cmd.label}</div>
                  <div style={{
                    fontSize:10, fontWeight:'500', marginTop:1,
                    color: catColor,
                    opacity: isActive ? 1 : 0.7,
                  }}>{cmd.category}</div>
                </div>

                {/* Shortcut */}
                {cmd.shortcut && (
                  <div style={{
                    display:'flex', gap:3, flexShrink:0,
                  }}>
                    {cmd.shortcut.split('+').map((k, ki) => (
                      <span key={ki} style={{
                        fontSize:9, padding:'2px 5px', borderRadius:3,
                        border:`1px solid ${isActive ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.15)'}`,
                        color: isActive ? '#f97316' : 'rgba(255,255,255,0.4)',
                        fontFamily:'monospace', fontWeight:'600', letterSpacing:'0.5px',
                      }}>{k}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding:'8px 18px',
          borderTop:'1px solid rgba(255,255,255,0.07)',
          display:'flex', gap:16, alignItems:'center',
          color:'rgba(255,255,255,0.25)', fontSize:10,
        }}>
          <span>↑↓ navigate</span>
          <span>↵ execute</span>
          <span>Esc close</span>
          <span style={{marginLeft:'auto'}}>{results.length} result{results.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
