// src/editor/ai/useThumbFriend.js
// React hook managing all ThumbFriend state.
// Pro users: real API calls with canvas image + actions.
// Free users: teaser only, zero real API calls (CLAUDE.md requirement).

import { useState, useCallback, useEffect, useRef } from 'react';
import useEditorStore from '../engine/Store';
import { checkProactiveAlerts } from './proactiveAlerts';
import { captureCanvasForAnalysis } from './canvasAnalyzer';
import { calculateCTRScore } from './ctrScore';
import supabase from '../../supabaseClient';

const RAILWAY_URL = (
  process.env.REACT_APP_API_URL ||
  'https://thumbframe-api-production.up.railway.app'
);

// ── Mock response for when Railway is unreachable ─────────────────────────────
// Honest about offline state — does NOT pretend to analyze the canvas.
function buildMock() {
  const layers = useEditorStore.getState().layers.filter(l => l.visible !== false);
  const hasContent = layers.length > 0;
  return {
    message: hasContent
      ? `I can see your canvas but I'm running in offline mode right now — my AI brain isn't connected. Start the Railway server to get real analysis. In the meantime, I can see you have ${layers.length} layer(s) on the canvas.`
      : "Your canvas is empty! Add an image or some text first, then ask me what I think. I'm running in offline mode right now anyway — start the Railway server to connect my AI brain.",
    actions:    [],
    expression: 'neutral',
    remaining:  null,
  };
}

// ── Canvas capture ─────────────────────────────────────────────────────────────
// Returns raw base64 JPEG string (no data: prefix — Anthropic requirement).
function captureCanvas() {
  const pixiCanvas = window.__pixiApp?.canvas || document.querySelector('canvas');
  if (!pixiCanvas) return null;
  try {
    const off = document.createElement('canvas');
    off.width  = 320;
    off.height = 180;
    const ctx = off.getContext('2d');

    // Fill background first so JPEG has no transparent artifacts
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(0, 0, 320, 180);

    ctx.drawImage(pixiCanvas, 0, 0, 320, 180);

    // Debug: log center pixel to verify we got real content
    const px = ctx.getImageData(160, 90, 1, 1).data;
    console.log('[ThumbFriend] capture center pixel:', px[0], px[1], px[2], px[3]);

    return off.toDataURL('image/jpeg', 0.6).split(',')[1];
  } catch (e) {
    console.warn('[ThumbFriend] canvas capture failed:', e);
    return null;
  }
}

// ── Canvas metadata ────────────────────────────────────────────────────────────
function buildCanvasData(layers) {
  const images = layers.filter(l => l.type === 'image' && l.visible);
  const texts  = layers.filter(l => l.type === 'text'  && l.visible);
  return {
    brightness:   images.length
      ? Math.round(images.reduce((s, l) => s + (l.adjustments?.brightness ?? 0), 0) / images.length)
      : 0,
    layerCount:   layers.length,
    hasText:      texts.length > 0,
    hasFace:      false,
    textContent:  texts.map(l => l.textData?.content || '').filter(Boolean).join(' | '),
  };
}

