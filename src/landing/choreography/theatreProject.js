import { getProject } from '@theatre/core';

// Theatre.js project — single source of truth for all camera/animation keyframes.
// In dev, @theatre/studio loads over this and lets you visually edit keyframes.
// In production, the exported keyframes.json drives everything deterministically.
const project = getProject('ThumbFrame Landing', {
  // state: keyframesJson, // uncomment when keyframes.json is exported from Studio
});

export const mainSheet = project.sheet('Main');
export default project;
