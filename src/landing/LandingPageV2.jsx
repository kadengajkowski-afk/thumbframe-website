import React from 'react';
import './landing.css';
import StarField from './components/bg/StarField';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Hero from './components/sections/Hero';
import Demo from './components/sections/Demo';
import Problem from './components/sections/Problem';
import Features from './components/sections/Features';
import Comparison from './components/sections/Comparison';
import Pricing from './components/sections/Pricing';
import FAQ from './components/sections/FAQ';
import FinalCTA from './components/sections/FinalCTA';

export default function LandingPageV2({ setPage }) {
  const onNavigate = (page) => setPage?.(page);

  return (
    <div className="landing-root min-h-screen">
      <a href="#main" className="skip-to-main">Skip to main content</a>
      <StarField />
      <Navbar onNavigate={onNavigate} />
      <main id="main">
        <Hero onNavigate={onNavigate} />
        <Demo />
        <Problem />
        <Features />
        <Comparison />
        <Pricing onNavigate={onNavigate} />
        <FAQ />
        <FinalCTA onNavigate={onNavigate} />
      </main>
      <Footer />
    </div>
  );
}
