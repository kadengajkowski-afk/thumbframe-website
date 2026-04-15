// src/editor/ai/ThumbFriendChat.jsx
// Floating iMessage-style chat bubble in the bottom-right of the editor.
// Silent by default — opens on click or proactive alert.
// Pro: full chat + canvas actions + all personalities.
// Free: teaser UI, no real API calls.

import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../engine/Store';
import useThumbFriend from './useThumbFriend';
import ThumbFriendAvatar from './ThumbFriendAvatar';
import ActionPreviewCard from './ActionPreviewCard';

const PERSONALITIES = [
  { id: 'hype_coach',              emoji: '🔥', label: 'Hype'   },
  { id: 'brutally_honest',         emoji: '💀', label: 'Honest' },
  { id: 'chill_creative_director', emoji: '😎', label: 'Chill'  },
  { id: 'data_nerd',               emoji: '📊', label: 'Data'   },
  { id: 'the_legend',              emoji: '🏆', label: 'Legend' },
];

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px',
      background: 'rgba(255,255,255,0.04)', borderRadius: '12px 12px 12px 4px',
      alignSelf: 'flex-start', marginBottom: 4,
    }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--text-4)',
            animation: `tf-dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Upgrade card (shown to free users) ────────────────────────────────────────
function UpgradeCard({ onUpgrade }) {
  return (
    <div style={{
      margin: '8px 0', padding: '12px 14px',
      background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.05))',
      border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>✨</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
        ThumbFriend Pro
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
        Unlimited messages, canvas edits,<br />all personalities &amp; conversation memory.
      </div>
      <button
        onClick={onUpgrade}
        style={{
          height: 30, padding: '0 16px', fontSize: 11, fontWeight: 700,
          background: '#f97316', border: 'none', borderRadius: 8,
          color: '#fff', cursor: 'pointer',
        }}
      >Upgrade to Pro</button>
    </div>
  );
}

// ── Single message bubble ──────────────────────────────────────────────────────
function MessageBubble({ msg, msgIdx, onApply, onSkip }) {
  const isUser = msg.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 6,
    }}>
      <div style={{
        maxWidth: '84%',
        padding: '8px 12px',
        background: isUser ? '#f97316' : 'rgba(255,255,255,0.05)',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        fontSize: 13, lineHeight: 1.55, color: isUser ? '#fff' : 'var(--text-1)',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>

      {/* Action preview card — only on assistant messages with actions */}
      {!isUser && msg.actions?.length > 0 && (
        <div style={{ width: '100%' }}>
          <ActionPreviewCard
            actions={msg.actions}
            onApply={(ai) => onApply(msgIdx, ai)}
            onSkip={(ai)  => onSkip(msgIdx, ai)}
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ThumbFriendChat({ user, supabaseSession, setPage }) {
  const thumbfriendEnabled = useEditorStore(s => s.thumbfriendEnabled);
  const personality        = useEditorStore(s => s.thumbfriendPersonality);

  const tf = useThumbFriend({ user, supabaseSession });

  const [inputVal,  setInputVal]  = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const textareaRef  = useRef(null);
  const messagesEndRef = useRef(null);
  const panelRef     = useRef(null);

  // Sync panelOpen with tf.isOpen so external opens (analyzeNow) work
  useEffect(() => { setPanelOpen(tf.isOpen); }, [tf.isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (panelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tf.messages, tf.isLoading, panelOpen]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [inputVal]);

  const handleToggle = useCallback(() => {
    if (panelOpen) { tf.close(); setPanelOpen(false); }
    else           { tf.open();  setPanelOpen(true);  }
  }, [panelOpen, tf]);

  const handleSend = useCallback(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || tf.isLoading) return;
    tf.sendMessage(trimmed);
    setInputVal('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [inputVal, tf]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleUpgrade = useCallback(() => {
    setPage?.('pricing');
    tf.close();
    setPanelOpen(false);
  }, [setPage, tf]);

  if (!thumbfriendEnabled) return null;

  const canSend = inputVal.trim().length > 0 && !tf.isLoading;
  const showEmpty = tf.messages.length === 0 && !tf.isLoading;

  return (
    <>
      {/* ── Keyframe animation for typing dots ──────────────────────────── */}
      <style>{`
        @keyframes tf-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes tf-panel-in {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>

      {/* ── Floating avatar bubble (closed state) ───────────────────────── */}
      {!panelOpen && (
        <div
          onClick={handleToggle}
          title="ThumbFriend AI"
          style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
            width: 44, height: 44, borderRadius: 12,
            background: '#18181b',
            border: '2px solid rgba(255,255,255,0.10)',
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'transform 120ms, box-shadow 120ms',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)'; }}
        >
          <ThumbFriendAvatar
            expression={tf.expression}
            size={44}
            hasAlert={tf.hasAlert}
            hasUnread={tf.unreadCount > 0}
          />
        </div>
      )}

      {/* ── Chat panel (open state) ──────────────────────────────────────── */}
      {panelOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
            width: 380, maxHeight: 520,
            background: '#18181b',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'Inter, -apple-system, sans-serif',
            animation: 'tf-panel-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          {/* ── Header (52px) ─────────────────────────────────────────── */}
          <div style={{
            height: 52, minHeight: 52, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <ThumbFriendAvatar expression={tf.expression} size={32} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
                ThumbFriend
              </div>
              <div style={{ fontSize: 10, color: tf.isLoading ? '#f97316' : '#22c55e', lineHeight: 1 }}>
                {tf.isLoading ? 'Thinking…' : 'Online'}
              </div>
            </div>

            {/* Pro badge */}
            {tf.isPro && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                color: '#f97316', background: 'rgba(249,115,22,0.12)',
                border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: 4, padding: '2px 5px',
              }}>PRO</span>
            )}

            {/* Free message count */}
            {!tf.isPro && (
              <span style={{ fontSize: 10, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
                Free plan
              </span>
            )}

            {/* Close */}
            <button
              onClick={handleToggle}
              style={{
                width: 26, height: 26, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-4)', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 100ms, color 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-4)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* ── Personality selector strip (Pro only) ──────────────────── */}
          {tf.isPro && (
            <div style={{
              display: 'flex', gap: 4, padding: '7px 12px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              flexShrink: 0,
            }}>
              {PERSONALITIES.map(p => {
                const active = personality === p.id;
                return (
                  <button
                    key={p.id}
                    title={p.id.replace(/_/g, ' ')}
                    onClick={() => tf.setPersonality(p.id)}
                    style={{
                      flex: 1, height: 26, fontSize: 11, fontWeight: active ? 700 : 500,
                      background: active ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(249,115,22,0.35)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 6, cursor: 'pointer',
                      color: active ? '#f97316' : 'var(--text-3)',
                      transition: 'all 100ms',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  >
                    {p.emoji}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Messages area ─────────────────────────────────────────── */}
          <div
            className="obs-scroll"
            style={{
              flex: 1, overflowY: 'auto', padding: '12px 12px 4px',
              display: 'flex', flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {/* Empty state */}
            {showEmpty && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '20px 16px', gap: 10,
              }}>
                <ThumbFriendAvatar expression="excited" size={52} />
                <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6 }}>
                  Hey! I can see your thumbnail.<br />
                  Ask me anything or say <span style={{ color: '#f97316', fontStyle: 'italic' }}>"what do you think?"</span>
                </div>
                {/* Free teaser */}
                {!tf.isPro && (
                  <UpgradeCard onUpgrade={handleUpgrade} />
                )}
              </div>
            )}

            {/* Message list */}
            {tf.messages.map((msg, idx) => (
              <React.Fragment key={idx}>
                {msg.isUpgradePrompt ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{
                      maxWidth: '84%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px 12px 12px 4px',
                      fontSize: 13, color: 'var(--text-3)',
                      marginBottom: 8,
                    }}>
                      {msg.content}
                    </div>
                    <UpgradeCard onUpgrade={handleUpgrade} />
                  </div>
                ) : (
                  <MessageBubble
                    msg={msg}
                    msgIdx={idx}
                    onApply={tf.applyAction}
                    onSkip={tf.skipAction}
                  />
                )}
              </React.Fragment>
            ))}

            {/* Typing indicator */}
            {tf.isLoading && <TypingDots />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input area ────────────────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            padding: '8px 12px 10px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'rgba(0,0,0,0.15)',
          }}>
            <textarea
              ref={textareaRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tf.isPro ? 'Ask ThumbFriend…' : 'Upgrade to Pro to chat…'}
              disabled={!tf.isPro || tf.isLoading}
              rows={1}
              style={{
                flex: 1, resize: 'none', minHeight: 34, maxHeight: 96,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10, color: 'var(--text-1)',
                fontSize: 13, padding: '7px 10px', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.45,
                opacity: !tf.isPro ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!canSend || !tf.isPro}
              title="Send (Enter)"
              style={{
                width: 34, height: 34, flexShrink: 0,
                borderRadius: 10, border: 'none',
                background: canSend && tf.isPro ? '#f97316' : 'rgba(255,255,255,0.08)',
                color: canSend && tf.isPro ? '#fff' : 'var(--text-4)',
                cursor: canSend && tf.isPro ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 150ms',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
