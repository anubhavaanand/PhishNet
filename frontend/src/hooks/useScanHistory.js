import { useState, useEffect, useCallback } from 'react';
import { getLocalStorage, clearHistory } from '@/lib/messaging';

/**
 * React hook for local scan stats and history.
 */
export function useScanHistory() {
  const [stats, setStats] = useState({ total: 0, phishing: 0, safe: 0, uncertain: 0, trusted: 0 });
  const [history, setHistory] = useState([]);

  const refresh = useCallback(async () => {
    const data = await getLocalStorage(['scanHistory', 'scanStats']);
    setStats(data.scanStats || { total: 0, phishing: 0, safe: 0, uncertain: 0, trusted: 0 });
    setHistory(data.scanHistory || []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const clear = useCallback(async () => {
    await clearHistory();
    await refresh();
  }, [refresh]);

  return { stats, history, refresh, clear };
}
