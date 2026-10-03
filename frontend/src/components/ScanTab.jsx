import React, { useState, useCallback } from 'react';
import { Button, ConfidenceRing, Card, Icon } from '@/components';
import { getVerdictMeta } from '@/lib/constants';
import { scanCurrentTab } from '@/lib/messaging';

/**
 * ScanTab — main scan action + result display.
 */
export function ScanTab({ onScanComplete }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setResult(null);

    const response = await scanCurrentTab();

    if (response && response.success && response.result) {
      setResult(response.result);
      onScanComplete?.();
    } else {
      setError(response?.error || 'No email open in Gmail or Outlook. Open an email and try again.');
    }
    setScanning(false);
  }, [onScanComplete]);

  if (result) {
    const meta = getVerdictMeta(result.label);
    const pct = Math.round((result.confidence || 0) * 100);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-3)', animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
        <Card accent={meta.color} padding="lg" style={{ textAlign: 'center' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--pn-space-3)',
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: `var(--pn-${meta.color}-pale)`,
              display: 'grid',
              placeItems: 'center',
              color: `var(--pn-${meta.color})`,
              animation: 'pn-pop 0.4s var(--pn-ease-spring) both',
            }}>
              <Icon name={meta.icon} size={28} />
            </div>

            <div>
              <div style={{
                fontFamily: 'var(--pn-font-heading)',
                fontSize: 'var(--pn-text-lg)',
                fontWeight: 800,
                color: 'var(--pn-text-primary)',
              }}>
                {meta.title}
              </div>
              <div style={{
                fontFamily: 'var(--pn-font-mono)',
                fontSize: 'var(--pn-text-2xl)',
                fontWeight: 800,
                color: `var(--pn-${meta.color})`,
                marginTop: 4,
              }}>
                {pct}%
              </div>
            </div>
          </div>
        </Card>

        {result.reasons && result.reasons.length > 0 && (
          <Card padding="md">
            <div style={{ fontSize: 'var(--pn-text-xs)', fontWeight: 700, color: 'var(--pn-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--pn-space-2)' }}>
              What we found
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-2)' }}>
              {result.reasons.slice(0, 5).map((reason, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--pn-space-2)',
                    fontSize: 'var(--pn-text-sm)',
                    color: 'var(--pn-text-secondary)',
                    lineHeight: 1.5,
                    animation: `pn-fade-up 0.3s var(--pn-ease-out) both`,
                    animationDelay: `${i * 0.06}s`,
                  }}
                >
                  <span style={{ color: `var(--pn-${meta.color})`, flexShrink: 0, marginTop: 2 }}>
                    <Icon name="alert" size={14} />
                  </span>
                  {reason}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Button variant="ghost" fullWidth onClick={() => setResult(null)}>
          Scan Another
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-4)', alignItems: 'center', paddingTop: 'var(--pn-space-6)' }}>
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'var(--pn-coral-pale)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--pn-coral)',
        animation: 'pn-pulse-ring 2.5s infinite',
      }}>
        <Icon name="scan" size={36} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--pn-font-heading)', fontSize: 'var(--pn-text-lg)', fontWeight: 800, color: 'var(--pn-text-primary)' }}>
          Check This Email
        </div>
        <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 4, maxWidth: 240, margin: '4px auto 0' }}>
          Scan the email you're reading for phishing signs — instantly, on your device.
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={scanning}
        onClick={handleScan}
        iconRight={!scanning && <Icon name="arrow-right" size={18} />}
      >
        {scanning ? 'Scanning...' : 'Scan Now'}
      </Button>

      {error && (
        <Card accent="rose" padding="md" style={{ width: '100%', animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
          <div style={{ display: 'flex', gap: 'var(--pn-space-2)', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--pn-rose)', flexShrink: 0, marginTop: 1 }}>
              <Icon name="alert" size={16} />
            </span>
            <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-secondary)', lineHeight: 1.5 }}>
              {error}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
