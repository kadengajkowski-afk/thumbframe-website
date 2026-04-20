// Landing entry — routes through to the Phase 2 landing page.
// The top-level filename stays LandingPageV2 because App.js imports it;
// the actual page composition lives in ./pages/LandingPage.jsx.

import React from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';
import LandingPage from './pages/LandingPage';

export default function LandingPageV2({ setPage }) {
  return <LandingPage onNavigate={setPage} />;
}
