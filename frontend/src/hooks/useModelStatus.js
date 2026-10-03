import { useState, useEffect } from 'react';
import { getStatus, onModelStatus } from '@/lib/messaging';

/**
 * React hook for model status (loading / ready / error + progress).
 * Polls every 4s as fallback, also listens for push updates.
 */
export function useModelStatus(pollInterval = 4000) {
  const [status, setStatus] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const res = await getStatus();
      if (!mounted || !res) return;
      setStatus(res.modelStatus || 'loading');
      setProgress(res.progress || 0);
      if (res.error) setError(res.error);
    };

    refresh();
    const interval = setInterval(refresh, pollInterval);

    const unsub = onModelStatus((payload) => {
      if (!mounted || !payload) return;
      setStatus(payload.status || 'loading');
      setProgress(payload.progress || 0);
      if (payload.error) setError(payload.error);
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      unsub();
    };
  }, [pollInterval]);

  return { status, progress, error };
}
