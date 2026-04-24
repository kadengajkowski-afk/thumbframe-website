import { useToastStore } from "./toastStore";
import "./toast.css";

/**
 * ToastHost renders the current toast rack. Mount once at App root.
 * Visuals are CSS-driven; store owns lifecycle (auto-dismiss + order).
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      className="toast-rack"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}
