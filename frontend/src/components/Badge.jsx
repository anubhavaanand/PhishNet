import React from 'react';
import { Icon } from './Icon';
import { getVerdictMeta } from '@/lib/constants';

/**
 * Badge — inline verdict pill for scan results.
 * Matches the badges injected into Gmail/Outlook.
 */
export function Badge({ label, confidence, size = 'md' }) {
  const meta = getVerdictMeta(label);
  const pct = Math.round((confidence || 0) * 100);

  const colorMap = {
    green: { bg: 'var(--pn-green-pale)', fg: 'var(--pn-green-dark)', border: 'var(--pn-green)' },
    rose: { bg: 'var(--pn-rose-pale)', fg: 'var(--pn-rose-dark)', border: 'var(--pn-rose)' },
    amber: { bg: 'var(--pn-amber-pale)', fg: 'var(--pn-amber-dark)', border: 'var(--pn-amber)' },
    gold: { bg: 'var(--pn-gold-pale)', fg: 'var(--pn-amber-dark)', border: 'var(--pn-gold)' },
  };
  const c = colorMap[meta.color] || colorMap.amber;

  const sizes = {
    sm: { padding: '3px 10px', fontSize: 'var(--pn-text-xs)', iconSize: 14 },
    md: { padding: '5px 14px', fontSize: 'var(--pn-text-sm)', iconSize: 16 },
    lg: { padding: '7px 18px', fontSize: 'var(--pn-text-base)', iconSize: 18 },
  };
  const s = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--pn-space-1)',
        padding: s.padding,
        borderRadius: 'var(--pn-radius-full)',
        background: c.bg,
        color: c.fg,
        border: `1.5px solid ${c.border}`,
        fontSize: s.fontSize,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        animation: 'pn-pop 0.3s var(--pn-ease-spring) both',
      }}
    >
      <Icon name={meta.icon} size={s.iconSize} />
      {meta.short} · {pct}%
    </span>
  );
}
