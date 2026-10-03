import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { Icon, Toggle, Slider, Card, Button } from '@/components';
import { SettingsSection, SettingRow } from '@/components/SettingsSection';
import { TrustedSection } from '@/components/TrustedSection';
import { useSettings } from '@/hooks/useSettings';
import { useScanHistory } from '@/hooks/useScanHistory';
import { THEMES, getSensitivityLabel } from '@/lib/constants';

/**
 * PhishNet Options Page
 * Full-width settings experience, max 680px centered.
 */
function OptionsApp() {
  const { settings, update, loaded } = useSettings();
  const { stats, clear } = useScanHistory();
  const [toast, setToast] = useState(null);

  // Apply theme
  useEffect(() => {
    const theme = settings.theme || 'auto';
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const sensPct = Math.round((settings.sensitivityThreshold ?? 0.7) * 100);
  const sensLabel = getSensitivityLabel(settings.sensitivityThreshold);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--pn-bg)',
      fontFamily: 'var(--pn-font-body)',
      color: 'var(--pn-text-primary)',
    }}>
      {/* Top banner */}
      <div style={{
        background: 'var(--pn-bg-card)',
        borderBottom: '1px solid var(--pn-border)',
        padding: '20px 0',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 'var(--pn-radius-lg)',
            background: 'linear-gradient(135deg, var(--pn-coral-light), var(--pn-coral))',
            display: 'grid', placeItems: 'center',
            color: '#fff', boxShadow: 'var(--pn-shadow-coral)',
          }}>
            <Icon name="fish" size={28} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--pn-font-heading)', fontSize: 'var(--pn-text-xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              PhishNet Settings
            </h1>
            <p style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)' }}>
              Make PhishNet work the way you want. Everything stays on your device.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-4)' }}>

        {/* Protection Section */}
        <SettingsSection icon="shield" title="Protection" desc="How PhishNet watches over your inbox" accent="coral">
          <SettingRow title="Auto-scan emails" desc="Automatically check every email you open in Gmail or Outlook — no button press needed.">
            <Toggle checked={settings.autoScan} onChange={(v) => update('autoScan', v)} ariaLabel="Auto-scan" />
          </SettingRow>
          <SettingRow title="Highlight suspicious links" desc="Draw a wavy red underline under unsafe URLs so they're easy to spot.">
            <Toggle checked={settings.highlightLinks} onChange={(v) => update('highlightLinks', v)} color="teal" ariaLabel="Highlight links" />
          </SettingRow>
          <div style={{ padding: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pn-space-2)' }}>
              <span style={{ fontSize: 'var(--pn-text-base)', fontWeight: 600, color: 'var(--pn-text-primary)' }}>
                Sensitivity
              </span>
              <span style={{ fontFamily: 'var(--pn-font-mono)', fontWeight: 700, color: 'var(--pn-coral)' }}>
                {sensPct}%
              </span>
            </div>
            <div style={{ fontSize: 'var(--pn-text-sm)', fontWeight: 600, color: 'var(--pn-text-secondary)', marginBottom: 'var(--pn-space-3)' }}>
              {sensLabel.label} — {sensLabel.desc}
            </div>
            <Slider
              value={sensPct}
              min={50}
              max={95}
              step={5}
              onChange={(v) => update('sensitivityThreshold', v / 100)}
              color="coral"
              trackFill={((sensPct - 50) / (95 - 50)) * 100}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--pn-text-tertiary)' }}>
              <span>More alerts</span>
              <span>Fewer false positives</span>
            </div>
          </div>
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection icon="gear" title="Appearance" desc="Choose how PhishNet looks" accent="teal">
          <div style={{ padding: '6px 0' }}>
            <div style={{ fontSize: 'var(--pn-text-base)', fontWeight: 600, marginBottom: 'var(--pn-space-3)' }}>
              Theme
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--pn-space-2)' }}>
              {THEMES.map((t) => {
                const isActive = (settings.theme || 'auto') === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => update('theme', t.id)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: 'var(--pn-radius-md)',
                      border: isActive ? '2px solid var(--pn-coral)' : '2px solid var(--pn-border)',
                      background: isActive ? 'var(--pn-coral-pale)' : 'var(--pn-bg-card)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all var(--pn-dur-fast) var(--pn-ease-spring)',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28,
                      borderRadius: '50%',
                      margin: '0 auto var(--pn-space-2)',
                      border: '2px solid var(--pn-border)',
                      background: t.id === 'light' ? '#FAF6F1' : (t.id === 'dark' ? '#1A1714' : 'linear-gradient(135deg, #FAF6F1 50%, #1A1714 50%)'),
                    }} />
                    <div style={{ fontSize: 'var(--pn-text-sm)', fontWeight: 700, color: isActive ? 'var(--pn-coral)' : 'var(--pn-text-primary)' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--pn-text-tertiary)', marginTop: 2 }}>
                      {t.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsSection>

        {/* Trusted Senders */}
        <TrustedSection
          whitelist={settings.whitelist || []}
          onUpdate={(list) => update('whitelist', list)}
        />

        {/* Privacy & Data */}
        <SettingsSection icon="lock" title="Privacy & Data" desc="Your data never leaves your device" accent="green">
          <div style={{
            padding: '14px 16px',
            borderRadius: 'var(--pn-radius-md)',
            background: 'var(--pn-green-pale)',
            border: '1px solid var(--pn-green)',
            marginBottom: 'var(--pn-space-4)',
            display: 'flex',
            gap: 'var(--pn-space-3)',
            alignItems: 'flex-start',
          }}>
            <span style={{ color: 'var(--pn-green)', flexShrink: 0, marginTop: 2 }}>
              <Icon name="lock" size={20} />
            </span>
            <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-secondary)', lineHeight: 1.6 }}>
              PhishNet processes everything on your device. No email content, sender info,
              or scan results are ever sent to any server. The only network request is the
              one-time AI model download.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--pn-border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--pn-text-base)' }}>Scan history</div>
              <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 2 }}>
                {stats.total || 0} emails scanned, {stats.phishing || 0} threats found
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={async () => { await clear(); showToast('History cleared!'); }}>
              Clear History
            </Button>
          </div>

          <div style={{ padding: '12px 0' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--pn-text-base)' }}>Model data</div>
            <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>
              The AI model (~50 MB) is cached in your browser's IndexedDB. Clear browsing data in Chrome settings to remove it.
            </div>
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection icon="heart" title="About PhishNet" desc="Built with privacy as the foundation" accent="amber">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--pn-text-sm)' }}>
              <span style={{ color: 'var(--pn-text-tertiary)' }}>Version</span>
              <span style={{ fontWeight: 600 }}>1.1.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--pn-text-sm)' }}>
              <span style={{ color: 'var(--pn-text-tertiary)' }}>License</span>
              <span style={{ fontWeight: 600 }}>MIT (Open Source)</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--pn-space-3)', marginTop: 'var(--pn-space-2)' }}>
              <a
                href="https://github.com/anubhavaanand/PhishNet"
                target="_blank"
                rel="noopener"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 'var(--pn-radius-md)',
                  background: 'var(--pn-bg-subtle)',
                  color: 'var(--pn-text-primary)',
                  fontSize: 'var(--pn-text-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'background var(--pn-dur-fast)',
                }}
              >
                <Icon name="github" size={16} /> Source Code
              </a>
              <a
                href="https://github.com/anubhavaanand/PhishNet/blob/main/PRIVACY_POLICY.md"
                target="_blank"
                rel="noopener"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 'var(--pn-radius-md)',
                  background: 'var(--pn-bg-subtle)',
                  color: 'var(--pn-text-primary)',
                  fontSize: 'var(--pn-text-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Icon name="external-link" size={16} /> Privacy Policy
              </a>
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: 'var(--pn-radius-full)',
          background: 'var(--pn-green)',
          color: '#fff',
          fontSize: 'var(--pn-text-sm)',
          fontWeight: 700,
          boxShadow: 'var(--pn-shadow-lg)',
          animation: 'pn-bounce-in 0.3s var(--pn-ease-spring) both',
          zIndex: 1000,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<OptionsApp />);
