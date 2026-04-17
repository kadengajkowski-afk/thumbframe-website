// src/editor/components/ChannelDashboard.jsx
// Full-screen modal for connecting / viewing a YouTube channel.
// States: loading | not_configured | not_connected | connected | error

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSubscribers(n) {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subscribers`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K subscribers`;
  return `${n} subscribers`;
}

function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message, type } }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 12 }}>
      <div style={{
        width:  36,
        height: 36,
        border: '3px solid var(--bg-5)',
        borderTopColor: 'var(--accent)',
        borderRadius:   '50%',
        animation:      'yt-spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background:   'var(--bg-4)',
      border:       '1px solid var(--border-1)',
      borderRadius: 'var(--radius-md)',
      padding:      '10px 14px',
      textAlign:    'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChannelDashboard({ user, onClose }) {
  const [status,     setStatus]     = useState('loading'); // 'loading' | 'connected' | 'not_connected' | 'not_configured' | 'error'
  const [channel,    setChannel]    = useState(null);
  const [videos,     setVideos]     = useState([]);
  const [connecting, setConnecting] = useState(false);

  // ── Fetch channel status on mount ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const res = await apiFetch('/api/youtube/status');

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.configured === false) {
          setStatus('not_configured');
          return;
        }

        if (data.connected) {
          setStatus('connected');
          setChannel(data.channel || null);
          // Fetch recent videos
          fetchVideos();
        } else {
          setStatus('not_connected');
        }
      } catch (err) {
        console.error('[ChannelDashboard] status fetch error:', err);
        if (!cancelled) setStatus('error');
      }
    }

    loadStatus();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchVideos() {
    try {
      const res = await apiFetch('/api/youtube/videos');
      if (!res.ok) return;
      const data = await res.json();
      setVideos(data.videos || []);
    } catch {
      // Videos are optional — fail silently
    }
  }

  // ── Escape key ────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !connecting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connecting, onClose]);

  // ── Connect flow ─────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (status === 'not_configured') {
      toast(
        'YouTube integration requires configuration. Add YOUTUBE_CLIENT_ID to Railway environment variables.',
        'info'
      );
      return;
    }

    setConnecting(true);
    try {
      const res = await apiFetch('/api/youtube/auth-url');

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
        // Don't reset connecting — page will navigate away
      } else {
        throw new Error('No authUrl in response');
      }
    } catch (err) {
      console.error('[ChannelDashboard] connect error:', err);
      toast('Could not start YouTube connection. Please try again.', 'error');
      setConnecting(false);
    }
  };

  // ── Disconnect flow ───────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    try {
      await apiFetch('/api/youtube/disconnect', { method: 'POST' });
    } catch {
      // Ignore network errors — clear state anyway
    }
    setStatus('not_connected');
    setChannel(null);
    setVideos([]);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderBody() {
    switch (status) {
      case 'loading':
        return <Spinner />;

      case 'not_configured':
        return (
          <div style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
              YouTube Integration Not Configured
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
              Add these environment variables to your<br />
              Railway deployment to enable YouTube analytics:
            </div>
            <div style={{
              background:   'var(--bg-4)',
              border:       '1px solid var(--border-1)',
              borderRadius: 'var(--radius-md)',
              padding:      '12px 16px',
              textAlign:    'left',
              marginBottom: 24,
              display:      'inline-block',
              minWidth:     260,
            }}>
              {['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI'].map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: 'var(--accent)', fontSize: 11 }}>•</span>
                  <code style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>
                    {v}
                  </code>
                </div>
              ))}
            </div>
            <div>
              <button onClick={onClose} style={btnStyle('secondary')}>
                Dismiss
              </button>
            </div>
          </div>
        );

      case 'not_connected':
        return (
          <div style={{ textAlign: 'center', padding: '32px 24px' }}>
            {/* YouTube icon */}
            <div style={{ marginBottom: 18 }}>
              <svg width={52} height={36} viewBox="0 0 52 36" fill="none">
                <rect width={52} height={36} rx={8} fill="#FF0000" />
                <polygon points="21,10 21,26 36,18" fill="white" />
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12 }}>
              Connect Your YouTube Channel
            </div>
            <div style={{ textAlign: 'left', marginBottom: 28, display: 'inline-block' }}>
              {[
                'See your real CTR data for each video',
                'CTR Score uses your actual channel benchmark',
                'ThumbFriend gives personalized advice',
              ].map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  <span style={{ color: '#22c55e', marginTop: 2, flexShrink: 0 }}>✓</span>
                  {line}
                </div>
              ))}
            </div>
            <div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={btnStyle('primary', connecting)}
              >
                {connecting ? 'Redirecting…' : 'Connect YouTube →'}
              </button>
            </div>
          </div>
        );

      case 'connected':
        return (
          <div style={{ padding: '0 4px' }}>
            {/* Channel header */}
            {channel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                {channel.thumbnail && (
                  <img
                    src={channel.thumbnail}
                    alt={channel.name}
                    width={52}
                    height={52}
                    style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover', border: '2px solid var(--border-1)' }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {channel.name || 'Your Channel'}
                  </div>
                  {channel.subscriberCount != null && (
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                      {formatSubscribers(channel.subscriberCount)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CTR stat */}
            {channel?.avgCtr != null && (
              <div style={{ marginBottom: 20 }}>
                <StatCard label="Channel Avg CTR" value={`${channel.avgCtr.toFixed(1)}%`} />
              </div>
            )}

            {/* Recent videos */}
            {videos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <SectionTitle>Recent Videos</SectionTitle>
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap:                 8,
                }}>
                  {videos.slice(0, 9).map((video, i) => (
                    <div key={video.id || i} style={{
                      background:   'var(--bg-4)',
                      border:       '1px solid var(--border-1)',
                      borderRadius: 'var(--radius-md)',
                      overflow:     'hidden',
                    }}>
                      {/* 16:9 thumbnail */}
                      <div style={{ position: 'relative', paddingBottom: '56.25%', background: 'var(--bg-5)' }}>
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 18 }}>▶</span>
                          </div>
                        )}
                        {/* CTR badge */}
                        {video.ctr != null && (
                          <div style={{
                            position:     'absolute',
                            top:          4,
                            right:        4,
                            background:   'rgba(0,0,0,0.75)',
                            color:        '#fff',
                            fontSize:     9,
                            fontWeight:   700,
                            borderRadius: 3,
                            padding:      '2px 4px',
                            lineHeight:   1,
                          }}>
                            {video.ctr.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {/* Title */}
                      <div style={{
                        padding:      '5px 6px',
                        fontSize:     10,
                        color:        'var(--text-3)',
                        whiteSpace:   'nowrap',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight:   1.3,
                      }}>
                        {video.title || 'Untitled'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disconnect */}
            <div style={{ textAlign: 'center', paddingTop: 4, borderTop: '1px solid var(--border-1)', marginTop: 8 }}>
              <button
                onClick={handleDisconnect}
                style={{
                  background:  'none',
                  border:      'none',
                  cursor:      'pointer',
                  fontSize:    11,
                  color:       'var(--text-4)',
                  padding:     '6px 0',
                  textDecoration: 'underline',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-4)'; }}
              >
                Disconnect YouTube
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
              Could not load YouTube status. Check your connection and try again.
            </div>
            <button onClick={onClose} style={btnStyle('secondary')}>
              Close
            </button>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Root render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Keyframe for spinner */}
      <style>{`
        @keyframes yt-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={connecting ? undefined : onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     300,
          background: 'rgba(0,0,0,0.60)',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:      'relative',
            zIndex:         301,
            background:    'var(--bg-3)',
            border:        '1px solid var(--border-1)',
            borderRadius:  'var(--radius-lg)',
            width:         '100%',
            maxWidth:       560,
            maxHeight:     '80vh',
            overflowY:     'auto',
            boxShadow:     '0 24px 64px rgba(0,0,0,0.5)',
            margin:        '0 16px',
          }}
        >
          {/* Modal header */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '16px 20px',
            borderBottom:   '1px solid var(--border-1)',
            position:       'sticky',
            top:             0,
            background:     'var(--bg-3)',
            zIndex:          1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Small YouTube icon */}
              <svg width={22} height={16} viewBox="0 0 52 36" fill="none">
                <rect width={52} height={36} rx={8} fill="#FF0000" />
                <polygon points="21,10 21,26 36,18" fill="white" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
                YouTube Channel
              </span>
            </div>
            <button
              onClick={connecting ? undefined : onClose}
              disabled={connecting}
              style={{
                background:   'none',
                border:       'none',
                cursor:       connecting ? 'default' : 'pointer',
                fontSize:     18,
                color:        'var(--text-4)',
                lineHeight:   1,
                padding:      '2px 4px',
                opacity:      connecting ? 0.4 : 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Modal body */}
          <div style={{ padding: 20 }}>
            {renderBody()}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Button style helper ───────────────────────────────────────────────────────

function btnStyle(variant = 'primary', disabled = false) {
  const base = {
    border:       'none',
    borderRadius: 'var(--radius-md)',
    cursor:       disabled ? 'not-allowed' : 'pointer',
    fontWeight:   600,
    fontSize:     13,
    padding:      '9px 20px',
    transition:   'opacity 0.15s',
    opacity:      disabled ? 0.55 : 1,
  };
  if (variant === 'primary') {
    return {
      ...base,
      background: 'var(--accent)',
      color:      '#fff',
    };
  }
  return {
    ...base,
    background: 'var(--bg-5)',
    color:      'var(--text-2)',
    border:     '1px solid var(--border-1)',
  };
}
