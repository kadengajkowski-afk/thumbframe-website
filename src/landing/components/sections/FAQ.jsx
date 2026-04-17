import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { fadeUp } from '../../lib/motion';

const ITEMS = [
  {
    q: 'Can I cancel anytime?',
    a: "Yes. One click in your dashboard. You keep Pro access through the end of your billing period — no trick cancellation flow, no \"are you sure\" guilt trip.",
  },
  {
    q: 'Does ThumbFrame work on mobile?',
    a: "The editor is desktop-first (thumbnails are 1280×720 and most creators edit on a real screen). The mobile editor is in beta — join the Pro tier to get early access. Your dashboard works on any device.",
  },
  {
    q: 'Do I own my thumbnails and designs?',
    a: "100%. Your designs are yours. We don't claim any rights, we don't train models on your private work without opt-in, and you can export and delete everything at any time.",
  },
  {
    q: 'Is there a free trial of Pro?',
    a: "The free tier is free forever, no trial needed. Upgrade to Pro when you want CTR scoring and A/B variants — that's the moment most creators find it worth it.",
  },
  {
    q: 'Does it integrate with YouTube?',
    a: "Export is optimized for YouTube (1280×720 JPEG under 2MB, the format YouTube actually wants). Direct upload-to-YouTube is on the roadmap for Q3 2026.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(-1);

  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeading title="Questions." />

        <motion.div {...fadeUp} className="divide-y divide-space-3">
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between py-5 text-left cursor-pointer group"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                >
                  <span className="text-base font-medium text-text-0 group-hover:text-orange transition-colors">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-text-2 transition-transform duration-200 shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-text-1 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
