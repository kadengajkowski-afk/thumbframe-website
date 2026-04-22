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

// jsdom's KeyboardEvent.getModifierState() returns false even when
// ctrlKey/metaKey/altKey/shiftKey are set via the constructor options.
// tinykeys relies on getModifierState; without this patch, $mod+<key>
// shortcuts can't be tested. Read from the boolean flags instead.
if (typeof KeyboardEvent !== 'undefined') {
  const originalGetModifierState = KeyboardEvent.prototype.getModifierState;
  KeyboardEvent.prototype.getModifierState = function (modifier) {
    const native = originalGetModifierState?.call(this, modifier);
    if (native) return true;
    switch (modifier) {
      case 'Control':   return !!this.ctrlKey;
      case 'Meta':      return !!this.metaKey;
      case 'Alt':       return !!this.altKey;
      case 'Shift':     return !!this.shiftKey;
      case 'AltGraph':  return !!this.altKey && !!this.ctrlKey;
      default:          return false;
    }
  };
}
