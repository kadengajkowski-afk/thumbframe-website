// src/editor/tools/BrushTool.js
// Standard paint brush. Pipeline default draws brushTip onto wet canvas —
// no custom applyStamp needed here.

export class BrushTool {
  handlesComposite = false;

  static defaultParams() {
    return {
      size:          20,
      hardness:      80,
      opacity:       100,
      flow:          100,
      spacing:       25,
      blendMode:     'normal',
      color:         '#ffffff',
      roundness:     100,
      angle:         0,
      scatter:       0,
      dynamicSize:   false,
      dynamicOpacity: false,
    };
  }
}
