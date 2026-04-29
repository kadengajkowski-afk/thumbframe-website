import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { toast } from "@/toasts/toastStore";

import { useImageGen, type Variant } from "@/editor/hooks/useImageGen";
import { STYLE_PRESETS, type AspectRatio } from "@/lib/imageGenClient";
import { addGeneratedImageToCanvas } from "@/lib/imageGenAddToCanvas";
import * as s from "./ImageGenPanel.styles";

/** Day 37 — AI image generation panel.
 *
 * Modal. Cmd+G opens. Lets the user write a prompt, pick a style
 * preset, choose an aspect ratio, optionally drag a reference image,
 * and generate 4 variants. Each variant is a fal.ai cloud render —
 * "Add to canvas" turns it into a real ImageLayer (the differentiator
 * vs Midjourney: every output is editable, not flat). */

const ASPECTS: { id: AspectRatio; label: string }[] = [
  { id: "16:9", label: "16:9" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
];

export function ImageGenPanel() {
  const open = useUiStore((u) => u.imageGenPanelOpen);
  const close = useUiStore((u) => u.setImageGenPanelOpen);
  const userTier = useUiStore((u) => u.userTier);
  const isPro = userTier === "pro";

  const [prompt, setPrompt] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [reference, setReference] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const gen = useImageGen();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const running = gen.status === "queued" || gen.status === "generating";
  const canSubmit = prompt.trim().length >= 3 && !running;

  function onGenerate() {
    if (!canSubmit) return;
    void gen.generate({
      prompt,
      ...(presetId ? { presetId } : {}),
      aspectRatio: aspect,
      ...(reference ? { referenceImage: reference } : {}),
    });
  }

  async function onAddToCanvas(url: string) {
    try {
      await addGeneratedImageToCanvas({
        url,
        prompt: gen.sentPrompt || prompt,
        generatedBy: gen.intent ?? "thumbnail-bg",
      });
      close(false);
      toast("Added to canvas");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add image");
    }
  }

  async function onUseAsReference(url: string) {
    try {
      const blob = await (await fetch(url, { mode: "cors" })).blob();
      const base64 = await blobToBase64(blob);
      setReference(base64);
      toast("Reference set — generate again");
    } catch {
      toast("Couldn't load reference");
    }
  }

  return (
    <div role="dialog" aria-label="Generate image" style={s.backdrop} onClick={() => close(false)}>
      <div style={s.card} onClick={(e) => e.stopPropagation()} data-testid="image-gen-panel">
        <header style={s.header}>
          <span>Generate image</span>
          <span style={s.proBadge}>{isPro ? "Pro" : "Free trial"}</span>
        </header>

        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want"
          rows={3}
          style={s.textarea}
          data-testid="image-gen-prompt"
        />

        <div style={s.chipRow}>
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              style={presetId === p.id ? s.chipActive : s.chip}
              onClick={() => setPresetId(presetId === p.id ? null : p.id)}
              data-testid={`preset-${p.id}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={s.controlsRow}>
          <div style={s.aspectGroup}>
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                style={aspect === a.id ? s.aspectActive : s.aspectBtn}
                onClick={() => setAspect(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <ReferenceDrop reference={reference} onChange={setReference} />
        </div>

        {running ? (
          <button
            type="button"
            style={s.cancelBtn}
            onClick={() => gen.cancel()}
            data-testid="image-gen-cancel"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            style={canSubmit ? s.primaryBtn : s.primaryBtnDisabled}
            disabled={!canSubmit}
            onClick={onGenerate}
            data-testid="image-gen-submit"
          >
            Generate 4
          </button>
        )}

        {gen.error && <div style={s.errorRow} data-testid="image-gen-error">{gen.error}</div>}

        <ResultGrid
          variants={gen.variants}
          status={gen.status}
          modelLabel={gen.modelLabel}
          etaSeconds={gen.etaSeconds}
          onAdd={onAddToCanvas}
          onUseAsRef={onUseAsReference}
        />
      </div>
    </div>
  );
}

function ReferenceDrop({
  reference,
  onChange,
}: {
  reference: string | null;
  onChange: (b64: string | null) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <label
      style={hover ? s.refDropHover : s.refDrop}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setHover(false);
        const file = e.dataTransfer.files[0];
        if (!file?.type.startsWith("image/")) return;
        const b64 = await blobToBase64(file);
        onChange(b64);
      }}
    >
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const b64 = await blobToBase64(file);
          onChange(b64);
        }}
      />
      <span>{reference ? "Reference set" : "Drop reference (optional)"}</span>
      {reference && (
        <button type="button" style={s.refClear} onClick={(e) => { e.preventDefault(); onChange(null); }}>×</button>
      )}
    </label>
  );
}

function ResultGrid({
  variants,
  status,
  modelLabel,
  etaSeconds,
  onAdd,
  onUseAsRef,
}: {
  variants: Variant[];
  status: string;
  modelLabel: string | null;
  etaSeconds: number;
  onAdd: (url: string) => void;
  onUseAsRef: (url: string) => void;
}) {
  if (status === "idle" || variants.length === 0) {
    return <div style={s.hint}>Press Generate to render 4 variants.</div>;
  }
  return (
    <div>
      <div style={s.resultMeta}>
        {modelLabel ? `${modelLabel} · ~${etaSeconds}s` : "Queued…"}
      </div>
      <div style={s.grid}>
        {variants.map((v) => (
          <div key={v.index} style={s.cell} data-testid={`variant-${v.index}`}>
            {v.url ? (
              <>
                <img src={v.url} alt={`variant ${v.index + 1}`} style={s.img} />
                <div style={s.overlay}>
                  <button type="button" style={s.overlayBtn} onClick={() => onAdd(v.url!)}>
                    Add to canvas
                  </button>
                  <button type="button" style={s.overlayBtn} onClick={() => onUseAsRef(v.url!)}>
                    Use as reference
                  </button>
                </div>
              </>
            ) : (
              <div style={s.loadingCell}>
                <div style={s.scanLine} />
                <span style={s.loadingTxt}>
                  {v.error ? v.error : `Generating ${Math.round(v.progress * 100)}%`}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{s.keyframes}</style>
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
