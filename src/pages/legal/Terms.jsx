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
      lastUpdated="May 2026"
      palette={{
        core:      '#050818',
        mid:       '#1a1a38',
        highlight: '#3a3868',
        accent:    '#b8c0e0',
      }}
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

      <h2>5. Acceptable Use Policy</h2>
      <p>Don't use ThumbFrame to:</p>
      <ul>
        <li><strong>CSAM:</strong> upload, generate, or share child
          sexual abuse material. We use automated detection (PhotoDNA
          / Hive) on every upload and AI generation. Positive matches
          result in immediate account suspension and a report to the
          National Center for Missing &amp; Exploited Children
          (NCMEC) as required by U.S. law (18 U.S.C. §2258A).</li>
        <li><strong>Deepfakes of real people without consent:</strong>
          do not generate or upload AI-manipulated thumbnails depicting
          identifiable real people without their explicit permission.</li>
        <li><strong>Hate / harassment:</strong> no thumbnails promoting
          hate speech, harassment, or violence against any group.</li>
        <li><strong>Deceptive impersonation:</strong> do not create
          thumbnails that impersonate other channels, brands, or news
          outlets in a way intended to mislead viewers.</li>
        <li><strong>Copyright infringement:</strong> only use images,
          fonts, and assets you have the right to use. Submit DMCA
          takedown notices to{' '}
          <a href="mailto:dmca@thumbframe.com">dmca@thumbframe.com</a>{' '}
          (see our <a href="/dmca" onClick={(e) => { e.preventDefault(); setPage('dmca'); }}>DMCA page</a>).</li>
        <li><strong>NSFW content:</strong> we use moderation APIs
          (Sightengine / Hive) to automatically block nudity, gore,
          and graphic violence at upload time and on AI generation.</li>
        <li>Reverse engineer, scrape, or resell the service.</li>
        <li>Disrupt or overload our infrastructure (rate-limited at
          the API; abuse triggers account suspension).</li>
      </ul>
      <p>
        Violations may result in content removal, account suspension,
        or referral to law enforcement where applicable. We reserve
        the right to remove content and terminate accounts at our
        sole discretion. Report abuse to{' '}
        <a href="mailto:trust@thumbframe.com">trust@thumbframe.com</a>.
      </p>

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
        ThumbFrame uses third-party AI services (Anthropic Claude for
        the ThumbFriend assistant; fal.ai for image generation via
        Flux Schnell, Ideogram 3, and Nano Banana; Remove.bg for
        background removal). When you use these features, your prompt,
        canvas state, and/or reference images are sent to the
        provider's API.
      </p>
      <p>
        <strong>Your data is not used for AI training.</strong>{' '}
        Anthropic and fal.ai both contractually guarantee that data
        sent through their APIs is not used to train their models.
        See our <a href="/privacy" onClick={(e) => { e.preventDefault(); setPage('privacy'); }}>Privacy Policy</a> for the
        full sub-processor list.
      </p>
      <p>
        <strong>Ownership of AI outputs.</strong> To the extent
        copyright in AI-generated images is assignable, you own the
        outputs you generate through ThumbFrame. AI outputs may not
        always be eligible for copyright protection under U.S. law
        (see U.S. Copyright Office guidance, March 2023).
      </p>
      <p>
        <strong>No warranty of non-infringement.</strong> AI outputs
        may inadvertently resemble existing copyrighted works,
        trademarks, or likenesses. We don't warrant that AI outputs
        are free from third-party rights claims. You agree to
        indemnify ThumbFrame for any claims arising from your use,
        modification, or distribution of AI outputs.
      </p>
      <p>
        AI outputs are provided as-is. We don't guarantee that
        AI-generated content is original, accurate, or safe for
        commercial use. You're responsible for verifying usage rights
        before publishing.
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

      <h2>12. Governing law and arbitration</h2>
      <p>
        These terms are governed by the laws of the State of California,
        USA, without regard to conflict-of-laws principles.
      </p>
      <p>
        Any dispute arising from these terms or your use of ThumbFrame
        will be resolved by binding individual arbitration administered
        by the American Arbitration Association under its Consumer
        Arbitration Rules. Arbitration will take place in California or
        another mutually agreed location, or online if the dispute
        amount is below the threshold for an in-person hearing.
        <strong> You waive the right to a jury trial and to participate
        in any class action.</strong>
      </p>
      <p>
        Either party may bring an individual claim in small-claims
        court if eligible. Either party may seek injunctive relief in
        court for IP infringement.
      </p>
      <p>
        You may opt out of this arbitration clause within 30 days of
        first accepting these terms by emailing{' '}
        <a href="mailto:legal@thumbframe.com">legal@thumbframe.com</a>{' '}
        with "ARBITRATION OPT-OUT" in the subject.
      </p>

      <h2>13. Changes and contact</h2>
      <p>
        We may update these terms from time to time. If the changes are
        material, we'll email you or show a notice in the app before
        they take effect.
      </p>
      <p>
        Questions? Email{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
        For abuse / safety reports:{' '}
        <a href="mailto:trust@thumbframe.com">trust@thumbframe.com</a>.
      </p>
    </LegalPageTemplate>
  );
}
