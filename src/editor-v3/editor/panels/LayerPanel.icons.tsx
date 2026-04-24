/** Icon SVGs used by LayerPanel row toggles. Kept in their own file
 * so LayerPanel.tsx stays under the 200-line component ceiling. */

export function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M1 7 C 3 3, 11 3, 13 7 C 11 11, 3 11, 1 7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="7" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M1 7 C 3 3, 11 3, 13 7 C 11 11, 3 11, 1 7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
      <line
        x1="2"
        y1="12"
        x2="12"
        y2="2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockClosedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="3" y="6" width="8" height="6" rx="1" fill="currentColor" />
      <path
        d="M4.5 6 V4.5 a2.5 2.5 0 0 1 5 0 V6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 4 H11 M5.5 4 V2.5 h3 V4 M4 4 L4.5 12 a1 1 0 0 0 1 1 h3 a1 1 0 0 0 1 -1 L10 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="8"
        height="6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M4.5 6 V4.5 a2.5 2.5 0 0 1 5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
    </svg>
  );
}
