import type { ReactNode } from 'react';
import type { Grade } from '../types.ts';
import { useT } from '../i18n/index.tsx';

export function GradeBadge({ grade, large, label }: { grade: Grade; large?: boolean; label?: string }) {
  return (
    <span className={`grade grade-${grade}${large ? ' grade-lg' : ''}`} aria-label={label ? `${label}: ${grade}` : undefined}>
      {grade}
    </span>
  );
}

/** Marks something that is simulated in this concept. Always visible where the thing is visible. */
export function Sim({ children }: { children?: ReactNode }) {
  const t = useT();
  return <span className="sim">{children ?? t.simulated}</span>;
}

export function PowerBiPlaceholder({ title }: { title?: string }) {
  const t = useT();
  return (
    <div className="powerbi" role="img" aria-label={`${t.powerbi}. ${t.powerbiNote}`}>
      <strong>{title ?? t.powerbi}</strong>
      <span className="small">{t.powerbiNote}</span>
      <Sim>placeholder</Sim>
    </div>
  );
}

export function Callout({ kind = 'info', children, role }: { kind?: 'info' | 'warn' | 'danger' | 'ok' | 'accent'; children: ReactNode; role?: string }) {
  return (
    <div className={`callout${kind === 'accent' ? '' : ` callout-${kind}`}`} role={role}>
      {children}
    </div>
  );
}

export function Kv({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
