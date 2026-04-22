// src/editor-v2/flag.js
// -----------------------------------------------------------------------------
// Purpose:  Editor-version feature flag. Reads `editor_version` from the
//           authenticated user's Supabase profile. Dev-mode URL override
//           lets `?editor=v2` force the v2 editor regardless of profile.
// Exports:  useEditorVersion (React hook), readUrlOverride
// Depends:  ../context/AuthContext (user object carries the flag)
//
// Usage in App.js:
//   const version = useEditorVersion();
//   if (page === 'editor' && version === 'v2') return <EditorV2 />;
//   if (page === 'editor')                     return <NewEditor />;
// -----------------------------------------------------------------------------

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/** @typedef {'v1'|'v2'} EditorVersion */

/** Returns 'v1' or 'v2' if the URL has ?editor=..., else null. */
export function readUrlOverride() {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('editor');
  return value === 'v1' || value === 'v2' ? value : null;
}

/**
 * Hook — returns the editor version for the current user.
 *
 * Order of precedence:
 *   1. URL query param override (?editor=v1 | ?editor=v2)
 *   2. Supabase profile `editor_version` field
 *   3. Default 'v1'
 *
 * @returns {EditorVersion}
 */
export function useEditorVersion() {
  const { user } = useAuth();
  const override = useMemo(() => readUrlOverride(), []);
  return useMemo(() => {
    if (override) return override;
    return user?.editor_version === 'v2' ? 'v2' : 'v1';
  }, [override, user?.editor_version]);
}
