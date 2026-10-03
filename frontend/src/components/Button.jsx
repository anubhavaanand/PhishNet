import React from 'react';

/**
 * Button — playful, squishy primary action button.
 * Variants: primary (coral), secondary (teal), ghost, danger.
 * Sizes: md (default), sm, lg.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  iconRight,
  onClick,
  type = 'button',
  className = '',
  style,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--pn-space-2)',
    fontFamily: 'var(--pn-font-body)',
    fontWeight: 700,
    borderRadius: 'var(--pn-radius-md)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: `transform var(--pn-dur-fast) var(--pn-ease-spring), box-shadow var(--pn-dur-normal) var(--pn-ease-smooth), opacity var(--pn-dur-fast)`,
    border: 'none',
    position: 'relative',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    opacity: disabled ? 0.5 : 1,
    outline: 'none',
  };

  const sizes = {
    sm: { padding: '6px 14px', fontSize: 'var(--pn-text-sm)' },
    md: { padding: '10px 20px', fontSize: 'var(--pn-text-base)', minHeight: '40px' },
    lg: { padding: '14px 28px', fontSize: 'var(--pn-text-md)', minHeight: '48px' },
  };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, var(--pn-coral-light), var(--pn-coral))',
      color: '#fff',
      boxShadow: 'var(--pn-shadow-coral)',
    },
    secondary: {
      background: 'linear-gradient(135deg, var(--pn-teal-light), var(--pn-teal))',
      color: '#fff',
      boxShadow: 'var(--pn-shadow-teal)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--pn-text-secondary)',
      border: '1.5px solid var(--pn-border)',
    },
    danger: {
      background: 'linear-gradient(135deg, var(--pn-rose-light), var(--pn-rose))',
      color: '#fff',
      boxShadow: 'var(--pn-shadow-rose)',
    },
  };

  const hoverTransform = !disabled && !loading ? 'translateY(-2px)' : 'none';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      style={{
        ...base,
        ...sizes[size],
        ...variants[variant],
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled || loading) return;
        e.currentTarget.style.transform = hoverTransform;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
      }}
      onMouseDown={(e) => {
        if (disabled || loading) return;
        e.currentTarget.style.transform = 'scale(0.96)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = hoverTransform;
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px var(--pn-coral-pale), ${variants[variant].boxShadow || ''}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = variants[variant].boxShadow || '';
      }}
      {...rest}
    >
      {loading && (
        <span
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'pn-spin 0.6s linear infinite',
          }}
        />
      )}
      {!loading && icon}
      {!loading && <span>{children}</span>}
      {!loading && iconRight}
    </button>
  );
}
