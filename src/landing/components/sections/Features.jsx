import React from 'react';
import { motion } from 'framer-motion';
import { Scissors, Target, Dices, Sparkles, Smile, LayoutGrid } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Badge from '../ui/Badge';
import { stagger } from '../../lib/motion';

const FEATURES = [
  { icon: Scissors,   title: 'Free AI Background Remover', desc: 'One-click cutouts with clean, thumbnail-ready edges. Free, forever.', badge: { label: 'Free forever', variant: 'cyan' } },
  { icon: Target,     title: 'CTR Score',                   desc: "See how your thumbnail will perform before you upload. No more guessing which version wins.", badge: { label: 'Pro', variant: 'orange' } },
  { icon: Dices,      title: 'A/B Variants',                desc: 'Generate 4 versions of any thumbnail in one click. Test the one your audience actually clicks.', badge: { label: 'Pro', variant: 'orange' } },
  { icon: Sparkles,   title: 'AI Generate',                 desc: 'Describe your video. Get a thumbnail draft in seconds. Iterate from there.', badge: null },
  { icon: Smile,      title: 'Face Cutout + Outline',       desc: 'Auto-detect your face, cut it out, add the classic YouTuber outline. One click.', badge: null },
  { icon: LayoutGrid, title: 'Niche Templates',             desc: 'Start from what works in your niche. Minecraft, finance, vlogs, tech, gaming, and growing.', badge: null },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          title="Everything the other tools are missing."
          subtitle="Six features no general-purpose editor will ever ship."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...stagger(i * 0.08)}
              className="bg-space-2 border border-space-3 rounded-xl p-8 transition-all duration-200 hover:border-orange/40 hover:scale-[1.02] glow-card hover:glow-orange"
            >
              <f.icon size={24} className="text-orange mb-4" />
              <h3 className="text-xl font-semibold text-text-0 mb-2">{f.title}</h3>
              <p className="text-text-1 text-sm leading-relaxed mb-3">{f.desc}</p>
              {f.badge && <Badge variant={f.badge.variant}>{f.badge.label}</Badge>}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
