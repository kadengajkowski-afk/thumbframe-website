// src/editor/components/FeedSimulator.jsx
// Feature 4 — YouTube Feed Simulator
// Full-screen modal showing the thumbnail in a realistic YouTube feed context.
// 4 view modes: Home Feed, Search Results, Sidebar, Shorts Shelf.
// Dark / Light toggle. Updates every second.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../engine/Store';

const FAKE_VIDEOS = [
  { title: 'How I Made $10K in One Month',       ch: 'FinanceHub',   views: '2.3M',  age: '3 days ago',   dur: '14:22' },
  { title: 'The Ultimate Productivity System',    ch: 'Productify',   views: '891K',  age: '1 week ago',   dur: '18:05' },
  { title: '10 Things You Didn\'t Know About AI', ch: 'TechInsider',  views: '4.1M',  age: '2 days ago',   dur: '11:47' },
  { title: 'I Tried Every Viral Food Trend',      ch: 'FoodVlogger',  views: '1.8M',  age: '5 days ago',   dur: '22:33' },
  { title: 'Building a PC in 2025 — Full Guide',  ch: 'PCMasterRace', views: '3.2M',  age: '1 day ago',    dur: '28:14' },
  { title: 'Minecraft 1.21 — Everything New',     ch: 'CraftKing',    views: '6.7M',  age: '12 hours ago', dur: '9:58'  },
  { title: 'My Honest Smartphone Review',         ch: 'GadgetZone',   views: '720K',  age: '4 days ago',   dur: '15:01' },
  { title: 'How to Learn Any Skill Fast',         ch: 'LevelUp',      views: '2.1M',  age: '6 days ago',   dur: '12:48' },
];

const CH_COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#ef4444','#eab308','#06b6d4','#ec4899'];

function FakeThumbnail({ idx, dark }) {
  const hue = (idx * 47) % 360;
  return (
    <div style={{
      width: '100%', paddingTop: '56.25%', position: 'relative', borderRadius: 6,
      overflow: 'hidden', background: `hsl(${hue},40%,${dark ? 25 : 60}%)`, flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        background: 'rgba(0,0,0,0.85)', borderRadius: 2,
        fontSize: 10, fontWeight: 700, color: '#fff', padding: '1px 4px',
      }}>{FAKE_VIDEOS[idx % FAKE_VIDEOS.length].dur}</div>
    </div>
  );
}

function YourThumbnail({ src, dark }) {
  return (
    <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '2px solid #f97316' }}>
      {src
        ? <img src={src} alt="Your thumbnail" style={{ display: 'block', width: '100%' }} />
        : <div style={{ paddingTop: '56.25%', background: dark ? '#222' : '#ddd' }} />
      }
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        background: 'rgba(0,0,0,0.85)', borderRadius: 2,
        fontSize: 10, fontWeight: 700, color: '#fff', padding: '1px 4px',
      }}>12:34</div>
      <div style={{
        position: 'absolute', top: 4, left: 4,
        background: '#f97316', borderRadius: 3,
        fontSize: 9, fontWeight: 800, color: '#fff', padding: '2px 5px',
        letterSpacing: '0.05em',
      }}>YOUR THUMBNAIL</div>
    </div>
  );
}

function VideoMeta({ idx, dark }) {
  const v   = FAKE_VIDEOS[idx % FAKE_VIDEOS.length];
  const col = CH_COLORS[idx % CH_COLORS.length];
  const tc  = dark ? '#fff' : '#0f0f0f';
  const mc  = dark ? '#aaa' : '#606060';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        background: col, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, color: '#fff',
      }}>{v.ch[0]}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: tc, lineHeight: 1.3, marginBottom: 2 }}>{v.title}</div>
        <div style={{ fontSize: 11, color: mc }}>{v.ch} · {v.views} views · {v.age}</div>
      </div>
    </div>
  );
}

