/// <reference lib="webworker" />
import encode from "@jsquash/jpeg/encode";

/** Day 18 — JPEG encode runs in a Worker so a 1280×720 mozjpeg pass
 * (~500ms-2s) doesn't freeze the editor. The Worker accepts an
 * ImageData (transferred via copy — ImageData isn't a transferable
 * itself; we copy and transfer the underlying buffer back). */

type Req = { imageData: ImageData; quality: number };
type Res = { ok: true; buffer: ArrayBuffer } | { ok: false; error: string };

self.addEventListener("message", async (e: MessageEvent<Req>) => {
  try {
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
