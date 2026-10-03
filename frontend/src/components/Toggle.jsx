import React from 'react';

/**
 * Toggle — playful switch with bounce animation.
 */
export function Toggle({ checked, onChange, disabled, ariaLabel, color = 'coral' }) {
  const colors = {
    coral: { on: 'var(--pn-coral)', glow: 'var(--pn-coral-pale)' },
    teal: { on: 'var(--pn-teal)', glow: 'var(--pn-teal-pale)' },
    green: { on: 'var(--pn-green)', glow: 'var(--pn-green-pale)' },
  };
  const c = colors[color] || colors.coral;

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        width: 48,
        height: 28,
        borderRadius: 'var(--pn-radius-full)',
        border: 'none',
        background: checked ? c.on : 'var(--pn-bg-hover)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: `background var(--pn-dur-normal) var(--pn-ease-smooth)`,
        flexShrink: 0,
        boxShadow: checked ? `0 0 12px ${c.glow}` : 'var(--pn-shadow-sm)',
        outline: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 3px var(--pn-coral-pale)`; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = checked ? `0 0 12px ${c.glow}` : 'var(--pn-shadow-sm)'; }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          transition: `left var(--pn-dur-normal) var(--pn-ease-spring)`,
        }}
      />
    </button>
  );
}
