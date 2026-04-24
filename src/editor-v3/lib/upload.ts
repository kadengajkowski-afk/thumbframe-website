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
