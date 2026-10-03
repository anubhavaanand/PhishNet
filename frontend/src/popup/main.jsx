import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { Header, TabBar, ScanTab, StatsTab, TrustedTab, SettingsTab } from '@/components';
import { useSettings } from '@/hooks/useSettings';
import { useModelStatus } from '@/hooks/useModelStatus';
import { useScanHistory } from '@/hooks/useScanHistory';

/**
 * PhishNet Popup App
 * 400px-wide popup with 4 tabs: Scan, Stats, Trusted, Settings.
 */
function PopupApp() {
  const [activeTab, setActiveTab] = useState('scan');
  const { settings, update } = useSettings();
  const { status, progress } = useModelStatus();
  const { stats, history, refresh, clear } = useScanHistory();

  // Apply theme to root
  useEffect(() => {
    const theme = settings.theme || 'auto';
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  return (
    <div style={{
      width: 380,
      minHeight: 480,
      maxHeight: 600,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pn-bg)',
      fontFamily: 'var(--pn-font-body)',
    }}>
      <Header status={status} progress={progress} />

      {/* Progress bar during model loading */}
      {status === 'loading' && (
        <div style={{
          height: 3,
          background: 'var(--pn-bg-subtle)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--pn-coral), var(--pn-amber))',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Tab content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--pn-space-4)',
      }}>
        {activeTab === 'scan' && <ScanTab onScanComplete={refresh} />}
        {activeTab === 'stats' && <StatsTab stats={stats} history={history} onClear={clear} />}
        {activeTab === 'trusted' && (
          <TrustedTab
            whitelist={settings.whitelist || []}
            onUpdate={(newList) => update('whitelist', newList)}
          />
        )}
        {activeTab === 'settings' && <SettingsTab settings={settings} onUpdate={update} />}
      </div>

      {/* Footer link to options page */}
      <div style={{
        padding: '6px 16px',
        background: 'var(--pn-bg-card)',
        borderTop: '1px solid var(--pn-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'var(--pn-text-tertiary)',
      }}>
        <span>v1.1.0</span>
        <button
          onClick={() => {
            const api = typeof chrome !== 'undefined' ? chrome : browser;
            if (api?.runtime?.openOptionsPage) api.runtime.openOptionsPage();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--pn-coral)',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Full Settings →
        </button>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<PopupApp />);
