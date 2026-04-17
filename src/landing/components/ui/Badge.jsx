import React from 'react';

const colors = {
  cyan:   'border-cyan/40 text-cyan',
  orange: 'border-orange/40 text-orange',
  lime:   'border-lime/40 text-lime',
};

export default function Badge({ variant = 'cyan', pulse, children }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border ${colors[variant] || colors.cyan}`}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${variant === 'cyan' ? 'bg-cyan' : variant === 'orange' ? 'bg-orange' : 'bg-lime'}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${variant === 'cyan' ? 'bg-cyan' : variant === 'orange' ? 'bg-orange' : 'bg-lime'}`} />
        </span>
      )}
      {children}
    </span>
  );
}
