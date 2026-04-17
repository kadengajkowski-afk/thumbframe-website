import React from 'react';

const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap';

const variants = {
  primary: 'bg-orange text-white hover:brightness-110 glow-orange',
  secondary: 'border border-cyan text-cyan hover:bg-cyan/10',
  ghost: 'text-text-0 hover:underline underline-offset-4',
};

const sizes = {
  sm: 'text-sm px-4 py-2',
  md: 'text-base px-6 py-3',
  lg: 'text-lg px-8 py-4',
};

export default function Button({ variant = 'primary', size = 'md', href, children, className = '', ...props }) {
  const cls = `${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`;
  if (href) return <a href={href} className={cls} {...props}>{children}</a>;
  return <button className={cls} {...props}>{children}</button>;
}
