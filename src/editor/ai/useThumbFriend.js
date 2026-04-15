// src/editor/ai/useThumbFriend.js
// React hook managing all ThumbFriend state.
// Pro users: real API calls with canvas image + actions.
// Free users: teaser only, zero real API calls (CLAUDE.md requirement).

import { useState, useCallback, useEffect, useRef } from 'react';
import useEditorStore from '../engine/Store';
import { checkProactiveAlerts } from './proactiveAlerts';

const RAILWAY_URL = (
  process.env.REACT_APP_API_URL ||
  'https://thumbframe-api-production.up.railway.app'
);

// ── Mock response for when Railway is unreachable ─────────────────────────────
// Demonstrates the full experience including action suggestions.
function buildMock(layers) {
  const firstImage = layers.find(l => l.type === 'image');
  return {
    message: "I can see your thumbnail! The composition looks solid — main subject is well-positioned. To push it further, try boosting brightness slightly and strengthening your text outline for mobile readability. What aspect would you like help with?",
    actions: firstImage ? [
      {
        type:        'adjust_brightness',
        target:      firstImage.id,
        target_name: firstImage.name,
        params:      { value: 15 },
        reason:      'Brightness is below optimal range (100–110). +15 will improve feed visibility in dark mode.',
      },
    ] : [],
    expression: 'excited',
  };
}

// ── Canvas capture ─────────────────────────────────────────────────────────────
// Returns raw base64 JPEG string (no data: prefix — Anthropic requirement).
function captureCanvas() {
  const pixiCanvas = document.querySelector('canvas');
  if (!pixiCanvas) return null;
  try {
    const off = document.createElement('canvas');
    off.width  = 320;
    off.height = 180;
    off.getContext('2d').drawImage(pixiCanvas, 0, 0, 320, 180);
    return off.toDataURL('image/jpeg', 0.6).split(',')[1];
  } catch {
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

  const layers      = useEditorStore(s => s.layers);
  const personality = useEditorStore(s => s.thumbfriendPersonality);

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

    const image      = captureCanvas();
    const canvasData = buildCanvasData(layers);
    // Take history snapshot *before* appending the new user message
    const history    = serializeHistory(messages);
    const token      = supabaseSession?.access_token;

    let response = null;

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
      response = buildMock(layers);
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
  }, [isLoading, isPro, layers, messages, personality, supabaseSession]);

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
