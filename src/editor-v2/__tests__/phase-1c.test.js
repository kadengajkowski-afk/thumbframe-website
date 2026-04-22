// src/editor-v2/__tests__/phase-1c.test.js
// -----------------------------------------------------------------------------
// Phase 1.c regression suite. Covers:
//   • every 1.c tool (blur, sharpen, dodge, burn, sponge, smudge,
//     cloneStamp, spotHeal, lightPainting) is registered + selectable
//   • StrokeSession configures the correct composite-op for each tool
//   • toolParams bucket pre-seeded for every new tool
//   • registry lookup maps ids to the right tool object
//
// The pixel-accuracy of smudge / clone / spot-heal is out of scope here
// — those tools ship as stubs in 1.c and get a full implementation in
// 1.f's polish pass. This suite verifies the pipeline contract, not the
// perceptual output.
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async (p) => { db.projects.set(p.id, p); }),
    getProject: jest.fn(async (id) => db.projects.get(id) || null),
    listProjects: jest.fn(async () => [...db.projects.values()]),
    putSnapshot: jest.fn(async (s) => { db.snapshots.set(s.id, s); }),
    listSnapshots: jest.fn(async (projectId) =>
      [...db.snapshots.values()]
        .filter(s => s.projectId === projectId)
        .sort((a, b) => a.timestamp - b.timestamp),
    ),
    pruneSnapshots: jest.fn(async () => {}),
    enqueueSave: jest.fn(async () => {}),
    drainQueue:  jest.fn(async () => []),
    peekQueue:   jest.fn(async () => []),
    __resetForTests: jest.fn(async () => {
      db.projects.clear(); db.snapshots.clear(); db.queue.clear();
    }),
  };
});

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import 'jest-canvas-mock';
import { useStore, SAVE_STATUS }  from '../store/Store';
import { History }                from '../history/History';
import {
  registerFoundationActions,
  executeAction,
  getAction,
  __resetRegistry,
} from '../actions/registry';
import { PaintCanvases }          from '../engine/PaintCanvases';
import { StrokeSession }          from '../tools/StrokeSession';
import { BlurTool, SharpenTool }  from '../tools/ConvolutionTools';
import { DodgeTool, BurnTool, SpongeTool } from '../tools/ToneTools';
import { SmudgeTool, CloneStampTool, SpotHealTool } from '../tools/SamplingTools';
import { LightPaintingTool }      from '../tools/LightPaintingTool';
import * as idb                   from '../save/idb';

let history;
let paintCanvases;

async function resetAll() {
  __resetRegistry();
  await idb.__resetForTests();
  // Don't clobber activeTool/toolParams — they default from the initial
  // store creation which imports the tool defaults directly.
  const s = useStore.getState();
  useStore.setState({
    projectId:        null,
    projectName:      'Untitled',
    layers:           [],
    selectedLayerIds: [],
    saveStatus:       SAVE_STATUS.SAVED,
    lastSavedAt:      null,
    rendererReady:    false,
    activeTool:       'brush',
    toolParams:       s.toolParams,   // preserve the seeded defaults
    strokeActive:     false,
  });
  paintCanvases = new PaintCanvases();
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history, paintCanvases });
  await history.seed('Initial state');
}

beforeEach(resetAll);

function makeMockCtx() {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); };
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    fillStyle: '#000',
    calls,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    fill: record('fill'),
    createRadialGradient: () => null,
  };
}

// ── Tool registration ──────────────────────────────────────────────────────
describe('Phase 1.c tool actions', () => {
  test.each([
    'tool.blur.select',
    'tool.sharpen.select',
    'tool.dodge.select',
    'tool.burn.select',
    'tool.sponge.select',
    'tool.smudge.select',
    'tool.cloneStamp.select',
    'tool.spotHeal.select',
    'tool.lightPainting.select',
  ])('%s registered with a handler', (id) => {
    const a = getAction(id);
    expect(a).not.toBeNull();
    expect(typeof a.handler).toBe('function');
    expect(a.category).toBe('tool');
  });

  test.each([
    ['tool.blur.select',          'blur'],
    ['tool.sharpen.select',       'sharpen'],
    ['tool.dodge.select',         'dodge'],
    ['tool.burn.select',          'burn'],
    ['tool.sponge.select',        'sponge'],
    ['tool.smudge.select',        'smudge'],
    ['tool.cloneStamp.select',    'cloneStamp'],
    ['tool.spotHeal.select',      'spotHeal'],
    ['tool.lightPainting.select', 'lightPainting'],
  ])('%s flips activeTool to %s', async (actionId, toolId) => {
    await executeAction(actionId);
    expect(useStore.getState().activeTool).toBe(toolId);
  });
});

