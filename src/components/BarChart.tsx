import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../i18n/index.tsx';
import { useStore } from '../store/index.tsx';

export interface Bar {
  label: string;
  value: number;
  /** 0..max */
  max?: number;
  note?: string;
}

/**
 * Horizontal SVG bar chart with a data-table alternative.
 * In Lite mode only the table is rendered.
 */
export function BarChart({ title, bars, unit = '%', max = 100, caption }: { title: string; bars: Bar[]; unit?: string; max?: number; caption?: string }) {
  const t = useT();
  const { state } = useStore();
  const [table, setTable] = useState(false);
  const id = useId();
  // the SVG is drawn in CSS pixels of the measured container, so text never scales down on phones
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(560);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setMeasured(Math.max(240, Math.round(el.getBoundingClientRect().width || 560)));
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = measured < 520;
  const w = measured;
  const rowH = narrow ? 44 : 26;
  const labelW = narrow ? 0 : 150;
  const valueW = 56;
  const barY = narrow ? 24 : 3;
  const barH = narrow ? 12 : rowH - 10;
  const h = bars.length * rowH + 8;
  const maxLabel = narrow ? 48 : 22;
  const showTable = table || state.settings.lite;
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="row row-between">
        <strong>{title}</strong>
        {!state.settings.lite && (
          <button type="button" className="btn btn-link btn-sm" aria-pressed={table} aria-controls={id} onClick={() => setTable((v) => !v)}>
            {table ? t.common.hideTable : t.common.showTable}
          </button>
        )}
      </figcaption>
      <div ref={wrapRef} hidden={showTable}>
        {!showTable && (
          <svg className="bar-chart" viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label={`${title}. ${bars.map((b) => `${b.label}: ${b.value}${unit}`).join('. ')}`}>
            {bars.map((b, i) => {
              const track = Math.max(40, w - labelW - valueW);
              const bw = Math.max(0, Math.min(1, b.value / (b.max ?? max))) * track;
              const y = i * rowH + 4;
              const label = b.label.length > maxLabel ? b.label.slice(0, maxLabel - 1) + '…' : b.label;
              return (
                <g key={b.label}>
                  {narrow ? <text x={0} y={y + 14}>{label}</text> : <text x={labelW - 8} y={y + 15} textAnchor="end">{label}</text>}
                  <rect x={labelW} y={y + barY} width={track} height={barH} fill="var(--surface-2)" />
                  <rect x={labelW} y={y + barY} width={bw} height={barH} fill="var(--accent)" />
                  <text x={labelW + bw + 6} y={y + barY + barH - 2}>{b.value}{unit}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <div id={id} hidden={!showTable} className="table-wrap">
        <table>
          {caption && <caption>{caption}</caption>}
          <thead>
            <tr>
              <th scope="col">{title}</th>
              <th scope="col" className="num">{unit === '%' ? '%' : unit}</th>
              {bars.some((b) => b.note) && <th scope="col">—</th>}
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.label}>
                <th scope="row">{b.label}</th>
                <td className="num">{b.value}</td>
                {bars.some((x) => x.note) && <td>{b.note}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
