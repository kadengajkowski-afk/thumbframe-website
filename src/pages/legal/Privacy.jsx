import React from 'react';
import LegalPageTemplate from './LegalPageTemplate';
import { useSEO } from '../../hooks/useSEO';

export default function Privacy({ setPage }) {
  useSEO({
    title: 'Privacy Policy — ThumbFrame',
    description: 'How ThumbFrame collects, uses, and protects your data.',
  });

  return (
    <LegalPageTemplate
      setPage={setPage}
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="May 2026"
      palette={{
        core:      '#081408',
        mid:       '#1a3a20',
        highlight: '#2a6048',
        accent:    '#c8e0a0',
      }}
    >
      <div className="tf-legal-disclaimer">
        Plain English, no lawyer-speak. If something isn't clear, email{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a> and
        we'll explain.
      </div>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account info</strong> — your email and display name.</li>
        <li><strong>Billing info</strong> — processed by Stripe. We never
          see or store your card details; Stripe gives us a customer ID
          and plan status only.</li>
        <li><strong>Usage data</strong> — which features you use, how
          many designs you've saved, CTR metrics when you run them, and
          general product analytics.</li>
        <li><strong>Uploaded images and generated thumbnails</strong> —
          stored so they reappear when you reopen a project.</li>
        <li><strong>YouTube integration data</strong> — only if you
          connect a channel. We read public channel metadata and, with
          your permission, past thumbnail performance to power features
          like Style Transfer and CTR benchmarks.</li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To run the service (render your designs, save your work,
          let you log in).</li>
        <li>To process payments via Stripe.</li>
        <li>To improve the product — aggregated and anonymized usage
          patterns help us decide what to build next.</li>
        <li>To send transactional emails (password resets, receipts,
          account notices). We don't send marketing email unless you
          opt in.</li>
      </ul>

      <h2>3. Third-party services we use</h2>
      <p>
        We use these providers to run ThumbFrame. Each has its own
        privacy policy covering how they handle data sent from us.
      </p>
      <ul>
        <li><strong>Supabase</strong> — authentication, database,
          and image storage (US-East).</li>
        <li><strong>Stripe</strong> — payment processing and
          subscription management.</li>
        <li><strong>Cloudflare</strong> — DNS, email routing
          (support@/dmca@/trust@), and edge security.</li>
        <li><strong>Vercel</strong> — frontend hosting and CDN.</li>
        <li><strong>Railway</strong> — backend / API hosting.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
        <li><strong>Anthropic (Claude)</strong> — ThumbFriend AI
          assistant. Prompts and canvas state are sent to Anthropic's
          API. <strong>Anthropic does not train on data sent via
          their API</strong> — this is contractually guaranteed.</li>
        <li><strong>fal.ai</strong> — AI image generation (Flux
          Schnell, Ideogram 3, Nano Banana). Your prompt + reference
          image (when supplied) are sent to fal.ai's API. <strong>fal.ai
          does not train on data sent via their API</strong>.</li>
        <li><strong>Remove.bg</strong> — HD background removal
          (Pro tier opt-in).</li>
        <li><strong>Sightengine / Hive Moderation</strong> — NSFW
          and CSAM content moderation. We send a hashed version
          of every uploaded and generated image for compliance
          screening. No metadata is shared.</li>
      </ul>
      <p>
        We don't sell data. We don't share data with advertisers. We
        only share what's needed for each service to do its job.
        AI prompts and uploads are <strong>NOT used to train any
        model</strong> at any provider listed above.
      </p>

      <h2>4. Where we store data</h2>
      <p>
        Designs and account data live in Supabase, hosted in US-East,
        encrypted at rest. Connections to our API use HTTPS.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Your designs are kept while your account is active. When you
        delete your account (from Settings), we remove your personal
        data and saved designs within 30 days, except where retention
        is required by law (for example: tax records for past
        subscription payments).
      </p>

      <h2>6. Your rights</h2>
      <p>
        Wherever you live, you have the right to:
      </p>
      <ul>
        <li><strong>Access</strong> — see what data we hold about you.</li>
        <li><strong>Export</strong> — get a copy of your designs and
          account data.</li>
        <li><strong>Delete</strong> — remove your account and data.</li>
        <li><strong>Correct</strong> — fix inaccurate info.</li>
      </ul>
      <p>
        Most of this you can do directly from Settings. For anything
        else, email{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>{' '}
        and we'll respond within 30 days.
      </p>
      <p>
        If you're in the EU / UK (GDPR) or California (CCPA), these
        rights are guaranteed by law and we honor them for everyone
        regardless of location.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use a small number of cookies and similar storage to keep
        you logged in and remember your preferences. We don't use
        third-party advertising cookies or cross-site tracking.
      </p>

      <h2>8. Children's privacy</h2>
      <p>
        ThumbFrame isn't intended for people under 13. We don't
        knowingly collect data from children. If you believe a child
        has created an account, email us and we'll remove it.
      </p>

      <h2>9. International users</h2>
      <p>
        Our servers are in the United States. If you're using
        ThumbFrame from outside the US, you consent to your data being
        transferred to and processed in the US.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        If we make material changes (anything that expands how we use
        your data), we'll email you before the change takes effect.
        Smaller changes will be reflected in the "Last updated" date at
        the top of this page.
      </p>

      <h2>11. Contact</h2>
      <p>
        For any privacy question, request, or concern, email{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>{' '}
        or <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
      </p>
      <p>
        For data export or deletion requests (GDPR / CCPA), use the
        Settings → Account page or email{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
        We respond within 30 days.
      </p>
    </LegalPageTemplate>
  );
}
