// Frame doorway measurement. Measured in Photopea against mountain-main.png
// (the baked hero base containing sky + mountain + river + Frame niche).
//
// These constants lock where the 3D Frame mesh will be registered when it
// gets built in Phase 6. Phase 2 does not mount the Frame; it just places
// a stub hotspot at the same screen coordinates so positioning references
// are consistent between the 2D composition and the future 3D element.

export const FRAME_DOORWAY = {
  imageWidth: 816,
  imageHeight: 1456,
  doorway: {
    topLeft:     { x: 366, y:  799 },
    topRight:    { x: 440, y:  798 },
    bottomLeft:  { x: 366, y: 1009 },
    bottomRight: { x: 440, y: 1008 },
    center:      { x: 403, y:  903 },
    widthPct:    0.0920,   // doorway width  as fraction of image width
    heightPct:   0.1443,   // doorway height as fraction of image height
    centerXPct:  0.494,    // doorway centre X as fraction of image width
    centerYPct:  0.620,    // doorway centre Y as fraction of image height
  },
};
