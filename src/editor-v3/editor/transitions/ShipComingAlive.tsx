import { useEffect, useRef, useState, type ReactNode } from "react";
import "./ship-alive.css";

/**
 * Ship-coming-alive transition. Wraps both the empty state and the
 * editor shell. Plays exactly once per tab (sessionStorage-gated). On
 * subsequent `hasEntered` flips — e.g. if we ever add a "leave project"
 * flow — the editor mounts instantly with no animation.
 */
type Props = {
  hasEntered: boolean;
  empty: ReactNode;
  editor: ReactNode;
};

const SESSION_KEY = "thumbframe:ship-alive:played";
const DURATION_MS = 1200;

type Phase = "empty" | "playing" | "done";

export function ShipComingAlive({ hasEntered, empty, editor }: Props) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(hasEntered));
  const prevEntered = useRef(hasEntered);

  // While phase === "playing" we are mid-animation: mark the gate
  // (idempotent) and schedule the flip to "done". Works whether we
  // landed in "playing" via initialPhase or via the hasEntered flip
  // below.
  useEffect(() => {
    if (phase !== "playing") return;
    markPlayed();
    const t = window.setTimeout(() => setPhase("done"), DURATION_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Empty → editor handoff. Only fires on the false → true edge.
  useEffect(() => {
    const wasEntered = prevEntered.current;
    prevEntered.current = hasEntered;
    if (!wasEntered && hasEntered) {
      setPhase(alreadyPlayed() ? "done" : "playing");
    }
  }, [hasEntered]);

  return (
    <>
      {(phase === "empty" || phase === "playing") && (
        <div
          className={phase === "playing" ? "ship-empty fading" : "ship-empty"}
          aria-hidden={phase === "playing"}
        >
          {empty}
        </div>
      )}
      {(phase === "playing" || phase === "done") && (
        <div
          className={
            phase === "playing" ? "ship-editor entering" : "ship-editor"
          }
        >
          {editor}
        </div>
      )}
    </>
  );
}

function initialPhase(hasEntered: boolean): Phase {
  if (!hasEntered) return "empty";
  // If the tab reloaded after the user already passed the empty state,
  // skip the animation — seeing it twice in 10 seconds feels fake.
  return alreadyPlayed() ? "done" : "playing";
}

function alreadyPlayed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPlayed() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Private mode or storage quota — fine, we just lose the gate.
  }
}
