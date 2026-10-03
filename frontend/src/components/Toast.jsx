import React from 'react';
import { Icon } from './Icon';

/**
 * Toast — brief notification that slides in and auto-dismisses.
 */
export function Toast({ message, type = 'info', onDismiss }) {
  const colors = {
    info: { bg: 'var(--pn-teal-pale)', fg: 'var(--pn-teal-dark)', icon: 'star' },
    success: { bg: 'var(--pn-green-pale)', fg: 'var(--pn-green-dark)', icon: 'shield' },
    error: { bg: 'var(--pn-rose-pale)', fg: 'var(--pn-rose-dark)', icon: 'alert' },
  };
  const c = colors[type] || colors.info;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--pn-space-2)',
        padding: '10px 18px',
        borderRadius: 'var(--pn-radius-full)',
        background: 'var(--pn-bg-card)',
        border: `1.5px solid ${c.fg}`,
        color: c.fg,
        fontSize: 'var(--pn-text-sm)',
        fontWeight: 600,
        boxShadow: 'var(--pn-shadow-lg)',
        zIndex: 'var(--pn-z-toast)',
        animation: 'pn-bounce-in 0.3s var(--pn-ease-spring) both',
      }}
    >
      <Icon name={c.icon} size={16} />
      {message}
    </div>
  );
}
