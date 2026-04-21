import React from 'react';
import LegalPageTemplate from './LegalPageTemplate';
import { useSEO } from '../../hooks/useSEO';

export default function Terms({ setPage }) {
  useSEO({
    title: 'Terms of Service — ThumbFrame',
    description: 'The terms under which ThumbFrame is offered.',
  });

  return (
    <LegalPageTemplate
      setPage={setPage}
      eyebrow="Legal"
      title="Terms of Service"
      lastUpdated="April 2026"
    >
      <div className="tf-legal-disclaimer">
        This is a plain-English summary of our legal terms. For the full
        legal version, contact us at <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
      </div>

      <h2>1. Acceptance of terms</h2>
      <p>
        By creating an account or using ThumbFrame, you agree to these
        terms. If you don't agree with something here, please don't use
        the service.
      </p>
      <p>
        ThumbFrame is operated independently and is not affiliated with
        Anthropic, OpenAI, Google, or any other third-party service it
        integrates with.
      </p>

      <h2>2. What ThumbFrame does</h2>
      <p>
        ThumbFrame is a browser-based tool for creating YouTube
        thumbnails. It includes an editor with layers, text, brushes,
        selection tools, and effects, plus optional AI features for
        background removal, thumbnail generation, CTR scoring, and
        creative assistance.
      </p>
      <p>
        The service is offered under a Free plan and a Pro plan. Feature
        availability depends on your plan.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must provide accurate information when signing up.</li>
        <li>One account per person — no sharing, no resale.</li>
        <li>You're responsible for keeping your password safe and for
          anything that happens on your account.</li>
        <li>You must be at least 13 years old to use ThumbFrame.</li>
      </ul>

      <h2>4. Subscription and billing</h2>
      <p>
        The Pro plan is $15 per month, billed through Stripe. Your
        subscription renews automatically at the end of each billing
        period until you cancel.
      </p>
      <p>
        You can cancel anytime from the Billing tab in Settings. When you
        cancel, you keep Pro access until the end of your current paid
        period, then your account reverts to Free. See our{' '}
        <a href="/refund" onClick={(e) => { e.preventDefault(); setPage('refund'); }}>Refund Policy</a>{' '}
        for details on refunds.
      </p>

      <h2>5. Acceptable use</h2>
      <p>Don't use ThumbFrame to:</p>
      <ul>
        <li>Create content that's illegal, defamatory, or infringes
          someone else's rights.</li>
        <li>Generate thumbnails depicting real people without their
          consent.</li>
        <li>Create sexual content involving minors, or any other content
          prohibited by law.</li>
        <li>Reverse engineer, scrape, or resell the service.</li>
        <li>Disrupt or overload our infrastructure.</li>
      </ul>

      <h2>6. Your content</h2>
      <p>
        You keep all rights to the thumbnails and assets you create. We
        don't claim ownership of your work. You grant ThumbFrame a
        limited license to store, display, and process your content
        solely to run the service (for example: auto-saving your designs
        to your account).
      </p>
      <p>
        You're responsible for making sure you have the right to use any
        images, fonts, or other material you upload.
      </p>

      <h2>7. AI-generated content</h2>
      <p>
        ThumbFrame uses third-party AI services (including OpenAI's
        DALL-E 3 for image generation and other providers for background
        removal and face enhancement). When you use these features, your
        prompt and/or images are sent to the provider's API.
      </p>
      <p>
        AI outputs are provided as-is. We don't guarantee that
        AI-generated content is original, accurate, or safe for
        commercial use. You're responsible for how you use these
        outputs, including verifying usage rights before publishing.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        The ThumbFrame name, logo, website, and source code are our
        property. Templates, stock assets, and fonts bundled with the
        service are licensed to you for use within thumbnails you
        create; they aren't licensed for redistribution on their own.
      </p>

      <h2>9. Termination</h2>
      <p>
        You can delete your account anytime from Settings. When you do,
        we delete your designs and personal data per our{' '}
        <a href="/privacy" onClick={(e) => { e.preventDefault(); setPage('privacy'); }}>Privacy Policy</a>.
      </p>
      <p>
        We can suspend or terminate accounts that violate these terms,
        abuse the service, or put other users at risk. Where reasonable,
        we'll let you know why and give you a chance to respond first.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        ThumbFrame is provided "as is" without warranties of any kind.
        We can't promise the service will be uninterrupted, bug-free,
        or that any particular thumbnail will improve your
        click-through rate on YouTube.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent allowed by law, ThumbFrame's total
        liability to you for any claim related to the service is
        limited to what you paid us in the three months before the
        claim arose. We're not liable for indirect, incidental, or
        consequential damages (for example: lost revenue or lost data
        due to a service outage).
      </p>

      <h2>12. Changes and contact</h2>
      <p>
        We may update these terms from time to time. If the changes are
        material, we'll email you or show a notice in the app before
        they take effect.
      </p>
      <p>
        Questions? Email{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
      </p>
    </LegalPageTemplate>
  );
}
