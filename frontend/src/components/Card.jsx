import React from 'react';

/**
 * Card — rounded surface container with optional accent strip.
 */
export function Card({ children, accent, padding = 'md', className = '', style, ...rest }) {
  const accents = {
    coral: 'var(--pn-coral)',
    teal: 'var(--pn-teal)',
    green: 'var(--pn-green)',
    amber: 'var(--pn-amber)',
    rose: 'var(--pn-rose)',
    gold: 'var(--pn-gold)',
    none: 'transparent',
  };

  const pads = {
    sm: 'var(--pn-space-3)',
    md: 'var(--pn-space-4)',
    lg: 'var(--pn-space-6)',
  };

  return (
    <div
      className={className}
      style={{
        background: 'var(--pn-bg-card)',
        borderRadius: 'var(--pn-radius-lg)',
        border: '1px solid var(--pn-border)',
        padding: pads[padding],
        boxShadow: 'var(--pn-shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {accent && accent !== 'none' && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${accents[accent]}, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}
