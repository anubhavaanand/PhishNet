import React from 'react';
import { Card, Icon } from '@/components';

/**
 * SettingsSection — a grouped, titled settings card with an icon header.
 */
export function SettingsSection({ icon, title, desc, accent, children }) {
  return (
    <Card accent={accent} padding="lg" style={{ animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--pn-space-3)',
        marginBottom: 'var(--pn-space-4)',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--pn-radius-md)',
          background: `var(--pn-${accent || 'coral'}-pale)`,
          color: `var(--pn-${accent || 'coral'})`,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}>
          <Icon name={icon} size={22} />
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--pn-font-heading)',
            fontSize: 'var(--pn-text-md)',
            fontWeight: 800,
            color: 'var(--pn-text-primary)',
          }}>
            {title}
          </div>
          {desc && (
            <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 2 }}>
              {desc}
            </div>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

/**
 * SettingRow — a single toggle/setting line within a section.
 */
export function SettingRow({ title, desc, children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--pn-space-4)',
      padding: '14px 0',
      borderBottom: '1px solid var(--pn-border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--pn-text-base)', fontWeight: 600, color: 'var(--pn-text-primary)' }}>
          {title}
        </div>
        {desc && (
          <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>
            {desc}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
