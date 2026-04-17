import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { fadeUp, stagger } from '../../lib/motion';

const FREE_FEATURES = [
  '5 thumbnails per month',
  'Free background remover',
  '10 starter templates',
  '1280×720 export',
  'Community support',
];

const PRO_FEATURES = [
  'Unlimited thumbnails',
  'CTR scoring on every export',
  'A/B variant generator',
  'AI thumbnail generation',
  'All templates + niche packs',
  'Face cutout + auto-outline',
  'Priority AI processing',
  'No watermark',
  'Priority support',
];

function FeatureList({ items }) {
  return (
    <ul className="space-y-3">
      {items.map(item => (
        <li key={item} className="flex items-start gap-3 text-sm text-text-1">
          <Check size={16} className="text-orange shrink-0 mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function Pricing({ onNavigate }) {
  const [annual, setAnnual] = useState(false);
  const proPrice  = annual ? '$12' : '$15';
  const proPeriod = annual ? 'billed annually' : 'per month';

  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          title="Simple pricing. Upgrade when you're ready."
        />

        {/* Toggle */}
        <motion.div {...fadeUp} className="flex items-center justify-center gap-3 mb-14">
          <span className={`text-sm ${!annual ? 'text-text-0 font-medium' : 'text-text-2'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(a => !a)}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${annual ? 'bg-orange' : 'bg-space-3'}`}
            aria-label="Toggle annual pricing"
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'translate-x-6' : ''}`} />
          </button>
          <span className={`text-sm ${annual ? 'text-text-0 font-medium' : 'text-text-2'}`}>
            Annual
            {annual && <Badge variant="lime" className="ml-2">Save 20%</Badge>}
          </span>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <motion.div {...stagger(0)} className="bg-space-2 border border-space-3 rounded-xl p-8 glow-card">
            <h3 className="text-xl font-bold text-text-0 mb-1">Free</h3>
            <p className="text-3xl font-bold text-text-0 mb-1">$0 <span className="text-base font-normal text-text-2">/ month</span></p>
            <p className="text-sm text-text-2 mb-6">For creators just getting started.</p>
            <FeatureList items={FREE_FEATURES} />
            <div className="mt-8">
              <Button variant="ghost" size="md" onClick={() => onNavigate?.('signup')} className="w-full justify-center border border-space-3">
                Start free →
              </Button>
            </div>
          </motion.div>

          {/* Pro */}
          <motion.div {...stagger(0.1)} className="relative bg-space-2 border-2 border-orange/50 rounded-xl p-8 glow-orange scale-[1.02]">
            <div className="absolute -top-3 right-6">
              <Badge variant="orange">Most popular</Badge>
            </div>
            <h3 className="text-xl font-bold text-text-0 mb-1">Pro</h3>
            <p className="text-3xl font-bold text-text-0 mb-1">
              {proPrice} <span className="text-base font-normal text-text-2">/ month</span>
            </p>
            <p className="text-sm text-text-2 mb-2">{annual ? 'Billed $144/year' : proPeriod}</p>
            <p className="text-sm text-text-1 mb-6">For creators who ship.</p>
            <p className="text-xs text-text-2 mb-4 font-medium uppercase tracking-wide">Everything in Free, plus:</p>
            <FeatureList items={PRO_FEATURES} />
            <div className="mt-8">
              <Button size="md" onClick={() => onNavigate?.('signup')} className="w-full justify-center">
                Go Pro →
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.p {...fadeUp} className="mt-8 text-sm text-text-2 text-center">
          Cancel anytime from your dashboard. Keep Pro access through your billing period.
        </motion.p>
      </div>
    </section>
  );
}
