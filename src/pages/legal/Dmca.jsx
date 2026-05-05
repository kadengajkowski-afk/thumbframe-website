import React from 'react';
import LegalPageTemplate from './LegalPageTemplate';
import { useSEO } from '../../hooks/useSEO';

/** Day 55 — DMCA takedown page.
 *
 * Public surface for §512 safe-harbor compliance. Lists how to
 * submit a notice + the required information + the designated
 * agent contact. The DMCA Designated Agent registration with the
 * US Copyright Office is a separate $6 / 3-year filing (manual,
 * Kaden's task — see DEFERRED). Without that registration, the
 * safe harbor doesn't fully attach, but a public DMCA process is
 * still required by every CDN / payment processor as a baseline. */

export default function Dmca({ setPage }) {
  useSEO({
    title: 'DMCA Takedown — ThumbFrame',
    description: 'How to submit a DMCA takedown notice to ThumbFrame.',
  });

  return (
    <LegalPageTemplate
      setPage={setPage}
      eyebrow="Legal"
      title="DMCA Takedown"
      lastUpdated="May 2026"
      palette={{
        core:      '#0c1422',
        mid:       '#1a2840',
        highlight: '#3a4a6a',
        accent:    '#88b0ff',
      }}
    >
      <p>
        ThumbFrame respects the intellectual property rights of others
        and expects our users to do the same. We respond to clear
        notices of alleged copyright infringement under the Digital
        Millennium Copyright Act (DMCA, 17 U.S.C. §512).
      </p>

      <h2>Submitting a notice</h2>
      <p>
        Send takedown notices to{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
        We aim to respond within 24-48 hours of receipt.
      </p>

      <p>Your notice MUST include all of the following:</p>
      <ul>
        <li>A physical or electronic signature of the copyright owner
          (or their authorized agent).</li>
        <li>Identification of the copyrighted work claimed to be
          infringed (e.g. URL, registration number, image / file
          description).</li>
        <li>Identification of the material that is claimed to be
          infringing on ThumbFrame and that you want removed,
          including a URL or other location specific enough to find
          the material.</li>
        <li>Your name, postal address, telephone number, and email
          address.</li>
        <li>A statement that you have a good faith belief that use of
          the material in the manner complained of is not authorized
          by the copyright owner, its agent, or the law.</li>
        <li>A statement, made under penalty of perjury, that the
          information in the notification is accurate and that you
          are the copyright owner or are authorized to act on the
          copyright owner's behalf.</li>
      </ul>

      <p>
        Notices missing any of the above elements may be invalid under
        the DMCA. Knowingly submitting a misrepresentation may subject
        you to liability for damages.
      </p>

      <h2>Counter-notice</h2>
      <p>
        If you believe content of yours was removed in error, you may
        submit a counter-notice to{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>{' '}
        with the elements required by 17 U.S.C. §512(g).
      </p>

      <h2>Repeat infringers</h2>
      <p>
        ThumbFrame will terminate accounts of users who repeatedly
        infringe copyright in appropriate circumstances.
      </p>

      <h2>Designated Agent</h2>
      <p>
        Designated Agent contact:{' '}
        <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>.
      </p>
    </LegalPageTemplate>
  );
}
