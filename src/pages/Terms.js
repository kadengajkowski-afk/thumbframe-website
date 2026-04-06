import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const legalStyles = `
  .tf-legal-page { background: var(--bg-primary); min-height: 100vh; color: var(--text-primary); font-family: var(--font-body); }
  .tf-legal-hero { padding: 140px 24px 56px; text-align: center; position: relative; }
  .tf-legal-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,107,0,0.04) 0%, transparent 70%); pointer-events: none; }
  .tf-legal-hero h1 { font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.03em; margin-bottom: 12px; }
  .tf-legal-hero p { font-size: 15px; color: var(--text-muted); }
  .tf-legal-body { max-width: 720px; margin: 0 auto; padding: 0 24px 100px; }
  .tf-legal-body h2 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); margin: 2.5em 0 0.75em; padding-top: 1.5em; border-top: 1px solid var(--border); }
  .tf-legal-body h2:first-child { border-top: none; margin-top: 0; padding-top: 0; }
  .tf-legal-body p { font-size: 15px; color: var(--text-secondary); line-height: 1.8; margin: 0 0 1.2em; }
  .tf-legal-body ul { padding-left: 20px; margin: 0 0 1.2em; }
  .tf-legal-body li { font-size: 15px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 6px; }
  .tf-legal-body strong { color: var(--text-primary); font-weight: 600; }
  .tf-legal-body a { color: var(--accent); text-decoration: underline; }
`;

export default function Terms({ setPage }) {
  useSEO({
    title: 'Terms of Service — ThumbFrame',
    description: 'ThumbFrame Terms of Service — the rules for using our platform.',
    url: 'https://thumbframe.com/terms',
  });

  return (
    <div className="tf-legal-page">
      <style>{legalStyles}</style>
      <Navbar setPage={setPage} currentPage="" />

      <div className="tf-legal-hero">
        <span className="badge badge-accent" style={{ marginBottom: 16 }}>Legal</span>
        <h1>Terms of Service</h1>
        <p>Last updated: January 1, 2025</p>
      </div>

      <div className="tf-legal-body">
        <h2>Acceptance of Terms</h2>
        <p>By accessing or using ThumbFrame at thumbframe.com ("the Service"), you agree to be bound by these Terms of Service. If you don't agree, don't use the Service.</p>

        <h2>Description of Service</h2>
        <p>ThumbFrame is an AI-powered YouTube thumbnail editor. The Service is provided "as is" and may be updated, modified, or discontinued at any time with or without notice.</p>

        <h2>Account Registration</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account and all activity that occurs under it. Notify us immediately at <a href="mailto:support@thumbframe.com">support@thumbframe.com</a> if you suspect unauthorized use.</p>

        <h2>Acceptable Use</h2>
        <p>You agree not to use ThumbFrame to:</p>
        <ul>
          <li>Upload or create content that is illegal, infringing, defamatory, obscene, or harmful</li>
          <li>Violate the intellectual property rights of others</li>
          <li>Attempt to reverse-engineer, hack, or circumvent the Service's security</li>
          <li>Use automated tools to scrape, stress-test, or abuse the Service</li>
          <li>Create multiple accounts to circumvent free-tier limits</li>
          <li>Resell or redistribute access to the Service without authorization</li>
        </ul>

        <h2>Intellectual Property</h2>
        <p><strong>Your content:</strong> You retain full ownership of the images and designs you create using ThumbFrame. By uploading content, you grant us a limited license to process it solely to provide the Service.</p>
        <p><strong>Our content:</strong> The ThumbFrame platform, branding, code, and AI models are owned by ThumbFrame. You may not copy, modify, or distribute them without written permission.</p>

        <h2>Subscription and Payment</h2>
        <p>ThumbFrame offers free and paid subscription tiers. By subscribing to a paid plan:</p>
        <ul>
          <li>You authorize us to charge your payment method on a recurring basis</li>
          <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
          <li>Prices may change with 30 days' notice</li>
          <li>No partial refunds for unused subscription time, except where required by law</li>
        </ul>
        <p>See our <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', padding: 0, fontFamily: 'inherit' }} onClick={() => setPage('refund')}>Refund Policy</button> for details on refunds.</p>

        <h2>Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, ThumbFrame shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, even if we have been advised of the possibility of such damages.</p>
        <p>Our total liability to you for any claim arising from use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

        <h2>Disclaimer of Warranties</h2>
        <p>The Service is provided "as is" without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or completely secure.</p>

        <h2>Termination</h2>
        <p>We may terminate or suspend your account at any time for violations of these Terms. You may delete your account at any time via Settings. Upon termination, your right to use the Service ends immediately.</p>

        <h2>Governing Law</h2>
        <p>These Terms are governed by the laws of the United States. Any disputes shall be resolved in the courts of the applicable jurisdiction.</p>

        <h2>Changes to Terms</h2>
        <p>We may update these Terms. Continued use of the Service after changes take effect constitutes acceptance. We will notify you of material changes via email.</p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:legal@thumbframe.com">legal@thumbframe.com</a>.</p>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
