import React, { useEffect } from 'react';
import useEditorStore from '../engine/Store';

const PROMPTS = {
  pro_template: {
    headline: 'This template is Pro only',
    body: 'Unlock 50+ Pro templates, AI tools, and advanced features.',
    cta: 'Upgrade to Pro — $12/mo',
    icon: '📋',
  },
  pro_color_grade: {
    headline: 'Unlock all 20 color grades',
    body: 'Free plan includes 3 grades. Pro unlocks all 20 including Neon Glow, Cinematic, and custom LUT import.',
    cta: 'Upgrade to Pro',
    icon: '🎨',
  },
  thumbfriend_limit: {
    headline: 'ThumbFriend is Pro only',
    body: 'Upgrade to unlock unlimited AI feedback, canvas edits, all personalities, and conversation memory.',
    cta: 'Get AI Feedback — Upgrade to Pro',
    icon: '🤖',
  },
  bg_removal_limit: {
    headline: 'Background removal limit reached',
    body: 'Upgrade to Pro for unlimited background removals with one-click AI.',
    cta: 'Upgrade for Unlimited Removals',
    icon: '✂️',
  },
  personality_locked: {
    headline: 'Personality selector is Pro only',
    body: 'Choose from 5 unique ThumbFriend personalities — each gives different feedback styles.',
    cta: 'Unlock All Personalities',
    icon: '🎭',
  },
  community_tab: {
    headline: 'Community showcase is Pro',
    body: 'Browse top creator thumbnails, get inspired, and submit your own for feedback.',
    cta: 'Join the Community — Go Pro',
    icon: '🏆',
  },
  ai_generate_free: {
    headline: 'AI generation requires Pro',
    body: 'Generate stunning backgrounds and full thumbnails with DALL-E 3. 50 generations/month.',
    cta: 'Generate with AI — Upgrade',
    icon: '✦',
  },
  export_limit: {
    headline: 'You\'ve hit the free export limit',
    body: 'Free plan: 3 exports/month. Pro: unlimited exports + 4K resolution + watermark-free.',
    cta: 'Upgrade for Unlimited Exports',
    icon: '📤',
  },
  ctr_score_high: {
    headline: 'Great score! Optimize further with Pro',
    body: 'Your CTR score is high. Pro unlocks deep analysis, competitor benchmarks, and YouTube integration.',
    cta: 'Unlock Full CTR Analytics',
    icon: '📈',
  },
  high_ctr_detected: {
    headline: 'You\'re close to a breakthrough',
    body: 'Connect YouTube to see how your real thumbnails compare, and get personalized improvement tips.',
    cta: 'Connect YouTube — Go Pro',
    icon: '📺',
  },
};

export default function UpgradeModal() {
  const trigger      = useEditorStore(s => s.upgradeModalTrigger);
  const hideUpgradeModal = useEditorStore(s => s.hideUpgradeModal);

  useEffect(() => {
    if (!trigger) return;
    const handler = (e) => { if (e.key === 'Escape') hideUpgradeModal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [trigger, hideUpgradeModal]);

  if (!trigger) return null;
  const prompt = PROMPTS[trigger] || PROMPTS.pro_template;

  return (
    <div
      onClick={hideUpgradeModal}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.70)',
        zIndex: 50000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, background: 'rgba(17,17,19,0.98)',
          border: '1px solid rgba(249,115,22,0.30)',
          borderRadius: 16, padding: 32, textAlign: 'center',
          boxShadow: '0 0 60px rgba(249,115,22,0.15), 0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{prompt.icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#f5f5f7', marginBottom: 10 }}>
          {prompt.headline}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(245,245,247,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
          {prompt.body}
        </div>
        <a
          href="/pricing"
          style={{
            display: 'block', padding: '14px', background: '#f97316',
            borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
            textDecoration: 'none', marginBottom: 10,
          }}
        >
          {prompt.cta}
        </a>
        <button
          onClick={hideUpgradeModal}
          style={{ background: 'none', border: 'none', color: 'rgba(245,245,247,0.40)', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
