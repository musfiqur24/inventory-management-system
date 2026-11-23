import { useEffect,useRef,useState } from 'react';
/** Keep placeholders visible for at least 500ms; never shorten a pending request. */
export function useMinimumLoading(loading: boolean, duration = 500) {
  const [held, setHeld] = useState(loading);
  const started = useRef(0);
  useEffect(() => {
    if (loading) {
      started.current = Date.now();
      const startTimer=window.setTimeout(()=>setHeld(true),0);
      return()=>window.clearTimeout(startTimer);
    }
    const remaining = Math.max(0, duration - (Date.now() - started.current));
    const timer = window.setTimeout(() => setHeld(false), remaining);
    return () => window.clearTimeout(timer);
  }, [loading, duration]);
  return loading || held;
}

