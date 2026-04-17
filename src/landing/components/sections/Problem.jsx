import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, stagger } from '../../lib/motion';

const TOOLS = [
  { name: 'Canva',     line: 'Great for everything except the 1280×720 that actually matters.' },
  { name: 'Photoshop', line: '$23/month to align two text layers.' },
  { name: 'Photopea',  line: 'Free, powerful, built in 2013. It shows.' },
];

export default function Problem() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6">
        <motion.h2 {...fadeUp} className="text-3xl md:text-5xl font-bold text-text-0 tracking-tight text-center mb-16">
          Every thumbnail tool is the wrong tool.
        </motion.h2>

        <div className="space-y-8 mb-16">
          {TOOLS.map((t, i) => (
            <motion.div key={t.name} {...stagger(i * 0.1)} className="flex gap-4 items-baseline">
              <span className="text-lg font-bold text-text-2 shrink-0 w-28 text-right">{t.name}</span>
              <span className="text-text-1 text-lg">{t.line}</span>
            </motion.div>
          ))}
        </div>

        <motion.p {...fadeUp} className="text-xl md:text-2xl text-text-1 text-center leading-relaxed">
          ThumbFrame is the first editor designed{' '}
          <span className="text-orange font-semibold">specifically for the highest-leverage image in your business.</span>
        </motion.p>
      </div>
    </section>
  );
}
