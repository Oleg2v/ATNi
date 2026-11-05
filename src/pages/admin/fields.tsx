import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Editor inputs. Values are applied to the store on every change (so Health updates live);
 * `onCommit(before, after)` fires on blur only when the value changed, which is where the
 * audit journal entry is written.
 */

interface BaseProps {
  id: string;
  label: ReactNode;
  readOnly?: boolean;
  hint?: ReactNode;
  flag?: string;
  invalid?: boolean;
}

export function TextField({ id, label, value, onChange, onCommit, multiline, readOnly, hint, flag, invalid, lang }: BaseProps & { value: string; onChange: (v: string) => void; onCommit?: (before: string, after: string) => void; multiline?: boolean; lang?: string }) {
  const start = useRef<string | null>(null);
  const inputId = `${id}-input`;
  const hintId = hint || flag ? `${id}-hint` : undefined;
  const common = {
    id: inputId,
    value,
    readOnly,
    'aria-readonly': readOnly || undefined,
    'aria-invalid': invalid || undefined,
    'aria-describedby': hintId,
    lang,
    onFocus: () => {
      start.current = value;
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur: () => {
      if (start.current !== null && start.current !== value) onCommit?.(start.current, value);
      start.current = null;
    },
  };
  return (
    <div className="field" id={id}>
      <label htmlFor={inputId}>{label}</label>
      {multiline ? <textarea {...common} rows={3} /> : <input type="text" {...common} />}
      {(hint || flag) && (
        <p className="hint" id={hintId}>
          {flag && <span className="chip chip-warn">{flag}</span>} {hint}
        </p>
      )}
    </div>
  );
}

export function NumberField({ id, label, value, onChange, onCommit, step = 0.5, min = 0, readOnly, hint, invalid, inputId: forcedInputId, compact }: BaseProps & { value: number; onChange: (v: number) => void; onCommit?: (before: number, after: number) => void; step?: number; min?: number; inputId?: string; compact?: boolean }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  const inputId = forcedInputId ?? `${id}-input`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={compact ? 'field-compact' : 'field'} id={id}>
      <label htmlFor={inputId} className={compact ? 'sr-only' : undefined}>{label}</label>
      <input
        type="number"
        id={inputId}
        inputMode="decimal"
        step={step}
        min={min}
        value={text}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        onFocus={() => {
          focused.current = true;
          start.current = value;
        }}
        onChange={(e) => {
          const s = e.target.value;
          setText(s);
          const n = Number(s);
          if (s.trim() !== '' && Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          focused.current = false;
          setText(String(value));
          if (start.current !== null && start.current !== value) onCommit?.(start.current, value);
          start.current = null;
        }}
      />
      {hint && <p className="hint" id={hintId}>{hint}</p>}
    </div>
  );
}

export function SelectField({ id, label, value, onChange, options, readOnly, hint, invalid }: BaseProps & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const inputId = `${id}-input`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field" id={id}>
      <label htmlFor={inputId}>{label}</label>
      <select id={inputId} value={value} disabled={readOnly} aria-invalid={invalid || undefined} aria-describedby={hintId} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="hint" id={hintId}>{hint}</p>}
    </div>
  );
}

export function CheckField({ id, label, checked, onChange, readOnly, hint }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void; readOnly?: boolean; hint?: ReactNode }) {
  const inputId = `${id}-input`;
  return (
    <div className="field" id={id}>
      <label className="choice" htmlFor={inputId} style={{ padding: '4px 0' }}>
        <input type="checkbox" id={inputId} checked={checked} disabled={readOnly} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}{hint && <span className="hint" style={{ display: 'block' }}>{hint}</span>}</span>
      </label>
    </div>
  );
}