function YourMeta({ dark }) {
  const _tc = dark ? '#fff' : '#0f0f0f'; // eslint-disable-line no-unused-vars
  const mc = dark ? '#aaa' : '#606060';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, color: '#fff',
      }}>T</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f97316', lineHeight: 1.3, marginBottom: 2 }}>
          ← Your thumbnail title here
        </div>
        <div style={{ fontSize: 11, color: mc }}>Your Channel · —</div>
      </div>
    </div>
  );
}

// ── Home Feed (3-column grid) ─────────────────────────────────────────────────
function HomeFeedView({ src, dark }) {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px 12px',
      padding: '0 16px',
    }}>
      {items.map(i => (
        <div key={i}>
          {i === 1 ? <YourThumbnail src={src} dark={dark} /> : <FakeThumbnail idx={i} dark={dark} />}
          <div style={{ marginTop: 8 }}>
            {i === 1 ? <YourMeta dark={dark} /> : <VideoMeta idx={i} dark={dark} />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Search Results (list) ─────────────────────────────────────────────────────
function SearchView({ src, dark }) {
  const items = [0, 1, 2, 3, 4, 5];
  const tc    = dark ? '#fff' : '#0f0f0f';
  const mc    = dark ? '#aaa' : '#606060';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
      {items.map(i => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 220, flexShrink: 0 }}>
            {i === 1 ? <YourThumbnail src={src} dark={dark} /> : <FakeThumbnail idx={i} dark={dark} />}
          </div>
          <div style={{ flex: 1 }}>
            {i === 1 ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f97316', marginBottom: 4 }}>← Your thumbnail title here</div>
                <div style={{ fontSize: 11, color: mc }}>Your Channel · —</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: tc, marginBottom: 4 }}>{FAKE_VIDEOS[i % FAKE_VIDEOS.length].title}</div>
                <div style={{ fontSize: 11, color: mc }}>{FAKE_VIDEOS[i % FAKE_VIDEOS.length].ch} · {FAKE_VIDEOS[i % FAKE_VIDEOS.length].views} · {FAKE_VIDEOS[i % FAKE_VIDEOS.length].age}</div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar (right column) ────────────────────────────────────────────────────
function SidebarView({ src, dark }) {
  const items = [0, 1, 2, 3, 4, 5, 6];
  const tc    = dark ? '#fff' : '#0f0f0f';
  const mc    = dark ? '#aaa' : '#606060';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
      {items.map(i => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 140, flexShrink: 0 }}>
            {i === 2 ? <YourThumbnail src={src} dark={dark} /> : <FakeThumbnail idx={i} dark={dark} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {i === 2 ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f97316', lineHeight: 1.3, marginBottom: 2 }}>← Your title</div>
                <div style={{ fontSize: 10, color: mc }}>Your Channel</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: tc, lineHeight: 1.3, marginBottom: 2 }}>{FAKE_VIDEOS[i % FAKE_VIDEOS.length].title}</div>
                <div style={{ fontSize: 10, color: mc }}>{FAKE_VIDEOS[i % FAKE_VIDEOS.length].views}</div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shorts Shelf ──────────────────────────────────────────────────────────────
function ShortsView({ src, dark }) {
  const tc = dark ? '#fff' : '#0f0f0f';
  const items = [0, 1, 2, 3, 4];
  const shorts = items.map((_, i) => {
    const hue = (i * 73) % 360;
    return `hsl(${hue},50%,${dark ? 30 : 55}%)`;
  });
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: tc, marginBottom: 10 }}>Suggested for you</div>
      {/* Shorts row */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ flexShrink: 0, width: 100 }}>
            <div style={{ height: 180, borderRadius: 8, background: shorts[i % shorts.length], marginBottom: 4 }} />
            <div style={{ fontSize: 10, fontWeight: 600, color: tc, lineHeight: 1.3 }}>Short title #{i + 1}</div>
          </div>
        ))}
      </div>
      {/* Regular grid after shorts */}
      <div style={{ fontSize: 14, fontWeight: 700, color: tc, marginBottom: 10 }}>Up next</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i}>
            {i === 2 ? <YourThumbnail src={src} dark={dark} /> : <FakeThumbnail idx={i} dark={dark} />}
            <div style={{ marginTop: 6 }}>
              {i === 2 ? <YourMeta dark={dark} /> : <VideoMeta idx={i} dark={dark} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const MODES = [
  { id: 'home',   label: 'Home Feed'      },
  { id: 'search', label: 'Search Results' },
  { id: 'sidebar',label: 'Sidebar'        },
  { id: 'shorts', label: 'Shorts Shelf'   },
];

export default function FeedSimulator({ rendererRef }) {
  const isOpen          = useEditorStore(s => s.showFeedSimulator);
  const setOpen         = useEditorStore(s => s.setShowFeedSimulator);

  const [mode,    setMode]    = useState('home');
  const [dark,    setDark]    = useState(true);
  const [thumbSrc,setThumbSrc] = useState(null);
  const prevUrlRef = useRef(null);

  const capture = useCallback(() => {
    const renderer = rendererRef?.current;
    if (!renderer?._mounted) return;
    const dataUrl = renderer.exportToDataURL('image/jpeg', 0.85);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const off = document.createElement('canvas');
      off.width  = 320;
      off.height = 180;
      off.getContext('2d').drawImage(img, 0, 0, 320, 180);
      off.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setThumbSrc(url);
      }, 'image/jpeg', 0.85);
    };
    img.src = dataUrl;
  }, [rendererRef]);

  useEffect(() => {
    if (!isOpen) return;
    capture();
    const id = setInterval(capture, 1000);
    return () => {
      clearInterval(id);
      if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, [isOpen, capture]);

  if (!isOpen) return null;

  const bgColor = dark ? '#0f0f0f' : '#ffffff';
  const headerBg = dark ? '#212121' : '#f1f1f1';
  const borderC  = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        background: bgColor,
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
      onKeyDown={e => e.key === 'Escape' && setOpen(false)}
      tabIndex={-1}
    >
      {/* Header */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        background: headerBg, borderBottom: `1px solid ${borderC}`,
      }}>
        {/* YouTube logo mock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 24, height: 16, background: '#FF0000', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 0, height: 0, borderLeft: '8px solid #fff', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: dark ? '#fff' : '#0f0f0f' }}>YouTube</span>
        </div>

        {/* Mode pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                height: 28, padding: '0 10px', fontSize: 11, fontWeight: mode === m.id ? 700 : 500,
                background: mode === m.id ? (dark ? '#fff' : '#0f0f0f') : 'transparent',
                border: `1px solid ${borderC}`,
                borderRadius: 14, cursor: 'pointer',
                color: mode === m.id ? (dark ? '#0f0f0f' : '#fff') : (dark ? '#aaa' : '#606060'),
                transition: 'all 100ms',
              }}
            >{m.label}</button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Dark/Light toggle */}
        <button
          onClick={() => setDark(d => !d)}
          style={{
            height: 28, padding: '0 10px', fontSize: 11, fontWeight: 600,
            background: 'transparent', border: `1px solid ${borderC}`,
            borderRadius: 14, cursor: 'pointer',
            color: dark ? '#aaa' : '#606060',
          }}
        >{dark ? '☀️ Light' : '🌙 Dark'}</button>

        {/* Close */}
        <button
          onClick={() => setOpen(false)}
          style={{
            height: 32, width: 32, background: 'transparent', border: 'none',
            cursor: 'pointer', color: dark ? '#aaa' : '#606060',
            fontSize: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Feed content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16 }}>
        {mode === 'home'    && <HomeFeedView  src={thumbSrc} dark={dark} />}
        {mode === 'search'  && <SearchView    src={thumbSrc} dark={dark} />}
        {mode === 'sidebar' && <SidebarView   src={thumbSrc} dark={dark} />}
        {mode === 'shorts'  && <ShortsView    src={thumbSrc} dark={dark} />}
      </div>

      {/* Hint bar */}
      <div style={{
        height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: `1px solid ${borderC}`, fontSize: 10,
        color: dark ? '#555' : '#aaa',
      }}>
        Press Esc or click ✕ to close · Updates live from canvas · Competitor slots are placeholders
      </div>
    </div>
  );
}
