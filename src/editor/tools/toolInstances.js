// src/editor/tools/toolInstances.js
// Module-level singletons shared across NewEditor and panel components.
// Importing this file multiple times always returns the same instances.

import { MagicWandTool } from './MagicWandTool';
import { LassoTool }     from './LassoTool';

export const magicWand = new MagicWandTool();
export const lasso     = new LassoTool();
