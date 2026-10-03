import React from 'react';
import { StatCard, Card, EmptyState, Button, Icon } from '@/components';

/**
 * StatsTab — scan history and aggregate stats.
 */
export function StatsTab({ stats, history, onClear }) {
  const safeCount = (stats.safe || 0) + (stats.trusted || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-3)', animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--pn-space-2)' }}>
        <StatCard icon="scan" label="Scanned" value={stats.total || 0} color="coral" delay={0} />
        <StatCard icon="alert" label="Threats" value={stats.phishing || 0} color="rose" delay={0.08} />
        <StatCard icon="shield" label="Safe" value={safeCount} color="green" delay={0.16} />
      </div>

      <Card padding="md">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--pn-space-3)',
        }}>
          <span style={{ fontSize: 'var(--pn-text-sm)', fontWeight: 700, color: 'var(--pn-text-secondary)' }}>
            Recent Scans
          </span>
          {history.length > 0 && (
            <button
              onClick={onClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--pn-text-tertiary)',
                fontSize: 'var(--pn-text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="trash" size={13} /> Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={<Icon name="scan" size={28} />}
            title="No scans yet"
            subtitle="Open an email in Gmail or Outlook and hit Scan to see your history here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {history.map((item, i) => {
              const isPhish = item.label?.includes('phishing');
              const isSafe = item.label?.includes('legitimate');
              const isTrusted = item.label === 'trusted';
              const color = isPhish ? 'rose' : (isTrusted ? 'gold' : (isSafe ? 'green' : 'amber'));
              const tagText = isTrusted ? 'Trusted' : (isPhish ? 'Phish' : (isSafe ? 'Safe' : '?'));

              return (
                <div
                  key={item.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--pn-space-2)',
                    padding: '8px 10px',
                    borderRadius: 'var(--pn-radius-sm)',
                    background: 'var(--pn-bg-subtle)',
                    animation: `pn-slide-in-right 0.3s var(--pn-ease-out) both`,
                    animationDelay: `${i * 0.04}s`,
                  }}
                >
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'var(--pn-text-sm)',
                    fontWeight: 500,
                    color: 'var(--pn-text-primary)',
                    flex: 1,
                  }} title={item.subject}>
                    {item.subject || item.sender}
                  </span>
                  <span style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    borderRadius: 'var(--pn-radius-full)',
                    fontSize: 10,
                    fontWeight: 800,
                    background: `var(--pn-${color}-pale)`,
                    color: `var(--pn-${color}-dark)`,
                  }}>
                    {tagText}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{
        fontSize: 10,
        color: 'var(--pn-text-tertiary)',
        textAlign: 'center',
        fontWeight: 500,
      }}>
        All data stays on your device. Nothing is uploaded.
      </div>
    </div>
  );
}
