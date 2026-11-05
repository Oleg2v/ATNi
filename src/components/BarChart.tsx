import { useId, useState } from 'react';
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
  const rowH = 26;
  const labelW = 150;
  const w = 560;
  const h = bars.length * rowH + 8;
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
      {!showTable && (
        <svg className="bar-chart" viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${title}. ${bars.map((b) => `${b.label}: ${b.value}${unit}`).join('. ')}`}>
          {bars.map((b, i) => {
            const bw = Math.max(0, Math.min(1, b.value / (b.max ?? max))) * (w - labelW - 60);
            const y = i * rowH + 4;
            return (
              <g key={b.label}>
                <text x={labelW - 8} y={y + 15} textAnchor="end">{b.label.length > 22 ? b.label.slice(0, 21) + '…' : b.label}</text>
                <rect x={labelW} y={y + 3} width={w - labelW - 60} height={rowH - 10} fill="var(--surface-2)" />
                <rect x={labelW} y={y + 3} width={bw} height={rowH - 10} fill="var(--accent)" />
                <text x={labelW + bw + 6} y={y + 15}>{b.value}{unit}</text>
              </g>
            );
          })}
        </svg>
      )}
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
