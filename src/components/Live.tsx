import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface LiveApi {
  announce: (msg: string, assertive?: boolean) => void;
  toast: (msg: string) => void;
}
const LiveContext = createContext<LiveApi>({ announce: () => {}, toast: () => {} });

/** One polite and one assertive live region for the whole app, plus a visual toast. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const announce = useCallback((msg: string, isAssertive = false) => {
    // clear first so repeated identical messages are re-announced
    if (isAssertive) {
      setAssertive('');
      window.setTimeout(() => setAssertive(msg), 30);
    } else {
      setPolite('');
      window.setTimeout(() => setPolite(msg), 30);
    }
  }, []);
  const toast = useCallback(
    (msg: string) => {
      setToastMsg(msg);
      announce(msg);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToastMsg(null), 4000);
    },
    [announce],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <LiveContext.Provider value={{ announce, toast }}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{polite}</div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{assertive}</div>
      {toastMsg && <div className="toast no-print" role="status" aria-hidden="true">{toastMsg}</div>}
    </LiveContext.Provider>
  );
}

export function useLive(): LiveApi {
  return useContext(LiveContext);
}
