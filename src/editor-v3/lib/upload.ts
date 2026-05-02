/**
 * Image upload library — pure logic, no UI.
 *
 * Validates a File against the Day 4 allowlist and decodes it to an
 * ImageBitmap via createImageBitmap (off-thread where supported).
 *
 * The caller decides what to do with errors: toast, log, silently
 * skip. No window globals, no store writes, no side effects other
 * than bitmap allocation.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

const ACCEPTED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg", // some macOS sources report this variant
  "image/webp",
  "image/gif",
]);

// Extensions checked as a fallback when the browser doesn't give us a
// useful MIME (clipboard-originated files often report an empty type).
const ACCEPTED_EXT = new Set<string>(["png", "jpg", "jpeg", "webp", "gif"]);

export class UnsupportedFormatError extends Error {
  readonly code = "unsupported-format" as const;
  constructor(public readonly mime: string) {
    super(`Unsupported image format: ${mime || "unknown"}`);
  }
}

export class FileTooLargeError extends Error {
  readonly code = "file-too-large" as const;
  constructor(public readonly bytes: number) {
    super(`File exceeds ${MAX_FILE_BYTES} bytes: ${bytes}`);
  }
}

export class DecodeFailedError extends Error {
  readonly code = "decode-failed" as const;
  constructor(cause?: unknown) {
    super(
      cause instanceof Error
        ? `Decode failed: ${cause.message}`
        : "Decode failed",
    );
  }
}

export type UploadError =
  | UnsupportedFormatError
  | FileTooLargeError
  | DecodeFailedError;

export function isUploadError(e: unknown): e is UploadError {
  return (
    e instanceof UnsupportedFormatError ||
    e instanceof FileTooLargeError ||
    e instanceof DecodeFailedError
  );
}

export async function loadImageFromFile(file: File): Promise<ImageBitmap> {
  if (!isAcceptedFormat(file)) {
    throw new UnsupportedFormatError(file.type);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileTooLargeError(file.size);
  }
  try {
    return await createImageBitmap(file);
  } catch (cause) {
    throw new DecodeFailedError(cause);
  }
}

/** Day 55 — server-side sanitization wrapper.
 *
 * POSTs the file as a base64 dataURL to /api/upload/image. The server
 * Sharp-re-encodes (strips EXIF / GPS / color profiles, downscales to
 * ≤4096×4096), runs NSFW + CSAM moderation, and returns a clean
 * dataURL we round-trip back into createImageBitmap so the rest of
 * the editor pipeline is unchanged.
 *
 * Best-effort: if the server is unreachable OR returns a non-block
 * error, fall back to the local decode path. The server WILL block
 * with HTTP 451 on moderation hits + 415 on unsupported formats —
 * those errors propagate so the caller can surface a toast.
 */
export class ContentBlockedError extends Error {
  readonly code = "content-blocked" as const;
  constructor(public readonly reason: string) {
    super(`Content blocked: ${reason}`);
  }
}

export async function sanitizeFileViaApi(
  file: File,
  apiBase: string,
  authToken: string | null,
): Promise<ImageBitmap> {
  if (!isAcceptedFormat(file)) {
    throw new UnsupportedFormatError(file.type);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileTooLargeError(file.size);
  }
  const dataUrl = await fileToDataUrl(file);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  let res: Response;
  try {
    res = await fetch(apiBase.replace(/\/$/, "") + "/api/upload/image", {
      method: "POST",
      headers,
      body: JSON.stringify({ dataUrl }),
    });
  } catch (cause) {
    // Network failure — fall back to local decode rather than
    // blocking the user.
    console.warn("[upload] sanitize API unreachable, falling back:", cause);
    return loadImageFromFile(file);
  }
  if (res.status === 451) {
    const body = await res.json().catch(() => ({} as { code?: string }));
    throw new ContentBlockedError(body.code || "FLAGGED");
  }
  if (res.status === 415) {
    throw new UnsupportedFormatError(file.type);
  }
  if (!res.ok) {
    // Non-block error — log + fall back. Better to ship the local
    // decode than to dead-end on a transient server problem.
    console.warn("[upload] sanitize API returned", res.status, "— falling back to local decode");
    return loadImageFromFile(file);
  }
  const body = (await res.json()) as { url: string };
  if (!body.url) {
    return loadImageFromFile(file);
  }
  // Convert the dataURL back to a Blob → ImageBitmap.
  const blob = await dataUrlToBlob(body.url);
  try {
    return await createImageBitmap(blob);
  } catch (cause) {
    throw new DecodeFailedError(cause);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function isAcceptedFormat(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime && ACCEPTED_MIME.has(mime)) return true;
  // Fallback on extension when the MIME is empty or misreported.
  const ext = extensionOf(file.name);
  return ext !== null && ACCEPTED_EXT.has(ext);
}

function extensionOf(name: string): string | null {
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return null;
  return name.slice(idx + 1).toLowerCase();
}
