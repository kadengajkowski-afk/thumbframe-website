import React from 'react';
import LegalPageTemplate from './LegalPageTemplate';
import { useSEO } from '../../hooks/useSEO';

export default function Refund({ setPage }) {
  useSEO({
    title: 'Refund Policy — ThumbFrame',
    description: 'ThumbFrame refund policy and cancellation details.',
  });

  return (
    <LegalPageTemplate
      setPage={setPage}
      eyebrow="Legal"
      title="Refund Policy"
      lastUpdated="April 2026"
      palette={{
        core:      '#180808',
        mid:       '#3a1a20',
        highlight: '#6a3848',
        accent:    '#ffb088',
      }}
    >
      <p>
        We don't offer refunds on Pro subscriptions.
      </p>
      <p>
        You can cancel anytime from the Billing tab in Settings. When
        you cancel, you'll keep Pro access until the end of your
        current paid period. After that, your account automatically
        reverts to the Free plan.
      </p>
      <p>
        If you're unhappy with ThumbFrame, we'd genuinely like to know
        why. Email us at{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>{' '}
        — we read every message and it helps us improve.
      </p>
      <p>
        For billing questions or disputes, contact us at{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
      </p>
    </LegalPageTemplate>
  );
}
