import React, { useState, useEffect } from 'react';
import '@fontsource-variable/fraunces';
import SettingsScene from '../landing/scenes/SettingsScene';
import Navbar from '../landing/components/layout/Navbar';
import BillingTab from '../BillingTab';
import { useAuth } from '../context/AuthContext';
import { useSEO } from '../hooks/useSEO';
import supabase from '../supabaseClient';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const INTER    = "'Inter Variable', 'Inter', system-ui, sans-serif";
const CREAM    = '#faecd0';
const CREAM_60 = 'rgba(250,236,208,0.6)';
const CREAM_50 = 'rgba(250,236,208,0.5)';
const CREAM_70 = 'rgba(250,236,208,0.7)';
const AMBER    = '#f97316';
const DANGER   = '#e87050';
const BORDER   = 'rgba(255,255,255,0.08)';
const CARD_BG  = 'rgba(10,7,20,0.75)';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

// ── Styles ─────────────────────────────────────────────────────────────────────
const cardStyle = {
  background: CARD_BG,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 32,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'rgba(5,3,12,0.5)',
  color: CREAM,
  fontSize: 14,
  fontFamily: INTER,
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

const primaryBtn = {
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  background: AMBER,
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: INTER,
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
};

const ghostBtn = {
  padding: '10px 20px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: CREAM,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: INTER,
  cursor: 'pointer',
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: CREAM_70,
  fontFamily: INTER,
  marginBottom: 6,
  letterSpacing: '0.02em',
};

const sectionHeading = {
  fontFamily: FRAUNCES,
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: CREAM,
  margin: '0 0 16px',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMemberSince(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '12px 4px',
        marginRight: 28,
        fontFamily: INTER,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? CREAM : CREAM_50,
        borderBottom: active ? `2px solid ${CREAM}` : '2px solid transparent',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      style={{
        position: 'relative',
        width: 42,
        height: 24,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: value ? AMBER : 'rgba(255,255,255,0.08)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        transition: 'background-color 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ onClose, onConfirm, loading }) {
  const [typed, setTyped] = useState('');
  const canConfirm = typed === 'DELETE' && !loading;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(5,3,12,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...cardStyle,
          maxWidth: 480,
          width: '100%',
          fontFamily: INTER,
        }}
      >
        <h3 style={{
          fontFamily: FRAUNCES,
          fontSize: 22,
          fontWeight: 500,
          color: DANGER,
          margin: '0 0 12px',
        }}>
          Delete account
        </h3>
        <p style={{ fontSize: 14, color: CREAM_70, lineHeight: 1.6, margin: '0 0 20px' }}>
          This will permanently delete your account and all your saved designs. This cannot be undone.
        </p>
        <label style={labelStyle}>Type <span style={{ color: CREAM, fontWeight: 700 }}>DELETE</span> to confirm</label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          style={inputStyle}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={ghostBtn} disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              ...primaryBtn,
              background: canConfirm ? DANGER : 'rgba(232,112,80,0.3)',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Billing tab card wrapper ──────────────────────────────────────────────────
function BillingTabCard() {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 8 }}>
        <BillingTab />
      </div>
    </div>
  );
}

