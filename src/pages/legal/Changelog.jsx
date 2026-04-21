import React from 'react';
import LegalPageTemplate from './LegalPageTemplate';
import { useSEO } from '../../hooks/useSEO';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const CREAM    = '#faecd0';
const CREAM_60 = 'rgba(250,236,208,0.6)';
const CREAM_80 = 'rgba(250,236,208,0.8)';

const ENTRIES = [
  {
    version: '1.2',
    date:    'April 2026',
    summary: 'Site-wide visual refresh and new AI features.',
    items: [
      'Entirely new landing, pricing, and features pages with painterly cosmic theme',
      'ThumbFriend AI creative partner with five personalities',
      'Auto Thumbnail AI generation from video description',
      'CTR Score with detailed breakdowns',
      'A/B Variant generation',
      'New Gallery page for saved designs',
      'Redesigned Settings and Billing',
    ],
  },
  {
    version: '1.1',
    date:    'April 2026',
    summary: 'Major editor rebuild with faster rendering and smoother tools.',
    items: [
      'Rebuilt editor on PixiJS v8 for significant performance improvements',
      'New brush and spot healing system',
      'Magic wand and lasso selection tools',
      'Auto-save to cloud with 3-second debounce',
      'Improved undo/redo stack',
    ],
  },
  {
    version: '1.0',
    date:    'March 2026',
    summary: 'Public launch.',
    items: [
      'Web-based thumbnail editor with upload, text, layers, effects',
      'Pro plan with AI features',
      'YouTube channel integration',
      '12 starter templates',
      'Free and Pro tiers',
    ],
  },
];

export default function Changelog({ setPage }) {
  useSEO({
    title: 'Changelog — ThumbFrame',
    description: 'What we shipped, version by version.',
  });

  const lastUpdated = ENTRIES[0]?.date;

  return (
    <LegalPageTemplate
      setPage={setPage}
      eyebrow="Release notes"
      title="Changelog"
      subtitle="What's new in ThumbFrame."
      lastUpdated={lastUpdated}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ENTRIES.map((entry, idx) => (
          <React.Fragment key={entry.version}>
            <section style={{ padding: '8px 0' }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}>
                <h2 style={{
                  fontFamily: FRAUNCES,
                  fontSize: 34,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: CREAM,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  v{entry.version}
                </h2>
                <span style={{
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: CREAM_60,
                }}>
                  {entry.date}
                </span>
              </div>

              <p style={{
                fontSize: 15,
                color: CREAM_80,
                margin: '0 0 14px',
                lineHeight: 1.55,
              }}>
                {entry.summary}
              </p>

              <ul style={{ paddingLeft: 22, margin: 0 }}>
                {entry.items.map((item, i) => (
                  <li key={i} style={{
                    fontSize: 15,
                    color: CREAM_80,
                    lineHeight: 1.7,
                    marginBottom: 6,
                  }}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
            {idx < ENTRIES.length - 1 && (
              <hr style={{
                height: 1,
                border: 0,
                background: 'rgba(255,255,255,0.08)',
                margin: '48px 0',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <p style={{
        fontSize: 13,
        color: CREAM_60,
        margin: '48px 0 0',
        textAlign: 'center',
        fontStyle: 'italic',
      }}>
        More entries coming.
      </p>
    </LegalPageTemplate>
  );
}
