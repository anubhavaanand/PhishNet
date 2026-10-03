import React from 'react';
import { Toggle, Slider, Icon } from '@/components';
import { getSensitivityLabel, SENSITIVITY_LABELS } from '@/lib/constants';

/**
 * SettingsTab — quick settings in the popup.
 * Full settings available on the options page.
 */
export function SettingsTab({ settings, onUpdate }) {
  const sensPct = Math.round((settings.sensitivityThreshold ?? 0.7) * 100);
  const sensLabel = getSensitivityLabel(settings.sensitivityThreshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-3)', animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
      {/* Auto-scan */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--pn-border)',
      }}>
        <div>
          <div style={{ fontSize: 'var(--pn-text-sm)', fontWeight: 700, color: 'var(--pn-text-primary)' }}>
            Auto-scan emails
          </div>
          <div style={{ fontSize: 'var(--pn-text-xs)', color: 'var(--pn-text-tertiary)', marginTop: 2 }}>
            Check every email you open
          </div>
        </div>
        <Toggle
          checked={settings.autoScan}
          onChange={(v) => onUpdate('autoScan', v)}
          ariaLabel="Auto-scan emails"
        />
      </div>

      {/* Link highlighting */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--pn-border)',
      }}>
        <div>
          <div style={{ fontSize: 'var(--pn-text-sm)', fontWeight: 700, color: 'var(--pn-text-primary)' }}>
            Highlight suspicious links
          </div>
          <div style={{ fontSize: 'var(--pn-text-xs)', color: 'var(--pn-text-tertiary)', marginTop: 2 }}>
            Underline unsafe URLs in emails
          </div>
        </div>
        <Toggle
          checked={settings.highlightLinks}
          onChange={(v) => onUpdate('highlightLinks', v)}
          color="teal"
          ariaLabel="Highlight suspicious links"
        />
      </div>

      {/* Sensitivity */}
      <div style={{ padding: '12px 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--pn-space-2)',
        }}>
          <span style={{ fontSize: 'var(--pn-text-sm)', fontWeight: 700, color: 'var(--pn-text-primary)' }}>
            Sensitivity
          </span>
          <span style={{
            fontFamily: 'var(--pn-font-mono)',
            fontSize: 'var(--pn-text-sm)',
            fontWeight: 700,
            color: 'var(--pn-coral)',
          }}>
            {sensPct}%
          </span>
        </div>
        <div style={{
          fontSize: 'var(--pn-text-xs)',
          fontWeight: 600,
          color: 'var(--pn-text-secondary)',
          marginBottom: 'var(--pn-space-2)',
        }}>
          {sensLabel.label} — {sensLabel.desc}
        </div>
        <Slider
          value={sensPct}
          min={50}
          max={95}
          step={5}
          onChange={(v) => onUpdate('sensitivityThreshold', v / 100)}
          color="coral"
          trackFill={((sensPct - 50) / (95 - 50)) * 100}
        />
      </div>
    </div>
  );
}
