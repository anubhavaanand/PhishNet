import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings, onSettingsUpdate, DEFAULT_SETTINGS } from '@/lib/messaging';

/**
 * React hook for extension settings.
 * Loads from background, listens for updates, and provides a setter
 * that persists back through chrome.runtime.
 */
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    getSettings().then((res) => {
      if (!mounted || !res) return;
      setSettings({ ...DEFAULT_SETTINGS, ...res });
      setLoaded(true);
    });

    const unsub = onSettingsUpdate((payload) => {
      if (!mounted || !payload) return;
      setSettings((prev) => ({ ...prev, ...payload }));
    });

    return () => { mounted = false; unsub(); };
  }, []);

  const update = useCallback(async (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      updateSettings(next);
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
