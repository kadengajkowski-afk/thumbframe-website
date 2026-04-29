import { useCallback, useRef, useState } from "react";
import {
  streamImageGen,
  ImageGenError,
  applyPreset,
  detectIntent,
  type ImageGenIntent,
  type AspectRatio,
  type ImageGenEvent,
} from "@/lib/imageGenClient";
import { useUiStore } from "@/state/uiStore";

/** Day 37 — React hook wrapping streamImageGen for ImageGenPanel.
 *
 * State machine:
 *   idle → queued → generating(per-variant progress) → done | error
 *
 * Auto-injects pinned Brand Kit colors + fonts into the prompt before
 * sending so generated images match the channel's brand without the
 * user having to remember to type them. */

export type Variant = {
  index: number;
  url: string | null;
  progress: number;
  error: string | null;
};

export type GenerateOptions = {
  prompt: string;
  presetId?: string | null;
  intent?: ImageGenIntent;
  referenceImage?: string;
  aspectRatio?: AspectRatio;
  variants?: number;
};

export type UseImageGenState = {
  variants: Variant[];
  /** "queued" while we're waiting for fal to start, "generating" once
   * the first progress frame lands, "done" after all URLs arrive. */
  status: "idle" | "queued" | "generating" | "done" | "error";
  error: string | null;
  intent: ImageGenIntent | null;
  modelLabel: string | null;
  /** Server's wall-time hint for the loading UX. */
  etaSeconds: number;
  /** The exact prompt that was sent (after preset + brand-kit). Useful
   * for naming layers. */
  sentPrompt: string;
};

const VARIANT_COUNT_DEFAULT = 4;

export function useImageGen() {
  const [state, setState] = useState<UseImageGenState>(initialState());
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, status: "idle" }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState());
  }, []);

  const generate = useCallback(async (opts: GenerateOptions) => {
    const variants = opts.variants ?? VARIANT_COUNT_DEFAULT;
    const trimmed = opts.prompt.trim();
    if (trimmed.length < 3) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Compose the wire prompt: user prompt → preset suffix → brand kit.
    let wire = opts.presetId ? applyPreset(trimmed, opts.presetId) : trimmed;
    const pinnedKit = useUiStore.getState().pinnedBrandKit;
    if (pinnedKit) {
      const colors = pinnedKit.palette.slice(0, 5).join(", ");
      const fonts = pinnedKit.fonts.slice(0, 2).map((f) => f.name).join(", ");
      const brandBits: string[] = [];
      if (colors) brandBits.push(`brand colors ${colors}`);
      if (fonts) brandBits.push(`fonts ${fonts}`);
      if (brandBits.length > 0) wire = `${wire}, ${brandBits.join(", ")}`;
    }

    const intent: ImageGenIntent =
      opts.intent ?? detectIntent({
        prompt: wire,
        referenceImage: opts.referenceImage ?? null,
      });

    setState({
      variants: Array.from({ length: variants }, (_, i) => ({
        index: i, url: null, progress: 0, error: null,
      })),
      status: "queued",
      error: null,
      intent,
      modelLabel: null,
      etaSeconds: 0,
      sentPrompt: wire,
    });

    try {
      const stream = streamImageGen({
        prompt: wire,
        intent,
        variants,
        ...(opts.referenceImage ? { referenceImage: opts.referenceImage } : {}),
        ...(opts.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
        signal: controller.signal,
      });
      for await (const evt of stream) {
        applyEvent(setState, evt);
      }
      setState((s) => ({
        ...s,
        status: s.variants.some((v) => v.url) ? "done" : "error",
      }));
    } catch (err) {
      if (err instanceof ImageGenError && err.code === "ABORTED") {
        return; // silent on user cancel
      }
      const message = err instanceof Error ? err.message : "Generation failed";
      setState((s) => ({ ...s, status: "error", error: message }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  return { ...state, generate, cancel, reset };
}

function applyEvent(
  setState: (updater: (s: UseImageGenState) => UseImageGenState) => void,
  evt: ImageGenEvent,
) {
  setState((s) => {
    if (evt.type === "queued") {
      return {
        ...s,
        status: "queued",
        modelLabel: evt.model,
        etaSeconds: evt.eta,
        intent: evt.intent,
      };
    }
    if (evt.type === "progress") {
      const next = s.variants.map((v) =>
        v.index === evt.variant ? { ...v, progress: evt.fraction } : v,
      );
      return { ...s, status: "generating", variants: next };
    }
    if (evt.type === "variant") {
      const next = s.variants.map((v) =>
        v.index === evt.variant ? { ...v, url: evt.url, progress: 1 } : v,
      );
      return { ...s, status: "generating", variants: next };
    }
    if (evt.type === "done") {
      return { ...s, status: "done" };
    }
    if (evt.type === "error") {
      if (typeof evt.variant === "number") {
        const next = s.variants.map((v) =>
          v.index === evt.variant ? { ...v, error: evt.message } : v,
        );
        return { ...s, variants: next };
      }
      return { ...s, status: "error", error: evt.message };
    }
    return s;
  });
}

function initialState(): UseImageGenState {
  return {
    variants: [],
    status: "idle",
    error: null,
    intent: null,
    modelLabel: null,
    etaSeconds: 0,
    sentPrompt: "",
  };
}
