import React from 'react';

/**
 * LogoMark — the PhishNet mark: a fish hook lifting a net bag.
 *
 * Drawn as pixel rects rather than a bitmap so it stays crisp at any size and
 * needs no image asset. `variant="mono"` renders the whole mark in one colour,
 * which is what the coral header tile uses.
 *
 * Animation is CSS-only (see pn-logo-lift / pn-logo-net in tokens.css) and is
 * disabled by the global prefers-reduced-motion block.
 */

const P = 1; // pixel unit; the viewBox scales it

const HOOK = [
  [7, 1, 2], [7, 2, 2], [7, 3, 2], [7, 4, 2], [7, 5, 2], [7, 6, 2],
  [7, 7, 2], [11, 7, 2], [7, 8, 2], [10, 8, 2], [7, 9, 4], [7, 10, 3],
];

const NET = [
  [4, 11, 10],
  [3, 12, 1], [6, 12, 1], [11, 12, 1], [14, 12, 1],
  [2, 13, 1], [6, 13, 1], [11, 13, 1], [15, 13, 1],
  [2, 14, 1], [7, 14, 1], [10, 14, 1], [15, 14, 1],
  [2, 15, 1], [8, 15, 2], [15, 15, 1],
  [2, 16, 1], [7, 16, 1], [10, 16, 1], [15, 16, 1],
  [3, 17, 1], [7, 17, 1], [12, 17, 1], [16, 17, 1],
  [4, 18, 10],
];

export function LogoMark({ size = 20, mono = false, animated = true, title }) {
  const hookFill = mono ? 'currentColor' : '#fff';
  const netFill = mono ? 'currentColor' : 'var(--pn-teal, #4ecdc4)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g
        className={animated ? 'pn-logo-hook' : undefined}
        style={animated ? { animation: 'pn-logo-lift 2.8s ease-in-out infinite' } : undefined}
      >
        {HOOK.map(([x, y, w]) => (
          <rect key={`h${x}-${y}`} x={x * P} y={y * P} width={w * P} height={P} fill={hookFill} />
        ))}
      </g>

      <g
        className={animated ? 'pn-logo-net' : undefined}
        style={animated ? { animation: 'pn-logo-net 2.8s ease-in-out infinite' } : undefined}
      >
        {NET.map(([x, y, w]) => (
          <rect key={`n${x}-${y}`} x={x * P} y={y * P} width={w * P} height={P} fill={netFill} />
        ))}
      </g>
    </svg>
  );
}

export default LogoMark;