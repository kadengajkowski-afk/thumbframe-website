import { useEffect, useState, type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";

/** Day 55 — Help & support panel.
 *
 * Sections:
 *   - How-to (5 quick guides, concise prose)
 *   - Keyboard shortcuts → opens the Day 53 ShortcutsPanel
 *   - Get help → email + Discord links
 *   - Send feedback / report a bug → POSTs /api/feedback
 *
 * Trigger: Cmd+K → "Help" OR the ? icon in TopBar (Day 55) OR
 * direct via uiStore.helpPanelOpen. Closes on Esc / scrim click.
 *
 * Stays under the 200-line component ceiling by keeping the form
 * shape simple (one textarea + a type selector + an optional email).
 *
 * Mailto links are the cheap fallback for the support@ + Discord
 * paths; if Cloudflare Email Routing isn't set up yet, the link
 * still opens the user's mail client.
 */

const SUPPORT_EMAIL = "support@thumbframe.com";
const TRUST_EMAIL = "trust@thumbframe.com";
const DISCORD_URL = "https://discord.gg/thumbframe";
const FEEDBACK_ENDPOINT = (import.meta.env.VITE_API_URL || "https://thumbframe-api-production.up.railway.app").replace(/\/$/, "") + "/api/feedback";

type FeedbackType = "feedback" | "bug" | "feature";

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function HelpPanel() {
  const open = useUiStore((s) => s.helpPanelOpen);
  const setOpen = useUiStore((s) => s.setHelpPanelOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsPanelOpen);
  const user = useUiStore((s) => s.user);

  const [type, setType] = useState<FeedbackType>("feedback");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open && user?.email && !email) setEmail(user.email);
  }, [open, user, email]);

  if (!open) return null;

  async function submit() {
    if (!message.trim() || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          email: email.trim() || undefined,
          context: {
            user_id: user?.id,
            url: window.location.href,
            ua: navigator.userAgent.slice(0, 200),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setState({ kind: "ok" });
      setMessage("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ kind: "error", message });
    }
  }

  return (
    <div
      style={scrim}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      role="presentation"
    >
      <div style={card} role="dialog" aria-label="Help" aria-modal="true" data-testid="help-panel">
        <header style={header}>
          <h2 style={heading}>Help &amp; support</h2>
          <button type="button" style={closeBtn} onClick={() => setOpen(false)} aria-label="Close help">×</button>
        </header>
        <div style={scroller}>
          <Section title="Quick guides">
            <ul style={list}>
              <li><strong>Upload an image</strong> — Cmd+I, drag a file onto the canvas, or paste from your clipboard.</li>
              <li><strong>Use ThumbFriend</strong> — Cmd+/ opens the chat. Pick a crew member at the top to change voice.</li>
              <li><strong>Generate an image</strong> — Cmd+G, write what you want, pick a variant.</li>
              <li><strong>Brand Kit</strong> — Cmd+B, paste a YouTube channel URL, pin colors and fonts to the picker.</li>
              <li><strong>Ship it</strong> — Cmd+E to export. Default is PNG @ 1280×720.</li>
            </ul>
          </Section>
          <Section title="Keyboard shortcuts">
            <button
              type="button"
              style={inlineCta}
              onClick={() => { setOpen(false); setShortcutsOpen(true); }}
              data-testid="help-open-shortcuts"
            >
              Open shortcuts reference (⌘?)
            </button>
          </Section>
          <Section title="Get help">
            <p style={para}>Email <a href={`mailto:${SUPPORT_EMAIL}`} style={inlineLink}>{SUPPORT_EMAIL}</a> or join the <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" style={inlineLink}>Discord</a>.</p>
            <p style={paraMuted}>For abuse, security, or trust &amp; safety reports: <a href={`mailto:${TRUST_EMAIL}`} style={inlineLink}>{TRUST_EMAIL}</a>.</p>
          </Section>
          <Section title="Send feedback or report a bug">
            <div style={form}>
              <select value={type} onChange={(e) => setType(e.target.value as FeedbackType)} style={input} data-testid="help-type">
                <option value="feedback">Feedback</option>
                <option value="bug">Bug report</option>
                <option value="feature">Feature request</option>
              </select>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional — reply-to)" style={input} data-testid="help-email" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's on your mind?" rows={5} style={textarea} data-testid="help-message" />
              <div style={formFoot}>
                <button type="button" disabled={!message.trim() || state.kind === "sending"} style={!message.trim() || state.kind === "sending" ? sendBtnDisabled : sendBtn} onClick={submit} data-testid="help-send">
                  {state.kind === "sending" ? "Sending…" : "Send"}
                </button>
                {state.kind === "ok" && <span style={okMsg} data-testid="help-ok">Thanks — we got it.</span>}
                {state.kind === "error" && <span style={errMsg} data-testid="help-err">Couldn't send: {state.message}</span>}
              </div>
            </div>
          </Section>
          <Section title="Legal">
            <p style={paraMuted}><a href="/dmca" style={inlineLink}>DMCA takedown</a> · <a href="/terms" style={inlineLink}>Terms</a> · <a href="/privacy" style={inlineLink}>Privacy</a></p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={section} aria-label={title}>
      <h3 style={sectionHeading}>{title}</h3>
      {children}
    </section>
  );
}

const scrim: CSSProperties = { position: "fixed", inset: 0, background: "rgba(5,5,16,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 };
const card: CSSProperties = { width: "min(540px, 90vw)", maxHeight: "min(640px, 86vh)", background: "var(--bg-space-1)", border: "1px solid var(--border-ghost)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" };
const header: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border-ghost)" };
const heading: CSSProperties = { margin: 0, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 500 };
const closeBtn: CSSProperties = { width: 24, height: 24, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer", borderRadius: 4 };
const scroller: CSSProperties = { padding: "12px 18px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 };
const section: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const sectionHeading: CSSProperties = { margin: "8px 0 2px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-cream)", fontWeight: 500 };
const list: CSSProperties = { margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: 4 };
const para: CSSProperties = { margin: 0, fontSize: 13, color: "var(--text-primary)" };
const paraMuted: CSSProperties = { margin: 0, fontSize: 12, color: "var(--text-secondary)" };
const inlineLink: CSSProperties = { color: "var(--accent-orange)", textDecoration: "none" };
const inlineCta: CSSProperties = { background: "transparent", border: "1px solid var(--border-ghost-hover)", color: "var(--text-primary)", padding: "6px 12px", borderRadius: 5, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" };
const form: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const input: CSSProperties = { background: "var(--bg-space-0)", border: "1px solid var(--border-ghost)", borderRadius: 4, padding: "6px 10px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" };
const textarea: CSSProperties = { ...input, resize: "vertical", minHeight: 80 };
const formFoot: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const sendBtn: CSSProperties = { background: "var(--accent-orange)", color: "var(--bg-space-0)", border: "none", borderRadius: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const sendBtnDisabled: CSSProperties = { ...sendBtn, opacity: 0.4, cursor: "not-allowed" };
const okMsg: CSSProperties = { fontSize: 12, color: "var(--accent-cream)" };
const errMsg: CSSProperties = { fontSize: 12, color: "var(--accent-orange)" };
