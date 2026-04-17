import React from 'react';

const COLUMNS = [
  { title: 'Product',   links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Changelog', href: '/changelog' }, { label: 'Roadmap', href: '#' }] },
  { title: 'Resources', links: [{ label: 'Help', href: '/support' }, { label: 'Blog', href: '/blog' }, { label: 'FAQ', href: '#faq' }] },
  { title: 'Company',   links: [{ label: 'About', href: '/about' }, { label: 'Contact', href: '/support' }, { label: 'Twitter/X', href: '#' }, { label: 'YouTube', href: '#' }] },
  { title: 'Legal',     links: [{ label: 'Terms', href: '/terms' }, { label: 'Privacy', href: '/privacy' }, { label: 'Cookie policy', href: '/privacy' }] },
];

export default function Footer() {
  return (
    <footer className="bg-space-1 border-t border-space-3">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {COLUMNS.map(col => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-2 mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-text-1 hover:text-text-0 transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-space-3 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-text-2">&copy; 2026 ThumbFrame. Built in California.</p>
          <p className="text-sm text-cyan hover:text-orange transition-colors cursor-pointer">
            🚀 <code>/galaxy</code> coming soon
          </p>
        </div>
      </div>
    </footer>
  );
}
