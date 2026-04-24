import { create } from "zustand";
import { nanoid } from "nanoid";

/**
 * Toast system. Imperative `toast()` call pushes a message; ToastHost
 * renders + auto-dismisses. Observatory voice — callers own the copy;
 * the store never prepends "Oops" or similar banned words.
 */

export const MAX_MESSAGE_CHARS = 180;
export const DISMISS_MS = 4000;

export type ToastId = string;

export type Toast = {
  id: ToastId;
  message: string;
};

type ToastState = {
  toasts: Toast[];
};

export const useToastStore = create<ToastState>()(() => ({
  toasts: [],
}));

export function toast(message: string): ToastId {
  const clipped = message.slice(0, MAX_MESSAGE_CHARS);
  const id = nanoid();
  useToastStore.setState((s) => ({ toasts: [...s.toasts, { id, message: clipped }] }));
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), DISMISS_MS);
  }
  return id;
}

export function dismissToast(id: ToastId) {
  useToastStore.setState((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  }));
}

/** Testing hook. */
export function _resetToasts() {
  useToastStore.setState({ toasts: [] });
}
