import React from 'react';
import { motion } from 'framer-motion';
import SectionHeading from '../ui/SectionHeading';
import { fadeUp } from '../../lib/motion';

const ROWS = [
  { label: 'Built for thumbnails',    tf: true,  canva: false, ps: false, pp: false },
  { label: 'AI thumbnail generation', tf: true,  canva: 'partial', ps: false, pp: false },
  { label: 'CTR scoring',             tf: true,  canva: false, ps: false, pp: false },
  { label: 'A/B variant generator',   tf: true,  canva: false, ps: false, pp: false },
  { label: 'Free background remover', tf: true,  canva: 'partial', ps: false, pp: 'partial' },
  { label: 'YouTube-optimized export', tf: true, canva: false, ps: false, pp: false },
];

const Check = () => <span className="text-orange font-bold">✓</span>;
const Cross = () => <span className="text-text-2">✗</span>;
const Partial = () => <span className="text-cyan">~</span>;

function Cell({ v }) {
  if (v === true)      return <Check />;
  if (v === 'partial') return <Partial />;
  return <Cross />;
}

export default function Comparison() {
  return (
    <section className="py-24 md:py-32 bg-space-1">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading title="ThumbFrame vs. the tools you're probably using." />

        <motion.div {...fadeUp} className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-space-3">
                <th className="text-left py-3 pr-4 text-text-2 font-medium" />
                <th className="py-3 px-4 text-orange font-bold bg-orange/5 border-x border-orange/20 rounded-t-lg">ThumbFrame</th>
                <th className="py-3 px-4 text-text-1 font-medium">Canva</th>
                <th className="py-3 px-4 text-text-1 font-medium">Photoshop</th>
                <th className="py-3 px-4 text-text-1 font-medium">Photopea</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r.label} className="border-b border-space-3/50">
                  <td className="py-3 pr-4 text-text-1">{r.label}</td>
                  <td className="py-3 px-4 text-center bg-orange/5 border-x border-orange/20"><Cell v={r.tf} /></td>
                  <td className="py-3 px-4 text-center"><Cell v={r.canva} /></td>
                  <td className="py-3 px-4 text-center"><Cell v={r.ps} /></td>
                  <td className="py-3 px-4 text-center"><Cell v={r.pp} /></td>
                </tr>
              ))}
              <tr className="border-b border-space-3">
                <td className="py-3 pr-4 text-text-1 font-semibold">Starting price</td>
                <td className="py-3 px-4 text-center font-bold text-orange bg-orange/5 border-x border-orange/20">Free</td>
                <td className="py-3 px-4 text-center text-text-1 font-medium">Free</td>
                <td className="py-3 px-4 text-center text-text-1 font-medium">$22.99/mo</td>
                <td className="py-3 px-4 text-center text-text-1 font-medium">Free</td>
              </tr>
            </tbody>
          </table>
        </motion.div>

        <p className="mt-6 text-xs text-text-2 text-center">
          Comparison based on publicly listed features as of April 2026. Trademarks belong to their respective owners.
        </p>
      </div>
    </section>
  );
}
