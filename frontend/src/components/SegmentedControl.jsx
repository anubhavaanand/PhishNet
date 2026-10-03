import React from 'react';

/**
 * SegmentedControl — playful tab switcher with sliding indicator.
 * Used for the main popup tabs and settings sub-sections.
 */
export function SegmentedControl({ items, active, onChange, size = 'md' }) {
  const sizes = {
    sm: { padding: '6px 10px', fontSize: 'var(--pn-text-xs)', gap: 4 },
    md: { padding: '8px 14px', fontSize: 'var(--pn-text-sm)', gap: 6 },
  };
  const s = sizes[size];

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--pn-bg-subtle)',
        borderRadius: 'var(--pn-radius-md)',
        padding: 3,
      }}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s.gap,
              padding: s.padding,
              border: 'none',
              borderRadius: 'var(--pn-radius-sm)',
              background: isActive ? 'var(--pn-bg-card)' : 'transparent',
              color: isActive ? 'var(--pn-coral)' : 'var(--pn-text-secondary)',
              fontFamily: 'var(--pn-font-body)',
              fontSize: s.fontSize,
              fontWeight: 700,
              cursor: 'pointer',
              transition: `all var(--pn-dur-fast) var(--pn-ease-smooth)`,
              boxShadow: isActive ? 'var(--pn-shadow-sm)' : 'none',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--pn-text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--pn-text-secondary)';
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
