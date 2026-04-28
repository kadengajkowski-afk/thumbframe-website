/// <reference lib="webworker" />
import encode, { init } from "@jsquash/jpeg/encode";
// Day 18 fix — explicit WASM URL via Vite's ?url suffix. The default
// emscripten loader resolves the .wasm path off import.meta.url which
// breaks under Vite's dep optimizer (returns SPA fallback). Compiling
// the WASM module ourselves and passing it into init() side-steps that.
import mozjpegWasmUrl from "@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url";

/** Day 18 — JPEG encode runs in a Worker so a 1280×720 mozjpeg pass
 * (~500ms-2s) doesn't freeze the editor. The Worker accepts an
 * ImageData (transferred via copy — ImageData isn't transferable
 * itself; we copy and transfer the underlying buffer back). */

type Req = { imageData: ImageData; quality: number };
type Res = { ok: true; buffer: ArrayBuffer } | { ok: false; error: string };

let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const wasmModule = await WebAssembly.compileStreaming(fetch(mozjpegWasmUrl));
      await init(wasmModule);
    })();
  }
  return initPromise;
}

self.addEventListener("message", async (e: MessageEvent<Req>) => {
  try {
    await ensureInit();
    const { imageData, quality } = e.data;
    const buffer = await encode(imageData, { quality });
    const reply: Res = { ok: true, buffer };
    (self as unknown as Worker).postMessage(reply, [buffer]);
  } catch (err) {
    const reply: Res = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(reply);
  }
});
