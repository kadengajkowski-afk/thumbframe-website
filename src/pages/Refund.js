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
  .tf-refund-highlight {
    background: rgba(255,107,0,0.06);
    border: 1px solid rgba(255,107,0,0.15);
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 32px;
  }
  .tf-refund-highlight h3 { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 10px; color: var(--text-primary); }
  .tf-refund-highlight p { font-size: 15px; color: var(--text-secondary); margin: 0; line-height: 1.7; }
`;

export default function Refund({ setPage }) {
  useSEO({
    title: 'Refund Policy — ThumbFrame',
    description: 'ThumbFrame offers a full 7-day refund. No questions asked.',
    url: 'https://thumbframe.com/refund',
  });

  return (
    <div className="tf-legal-page">
      <style>{legalStyles}</style>
      <Navbar setPage={setPage} currentPage="" />

      <div className="tf-legal-hero">
        <span className="badge badge-accent" style={{ marginBottom: 16 }}>Legal</span>
        <h1>Refund Policy</h1>
        <p>Last updated: January 1, 2025</p>
      </div>

      <div className="tf-legal-body">
        <div className="tf-refund-highlight">
          <h3>7-day money-back guarantee</h3>
          <p>If you're not happy with ThumbFrame Pro within 7 days of your first payment, email us at <a href="mailto:support@thumbframe.com">support@thumbframe.com</a> and we'll issue a full refund. No questions asked, no hoops to jump through.</p>
        </div>

        <h2>Eligibility</h2>
        <p>You're eligible for a full refund if:</p>
        <ul>
          <li>You request the refund within <strong>7 days</strong> of your initial subscription payment</li>
          <li>You have not previously received a refund for a ThumbFrame subscription</li>
          <li>Your account is in good standing (not terminated for Terms violations)</li>
        </ul>

        <h2>How to Request a Refund</h2>
        <p>Email <a href="mailto:support@thumbframe.com">support@thumbframe.com</a> with:</p>
        <ul>
          <li>The email address on your ThumbFrame account</li>
          <li>A brief description of why you're requesting a refund (optional but helpful)</li>
        </ul>
        <p>We typically process refund requests within 1 business day. Funds appear back on your payment method within 5–10 business days depending on your bank.</p>

        <h2>After the 7-Day Window</h2>
        <p>After 7 days, we generally don't offer refunds for subscription payments already made. However, if you've experienced a significant technical issue or billing error, email us and we'll review your case individually. We're humans — we'll be reasonable.</p>

        <h2>Renewal Charges</h2>
        <p>Monthly subscription renewals are not eligible for refund after they are processed. To avoid being charged for the next billing cycle, cancel your subscription before the renewal date. You'll retain access to Pro features until the end of the period you've paid for.</p>
        <p>You can cancel anytime in <strong>Settings → Billing → Cancel plan</strong>.</p>

        <h2>Annual Subscriptions</h2>
        <p>Annual subscriptions (if offered) are eligible for a full refund within 14 days of the annual payment. After 14 days, we offer a prorated refund for unused months at our discretion.</p>

        <h2>Contact</h2>
        <p>Questions about billing? Email <a href="mailto:support@thumbframe.com">support@thumbframe.com</a>. We respond within 24 hours.</p>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
