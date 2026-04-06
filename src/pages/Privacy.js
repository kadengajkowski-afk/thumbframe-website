import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const legalStyles = `
  .tf-legal-page {
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
    font-family: var(--font-body);
  }
  .tf-legal-hero {
    padding: 140px 24px 56px;
    text-align: center;
    position: relative;
  }
  .tf-legal-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,107,0,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-legal-hero h1 {
    font-size: clamp(28px, 4vw, 44px);
    letter-spacing: -0.03em;
    margin-bottom: 12px;
  }
  .tf-legal-hero p {
    font-size: 15px;
    color: var(--text-muted);
  }
  .tf-legal-body {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 24px 100px;
  }
  .tf-legal-body h2 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 2.5em 0 0.75em;
    padding-top: 1.5em;
    border-top: 1px solid var(--border);
  }
  .tf-legal-body h2:first-child { border-top: none; margin-top: 0; padding-top: 0; }
  .tf-legal-body p {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.8;
    margin: 0 0 1.2em;
  }
  .tf-legal-body ul {
    padding-left: 20px;
    margin: 0 0 1.2em;
  }
  .tf-legal-body li {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: 6px;
  }
  .tf-legal-body strong { color: var(--text-primary); font-weight: 600; }
  .tf-legal-body a { color: var(--accent); text-decoration: underline; }
  .tf-legal-divider {
    height: 1px;
    background: var(--border);
    margin: 48px 0;
  }
`;

export default function Privacy({ setPage }) {
  useSEO({
    title: 'Privacy Policy — ThumbFrame',
    description: 'ThumbFrame Privacy Policy — how we collect, use, and protect your information.',
    url: 'https://thumbframe.com/privacy',
  });

  return (
    <div className="tf-legal-page">
      <style>{legalStyles}</style>
      <Navbar setPage={setPage} currentPage="" />

      <div className="tf-legal-hero">
        <span className="badge badge-accent" style={{ marginBottom: 16 }}>Legal</span>
        <h1>Privacy Policy</h1>
        <p>Last updated: January 1, 2025</p>
      </div>

      <div className="tf-legal-body">
        <h2>Overview</h2>
        <p>
          ThumbFrame ("we," "us," or "our") operates thumbframe.com. This Privacy Policy explains how we collect, use, and protect your information when you use our service. We believe in clear, plain-language privacy policies — not walls of legal text.
        </p>
        <p>
          By using ThumbFrame, you agree to the practices described in this policy. If you disagree, please don't use the service.
        </p>

        <h2>Information We Collect</h2>
        <p><strong>Account information:</strong> When you create an account, we collect your email address and name. We use Supabase for authentication and do not store plain-text passwords.</p>
        <p><strong>Usage data:</strong> We collect information about how you use ThumbFrame, including features accessed, pages visited, and actions taken within the editor. This helps us improve the product.</p>
        <p><strong>Payment information:</strong> All payments are processed by Stripe. We never see or store your full credit card number — only a tokenized reference provided by Stripe.</p>
        <p><strong>Uploaded content:</strong> Images you upload to ThumbFrame are processed to provide the service (background removal, editing, export). We do not use your uploaded images to train AI models without your explicit consent.</p>
        <p><strong>Communications:</strong> If you contact support, we store your message and email address to respond to you.</p>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain ThumbFrame's services</li>
          <li>To process payments and manage your subscription</li>
          <li>To send important service updates, billing notices, and security alerts</li>
          <li>To respond to support requests</li>
          <li>To improve and develop new features (aggregated, anonymized usage data only)</li>
          <li>To send marketing emails if you've opted in (you can unsubscribe any time)</li>
        </ul>

        <h2>Data Sharing</h2>
        <p>We do not sell your personal data. We share your information only with:</p>
        <ul>
          <li><strong>Supabase</strong> — authentication and database hosting</li>
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
          <li><strong>OpenAI / Replicate / Anthropic</strong> — AI processing for image generation and analysis (content is processed but not retained by these providers under our agreements)</li>
        </ul>
        <p>We may disclose your information if required by law or to protect ThumbFrame's rights and safety.</p>

        <h2>Cookies</h2>
        <p>ThumbFrame uses cookies to:</p>
        <ul>
          <li>Keep you logged in (session cookies)</li>
          <li>Analyze site traffic (Google Analytics — only if you consent)</li>
          <li>Store your preferences</li>
        </ul>
        <p>You can control cookies through your browser settings or our cookie consent banner. Declining analytics cookies does not affect your use of ThumbFrame.</p>

        <h2>Data Retention</h2>
        <p>We retain your account data as long as your account is active. If you delete your account, we delete your personal data within 30 days, except where retention is required by law. Uploaded images are deleted from our servers within 24 hours of processing.</p>

        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your data in a portable format</li>
          <li>Opt out of marketing communications</li>
        </ul>
        <p>To exercise any of these rights, email us at <a href="mailto:privacy@thumbframe.com">privacy@thumbframe.com</a>.</p>

        <h2>Security</h2>
        <p>We use industry-standard security measures including HTTPS, encrypted storage, and access controls. No system is 100% secure, but we take reasonable precautions to protect your data.</p>

        <h2>Children's Privacy</h2>
        <p>ThumbFrame is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us information, please contact us and we will delete it.</p>

        <h2>Changes to This Policy</h2>
        <p>We may update this Privacy Policy occasionally. We'll notify you of significant changes via email or an in-app notice. Continued use of ThumbFrame after changes take effect means you accept the updated policy.</p>

        <h2>Contact Us</h2>
        <p>
          Questions about this policy? Email us at{' '}
          <a href="mailto:privacy@thumbframe.com">privacy@thumbframe.com</a>.
        </p>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
