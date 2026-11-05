import { useMemo, useState } from 'react';
import { Link } from '../../router/index.tsx';
import { can, useStore } from '../../store/index.tsx';
import { useLive } from '../../components/Live.tsx';
import { Callout } from '../../components/Bits.tsx';
import { downloadText } from '../../lib/data.ts';
import { recommendationLibrary } from '../../engine/index.ts';
import type { MethodologyVersion, SwTranslations } from '../../types.ts';
import { PageHead, StatusChip } from './shared.tsx';

type Section = 'topics' | 'questions' | 'options' | 'info' | 'recommendations' | 'roadmap titles';
interface Row { key: string; section: Section; en: string; sw: string }

/** Every translatable string of a version with its key. */
export function stringsOf(v: MethodologyVersion): Row[] {
  const sw = v.translations.sw;
  const rows: Row[] = [];
  for (const t of v.topics) rows.push({ key: `topic:${t.id}`, section: 'topics', en: t.name, sw: sw.topics?.[t.id] ?? '' });
  for (const q of v.questions) {
    const tq = sw.questions?.[q.question_id];
    rows.push({ key: `q:${q.question_id}:question`, section: 'questions', en: q.question, sw: tq?.question ?? '' });
    if (q.info) rows.push({ key: `q:${q.question_id}:info`, section: 'info', en: q.info, sw: tq?.info ?? '' });
    const p = q.propositions;
    const opts = p.type === 'option' ? p.propositions.map((o) => o.proposition) : p.type === 'choices' ? p.propositions : [];
    opts.forEach((o, i) => rows.push({ key: `q:${q.question_id}:prop:${i}`, section: 'options', en: o, sw: tq?.propositions?.[i] ?? '' }));
    if (p.type === 'text') rows.push({ key: `q:${q.question_id}:text`, section: 'options', en: p.proposition, sw: tq?.text_proposition ?? '' });
  }
  for (const r of recommendationLibrary(v.questions)) rows.push({ key: `rec:${r.id}`, section: 'recommendations', en: r.text, sw: sw.recommendations?.[r.id] ?? '' });
  for (const r of v.roadmap_rules) rows.push({ key: `rule:${r.id}`, section: 'roadmap titles', en: r.title, sw: sw.roadmap_titles?.[r.id] ?? '' });
  return rows;
}

const csvCell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export function toCsv(rows: Row[]): string {
  return ['key,en,sw', ...rows.map((r) => [r.key, r.en, r.sw].map(csvCell).join(','))].join('\r\n');
}

/** RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

/** Apply key→sw pairs to a version's translations. Returns the new translations and counts. */
export function applyCsv(v: MethodologyVersion, pairs: [string, string][]): { sw: SwTranslations; updated: number; ignored: number } {
  const known = new Map(stringsOf(v).map((r) => [r.key, r]));
  const sw: SwTranslations = JSON.parse(JSON.stringify(v.translations.sw ?? {}));
  sw.topics ??= {};
  sw.questions ??= {};
  sw.recommendations ??= {};
  sw.roadmap_titles ??= {};
  let updated = 0;
  let ignored = 0;
  for (const [key, value] of pairs) {
    const row = known.get(key);
    const text = value.trim();
    if (!row || !text || text === row.sw) {
      ignored++;
      continue;
    }
    const parts = key.split(':');
    if (parts[0] === 'topic') sw.topics[parts.slice(1).join(':')] = text;
    else if (parts[0] === 'rec') sw.recommendations[parts.slice(1).join(':')] = text;
    else if (parts[0] === 'rule') sw.roadmap_titles[parts.slice(1).join(':')] = text;
    else if (parts[0] === 'q') {
      const field = parts[parts.length - 1];
      const isProp = parts[parts.length - 2] === 'prop';
      const qid = isProp ? parts.slice(1, -2).join(':') : parts.slice(1, -1).join(':');
      const q = v.questions.find((x) => x.question_id === qid);
      if (!q) {
        ignored++;
        continue;
      }
      const tq = { ...(sw.questions[qid] ?? {}) };
      if (isProp) {
        const p = q.propositions;
        const n = p.type === 'option' || p.type === 'choices' ? p.propositions.length : 0;
        const arr = Array.from({ length: n }, (_, i) => tq.propositions?.[i] ?? '');
        arr[Number(field)] = text;
        tq.propositions = arr;
      } else if (field === 'question') tq.question = text;
      else if (field === 'info') tq.info = text;
      else if (field === 'text') tq.text_proposition = text;
      sw.questions[qid] = tq;
    }
    updated++;
  }
  return { sw, updated, ignored };
}

const SECTIONS: Section[] = ['topics', 'questions', 'options', 'info', 'recommendations', 'roadmap titles'];

