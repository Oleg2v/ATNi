import { useEffect, useState } from 'react';

interface Weight {
  transferred: number;
  decoded: number;
  resources: number;
  fromCache: number;
}

/** Really measured weight of this page load, from the browser's Resource Timing API (no network calls). */
export function measureWeight(): Weight | null {
  try {
    const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')] as PerformanceResourceTiming[];
    if (!entries.length) return null;
    let transferred = 0;
    let decoded = 0;
    let fromCache = 0;
    for (const e of entries) {
      transferred += e.transferSize || 0;
      decoded += e.decodedBodySize || 0;
      if (e.transferSize === 0 && e.decodedBodySize > 0) fromCache++;
    }
    return { transferred, decoded, resources: entries.length, fromCache };
  } catch {
    return null;
  }
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

export function PageWeight({ lang, refreshKey }: { lang: 'en' | 'sw'; refreshKey?: string }) {
  const [w, setW] = useState<Weight | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setW(measureWeight()), 400);
    return () => window.clearTimeout(t);
  }, [refreshKey]);
  if (!w) return null;
  const cached = w.fromCache > 0 && w.transferred < 4096;
  const en = cached
    ? `Measured in this browser: ${kb(w.decoded)} of code and styles across ${w.resources} files, served from the browser cache on this load (${kb(w.transferred)} over the network).`
    : `Measured in this browser: ${kb(w.transferred)} transferred over the network (${kb(w.decoded)} uncompressed) across ${w.resources} files${w.fromCache ? `, ${w.fromCache} served from cache` : ''}.`;
  const sw = cached
    ? `Imepimwa katika kivinjari hiki: ${kb(w.decoded)} za msimbo na mitindo katika faili ${w.resources}, kutoka akiba ya kivinjari (${kb(w.transferred)} kupitia mtandao).`
    : `Imepimwa katika kivinjari hiki: ${kb(w.transferred)} zimehamishwa kupitia mtandao (${kb(w.decoded)} bila kubanwa) katika faili ${w.resources}${w.fromCache ? `, ${w.fromCache} kutoka akiba` : ''}.`;
  return <span className="tiny muted">{lang === 'sw' ? sw : en}</span>;
}
