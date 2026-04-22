// src/editor-v2/__tests__/phase-2b.test.js
// -----------------------------------------------------------------------------
// Phase 2.b regression suite. Covers:
//   • FONT_CATALOG has the 20 curated entries, all with required metadata
//   • FONT_FALLBACK_CHAIN defined for every category
//   • FontLoader.load caches / dedups in-flight + records failures
//   • FontLoader.resolveCssFamily returns a string with quoted families
//   • searchFonts, filterFontsByCategory, buildPickerPreview data helpers
//   • Registry: font.load, font.resolve forward through the store's
//     __fontLoader reference
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async (p) => { db.projects.set(p.id, p); }),
    getProject: jest.fn(async (id) => db.projects.get(id) || null),
    listProjects: jest.fn(async () => [...db.projects.values()]),
    putSnapshot: jest.fn(async (s) => { db.snapshots.set(s.id, s); }),
    listSnapshots: jest.fn(async (pid) =>
      [...db.snapshots.values()].filter(s => s.projectId === pid).sort((a, b) => a.timestamp - b.timestamp),
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
import { useStore, SAVE_STATUS } from '../store/Store';
import { History }               from '../history/History';
import {
  registerFoundationActions,
  executeAction,
  getAction,
  __resetRegistry,
} from '../actions/registry';
import { PaintCanvases }         from '../engine/PaintCanvases';
import {
  FONT_CATALOG,
  FONT_CATEGORIES,
  FONT_FALLBACK_CHAIN,
  getFontById,
  getFontsByCategory,
} from '../fonts/FontCatalog';
import { FontLoader }             from '../fonts/FontLoader';
import {
  searchFonts,
  filterFontsByCategory,
  buildPickerPreview,
} from '../fonts/FontPicker';
import * as idb                   from '../save/idb';

let history, paintCanvases, fontLoader;

async function resetAll() {
  __resetRegistry();
  await idb.__resetForTests();
  const s = useStore.getState();
  useStore.setState({
    projectId: null, projectName: 'Untitled',
    layers: [], selectedLayerIds: [],
    saveStatus: SAVE_STATUS.SAVED, lastSavedAt: null, rendererReady: false,
    activeTool: 'brush', toolParams: s.toolParams, strokeActive: false,
    __fontLoader: null,
  });
  paintCanvases = new PaintCanvases();
  fontLoader    = new FontLoader();
  useStore.getState().setFontLoader(fontLoader);
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history, paintCanvases });
  await history.seed('Initial state');
}

beforeEach(resetAll);

// ── Catalog ────────────────────────────────────────────────────────────────
describe('FONT_CATALOG', () => {
  test('has exactly 20 entries', () => {
    expect(FONT_CATALOG.length).toBe(20);
  });

  test('every entry has id, family, category, source, thumbnailText', () => {
    for (const f of FONT_CATALOG) {
      expect(typeof f.id).toBe('string');
      expect(typeof f.family).toBe('string');
      expect(FONT_CATEGORIES).toContain(f.category);
      expect(['google', 'fontsource']).toContain(f.source);
      expect(typeof f.thumbnailText).toBe('string');
    }
  });

  test('every font id is unique', () => {
    const ids = new Set(FONT_CATALOG.map(f => f.id));
    expect(ids.size).toBe(FONT_CATALOG.length);
  });

  test('getFontById returns the entry; unknown id → null', () => {
    expect(getFontById('inter').family).toBe('Inter');
    expect(getFontById('nope')).toBeNull();
  });

  test('getFontsByCategory filters correctly', () => {
    const display = getFontsByCategory('display');
    expect(display.length).toBe(8);
    for (const f of display) expect(f.category).toBe('display');
  });

  test('FONT_FALLBACK_CHAIN defined for every category', () => {
    for (const cat of FONT_CATEGORIES) {
      expect(Array.isArray(FONT_FALLBACK_CHAIN[cat])).toBe(true);
      expect(FONT_FALLBACK_CHAIN[cat].length).toBeGreaterThan(0);
    }
  });
});

