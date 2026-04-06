import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const changelogStyles = `
  .tf-cl-page {
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
    font-family: var(--font-body);
  }
  .tf-cl-hero {
    padding: 140px 24px 56px;
    text-align: center;
    position: relative;
  }
  .tf-cl-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,107,0,0.05) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-cl-hero h1 {
    font-size: clamp(28px, 4vw, 44px);
    letter-spacing: -0.03em;
    margin-bottom: 12px;
  }
  .tf-cl-hero p {
    font-size: 16px;
    color: var(--text-secondary);
    max-width: 420px;
    margin: 0 auto;
    line-height: 1.6;
  }
  .tf-cl-body {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 24px 100px;
  }
  .tf-cl-entry {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 0 32px;
    padding: 40px 0;
    border-bottom: 1px solid var(--border);
  }
  .tf-cl-entry:last-child { border-bottom: none; }
  .tf-cl-meta {
    padding-top: 4px;
  }
  .tf-cl-date {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tf-cl-version {
    display: inline-block;
    margin-top: 6px;
    padding: 2px 8px;
    border-radius: 100px;
    font-size: 11px;
    font-weight: 700;
    background: rgba(249,115,22,0.12);
    color: var(--accent);
    border: 1px solid rgba(249,115,22,0.25);
  }
  .tf-cl-content h2 {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
    color: var(--text-primary);
  }
  .tf-cl-content ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tf-cl-content li {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    display: flex;
    gap: 10px;
  }
  .tf-cl-content li::before {
    content: '–';
    color: var(--accent);
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tf-cl-tag {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: 6px;
    vertical-align: middle;
    position: relative;
    top: -1px;
  }
  .tf-cl-tag-new   { background: rgba(34,197,94,0.12);  color: #22c55e; }
  .tf-cl-tag-fix   { background: rgba(59,130,246,0.12); color: #60a5fa; }
  .tf-cl-tag-perf  { background: rgba(168,85,247,0.12); color: #c084fc; }

  @media (max-width: 640px) {
    .tf-cl-entry {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 28px 0;
    }
    .tf-cl-meta { display: flex; align-items: center; gap: 10px; }
  }
`;

