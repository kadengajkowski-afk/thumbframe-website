import { useCallback, useRef, useState } from "react";
import { fetchBrandKit, type BrandKit, type BrandKitError } from "@/lib/brandKit";

/** Day 31 — Brand Kit hook. Owns the request lifecycle for a single panel
 * mount: idle → loading → (success | error). Stale-response guard via a
 * monotonic request id so a fast retype doesn't paint the previous result
 * on top of the newer one. */

export type BrandKitState =
  | { status: "idle" }
  | { status: "loading"; input: string }
  | { status: "success"; kit: BrandKit }
  | { status: "error"; error: BrandKitError };

export function useBrandKit() {
  const [state, setState] = useState<BrandKitState>({ status: "idle" });
  const requestIdRef = useRef(0);

  const extract = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setState({
        status: "error",
        error: { code: "BAD_INPUT", message: "Paste a YouTube channel URL or @handle" },
      });
      return;
    }
    const reqId = ++requestIdRef.current;
    setState({ status: "loading", input: trimmed });
    try {
      const kit = await fetchBrandKit(trimmed);
      if (reqId !== requestIdRef.current) return;
      setState({ status: "success", kit });
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const error = err as BrandKitError;
      setState({
        status: "error",
        error: {
          code: error.code ?? "UPSTREAM_ERROR",
          message: error.message ?? "Couldn't reach the brand kit service",
        },
      });
    }
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, extract, reset };
}
