// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Stub HTMLCanvasElement 2D context (jsdom returns null by default).
// jest-canvas-mock records every call so editor-v2 paint pipeline tests
// can assert ctx interactions without needing a native canvas binding.
import 'jest-canvas-mock';

// jsdom doesn't ship ResizeObserver; cmdk (and other modern UI libs)
// call it on mount. A no-op stub is enough for tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom Element prototype lacks scrollIntoView; cmdk calls it when
// highlighting a list item. No-op stub.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
