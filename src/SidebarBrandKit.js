import React from 'react';

export default function SidebarBrandKit({
  T,
  user,
  brandKit,
  brandKitLoading,
  brandKitFace,
  brandKitColors,
  selectedLayer,
  onOpenSetup,
  onInjectSubject,
  onApplyColor,
}) {
  const subjectSrc = brandKit?.subject_url || brandKit?.face_image_url || brandKitFace;
  const colors = [
    { label: 'Primary', color: brandKit?.primary_color || brandKitColors.primary },
    { label: 'Secondary', color: brandKit?.secondary_color || brandKitColors.secondary },
  ].filter(item => item.color);

  const cardStyle = {
    padding: 14,
    borderRadius: 18,
    border: `1px solid ${T.border}`,
    background: `linear-gradient(180deg, ${T.input}, rgba(249,115,22,0.05))`,
    boxShadow: '0 18px 50px rgba(0,0,0,0.18)',
    marginTop: 10,
  };

  return (
    <div>
      <div style={{ ...cardStyle, marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: '800', color: T.text }}>Pro Brand Kit</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>
              Signature subject, brand colors, and typography defaults for high-CTR thumbnails.
            </div>
          </div>
          {user && (
            <button onClick={onOpenSetup} style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'rgba(249,115,22,0.12)', color: T.text, cursor: 'pointer', fontSize: 11, fontWeight: '700' }}>
              {brandKit ? 'Edit Pro Kit' : 'Setup'}
            </button>
          )}
        </div>

        {!user && (
          <div style={{ fontSize: 11, color: T.warning, padding: 12, background: 'rgba(245,158,11,0.10)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
            Log in to unlock saved Brand Kit assets.
          </div>
        )}

        {brandKitLoading && (
          <div style={{ fontSize: 11, color: T.muted, paddingTop: 4 }}>Loading Brand Kit…</div>
        )}
      </div>

      <button
        onClick={() => subjectSrc && onInjectSubject()}
        disabled={!subjectSrc}
        style={{
          ...cardStyle,
          width: '100%',
          textAlign: 'left',
          cursor: subjectSrc ? 'pointer' : 'default',
          overflow: 'hidden',
          background: subjectSrc
            ? `linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.68)), url(${subjectSrc}) center/cover`
            : `linear-gradient(135deg, ${T.input}, rgba(249,115,22,0.08))`,
          minHeight: 220,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          opacity: subjectSrc ? 1 : 0.82,
        }}
      >
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', backdropFilter: 'blur(8px)' }}>
          Primary Subject
        </div>
        <div style={{ marginTop: 12, color: '#fff' }}>
          <div style={{ fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
            {subjectSrc ? 'Inject Into Canvas' : 'No subject saved yet'}
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: subjectSrc ? 'rgba(255,255,255,0.88)' : T.muted }}>
            {subjectSrc
              ? 'Click to add your saved subject with the Brand Kit outline treatment.'
              : 'Save a subject in your Brand Kit to unlock one-click injection.'}
          </div>
        </div>
      </button>

      <div style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: '700', color: T.text, marginBottom: 6 }}>Brand Colors</div>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Click a color to apply it to the currently selected layer.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {colors.map(({ label, color }) => (
            <button
              key={label}
              onClick={() => onApplyColor(color)}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
              title={`Apply ${label} to selected layer`}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, border: '3px solid rgba(255,255,255,0.88)', boxShadow: '0 12px 28px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(0,0,0,0.18)' }} />
              <div style={{ fontSize: 10, color: T.text, textAlign: 'center', marginTop: 7, fontWeight: '700' }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: '700', color: T.text, marginBottom: 8 }}>Kit Metadata</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, color: T.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Primary Font</div>
            <div style={{ fontSize: 20, color: T.text, fontFamily: brandKit?.primary_font === 'Burbank' ? 'Bangers, Anton, sans-serif' : brandKit?.primary_font === 'Komika Axis' ? 'Comic Neue, Bangers, cursive' : brandKit?.primary_font || 'Anton, sans-serif', fontWeight: '800' }}>
              {brandKit?.primary_font || 'Anton'}
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, color: T.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Outline</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: brandKit?.outline_color || '#ffffff', border: `1px solid ${T.border}` }} />
              <div style={{ fontSize: 12, color: T.text, fontWeight: '700' }}>{brandKit?.outline_width || 5}px contour</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.muted }}>
            {selectedLayer ? `Selected layer: ${selectedLayer.type}` : 'Select a layer to apply brand colors instantly.'}
          </div>
        </div>
      </div>
    </div>
  );
}