// ── toolParams seeding ─────────────────────────────────────────────────────
describe('Phase 1.c toolParams seeding', () => {
  test.each([
    'brush', 'eraser', 'blur', 'sharpen',
    'dodge', 'burn', 'sponge',
    'smudge', 'cloneStamp', 'spotHeal', 'lightPainting',
  ])('%s bucket seeded with defaultParams', (toolId) => {
    const bucket = useStore.getState().toolParams[toolId];
    expect(bucket).toBeDefined();
    expect(typeof bucket.size).toBe('number');
  });
});

// ── Composite-op routing per tool ──────────────────────────────────────────
describe('Composite-op routing by tool', () => {
  test.each([
    [BlurTool,          'source-over'],
    [SharpenTool,       'source-over'],
    [DodgeTool,         'color-dodge'],
    [BurnTool,          'color-burn'],
    [SpongeTool,        'source-over'],
    [SmudgeTool,        'source-over'],
    [CloneStampTool,    'source-over'],
    [SpotHealTool,      'source-over'],
    [LightPaintingTool, 'lighter'],
  ])('%o sets ctx.globalCompositeOperation = %s', (tool, expected) => {
    const ctx = makeMockCtx();
    // eslint-disable-next-line no-new
    new StrokeSession({
      ctx,
      tool,
      target: 'layer',
      params: tool.defaultParams(),
    });
    expect(ctx.globalCompositeOperation).toBe(expected);
  });

  test('Blur sets ctx.filter with a numeric blur radius', () => {
    const ctx = makeMockCtx();
    // eslint-disable-next-line no-new
    new StrokeSession({
      ctx, tool: BlurTool, target: 'layer', params: { ...BlurTool.defaultParams(), blurPx: 7 },
    });
    expect(ctx.filter).toBe('blur(7px)');
  });

  test('Sharpen sets ctx.filter contrast', () => {
    const ctx = makeMockCtx();
    // eslint-disable-next-line no-new
    new StrokeSession({
      ctx, tool: SharpenTool, target: 'layer', params: { ...SharpenTool.defaultParams(), contrast: 1.6 },
    });
    expect(ctx.filter).toBe('contrast(1.6)');
  });

  test('Sponge desaturate mode inverts the saturate factor', () => {
    const ctx = makeMockCtx();
    // eslint-disable-next-line no-new
    new StrokeSession({
      ctx, tool: SpongeTool, target: 'layer',
      params: { ...SpongeTool.defaultParams(), mode: 'desaturate', strength: 2 },
    });
    expect(ctx.filter).toBe('saturate(0.5)');
  });
});

// ── End-to-end: registry begin/end for each tool ───────────────────────────
describe('Tool selection + stroke lifecycle', () => {
  test.each([
    'blur', 'sharpen', 'dodge', 'burn', 'sponge',
    'smudge', 'cloneStamp', 'spotHeal', 'lightPainting',
  ])('%s: begin → addPoint → endStroke lifecycle completes + one snapshot', async (toolId) => {
    const layerId = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction(`tool.${toolId}.select`);
    const before = history.size();

    await executeAction('paint.beginStroke', {
      layerId, target: 'layer', x: 10, y: 10, pressure: 1,
    });
    await executeAction('paint.addPoint', { x: 30, y: 30, pressure: 0.9 });
    await executeAction('paint.endStroke');

    expect(history.size()).toBe(before + 1);
    expect(useStore.getState().strokeActive).toBe(false);
    expect(await executeAction('paint.__debug.isActive')).toBe(false);
    expect(await executeAction('paint.__debug.activeToolId')).toBeNull();
  });
});

// ── Dodge / Burn stamp color resolution ────────────────────────────────────
describe('DodgeTool / BurnTool color resolution', () => {
  test('Dodge exposure=0 gives a darker-ish grey; exposure=1 gives white', () => {
    const low  = DodgeTool.resolveStampColor('layer', { exposure: 0 });
    const high = DodgeTool.resolveStampColor('layer', { exposure: 1 });
    expect(low).not.toBe(high);
    expect(high.toLowerCase()).toBe('#ffffff');
  });

  test('Burn exposure=0 is medium-dark; exposure=1 is pure black', () => {
    const low  = BurnTool.resolveStampColor('layer', { exposure: 0 });
    const high = BurnTool.resolveStampColor('layer', { exposure: 1 });
    expect(low).not.toBe(high);
    expect(high.toLowerCase()).toBe('#000000');
  });
});