export function TranslationsPage() {
  const { state, update, log } = useStore();
  const { toast } = useLive();
  const draft = state.versions.find((v) => v.status === 'draft');
  const [sel, setSel] = useState(draft?.id ?? state.versions[0]?.id ?? '');
  const version = state.versions.find((v) => v.id === sel) ?? state.versions[0];
  const rows = useMemo(() => stringsOf(version), [version]);
  const [report, setReport] = useState<string | null>(null);
  const canImport = version.status === 'draft' && can.editContent(state.role);
  const total = rows.length;
  const done = rows.filter((r) => r.sw.trim()).length;

  const exportCsv = () => {
    downloadText(`strings-${version.id}-en-sw.csv`, toCsv(rows), 'text/csv');
    log('export-strings', version.id, `${rows.length} strings exported as CSV (key,en,sw).`);
  };
  const onFile = (file: File | undefined) => {
    if (!file || !canImport) return;
    const reader = new FileReader();
    reader.onload = () => {
      const table = parseCsv(String(reader.result ?? ''));
      const header = table[0]?.map((h) => h.trim().toLowerCase()) ?? [];
      const ki = header.indexOf('key');
      const si = header.indexOf('sw');
      if (ki < 0 || si < 0) {
        setReport('The CSV needs a header row with at least the columns "key" and "sw".');
        return;
      }
      const pairs = table.slice(1).map((r) => [r[ki] ?? '', r[si] ?? ''] as [string, string]);
      const { sw, updated, ignored } = applyCsv(version, pairs);
      if (updated > 0) {
        update((s) => ({ ...s, versions: s.versions.map((v) => (v.id === version.id ? { ...v, translations: { sw } } : v)) }));
        log('import-strings', version.id, `${updated} Swahili strings updated from ${file.name}; ${ignored} rows ignored (unknown key, empty or unchanged).`);
      }
      setReport(`${file.name}: ${updated} strings updated, ${ignored} rows ignored (unknown key, empty or unchanged).`);
      toast(`${updated} strings updated`);
    };
    reader.readAsText(file);
  };

  return (
    <section>
      <PageHead title="Translation coverage" lead="How much of a version exists in Swahili, by section. Export the strings for a translator and import the completed CSV into a draft." />
      <div className="row" style={{ marginBottom: 12 }}>
        <label htmlFor="tr-version" style={{ margin: 0 }}>Version</label>
        <select id="tr-version" value={version.id} onChange={(e) => { setSel(e.target.value); setReport(null); }} style={{ width: 'auto' }}>
          {state.versions.map((v) => (
            <option key={v.id} value={v.id}>{v.id} ({v.status})</option>
          ))}
        </select>
        <StatusChip status={version.status} />
        <span className="small muted" role="status">{done} of {total} strings translated ({total ? Math.round((done / total) * 100) : 0} %)</span>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h2>Coverage by section</h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Swahili coverage by section</caption>
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col" className="num">Translated</th>
                  <th scope="col" className="num">Total</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((s) => {
                  const list = rows.filter((r) => r.section === s);
                  const n = list.filter((r) => r.sw.trim()).length;
                  const pct = list.length ? Math.round((n / list.length) * 100) : 100;
                  return (
                    <tr key={s}>
                      <th scope="row">{s}</th>
                      <td className="num">{n}</td>
                      <td className="num">{list.length}</td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <div className="cov-bar" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
                          <span className="small">{pct} %</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>Missing strings fall back to English for the company; the editor flags them per question. <Link to={`/admin/methodology/${version.id}`}>Open the editor</Link>.</p>
        </div>
        <div className="card">
          <h2>Exchange with a translator</h2>
          <p className="small">CSV with the columns <span className="mono">key,en,sw</span> (RFC 4180 quoting). Keys: <span className="mono">topic:&lt;id&gt;</span>, <span className="mono">q:&lt;qid&gt;:question|info|text</span>, <span className="mono">q:&lt;qid&gt;:prop:&lt;index&gt;</span>, <span className="mono">rec:&lt;x_id&gt;</span>, <span className="mono">rule:&lt;id&gt;</span>.</p>
          <div className="row">
            <button type="button" className="btn" onClick={exportCsv}>Export strings for translator (CSV)</button>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="tr-import">Import CSV (updates the Swahili column of this version)</label>
            <input type="file" id="tr-import" accept=".csv,text/csv" disabled={!canImport} onChange={(e) => onFile(e.target.files?.[0])} aria-describedby="tr-import-hint" />
            <p className="hint" id="tr-import-hint">
              {version.status !== 'draft' ? 'Published and archived versions are immutable: select a draft (or create one from the versions list) to import.' : !can.editContent(state.role) ? 'Importing requires the content, methodology or admin role.' : 'Only keys that exist in this version are applied; empty or unchanged cells are ignored.'}
            </p>
          </div>
          {report && <Callout kind="info" role="status">{report}</Callout>}
        </div>
      </div>
    </section>
  );
}
