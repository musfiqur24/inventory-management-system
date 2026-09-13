import { useCallback, useEffect, useRef, useState } from 'react';
export function usePageLoading() {
  const [loading, setLoading] = useState(true);
  const pending = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    pending.current += 1;
    if (mounted.current) setLoading(true);
    try { return await task(); }
    finally { pending.current -= 1; if (mounted.current && pending.current === 0) setLoading(false); }
  }, []);
  return [loading, run] as const;
}
