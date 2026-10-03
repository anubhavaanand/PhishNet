import React from 'react';

/**
 * Slider — friendly range input with gradient track.
 */
export function Slider({ value, min, max, step, onChange, color = 'coral', trackFill }) {
  const colors = {
    coral: '#FF6B6B',
    teal: '#2EC4B6',
    green: '#34C98B',
    amber: '#FFB845',
  };
  const c = colors[color] || colors.coral;
  const fillPct = trackFill != null ? trackFill : ((value - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        width: '100%',
        height: 8,
        appearance: 'none',
        WebkitAppearance: 'none',
        borderRadius: 'var(--pn-radius-full)',
        background: `linear-gradient(90deg, ${c} 0%, ${c} ${fillPct}%, var(--pn-bg-hover) ${fillPct}%, var(--pn-bg-hover) 100%)`,
        outline: 'none',
        cursor: 'pointer',
      }}
      css={{
        '&::-webkit-slider-thumb': {},
      }}
    />
  );
}
