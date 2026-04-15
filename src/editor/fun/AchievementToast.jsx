import React, { useEffect, useState } from 'react';
import { RARITY_COLORS } from './achievements';

export default function AchievementToast({ achievement, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!achievement) return null;

  const rarityColor = RARITY_COLORS[achievement.rarity] || '#9ca3af';

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      right: 20,
      zIndex: 100000,
      background: 'rgba(20,20,22,0.96)',
      border: `1px solid ${rarityColor}`,
      borderRadius: 12,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 260,
      boxShadow: `0 0 24px ${rarityColor}40, 0 8px 32px rgba(0,0,0,0.5)`,
      transition: 'opacity 0.4s, transform 0.4s',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      animation: visible ? 'tf-achievement-enter 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <span style={{ fontSize: 32 }}>{achievement.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: rarityColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
          Achievement Unlocked · {achievement.rarity}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7' }}>{achievement.name}</div>
        <div style={{ fontSize: 11, color: 'rgba(245,245,247,0.50)', marginTop: 1 }}>{achievement.description}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.12)', borderRadius: 6, padding: '4px 8px' }}>
        +{achievement.xp} XP
      </div>
    </div>
  );
}
