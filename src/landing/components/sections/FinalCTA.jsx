import React from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import { fadeUp } from '../../lib/motion';

export default function FinalCTA({ onNavigate }) {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <motion.div {...fadeUp} className="relative bg-space-2 border border-orange/30 rounded-2xl p-12 md:p-16 glow-orange">
          <h2 className="text-3xl md:text-5xl font-bold text-text-0 tracking-tight mb-4">
            Stop second-guessing thumbnails.
          </h2>
          <p className="text-lg text-text-1 mb-8">
            Start free. Go Pro when you want the science.
          </p>
          <Button size="lg" onClick={() => onNavigate?.('signup')}>
            Start free →
          </Button>
          <p className="mt-4 text-sm text-text-2">
            No credit card. Cancel anytime. Free tier forever.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
