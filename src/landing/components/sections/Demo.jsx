import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, Wand2, Target } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { fadeUp, stagger } from '../../lib/motion';

const PHASES = [
  { icon: Scissors, title: 'Cutout',  desc: 'Photo in. Background out. Free.' },
  { icon: Wand2,    title: 'Compose', desc: 'Add text, effects, templates. An editor that thinks like a thumbnail editor.' },
  { icon: Target,   title: 'Score',   desc: 'See the CTR prediction. Tweak. Ship the winner.' },
];

export default function Demo() {
  return (
    <section id="demo" className="py-24 md:py-32 bg-space-1">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading title="This is what 60 seconds of ThumbFrame looks like." />

        <motion.div {...fadeUp} className="max-w-4xl mx-auto mb-16">
          <div className="aspect-video rounded-xl overflow-hidden border border-space-3 bg-space-2">
            <video
              controls
              preload="metadata"
              width={1280}
              height={720}
              className="w-full h-full"
              aria-label="ThumbFrame 60-second demo"
            >
              <source src="/assets/videos/hero-demo.webm" type="video/webm" />
              <source src="/assets/videos/hero-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {PHASES.map((p, i) => (
            <motion.div key={p.title} {...stagger(i * 0.1)} className="text-center">
              <p.icon size={20} className="mx-auto mb-3 text-orange" />
              <h3 className="text-lg font-semibold text-text-0 mb-1">{p.title}</h3>
              <p className="text-sm text-text-1">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
