import React from 'react';

/**
 * ConfidenceRing — circular progress ring showing confidence percentage.
 * Color shifts based on verdict type.
 */
export function ConfidenceRing({ value, color = 'coral', size = 56, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round((value || 0) * 100);
  const offset = circumference - (pct / 100) * circumference;

  const colors = {
    coral: 'var(--pn-coral)',
    teal: 'var(--pn-teal)',
    green: 'var(--pn-green)',
    rose: 'var(--pn-rose)',
    amber: 'var(--pn-amber)',
    gold: 'var(--pn-gold)',
  };

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--pn-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[color] || colors.coral}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s var(--pn-ease-out)',
          }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--pn-font-mono)',
          fontSize: size > 50 ? 'var(--pn-text-md)' : 'var(--pn-text-sm)',
          fontWeight: 800,
          color: colors[color] || colors.coral,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}
