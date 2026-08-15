import { useCallback, useEffect, useState } from 'react';

/**
 * Shared busy/success/failure state for every page, so a write reports the same
 * way wherever it happens. Work returns the sentence shown on success.
 */
export function useStatus() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(async (work: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const done = await work();
      if (typeof done === 'string') setNotice(done);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : String(error_));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return { busy, error, notice, setError, run };
}
