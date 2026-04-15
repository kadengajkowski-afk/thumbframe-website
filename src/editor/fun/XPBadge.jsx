import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import { getLevel } from './XPSystem';

export default function XPBadge({ user }) {
  const [xpData, setXpData] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_xp')
      .select('total_xp, level')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { if (data) setXpData(data); });

    const handler = () => {
      supabase.from('user_xp').select('total_xp, level').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setXpData(data); });
    };
    window.addEventListener('tf:xp-updated', handler);
    return () => window.removeEventListener('tf:xp-updated', handler);
  }, [user?.id]);

  if (!xpData) return null;

  const levelInfo = getLevel(xpData.total_xp);

  return (
    <div
      title={`${xpData.total_xp} XP — ${levelInfo.name}${levelInfo.xpToNext ? ` · ${levelInfo.xpToNext} XP to ${levelInfo.nextLevel}` : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default', userSelect: 'none' }}
    >
      <span style={{ fontSize: 16 }}>{levelInfo.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 60 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', lineHeight: 1 }}>{levelInfo.name}</span>
        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden', width: 60 }}>
          <div style={{ height: '100%', width: `${levelInfo.progress}%`, background: '#f97316', borderRadius: 2, transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  );
}
