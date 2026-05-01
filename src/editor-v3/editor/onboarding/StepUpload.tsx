import { useRef, type CSSProperties, type ChangeEvent } from "react";
import { useOnboardingStore } from "@/state/onboardingStore";
import { handleUploadedFile } from "@/lib/uploadFlow";
import { dominantColorFromBitmap } from "@/lib/dominantColor";
import { executeAiTool } from "@/editor/aiToolExecutor";
import { useUiStore } from "@/state/uiStore";

/** Day 51 — Step C scaffold. Drag-drop or click-to-browse upload.
 *
 * Day 52 layers in:
 *   - Painterly border styling matching the empty-state ghost frame
 *   - Auto-extract dominant color from uploaded image, push to
 *     pickedDominantColor, and apply as canvas background
 *   - Smooth transition to Step D after upload completes
 *
 * Today: file input wired through the existing handleUploadedFile,
 * advances to step D on success. No dominant-color extraction yet —
 * Day 52 will add it. */
export function StepUpload() {
  const goToStep = useOnboardingStore((s) => s.goToStep);
  const skip = useOnboardingStore((s) => s.skipFromCurrent);
  const fileRef = useRef<HTMLInputElement>(null);

  const setDominantColor = useOnboardingStore((s) => s.setDominantColor);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Day 52 — extract dominant color from the file BEFORE we hand
    // it off to the upload flow. The file is read once for both
    // (createImageBitmap is fast on a Blob; the upload flow does
    // its own decode for the layer texture).
    let dominantHex: string | null = null;
    try {
      const bitmap = await createImageBitmap(file);
      dominantHex = await dominantColorFromBitmap(bitmap);
      bitmap.close();
    } catch {
      // Non-decodable file. handleUploadedFile will surface its own
      // error; we just skip the auto-bg.
    }
    await handleUploadedFile(file);
    // Apply the dominant color as canvas background so the uploaded
    // image visually "lands" on a complementary surface. Stored on
    // the onboarding store too so Step D can mention it in greetings.
    if (dominantHex) {
      setDominantColor(dominantHex);
      executeAiTool("set_canvas_background", { color: dominantHex });
    }
    useUiStore.getState().setHasEntered(true);
    goToStep("thumbfriend");
  }

  return (
    <div style={card} data-testid="onboarding-step-upload">
      <h2 style={heading}>Drop your image here</h2>
      <p style={sub}>
        Photos work best. The rest we&apos;ll handle.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onPick}
        aria-hidden="true"
        style={visuallyHidden}
      />
      <button
        type="button"
        style={dropzone}
        onClick={() => fileRef.current?.click()}
        data-testid="onboarding-upload-target"
      >
        Click to browse
      </button>
      <div style={footerRow}>
        <button
          type="button"
          style={secondaryLink}
          onClick={() => goToStep("welcome")}
          data-testid="onboarding-back-to-welcome"
        >
          ← Back
        </button>
        <button
          type="button"
          style={skipBtn}
          onClick={skip}
          data-testid="onboarding-skip"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  position: "relative",
  width: "min(560px, 92vw)",
  padding: "36px 36px 56px",
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  boxShadow: "0 16px 60px rgba(0, 0, 0, 0.4)",
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "var(--accent-cream)",
  fontWeight: 500,
};

const sub: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--text-secondary)",
};

const dropzone: CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  marginTop: 8,
  border: "2px dashed var(--border-ghost)",
  background: "transparent",
  borderRadius: 10,
  fontSize: 14,
  color: "var(--accent-cream)",
  cursor: "pointer",
};

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap", border: 0,
};

const footerRow: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const secondaryLink: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 12,
  cursor: "pointer",
};

const skipBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.04em",
};
