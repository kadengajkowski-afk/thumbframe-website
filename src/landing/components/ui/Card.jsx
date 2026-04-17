import React from 'react';

export default function Card({ elevated, className = '', children, ...props }) {
  const base = 'bg-space-2 border rounded-xl p-8';
  const border = elevated ? 'border-orange/40 glow-orange' : 'border-space-3 glow-card';
  return (
    <div className={`${base} ${border} ${className}`} {...props}>
      {children}
    </div>
  );
}