// ── FontLoader ─────────────────────────────────────────────────────────────
describe('FontLoader', () => {
  test('load resolves to a stub in non-browser envs (no FontFace)', async () => {
    // jsdom does not provide FontFace by default, so FontLoader takes
    // the stub path. The assertion is that it doesn't throw and marks
    // the font as loaded afterwards.
    const f = await fontLoader.load('inter');
    expect(f).toBeTruthy();
    expect(fontLoader.isLoaded('inter')).toBe(true);
  });

  test('duplicate load calls dedupe via _inFlight or _loaded', async () => {
    const [a, b] = await Promise.all([fontLoader.load('geist'), fontLoader.load('geist')]);
    expect(a).toBe(b);
  });

  test('load of unknown id → null', async () => {
    expect(await fontLoader.load('does-not-exist')).toBeNull();
  });

  test('resolveCssFamily: loaded font in front of category chain', async () => {
    await fontLoader.load('fraunces');
    const css = fontLoader.resolveCssFamily('fraunces');
    expect(css.startsWith('Fraunces')).toBe(true);
    expect(css).toContain('Georgia');
  });

  test('resolveCssFamily: multi-word family name is quoted', async () => {
    await fontLoader.load('bebas-neue');
    const css = fontLoader.resolveCssFamily('bebas-neue');
    expect(css).toMatch(/^'Bebas Neue'/);
  });

  test('resolveCssFamily: unloaded font falls back to chain only', () => {
    // Re-check with a fresh loader so nothing is loaded yet.
    const blank = new FontLoader();
    const css = blank.resolveCssFamily('playfair-display');
    expect(css.startsWith('Playfair Display') === false).toBe(true);
    expect(css).toContain('Georgia');
  });

  test('resolveCssFamily: unknown id → system-ui fallback', () => {
    expect(fontLoader.resolveCssFamily('nope')).toBe('system-ui, sans-serif');
  });

  test('summary reports catalog size and loaded set', async () => {
    await fontLoader.load('inter');
    await fontLoader.load('bebas-neue');
    const s = fontLoader.summary();
    expect(s.total).toBe(20);
    expect(s.loaded.length).toBe(2);
  });
});

// ── Picker helpers ─────────────────────────────────────────────────────────
describe('FontPicker helpers', () => {
  test('searchFonts empty returns full catalog', () => {
    expect(searchFonts('').length).toBe(FONT_CATALOG.length);
    expect(searchFonts('  ').length).toBe(FONT_CATALOG.length);
  });

  test('searchFonts matches family and category substrings', () => {
    expect(searchFonts('bebas').map(f => f.id)).toContain('bebas-neue');
    expect(searchFonts('rounded').every(f => f.category === 'rounded')).toBe(true);
  });

  test('filterFontsByCategory', () => {
    expect(filterFontsByCategory('mono').length).toBe(1);
    expect(filterFontsByCategory(null).length).toBe(FONT_CATALOG.length);
  });

  test('buildPickerPreview returns the shape the picker UI consumes', () => {
    const p = buildPickerPreview(getFontById('inter'), { isLoaded: true });
    expect(p.id).toBe('inter');
    expect(p.family).toBe('Inter');
    expect(p.variable).toBe(true);
    expect(p.isLoaded).toBe(true);
    expect(typeof p.thumbnailText).toBe('string');
  });
});

// ── Registry forwarders ────────────────────────────────────────────────────
describe('font.load / font.resolve', () => {
  test('font.load forwards through the store-attached loader', async () => {
    const face = await executeAction('font.load', 'oswald');
    expect(face).toBeTruthy();
    expect(fontLoader.isLoaded('oswald')).toBe(true);
  });

  test('font.resolve returns the CSS family string', () => {
    const css = executeAction('font.resolve', 'dm-sans');
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  test('font actions no-op when no loader is attached', async () => {
    useStore.getState().setFontLoader(null);
    expect(await executeAction('font.load', 'inter')).toBeNull();
    expect(executeAction('font.resolve', 'inter')).toBeNull();
  });

  test.each(['font.load', 'font.resolve'])('%s is registered with category=font', (id) => {
    const a = getAction(id);
    expect(a).not.toBeNull();
    expect(a.category).toBe('font');
  });
});
