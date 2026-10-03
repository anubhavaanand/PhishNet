import React from 'react';
import { Icon } from './Icon';

/**
 * Header — branded top bar with logo and animated status pill.
 */
export function Header({ status, progress }) {
  const statusConfig = {
    loading: { label: progress > 0 ? `Loading ${progress}%` : 'Starting up...', dotColor: 'var(--pn-amber)', pulse: true },
    ready: { label: 'Protected', dotColor: 'var(--pn-green)', pulse: true },
    error: { label: 'Rules Active', dotColor: 'var(--pn-rose)', pulse: false },
  };
  const s = statusConfig[status] || statusConfig.loading;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        background: 'var(--pn-bg-card)',
        borderBottom: '1px solid var(--pn-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--pn-radius-md)',
            background: 'linear-gradient(135deg, var(--pn-coral-light), var(--pn-coral))',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            boxShadow: 'var(--pn-shadow-coral)',
          }}
        >
          <Icon name="fish" size={20} />
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--pn-font-heading)',
            fontSize: 'var(--pn-text-md)',
            fontWeight: 800,
            color: 'var(--pn-text-primary)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            PhishNet
          </div>
          <div style={{
            fontSize: 'var(--pn-text-xs)',
            color: 'var(--pn-text-tertiary)',
            fontWeight: 500,
          }}>
            On-Device AI Protection
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 'var(--pn-radius-full)',
          background: 'var(--pn-bg-subtle)',
          fontSize: 'var(--pn-text-xs)',
          fontWeight: 700,
          color: 'var(--pn-text-secondary)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: s.dotColor,
            boxShadow: s.pulse ? `0 0 8px ${s.dotColor}` : 'none',
            animation: s.pulse ? 'pn-pulse-ring 2s infinite' : 'none',
          }}
        />
        {s.label}
      </div>
    </div>
  );
}
