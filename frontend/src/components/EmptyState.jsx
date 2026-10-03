import React from 'react';

/**
 * EmptyState — friendly placeholder when there's no data.
 */
export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--pn-space-8) var(--pn-space-4)',
        gap: 'var(--pn-space-3)',
        animation: 'pn-fade-up 0.4s var(--pn-ease-out) both',
      }}
    >
      {icon && (
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--pn-bg-subtle)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--pn-text-tertiary)',
          marginBottom: 'var(--pn-space-1)',
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 'var(--pn-text-md)', fontWeight: 700, color: 'var(--pn-text-secondary)' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', maxWidth: 260, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      )}
      {action}
    </div>
  );
}