// ── History serialiser ─────────────────────────────────────────────────────────
function serializeHistory(messages) {
  return messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export default function useThumbFriend({ user, supabaseSession }) {
  const [messages,        setMessages]        = useState([]);
  const [isLoading,       setIsLoading]       = useState(false);
  const [isOpen,          setIsOpen]          = useState(false);
  const [expression,      setExpression]      = useState('neutral');
  const [proactiveAlerts, setProactiveAlerts] = useState([]);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const [isOffline,       setIsOffline]       = useState(false);

  const layers           = useEditorStore(s => s.layers);
  const personality      = useEditorStore(s => s.thumbfriendPersonality);
  const youtubeChannelData = useEditorStore(s => s.youtubeChannelData);
  const nicheBenchmark     = useEditorStore(s => s.nicheBenchmark);

  const isPro = !!(user?.is_pro || user?.plan === 'pro');

  // Stable ref so interval doesn't capture stale layers
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // ── Proactive alert polling (every 10 s, only when idle) ─────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const { interactionMode } = useEditorStore.getState();
      if (interactionMode !== 'idle') return;
      const newAlerts = checkProactiveAlerts(layersRef.current);
      if (newAlerts.length === 0) return;
      setProactiveAlerts(prev => [...prev, ...newAlerts.map(a => ({ ...a, shown: false }))]);
      setUnreadCount(c => c + newAlerts.length);
    }, 10000);
    return () => clearInterval(id);
  }, []); // intentionally empty — alert polling runs for the lifetime of the hook

  // ── Open ──────────────────────────────────────────────────────────────────
  const open = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);

    // Inject any unshown proactive alerts as ThumbFriend messages
    setProactiveAlerts(prev => {
      const unshown = prev.filter(a => !a.shown);
      if (unshown.length > 0) {
        setMessages(msgs => [
          ...msgs,
          ...unshown.map(a => ({
            role:      'assistant',
            content:   a.message,
            expression:'concerned',
            isAlert:   true,
            actions:   [],
          })),
        ]);
      }
      return prev.map(a => ({ ...a, shown: true }));
    });
  }, []);

  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    if (isOpen) close(); else open();
  }, [isOpen, open, close]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    // Free users — show upgrade prompt, no API call (CLAUDE.md: PRO ONLY)
    if (!isPro) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text, actions: [] },
        {
          role:            'assistant',
          content:         'ThumbFriend is a Pro feature. Upgrade to unlock unlimited messages, canvas edits, all personalities, and conversation memory.',
          expression:      'neutral',
          isUpgradePrompt: true,
          actions:         [],
        },
      ]);
      return;
    }

    const userMsg = { role: 'user', content: text, actions: [] };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setExpression('thinking');

    const image        = captureCanvas();
    const canvasData   = buildCanvasData(layers);
    // Take history snapshot *before* appending the new user message
    const history      = serializeHistory(messages);

    // Fetch token fresh at call time — supabaseSession prop is unreliable
    // (NewEditor passes null). Try localStorage first (fastest), then live session.
    let token = null;
    try {
      const lsKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
      if (lsKey) {
        const stored = JSON.parse(localStorage.getItem(lsKey));
        token = stored?.access_token || stored?.data?.session?.access_token || null;
      }
    } catch { /* ignore */ }
    if (!token) {
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      } catch { /* ignore */ }
    }
    console.log('[ThumbFriend] token:', token ? 'present' : 'MISSING');

    // CTR score — run analysis + scoring, attach to payload so ThumbFriend
    // can reference the actual score in its response.
    let ctrScore = null;
    try {
      const canvasMetrics = captureCanvasForAnalysis(layers);
      ctrScore = calculateCTRScore(canvasMetrics, youtubeChannelData, nicheBenchmark);
    } catch { /* non-fatal */ }

    let response = null;
    let isOffline = false; // eslint-disable-line no-unused-vars

    try {
      const res = await fetch(`${RAILWAY_URL}/api/thumbfriend/chat`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message:             text,
          image,
          canvasData,
          ctrScore,
          conversationHistory: history,
          personality,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) response = await res.json();
    } catch {
      // Fall through to mock
    }

    if (!response) {
      // isOffline local var unused — state setter is what matters
      setIsOffline(true);
      response = buildMock();
    } else {
      setIsOffline(false);
    }

    const assistantMsg = {
      role:       'assistant',
      content:    response.message || 'Something went wrong. Try again.',
      expression: response.expression || 'neutral',
      actions:    (response.actions || []).map(a => ({ ...a, applied: false, skipped: false })),
    };

    setMessages(prev => [...prev, assistantMsg]);
    setExpression(response.expression || 'neutral');
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isPro, layers, messages, personality, youtubeChannelData, nicheBenchmark]);

  // ── Apply action (msgIdx, actionIdx inside that message) ─────────────────
  const applyAction = useCallback((msgIdx, actionIdx) => {
    setMessages(prev => {
      const msg = prev[msgIdx];
      if (!msg?.actions?.[actionIdx]) return prev;
      const action = msg.actions[actionIdx];
      if (action.applied || action.skipped) return prev;

      useEditorStore.getState().executeThumbFriendAction(action);

      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: {
          message: `Applied: ${(action.reason || action.type).slice(0, 60)}`,
          type:    'success',
        },
      }));

      return prev.map((m, mi) =>
        mi !== msgIdx ? m : {
          ...m,
          actions: m.actions.map((a, ai) =>
            ai === actionIdx ? { ...a, applied: true } : a
          ),
        }
      );
    });
  }, []);

  // ── Skip action ───────────────────────────────────────────────────────────
  const skipAction = useCallback((msgIdx, actionIdx) => {
    setMessages(prev =>
      prev.map((m, mi) =>
        mi !== msgIdx ? m : {
          ...m,
          actions: m.actions.map((a, ai) =>
            ai === actionIdx ? { ...a, skipped: true } : a
          ),
        }
      )
    );
  }, []);

  // ── Dismiss proactive alert ───────────────────────────────────────────────
  const dismissAlert = useCallback((type) => {
    setProactiveAlerts(prev => prev.filter(a => a.type !== type));
  }, []);

  // ── Force analysis ────────────────────────────────────────────────────────
  const analyzeNow = useCallback(() => {
    if (!isOpen) open();
    sendMessage('What do you think of my thumbnail?');
  }, [isOpen, open, sendMessage]);

  // ── Change personality (Pro only, clears conversation) ───────────────────
  const setPersonality = useCallback((p) => {
    useEditorStore.getState().setThumbfriendPersonality(p);
    setMessages([]);
    const NAMES = {
      hype_coach:              'Hype Coach',
      brutally_honest:         'Brutally Honest',
      chill_creative_director: 'Chill Creative Director',
      data_nerd:               'Data Nerd',
      the_legend:              'The Legend',
    };
    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: `ThumbFriend is now ${NAMES[p] || p}` },
    }));
  }, []);

  const hasAlert = proactiveAlerts.some(a => !a.shown);

  return {
    messages,
    isLoading,
    isOpen,
    isOffline,
    expression,
    proactiveAlerts,
    unreadCount,
    hasAlert,
    isPro,
    personality,
    open,
    close,
    toggle,
    sendMessage,
    applyAction,
    skipAction,
    dismissAlert,
    analyzeNow,
    setPersonality,
  };
}
