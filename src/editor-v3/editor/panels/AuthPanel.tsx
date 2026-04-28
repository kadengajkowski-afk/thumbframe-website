import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "@/toasts/toastStore";
import * as s from "./AuthPanel.styles";

/** Day 20 — sign-in modal. Two paths: magic link (email) +
 * Google OAuth. The actual auth state-change subscription lives
 * in App.tsx (mounts once on boot); this panel just kicks off the
 * sign-in flow and closes on success. */

type Mode = "idle" | "sending" | "sent" | "error";

export function AuthPanel() {
  const open = useUiStore((s) => s.authPanelOpen);
  const close = useUiStore((s) => s.setAuthPanelOpen);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
    setMode("idle");
    setErrorMsg("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const configured = isSupabaseConfigured();

  async function sendMagicLink() {
    if (!supabase) { toast("Supabase not configured"); return; }
    if (!email.trim()) return;
    setMode("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setMode("error");
      setErrorMsg(error.message);
      return;
    }
    setMode("sent");
  }

  async function signInWithGoogle() {
    if (!supabase) { toast("Supabase not configured"); return; }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setErrorMsg(error.message);
      setMode("error");
    }
  }

  return (
    <div role="dialog" aria-label="Sign in" style={s.backdrop} onClick={() => close(false)} data-testid="auth-panel">
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <header style={s.header}>Sign in</header>
        <p style={s.subtitle}>
          Sign in to save your work to the cloud and access it from any device.
        </p>

        {!configured && (
          <div style={s.warnBox}>
            Supabase isn't configured (missing VITE_SUPABASE_URL +
            VITE_SUPABASE_ANON_KEY). Sign-in won't work until those env
            vars are set. Your edits still save locally as a draft.
          </div>
        )}

        <button
          type="button"
          style={s.oauthBtn}
          onClick={signInWithGoogle}
          disabled={!configured}
          data-testid="auth-google"
        >
          <span style={s.googleMark}>G</span>
          Continue with Google
        </button>

        <div style={s.divider}>or</div>

        {mode === "sent" ? (
          <div style={s.successBox} data-testid="auth-sent">
            Check your email — we sent a magic link to <strong>{email}</strong>.
          </div>
        ) : (
          <>
            <label style={s.label} htmlFor="auth-email">Email</label>
            <input
              ref={inputRef}
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void sendMagicLink(); }}
              placeholder="you@example.com"
              style={s.input}
              disabled={!configured || mode === "sending"}
              data-testid="auth-email"
            />
            <button
              type="button"
              style={s.primaryBtn}
              onClick={sendMagicLink}
              disabled={!configured || mode === "sending" || !email.trim()}
              data-testid="auth-send"
            >
              {mode === "sending" ? "Sending…" : "Send link"}
            </button>
          </>
        )}

        {mode === "error" && errorMsg && (
          <div style={s.errorBox}>{errorMsg}</div>
        )}

        <button type="button" style={s.cancelBtn} onClick={() => close(false)}>
          {mode === "sent" ? "Done" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