const ENTRIES = [
  {
    date: 'April 2026',
    version: 'v3.8',
    title: 'Tier 3: Pressure Sensitivity, Warp Transform & PSD Export',
    items: [
      ['new', 'Pressure sensitivity support for Wacom and other drawing tablets'],
      ['new', 'Warp Transform tool with 5 mesh presets (Arc, Bulge, Wave, Fisheye, Custom)'],
      ['new', 'Text warping directly inside the text properties panel'],
      ['new', 'PSD export via ag-psd — preserves layers, blend modes, and text'],
      ['new', 'Redesigned export panel with PNG/JPEG/WebP/PSD format cards and quick presets'],
    ],
  },
  {
    date: 'March 2026',
    version: 'v3.6',
    title: 'Competitor Comparison & Focus Heat Map',
    items: [
      ['new', 'Competitor Comparison View — analyze your thumbnail against top YouTube search results'],
      ['new', 'Focus/Saliency Heat Map using Sobel edge detection with live insights'],
      ['new', 'Full Adjustment Layers: Levels, Hue/Sat, Color Balance, Vibrance, Selective Color, Gradient Map, Posterize, Threshold'],
      ['new', 'Dodge, Burn, Smudge, Blur & Sharpen brush tools with range-aware tonal targeting'],
    ],
  },
  {
    date: 'February 2026',
    version: 'v3.2',
    title: 'History Panel, Clipping Masks & Layer Groups',
    items: [
      ['new', 'Visual History panel with 50-entry thumbnails and named snapshots'],
      ['new', 'Clipping Masks (Ctrl+Alt+G) — clip any layer to the shape of the one below'],
      ['new', 'Layer Groups (Ctrl+G) — folder-style grouping with collapse, merge, and ungroup'],
      ['new', 'Full Filters modal: Gaussian Blur, Motion Blur, Radial Zoom, Surface Blur, Lens Bokeh, Unsharp Mask, High Pass'],
    ],
  },
  {
    date: 'January 2026',
    version: 'v3.0',
    title: 'Mobile Quick Editor & Team Collaboration',
    items: [
      ['new', 'Mobile Quick Editor — full AI editing experience on phones with bottom-dock actions'],
      ['new', 'Team Collaboration & Brand Kit Expanded — share projects, comment pins, version timeline'],
      ['new', 'Approval workflow: Draft → In Review → Approved status badge'],
      ['new', 'Mobile Preview, YouTube Search Result Preview, and accurate Safe Zone overlay'],
    ],
  },
  {
    date: 'December 2025',
    version: 'v2.8',
    title: 'YouTube History Intelligence & Selection Tools',
    items: [
      ['new', 'YouTube History Intelligence — connect your channel, analyze past CTR patterns, auto-apply winning styles'],
      ['new', 'Full selection tools: Marquee, Lasso, Polygon, Magic Wand'],
      ['new', 'Liquify Filter with 7 warp tools and freeze mask'],
      ['new', 'Niche-Specific AI Profiles — one-click optimization for Gaming, Tutorial, Vlog, Fitness, and more'],
    ],
  },
  {
    date: 'November 2025',
    version: 'v2.4',
    title: 'AI Variant Generator & CTR Score v2',
    items: [
      ['new', 'AI Variant Generator — 5 parallel thumbnail variants in a 2×3 preview grid, download all as ZIP'],
      ['new', 'CTR Score v2 — 6-category rubric with animated gauge and improvement tips'],
      ['new', 'AI Background Generation via DALL-E 3 with seamless edge blending'],
      ['new', 'Auto Color Grade with 5 creator presets (Warm, Cool, Cinematic, Neon, Matte)'],
    ],
  },
  {
    date: 'October 2025',
    version: 'v2.0',
    title: 'Smart Cutout, AI Face Engine & Composition AI',
    items: [
      ['new', 'Smart Cutout powered by SAM 2 — handles hair and complex edges in ~3 seconds'],
      ['new', 'AI Face & Expression Engine via MediaPipe — face detection, emotion tagging, glow effects'],
      ['new', 'Composition AI — Claude Vision scores rule-of-thirds, focal point, and text placement'],
      ['new', 'AI Text Engine — generates 5 high-CTR headline options with font + color suggestions'],
      ['new', 'Style Transfer with 5 creator presets and URL-based reference mode'],
    ],
  },
  {
    date: 'September 2025',
    version: 'v1.5',
    title: 'Performance & SEO overhaul',
    items: [
      ['perf', 'Code splitting by route — blog, gallery, and admin are now lazy-loaded'],
      ['perf', 'WebP image serving with JPEG fallback via srcset'],
      ['perf', 'Lighthouse score improvements across all pages (target: >80 on all categories)'],
      ['new', 'Full SEO meta tags, structured data, and sitemap.xml'],
      ['new', 'Custom 404 page, Cookie Consent (GDPR), and Changelog page'],
    ],
  },
  {
    date: 'August 2025',
    version: 'v1.0',
    title: 'Website launch',
    items: [
      ['new', 'Public launch — Home, Features, Pricing, Blog, Gallery, and Support pages'],
      ['new', 'Auto-save to IndexedDB — designs survive browser refreshes'],
      ['new', 'Stripe billing integration with Pro and Agency tiers'],
      ['new', 'Supabase auth with email/password and Google OAuth'],
      ['new', 'Full mobile responsive pass at 375px minimum width'],
    ],
  },
];

const TAG_LABELS = { new: 'New', fix: 'Fix', perf: 'Perf' };

export default function Changelog({ setPage }) {
  useSEO({
    title: 'Changelog — ThumbFrame',
    description: 'Every update, feature, and fix — in reverse chronological order.',
    url: 'https://thumbframe.com/changelog',
  });

  return (
    <>
      <style>{changelogStyles}</style>
      <div className="tf-cl-page">
        <Navbar setPage={setPage} currentPage="changelog" />

        <div className="tf-cl-hero">
          <h1>Changelog</h1>
          <p>Every update, feature, and fix. ThumbFrame ships continuously.</p>
        </div>

        <div className="tf-cl-body">
          {ENTRIES.map((entry, i) => (
            <div key={i} className="tf-cl-entry">
              <div className="tf-cl-meta">
                <div className="tf-cl-date">{entry.date}</div>
                <div className="tf-cl-version">{entry.version}</div>
              </div>
              <div className="tf-cl-content">
                <h2>{entry.title}</h2>
                <ul>
                  {entry.items.map(([tag, text], j) => (
                    <li key={j}>
                      <span>
                        {text}
                        <span className={`tf-cl-tag tf-cl-tag-${tag}`}>{TAG_LABELS[tag]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <Footer setPage={setPage} />
      </div>
    </>
  );
}