// ── Profile section ────────────────────────────────────────────────────────────
function ProfileSection({ user }) {
  const [displayName, setDisplayName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { kind: 'ok'|'err', msg }
  const [designCount, setDesignCount] = useState(null);

  // Seed display_name from user_metadata on mount.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const meta = data?.user?.user_metadata || {};
      const initial = meta.display_name || meta.name || user?.name || '';
      setDisplayName(initial);
      setInitialName(initial);
    });
    return () => { mounted = false; };
  }, [user?.name]);

  // Fetch design count from /designs/list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) { if (!cancelled) setDesignCount(0); return; }
        const res = await fetch(`${API_URL}/designs/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const list = Array.isArray(payload) ? payload
          : Array.isArray(payload?.designs) ? payload.designs
          : Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled) setDesignCount(list.length);
      } catch {
        if (!cancelled) setDesignCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (error) throw error;
      setInitialName(displayName);
      setStatus({ kind: 'ok', msg: 'Display name saved' });
    } catch (err) {
      setStatus({ kind: 'err', msg: err?.message || 'Could not save. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  const dirty = displayName !== initialName && displayName.trim().length > 0;
  const memberSince = formatMemberSince(user?.createdAt);

  return (
    <section>
      <h2 style={sectionHeading}>Profile</h2>
      <div style={cardStyle}>
        {/* Display name */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Display name</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={(e) => (e.target.style.borderColor = AMBER)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
          {status && (
            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: status.kind === 'ok' ? '#86efac' : DANGER,
            }}>
              {status.msg}
            </div>
          )}
        </div>

        {/* Email */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Email</label>
          <div style={{ ...inputStyle, color: CREAM_70, cursor: 'not-allowed' }}>
            {user?.email || '—'}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: CREAM_60 }}>
            Contact support to change your email.
          </div>
        </div>

        {/* Member since */}
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Member since</label>
            <div style={{ fontSize: 14, color: CREAM }}>{memberSince}</div>
          </div>
          <div>
            <label style={labelStyle}>Designs saved</label>
            <div style={{ fontSize: 14, color: CREAM }}>
              {designCount === null ? '—' : `${designCount} design${designCount === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Security section ───────────────────────────────────────────────────────────
function SecuritySection() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    if (newPw.length < 8) {
      setStatus({ kind: 'err', msg: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPw !== confirmPw) {
      setStatus({ kind: 'err', msg: "New passwords don't match." });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setStatus({ kind: 'ok', msg: 'Password updated.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setStatus({ kind: 'err', msg: err?.message || 'Could not update password.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 style={sectionHeading}>Security</h2>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Current password</label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
            onFocus={(e) => (e.target.style.borderColor = AMBER)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>New password</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
            onFocus={(e) => (e.target.style.borderColor = AMBER)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Confirm new password</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
            onFocus={(e) => (e.target.style.borderColor = AMBER)}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>

        {status && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: status.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(232,112,80,0.12)',
            border: `1px solid ${status.kind === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(232,112,80,0.3)'}`,
            fontSize: 13,
            color: status.kind === 'ok' ? '#86efac' : DANGER,
            marginBottom: 16,
          }}>
            {status.msg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !newPw || !confirmPw}
          style={{
            ...primaryBtn,
            opacity: (submitting || !newPw || !confirmPw) ? 0.6 : 1,
            cursor: (submitting || !newPw || !confirmPw) ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}

// ── Connections section (YouTube — Coming soon stub) ─────────────────────────
function ConnectionsSection() {
  return (
    <section>
      <h2 style={sectionHeading}>Connections</h2>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: CREAM, marginBottom: 4 }}>
              YouTube channel
            </div>
            <div style={{ fontSize: 13, color: CREAM_70, lineHeight: 1.5 }}>
              Connect your channel to pull CTR benchmarks and match your thumbnail style to past winners.
            </div>
            <div style={{ fontSize: 12, color: CREAM_60, marginTop: 8 }}>
              YouTube integration launching soon.
            </div>
          </div>
          <button
            disabled
            style={{
              ...ghostBtn,
              opacity: 0.5,
              cursor: 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            Coming soon
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Preferences section ────────────────────────────────────────────────────────
function PreferencesSection({ user }) {
  const [emailNotif, setEmailNotif] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const meta = data?.user?.user_metadata || {};
      if (typeof meta.email_notifications === 'boolean') {
        setEmailNotif(meta.email_notifications);
      }
      setLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  async function handleToggle(next) {
    setEmailNotif(next);
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { email_notifications: next } });
    } catch {
      setEmailNotif(!next); // revert on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 style={sectionHeading}>Preferences</h2>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: user?.is_pro ? 24 : 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: CREAM, marginBottom: 4 }}>
              Email notifications
            </div>
            <div style={{ fontSize: 13, color: CREAM_70 }}>
              Product updates, tips, and occasional announcements.
            </div>
          </div>
          <Toggle value={emailNotif} onChange={handleToggle} disabled={!loaded || saving} />
        </div>

        {user?.is_pro && (
          <div style={{
            paddingTop: 20,
            borderTop: `1px solid ${BORDER}`,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: CREAM, marginBottom: 4 }}>
              Plan renewal
            </div>
            <div style={{ fontSize: 13, color: CREAM_70 }}>
              Manage renewal in the Billing tab.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Danger zone ────────────────────────────────────────────────────────────────
function DangerZone({ setPage }) {
  const { logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleLogout() {
    await logout();
    setPage('home');
  }

  async function handleDelete() {
    setDeleting(true);
    // TODO: wire to real /api/delete-account endpoint when available.
    // For now, sign the user out and return them home.
    console.log('[Settings] Delete account requested — backend endpoint not yet implemented.');
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — we still clear local state
    }
    localStorage.removeItem('thumbframe_token');
    localStorage.removeItem('thumbframe_user');
    logout();
    setPage('home');
  }

  return (
    <section>
      <h2 style={{ ...sectionHeading, color: DANGER }}>Danger zone</h2>
      <div style={cardStyle}>
        <button
          onClick={handleLogout}
          style={{
            ...primaryBtn,
            width: '100%',
            padding: '12px 18px',
            marginBottom: 12,
          }}
        >
          Log out
        </button>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            ...ghostBtn,
            width: '100%',
            padding: '12px 18px',
            border: `1px solid ${DANGER}`,
            color: DANGER,
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(232,112,80,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          Delete account
        </button>
      </div>
      {modalOpen && (
        <DeleteModal
          onClose={() => setModalOpen(false)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Settings({ setPage }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('billing');

  useSEO({
    title: 'Settings — ThumbFrame',
    description: 'Manage your ThumbFrame account and subscription.',
  });

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      fontFamily: INTER,
      color: CREAM,
    }}>
      <SettingsScene />
      <Navbar onNavigate={setPage} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 820,
        margin: '0 auto',
        padding: '120px 24px 96px',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <button
            onClick={() => setPage('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: CREAM_70,
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
              fontFamily: INTER,
              marginBottom: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_70)}
          >
            ← Back to dashboard
          </button>
          <h1 style={{
            fontFamily: FRAUNCES,
            fontSize: 'clamp(36px, 5vw, 52px)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: CREAM,
            lineHeight: 1.05,
            margin: '0 0 12px',
            textShadow: '0 4px 32px rgba(0,0,0,0.5)',
          }}>
            Settings
          </h1>
          <p style={{
            fontSize: 16,
            color: CREAM_70,
            margin: 0,
            lineHeight: 1.5,
          }}>
            Manage your account and subscription.
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${BORDER}`,
          marginBottom: 32,
        }}>
          <TabButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}>
            Billing
          </TabButton>
          <TabButton active={activeTab === 'account'} onClick={() => setActiveTab('account')}>
            Account
          </TabButton>
        </div>

        {/* Tab content */}
        {activeTab === 'billing' && <BillingTabCard />}

        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <ProfileSection user={user} />
            <SecuritySection />
            <ConnectionsSection />
            <PreferencesSection user={user} />
            <DangerZone setPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
