import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';

const T = {
  bg: '#06070a', panel: '#111318', border: 'rgba(255,255,255,0.07)',
  text: '#f0f2f5', muted: 'rgba(255,255,255,0.38)',
  accent: '#f97316', success: '#22c55e',
};

export default function MobileProjectPicker({ user, onSelectProject, onNewProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('id, name, thumbnail_url, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setProjects(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: T.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif',
      color: T.text,
      paddingTop: 'env(safe-area-inset-top, 0)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>ThumbFrame</div>
          <div style={{ fontSize: 12, color: T.muted }}>Your projects</div>
        </div>
        <button
          onClick={onNewProject}
          style={{
            background: T.accent, color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 18px',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          + New
        </button>
      </div>

      {/* Project grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading && (
          <div style={{ textAlign: 'center', color: T.muted, paddingTop: 40 }}>
            Loading projects...
          </div>
        )}
        {!loading && projects.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No projects yet</div>
            <div style={{ color: T.muted, marginBottom: 24 }}>Create your first thumbnail</div>
            <button onClick={onNewProject} style={{
              background: T.accent, color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 24px',
              fontWeight: 700, fontSize: 16, cursor: 'pointer',
            }}>
              Create Project
            </button>
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectProject(p)}
              style={{
                background: T.panel, border: `1px solid ${T.border}`,
                borderRadius: 10, overflow: 'hidden',
                cursor: 'pointer', touchAction: 'manipulation',
                textAlign: 'left', padding: 0,
              }}
            >
              <div style={{
                width: '100%', aspectRatio: '16/9',
                background: '#1a1a1a',
                overflow: 'hidden',
              }}>
                {p.thumbnail_url
                  ? <img src={p.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 24 }}>🖼</div>
                }
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>
                  {p.name || 'Untitled'}
                </div>
                <div style={{ fontSize: 10, color: T.muted }}>
                  {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
