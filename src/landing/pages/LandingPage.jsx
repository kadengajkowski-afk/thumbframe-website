import LandingScene from '../scenes/LandingScene';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../../context/AuthContext';
import { gotoEditor } from '../../lib/editorUrl';

export default function LandingPage({ onNavigate }) {
  const { user } = useAuth();

  const handlePrimary = () => {
    if (user) {
      // Day 20: signed-in users go straight to the v3 editor on the
      // editor.thumbframe.com subdomain. The apex still serves v1
      // marketing; v1's in-app /editor route remains as legacy
      // fallback for in-session journeys.
      gotoEditor();
    } else {
      onNavigate?.('signup');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#1a0f2a',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ===== BACKGROUND: hero canvas ===== */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <LandingScene />
      </div>

      {/* ===== TOP NAV ===== */}
      <Navbar onNavigate={onNavigate} />

      {/* ===== HEADLINE (center-top area) ===== */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 24px',
          pointerEvents: 'none',
        }}
      >
        <h1
          style={{
            fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif",
            fontSize: 'clamp(32px, 5.5vw, 72px)',
            fontWeight: 400,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: '#faecd0',
            textAlign: 'center',
            maxWidth: '18ch',
            margin: 0,
            textShadow: '0 4px 32px rgba(0,0,0,0.5), 0 0 60px rgba(250,236,208,0.15)',
          }}
        >
          Every great channel starts with one thumbnail
        </h1>

        {/* Subtle painted underline accent */}
        <div
          style={{
            marginTop: '24px',
            width: '96px',
            height: '4px',
            background: 'linear-gradient(90deg, transparent 0%, #f0a060 50%, transparent 100%)',
            borderRadius: '2px',
            opacity: 0.85,
          }}
        />
      </div>

      {/* ===== CTA (below headline, above ship) ===== */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 24px',
        }}
      >
        <button
          onClick={handlePrimary}
          style={ctaButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 12px 40px rgba(240, 160, 96, 0.5), 0 0 0 1px rgba(250, 236, 208, 0.3) inset';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 8px 32px rgba(240, 160, 96, 0.35), 0 0 0 1px rgba(250, 236, 208, 0.2) inset';
          }}
        >
          {user ? 'Open editor' : 'Set sail'}
        </button>
      </div>
    </div>
  );
}

// ===== STYLES =====

const ctaButtonStyle = {
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: '17px',
  fontWeight: 600,
  color: '#2a1a10',
  background: 'linear-gradient(135deg, #f5c888 0%, #f0a060 100%)',
  border: 'none',
  borderRadius: '999px',
  padding: '14px 36px',
  cursor: 'pointer',
  letterSpacing: '0.01em',
  boxShadow: '0 8px 32px rgba(240, 160, 96, 0.35), 0 0 0 1px rgba(250, 236, 208, 0.2) inset',
  transition: 'transform 180ms ease, box-shadow 180ms ease',
};
