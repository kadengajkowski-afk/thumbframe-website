import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/motion';

export default function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <motion.div className="text-center mb-16" {...fadeUp}>
      {eyebrow && (
        <p className="text-cyan text-sm font-medium tracking-wide uppercase mb-4">{eyebrow}</p>
      )}
      <h2 className="text-3xl md:text-5xl font-bold text-text-0 tracking-tight">{title}</h2>
      {subtitle && (
        <p className="mt-4 text-lg text-text-1 max-w-2xl mx-auto">{subtitle}</p>
      )}
    </motion.div>
  );
}
