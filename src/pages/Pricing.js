import React from 'react';
import '@fontsource-variable/fraunces';
import { Check } from 'lucide-react';
import PricingScene from '../landing/scenes/PricingScene';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';
import { useSEO } from '../hooks/useSEO';
import { handleUpgrade } from '../utils/checkout';
import { useAuth } from '../context/AuthContext';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const INTER    = "'Inter Variable', 'Inter', system-ui, sans-serif";
const CREAM    = '#faecd0';
const AMBER    = '#f97316';

const FREE_FEATURES = [
  'Unlimited exports',
  'Basic templates (no premium)',
  'ThumbFriend (5 messages/day)',
  'All core editor tools',
  'Watermark-free exports',
  '1GB storage',
  'Background remover (5/month)',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited background removals',
  'ThumbFriend unlimited messages + all 5 personalities',
  'ThumbFriend canvas editing + deep memory',
  'Premium templates',
  'Image generator',
  'Auto Thumbnail generator',
  'A/B Variants',
  'CTR Score advanced breakdown',
  'Face Enhancement',
  'Style Transfer',
  '10GB storage',
  'Priority support',
  'Early access to new features',
];

export default function Pricing({ setPage }) {
  useSEO({
    title: 'Pricing — ThumbFrame',
    description: 'Simple pricing. Start free, upgrade when you need more.',
  });

  const { user } = useAuth();
  const isLoggedIn = !!user;
  const isPro      = !!user?.is_pro;

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      fontFamily: INTER,
      color: CREAM,
    }}>
      <PricingScene />
      <Navbar onNavigate={setPage} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 1100,
        margin: '0 auto',
        padding: '120px 24px 96px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            fontFamily: FRAUNCES,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: CREAM,
            opacity: 0.7,
            marginBottom: 16,
          }}>
            Pricing
          </div>
          <h1 style={{
            fontFamily: FRAUNCES,
            fontSize: 'clamp(40px, 5.5vw, 64px)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: CREAM,
            lineHeight: 1.05,
            margin: '0 0 16px',
            textShadow: '0 4px 32px rgba(0,0,0,0.5)',
          }}>
            Simple pricing.
          </h1>
          <p style={{
            fontSize: 17,
            lineHeight: 1.5,
            color: CREAM,
            opacity: 0.8,
            margin: 0,
          }}>
            Start free. Upgrade when you're ready.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}>
          <PricingCard
            eyebrow="For getting started"
            name="Free"
            price="$0"
            period="/ forever"
            features={FREE_FEATURES}
            ctaLabel={isLoggedIn ? 'You have this' : 'Start free'}
            ctaAction={() => setPage('signup')}
            ctaDisabled={isLoggedIn}
          />
          <PricingCard
            eyebrow="For serious creators"
            name="Pro"
            price="$15"
            period="/ month"
            features={PRO_FEATURES}
            ctaLabel={isPro ? "You're already Pro" : 'Go Pro'}
            ctaAction={() => handleUpgrade()}
            ctaDisabled={isPro}
            popular
          />
        </div>

        <p style={{
          textAlign: 'center',
          fontSize: 13,
          color: CREAM,
          opacity: 0.6,
          marginTop: 40,
        }}>
          Cancel anytime. No questions asked.
        </p>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

function PricingCard({ eyebrow, name, price, period, features, ctaLabel, ctaAction, ctaDisabled, popular }) {
  return (
    <div style={{
      flex: '1 1 340px',
      maxWidth: 400,
      minWidth: 280,
      padding: 32,
      borderRadius: 16,
      background: 'rgba(10, 7, 20, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: popular
        ? '0 30px 80px rgba(0,0,0,0.4), 0 0 40px rgba(255,184,112,0.15)'
        : '0 30px 80px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: CREAM, opacity: 0.65, marginBottom: 12,
      }}>
        <span>{eyebrow}</span>
        {popular && (
          <span style={{
            color: '#1a0a00', background: AMBER,
            padding: '3px 10px', borderRadius: 999,
            letterSpacing: '0.06em', fontWeight: 700,
            opacity: 1,
          }}>
            Popular
          </span>
        )}
      </div>

      <h2 style={{
        fontFamily: FRAUNCES,
        fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em',
        color: CREAM, margin: '0 0 12px', lineHeight: 1,
      }}>
        {name}
      </h2>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 24 }}>
        <span style={{
          fontFamily: FRAUNCES,
          fontSize: 56, fontWeight: 500, letterSpacing: '-0.03em',
          color: CREAM, lineHeight: 1,
        }}>
          {price}
        </span>
        <span style={{ fontSize: 14, color: CREAM, opacity: 0.6 }}>{period}</span>
      </div>

      <ul style={{
        listStyle: 'none', padding: 0, margin: '0 0 28px',
        display: 'flex', flexDirection: 'column', gap: 10,
        flex: 1,
      }}>
        {features.map((f, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            fontSize: 14, lineHeight: 1.45, color: CREAM,
          }}>
            <Check
              size={16}
              strokeWidth={2.5}
              style={{ flexShrink: 0, marginTop: 2, color: AMBER, opacity: 0.9 }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {ctaDisabled ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(250,236,208,0.4)',
            fontFamily: INTER,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'default',
          }}
        >
          {ctaLabel}
        </button>
      ) : (
        <button
          onClick={ctaAction}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 10,
            border: 'none',
            background: AMBER,
            color: '#1a0a00',
            fontFamily: INTER,
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 0 24px -6px rgba(249,115,22,0.55), 0 3px 10px rgba(249,115,22,0.25)',
            transition: 'transform 160ms ease, box-shadow 160ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 0 32px -2px rgba(249,115,22,0.75), 0 4px 14px rgba(249,115,22,0.38)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 24px -6px rgba(249,115,22,0.55), 0 3px 10px rgba(249,115,22,0.25)';
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
