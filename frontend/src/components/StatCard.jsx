import React from 'react';
import { Icon } from './Icon';
import { AnimatedNumber } from './AnimatedNumber';

/**
 * StatCard — playful stat display with animated count-up.
 */
export function StatCard({ icon, label, value, color = 'coral', delay = 0 }) {
  const colors = {
    coral: { bg: 'var(--pn-coral-pale)', fg: 'var(--pn-coral)' },
    teal: { bg: 'var(--pn-teal-pale)', fg: 'var(--pn-teal)' },
    green: { bg: 'var(--pn-green-pale)', fg: 'var(--pn-green)' },
    rose: { bg: 'var(--pn-rose-pale)', fg: 'var(--pn-rose)' },
    amber: { bg: 'var(--pn-amber-pale)', fg: 'var(--pn-amber)' },
    gold: { bg: 'var(--pn-gold-pale)', fg: 'var(--pn-gold)' },
  };
  const c = colors[color] || colors.coral;

  return (
    <div
      style={{
        background: 'var(--pn-bg-card)',
        borderRadius: 'var(--pn-radius-md)',
        border: '1px solid var(--pn-border)',
        padding: 'var(--pn-space-3) var(--pn-space-2)',
        textAlign: 'center',
        boxShadow: 'var(--pn-shadow-sm)',
        animation: `pn-bounce-in 0.4s var(--pn-ease-spring) both`,
        animationDelay: `${delay}s`,
        transition: 'transform var(--pn-dur-fast) var(--pn-ease-spring)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 32,
        height: 32,
        margin: '0 auto var(--pn-space-2)',
        borderRadius: 'var(--pn-radius-sm)',
        background: c.bg,
        color: c.fg,
        display: 'grid',
        placeItems: 'center',
      }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{
        fontFamily: 'var(--pn-font-heading)',
        fontSize: 'var(--pn-text-xl)',
        fontWeight: 800,
        color: c.fg,
        lineHeight: 1,
      }}>
        <AnimatedNumber value={value} />
      </div>
      <div style={{
        fontSize: 'var(--pn-text-xs)',
        color: 'var(--pn-text-tertiary)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginTop: 'var(--pn-space-1)',
      }}>
        {label}
      </div>
    </div>
  );
}
