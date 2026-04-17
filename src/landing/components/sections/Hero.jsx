import React from 'react';
import { motion } from 'framer-motion';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { heroFade } from '../../lib/motion';

export default function Hero({ onNavigate }) {
  return (
    <section className="min-h-screen flex items-center pt-16">
      <div className="max-w-6xl mx-auto px-6 w-full grid grid-cols-1 md:grid-cols-[55fr_45fr] gap-12 items-center">
        {/* Text side */}
        <div>
          <Badge variant="cyan">Now with free AI background remover</Badge>

          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight text-text-0 leading-[1.05]">
            Score every thumbnail before you upload.
          </h1>

          <motion.p {...heroFade(0.1)} className="mt-6 text-lg md:text-xl text-text-1 max-w-lg leading-relaxed">
            An out-of-this-world thumbnail editor, built for YouTubers.
            AI generation, CTR scoring, and A/B variants — all in one place.
          </motion.p>

          <motion.div {...heroFade(0.2)} className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={() => onNavigate?.('signup')}>
              Start free — no credit card →
            </Button>
            <Button variant="ghost" size="lg" href="#demo">
              Watch 60s demo ↓
            </Button>
          </motion.div>

          <motion.p {...heroFade(0.25)} className="mt-4 text-sm text-text-2">
            Free tier · No credit card · Cancel anytime
          </motion.p>
        </div>

        {/* Video side */}
        <motion.div {...heroFade(0.3)} className="relative">
          <div className="rounded-xl border border-orange/30 overflow-hidden glow-orange">
            <div className="aspect-video bg-space-2 flex items-center justify-center">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                width={1280}
                height={720}
                className="w-full h-full object-cover"
                aria-label="ThumbFrame demo: background removal, composition, and CTR scoring"
              >
                <source src="/assets/videos/hero-demo.webm" type="video/webm" />
                <source src="/assets/videos/hero-demo.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
          {/* Live demo badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-space-0/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-space-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            <span className="text-xs text-text-1 font-medium">Live demo</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
