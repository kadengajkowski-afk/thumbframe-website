// src/editor/components/LassoDrawingOverlay.jsx
// Shows the lasso path in progress (orange dashed line + fill).

export default function LassoDrawingOverlay({ points, viewport, isPolygonal }) {
  const vp = viewport || window.__renderer?.viewport;
  if (!points || points.length < 2 || !vp) return null;

  const zoom  = vp.scale?.x ?? 1;
  const vpX   = vp.x  ?? 0;
  const vpY   = vp.y  ?? 0;

  const toScreen = (p) => ({
    x: p.x * zoom + vpX,
    y: p.y * zoom + vpY,
  });

  const screenPts = points.map(toScreen);
  const ptStr     = screenPts.map(p => `${p.x},${p.y}`).join(' ');
  const start     = screenPts[0];

  return (
    <svg
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        15,
        overflow:      'visible',
      }}
    >
      {/* Semi-transparent fill */}
      <polyline
        points={ptStr}
        fill="rgba(249,115,22,0.10)"
        stroke="none"
      />
      {/* Orange dashed border */}
      <polyline
        points={ptStr}
        fill="none"
        stroke="#f97316"
        strokeWidth={Math.max(1, 2 / zoom)}
        strokeDasharray={`${6 / zoom},${4 / zoom}`}
        strokeLinejoin="round"
      />
      {/* Snap circle near start */}
      <circle
        cx={start.x}
        cy={start.y}
        r={5 / zoom}
        fill="#f97316"
        stroke="white"
        strokeWidth={1.5 / zoom}
      />
      {/* Polygon dot nodes */}
      {isPolygonal && screenPts.slice(1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5 / zoom} fill="#f97316" />
      ))}
    </svg>
  );
}
