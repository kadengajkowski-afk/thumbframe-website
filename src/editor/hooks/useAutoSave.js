// src/editor/hooks/useAutoSave.js
//
// CRITICAL: this hook is the cloud-save path for NewEditor. Prior to its
// introduction, NewEditor users had no persistence whatsoever — every
// reload was a fresh blank canvas. The legacy Editor.js had its own save
// path via createSaveEngine + a separate /designs/save fetch; that path
// was never wired to NewEditor.
//
// Responsibilities:
//   • Subscribe to store history — any forward commit schedules a save
//   • 3 s debounce with save lock + pending flag (never overlaps; always
//     runs a follow-up save if something arrived during an in-flight save)
//   • 30 s periodic safety save if state is still 'unsaved'
//   • POST /designs/save to the Railway API with the current snapshot
//     (layers + projectName) + a JPEG thumbnail generated from the
//     PixiJS canvas via Renderer.exportToDataURL
//   • Load on mount if ?project=<id> is in the URL — GET /designs/load
//     and hydrate the Zustand store
//   • Mirror the returned design ID into the URL so reload stays on the
//     same project
//   • Track online/offline; set status='error' while offline, retry on
//     reconnect
//   • beforeunload guard: if there are unsaved changes, show the browser's
//     native confirm dialog so the user isn't silently losing work
//   • Expose saveImmediate() so explicit triggers (Cmd+S, file menu, AI
//     completion, image upload) can bypass the debounce

import { useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../engine/Store';
import supabase from '../../supabaseClient';

const API_URL = (process.env.REACT_APP_API_URL
  || 'https://thumbframe-api-production.up.railway.app'
).replace(/\/$/, '');

const DEBOUNCE_MS = 3000;
const PERIODIC_MS = 30_000;

// Strip non-serialisable / transient fields before sending over the wire.
// Matches Store._pushHistory which strips the same fields for undo snapshots.
function cleanLayersForWire(layers) {
  return layers.map(({ texture, _preEditContent, ...rest }) => rest);
}

export default function useAutoSave({ platform = 'youtube' } = {}) {
  // Project ID persisted across renders; initialised from URL so users
  // who land on /editor?project=<id> resume the right document.
  const designIdRef = useRef(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('project')
      : null,
  );

  const debounceTimerRef = useRef(null);
  const periodicTimerRef = useRef(null);
  const savingRef        = useRef(false);
  const pendingRef       = useRef(false);
  const onlineRef        = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const loadingRef       = useRef(false);

  // Tracks the last committed history index so we only react to forward
  // commits (new edits) — not undo/redo navigation, which mutates layers
  // without pushing new history.
  const lastHistoryIdxRef = useRef(useEditorStore.getState().historyIndex);

  const setSaveStatus = useEditorStore(s => s.setSaveStatus);

  // ── Core save — POST /designs/save ─────────────────────────────────────
  const doSave = useCallback(async () => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }

    const st = useEditorStore.getState();

    // Don't save a fresh empty canvas — only save once the user has
    // actually created something, OR once an existing project is loaded.
    if (!designIdRef.current && (!st.layers || st.layers.length === 0)) {
      setSaveStatus('saved');
      return;
    }

    if (!onlineRef.current) {
      setSaveStatus('error');
      return;
    }

    savingRef.current = true;
    setSaveStatus('saving');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        // Guest mode — nothing to save remotely. Keep indicator neutral.
        setSaveStatus('saved');
        return;
      }

      // Thumbnail is nice-to-have; don't fail the save if it errors.
      let thumbnail = null;
      try {
        thumbnail = window.__renderer?.exportToDataURL?.('image/jpeg', 0.7) || null;
      } catch (err) {
        console.warn('[autoSave] thumbnail generation failed:', err?.message || err);
      }

      const cleanLayers = cleanLayersForWire(st.layers);

      const res = await fetch(`${API_URL}/designs/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: designIdRef.current || undefined,
          name: st.projectName || 'Untitled',
          platform,
          user_email: session.user.email,
          user_id: session.user.id,
          json_data: {
            name: st.projectName || 'Untitled',
            platform,
            layers: cleanLayers,
          },
          thumbnail,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const payload = await res.json().catch(() => ({}));
      const returnedId =
        payload?.data?.id ||
        payload?.id       ||
        payload?.design?.id ||
        null;

      // Mirror the ID into the URL so reloads resume this project.
      if (returnedId && returnedId !== designIdRef.current) {
        designIdRef.current = returnedId;
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('project') !== String(returnedId)) {
            url.searchParams.set('project', String(returnedId));
            window.history.replaceState(null, '', url.toString());
          }
        } catch {
          /* URL API failure is non-fatal */
        }
      }

      setSaveStatus('saved');
    } catch (err) {
      console.error('[autoSave] save failed:', err);
      setSaveStatus('error');
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        // Fire a follow-up save to capture anything that arrived during
        // the in-flight request. Using setTimeout to escape the current
        // microtask so React state updates can settle first.
        setTimeout(() => { doSave(); }, 0);
      }
    }
  }, [platform, setSaveStatus]);

  // ── Schedule a debounced save ──────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (loadingRef.current) return;  // suppress during project load
    setSaveStatus('unsaved');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      doSave();
    }, DEBOUNCE_MS);
  }, [doSave, setSaveStatus]);

  // ── Immediate save (bypass debounce) ───────────────────────────────────
  const saveImmediate = useCallback(() => {
    if (loadingRef.current) return Promise.resolve();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return doSave();
  }, [doSave]);

  // ── React to store history changes ─────────────────────────────────────
  // Any forward historyIndex move means a new commit happened (add layer,
  // move, resize, text edit commit, paint commit, adjust, etc.). Undo/redo
  // don't change history.length or push new entries, so they don't match.
  // Project name changes also trigger — they don't go through history but
  // are user-visible edits.
  useEffect(() => {
    let lastName = useEditorStore.getState().projectName;
    const unsub = useEditorStore.subscribe((state) => {
      if (state.historyIndex > lastHistoryIdxRef.current) {
        scheduleSave();
      }
      lastHistoryIdxRef.current = state.historyIndex;
      if (state.projectName !== lastName) {
        lastName = state.projectName;
        scheduleSave();
      }
    });
    return unsub;
  }, [scheduleSave]);

  // ── Periodic safety save ──────────────────────────────────────────────
  useEffect(() => {
    periodicTimerRef.current = setInterval(() => {
      const status = useEditorStore.getState().saveStatus;
      if (status === 'unsaved' || status === 'error') doSave();
    }, PERIODIC_MS);
    return () => {
      if (periodicTimerRef.current) clearInterval(periodicTimerRef.current);
    };
  }, [doSave]);

  // ── Load on mount when ?project=<id> is set ───────────────────────────
  useEffect(() => {
    const id = designIdRef.current;
    if (!id) return;

    loadingRef.current = true;
    setSaveStatus('saving'); // show status during load

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(
          `${API_URL}/designs/load?id=${encodeURIComponent(id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          console.warn('[autoSave] load failed:', res.status);
          return;
        }

        const payload = await res.json().catch(() => ({}));
        const design  = payload?.data || payload?.design || payload;
        if (!design) return;

        const jsonData = design.json_data || {};
        const layers   = jsonData.layers || design.layers || [];
        const name     = jsonData.name   || design.name   || 'Untitled';

        // Hydrate store. Use setState directly (not actions) so we can
        // atomically replace layers + reset history without triggering
        // save via the subscribe handler.
        useEditorStore.setState({
          projectName: name,
          layers,
          selectedLayerIds: [],
          history: [],
          historyIndex: -1,
          isEditingText: false,
          editingLayerId: null,
        });
        // Push a single seed history entry so the first user edit has
        // something to undo back to.
        useEditorStore.getState().commitChange('Load project');
        setSaveStatus('saved');
      } catch (err) {
        console.error('[autoSave] load error:', err);
        setSaveStatus('error');
      } finally {
        // Sync our tracking ref so the subscribe handler doesn't fire a
        // save for the load-induced history commit.
        lastHistoryIdxRef.current = useEditorStore.getState().historyIndex;
        loadingRef.current = false;
      }
    })();
  // Run exactly once on mount — this is intentional; relying on
  // URLSearchParams captured above. Project ID changes are mirrored into
  // the URL via replaceState; re-running this effect would reload the
  // document mid-session, which is not what we want.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Online/offline handling ───────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      onlineRef.current = true;
      // Immediately try to flush any pending changes now that we're back.
      if (useEditorStore.getState().saveStatus === 'error') {
        doSave();
      }
    };
    const onOffline = () => {
      onlineRef.current = false;
      setSaveStatus('error');
    };
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [doSave, setSaveStatus]);

  // ── Beforeunload: warn if user has unsaved work ──────────────────────
  useEffect(() => {
    const onBeforeUnload = (e) => {
      const status = useEditorStore.getState().saveStatus;
      // 'saving' also gets a warning — an in-flight request will be killed
      // by the browser on navigation.
      if (status === 'unsaved' || status === 'saving' || status === 'error') {
        e.preventDefault();
        // Legacy Chrome/Edge requires a return value; modern browsers
        // ignore it and show their own text.
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { saveImmediate, scheduleSave };
}
