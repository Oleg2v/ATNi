import { useMemo, useState } from 'react';
import { href } from '../../router/index.tsx';
import { useLang } from '../../i18n/index.tsx';
import { useAdminT } from '../../i18n/admin.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { Callout, GradeBadge } from '../../components/Bits.tsx';
import { fmtDate } from '../../lib/data.ts';
import { computeImpact, diffVersions, recommendationLibrary, type Change, type ImpactReport, type Issue, type ValidationReport } from '../../engine/index.ts';
import type { Assessment, MethodologyVersion } from '../../types.ts';
import { editorHref, fieldId, plain } from './shared.tsx';

/* ---------- Health ---------- */

export function HealthPanel({ version, report, onIssue }: { version: MethodologyVersion; report: ValidationReport; onIssue: (fieldId: string) => void }) {
  const groups: { sev: Issue['severity']; title: string }[] = [
    { sev: 'error', title: 'Errors (block publishing)' },
    { sev: 'warning', title: 'Warnings' },
    { sev: 'ok', title: 'Passed checks' },
  ];
  return (
    <>
      <h2 id="health-h" style={{ marginTop: 0 }}>Health</h2>
      <p id="health-summary" className="small" aria-live="polite">
        <strong>{report.errors} errors · {report.warnings} warnings · publishable {report.publishable ? 'yes' : 'no'}</strong>
      </p>
      <dl className="kv small">
        <dt>Maximum total</dt>
        <dd>{plain(report.max_total)} points</dd>
        {version.topics.map((t) => (
          <div key={t.id} style={{ display: 'contents' }}>
            <dt>{t.name}</dt>
            <dd>{plain(report.max_by_topic[t.id] ?? 0)}</dd>
          </div>
        ))}
      </dl>
      {groups.map((g) => {
        const list = report.issues.filter((i) => i.severity === g.sev);
        if (!list.length) return null;
        return (
          <div key={g.sev}>
            <h3 className="small" style={{ marginBottom: 4 }}>{g.title} ({list.length})</h3>
            <div>
              {list.map((i) => (
                <IssueRow key={i.id} issue={i} versionId={version.id} onIssue={onIssue} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function IssueRow({ issue, versionId, onIssue }: { issue: Issue; versionId: string; onIssue?: (fieldId: string) => void }) {
  const fid = fieldId(issue.path);
  return (
    <div className="issue small">
      <span className={`dot dot-${issue.severity}`} aria-hidden="true" />
      <span>
        <span className="sr-only">{issue.severity}: </span>
        {fid ? (
          <a href={href(editorHref(versionId, fid))} onClick={onIssue ? (e) => { e.preventDefault(); onIssue(fid); } : undefined}>{issue.message}</a>
        ) : (
          issue.message
        )}
      </span>
    </div>
  );
}

/* ---------- Compare ---------- */

export function CompareSection({ version, base, others, onBase }: { version: MethodologyVersion; base: MethodologyVersion | null; others: MethodologyVersion[]; onBase: (id: string) => void }) {
  const changes = useMemo(() => (base ? diffVersions(base, version) : []), [base, version]);
  const scoring = changes.filter((c) => c.affects_scoring).length;
  return (
    <section className="card" aria-labelledby="compare-h">
      <div className="row row-between">
        <h2 id="compare-h" style={{ margin: 0 }}>Compare {base ? `with ${base.id}` : ''}</h2>
        <label className="row" style={{ margin: 0, fontWeight: 400 }}>
          <span>Compare with</span>
          <select value={base?.id ?? ''} onChange={(e) => onBase(e.target.value)} style={{ width: 'auto', minHeight: 36 }}>
            {!base && <option value="">—</option>}
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.id} ({o.status})</option>
            ))}
          </select>
        </label>
      </div>
      {!base && <p className="muted">No other version to compare with.</p>}
      {base && (
        <>
          <p className="small muted">{changes.length} field-level changes, {scoring} of which affect scoring. Scoring changes are why past results stay on their original version.</p>
          {changes.length > 0 && (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Changes from {base.id} to {version.id}</caption>
                <thead>
                  <tr>
                    <th scope="col">Scope</th>
                    <th scope="col">Id</th>
                    <th scope="col">Field</th>
                    <th scope="col">Before ({base.id})</th>
                    <th scope="col">After ({version.id})</th>
                    <th scope="col">Scoring</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c, i) => (
                    <ChangeRow key={i} c={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ChangeRow({ c }: { c: Change }) {
  return (
    <tr>
      <td><span className="chip">{c.kind} {c.scope}</span></td>
      <td className="mono">{c.id}</td>
      <td>{c.field ?? '—'}</td>
      <td className="small" style={{ maxWidth: 320 }}>{c.before ?? '—'}</td>
      <td className="small" style={{ maxWidth: 320 }}>{c.after ?? '—'}</td>
      <td>{c.affects_scoring ? <span className="chip chip-warn">affects scoring</span> : <span className="chip">text only</span>}</td>
    </tr>
  );
}

/* ---------- Impact preview ---------- */

export function impactFor(assessments: Assessment[], base: MethodologyVersion, version: MethodologyVersion): ImpactReport {
  // a country-specific version only ever applies to that country's assessments
  const scoped = version.country === '*' ? assessments : assessments.filter((a) => a.country === version.country);
  return computeImpact(scoped.filter((a) => a.completed_at && a.version_id === base.id), base, version);
}

export function ImpactSummary({ impact, base }: { impact: ImpactReport; base: MethodologyVersion }) {
  return (
    <p>
      Of <strong>{impact.total}</strong> past assessments, <strong>{impact.changed}</strong> would have a different letter ({impact.down} lower, {impact.up} higher). They stay on {base.id} until the company assesses again.
    </p>
  );
}

export function ImpactSection({ version, base, assessments, loading }: { version: MethodologyVersion; base: MethodologyVersion | null; assessments: Assessment[]; loading: boolean }) {
  const a = useAdminT();
  const lang = useLang();
  const [impact, setImpact] = useState<ImpactReport | null>(null);
  const [all, setAll] = useState(false);
  const run = () => base && setImpact(impactFor(assessments, base, version));
  const rows = impact ? [...impact.rows].sort((x, y) => Number(y.changed) - Number(x.changed) || (y.completed_at ?? '').localeCompare(x.completed_at ?? '')) : [];
  const shown = all ? rows : rows.slice(0, 20);
  return (
    <section className="card" aria-labelledby="impact-h">
      <h2 id="impact-h" style={{ marginTop: 0 }}>Impact on past assessments</h2>
      <p className="small muted">Preview only: past results are never rewritten. Re-scores the stored answers of every completed assessment on {base?.id ?? 'the base version'}{version.country !== '*' ? ` from ${version.country}` : ''} with this version.</p>
      <button type="button" className="btn" onClick={run} disabled={!base || loading}>{loading ? 'Loading assessments…' : 'Preview impact on past assessments'}</button>
      {impact && base && (
        <div style={{ marginTop: 12 }}>
          <Callout kind={impact.changed ? 'warn' : 'ok'} role="status">
            <ImpactSummary impact={impact} base={base} />
            <p className="small" style={{ margin: 0 }}>Letters can also move up when a maximum is lowered: the percentage is points ÷ maximum, so a smaller denominator raises everyone’s share even with unchanged answers.</p>
          </Callout>
          {Object.keys(impact.by_transition).length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table style={{ maxWidth: 360 }}>
                <caption>Letter transitions</caption>
                <thead>
                  <tr>
                    <th scope="col">Transition</th>
                    <th scope="col" className="num">Assessments</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(impact.by_transition).sort((x, y) => y[1] - x[1]).map(([k, n]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td className="num">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <caption>Per assessment (changed rows first, {shown.length} of {rows.length})</caption>
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Country</th>
                  <th scope="col">Date</th>
                  <th scope="col">Letter</th>
                  <th scope="col" className="num">Old %</th>
                  <th scope="col" className="num">New %</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.assessment_id} style={r.changed ? { background: 'var(--warn-soft)' } : undefined}>
                    <th scope="row">{r.company_name}</th>
                    <td>{r.country}</td>
                    <td>{fmtDate(r.completed_at, lang)}</td>
                    <td>
                      <GradeBadge grade={r.old_grade} label="old" /> → <GradeBadge grade={r.new_grade} label="new" />
                      {r.changed && <span className="sr-only"> (changed)</span>}
                    </td>
                    <td className="num">{r.old_percent}</td>
                    <td className="num">{r.new_percent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 20 && (
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setAll((v) => !v)}>{all ? a.common.showFewer : `${a.common.showAll} (${rows.length})`}</button>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Roadmap rules (read-only) ---------- */

export function RulesSection({ version }: { version: MethodologyVersion }) {
  const lib = new Set(recommendationLibrary(version.questions).map((r) => r.id));
  return (
    <section className="card" aria-labelledby="rules-h">
      <h2 id="rules-h" style={{ marginTop: 0 }}>Roadmap rules ({version.roadmap_rules.length})</h2>
      <p className="small muted">A rule fires when a question’s score meets its condition and turns the linked recommendation into a roadmap step. Rules are edited as data in this concept (read-only here).</p>
      {version.roadmap_rules.length === 0 ? (
        <p className="muted">No rules yet: the roadmap will be empty for this version.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Roadmap rules</caption>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Question</th>
                <th scope="col">Condition</th>
                <th scope="col">Phase</th>
                <th scope="col">Priority / effort</th>
                <th scope="col">Recommendation</th>
                <th scope="col">Title</th>
              </tr>
            </thead>
            <tbody>
              {version.roadmap_rules.map((r) => (
                <tr key={r.id} id={`field-rule-${r.id}`} tabIndex={-1}>
                  <th scope="row" className="mono">{r.id}</th>
                  <td className="mono">{r.question_id}</td>
                  <td>{r.score_eq !== undefined ? `score = ${plain(r.score_eq)}` : r.max_share !== undefined ? `share ≤ ${Math.round(r.max_share * 100)} %` : <span className="chip chip-danger">no condition</span>}</td>
                  <td><span className={`chip phase-${r.phase}`}>{r.phase}</span></td>
                  <td>{r.priority} / {r.effort}</td>
                  <td className="mono">{r.rec_id} {lib.has(r.rec_id) ? '' : <span className="chip chip-danger">missing</span>}</td>
                  <td className="small">{r.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Publish dialog ---------- */

export function PublishDialog({ open, onClose, version, base, report, assessments, loading, onPublish }: { open: boolean; onClose: () => void; version: MethodologyVersion; base: MethodologyVersion | null; report: ValidationReport; assessments: Assessment[]; loading: boolean; onPublish: (comment: string, summary: string) => void }) {
  const [comment, setComment] = useState('');
  const [ack, setAck] = useState(false);
  const [tried, setTried] = useState(false);
  const impact = useMemo(() => (open && base ? impactFor(assessments, base, version) : null), [open, base, assessments, version]);
  const diffCount = useMemo(() => (base ? diffVersions(base, version).length : 0), [base, version]);
  const swWarnings = report.issues.filter((i) => i.severity === 'warning' && i.path.lang === 'sw' && i.code !== 'missing-rec-translation').length;
  const commentError = tried && !comment.trim();
  const ackError = tried && report.warnings > 0 && !ack;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!comment.trim() || (report.warnings > 0 && !ack)) return;
    const summary = impact && base ? `impact: ${impact.changed} of ${impact.total} letters would change (${impact.down} lower, ${impact.up} higher) vs ${base.id}` : 'no base version for impact';
    onPublish(comment.trim(), `${diffCount} changes · ${summary}`);
    setComment('');
    setAck(false);
    setTried(false);
  };
  return (
    <Dialog open={open} onClose={onClose} title={`Publish ${version.id}`} wide>
      <form onSubmit={submit} noValidate>
        {(commentError || ackError) && (
          <Callout kind="danger" role="alert">
            <strong>Please complete the form:</strong>
            <ul style={{ margin: '4px 0 0' }}>
              {commentError && <li><a href="#publish-comment" onClick={(e) => { e.preventDefault(); document.getElementById('publish-comment')?.focus(); }}>Publication comment is required</a></li>}
              {ackError && <li><a href="#publish-ack" onClick={(e) => { e.preventDefault(); document.getElementById('publish-ack')?.focus(); }}>Please confirm the warnings</a></li>}
            </ul>
          </Callout>
        )}
        <dl className="kv">
          <dt>Country</dt>
          <dd>{version.country === '*' ? 'all countries without a country-specific version' : version.country}</dd>
          <dt>Replaces</dt>
          <dd>{base ? `${base.id} (becomes archived)` : 'nothing: first version for this scope'}</dd>
          <dt>Changes</dt>
          <dd>{base ? `${diffCount} field-level changes vs ${base.id}` : '—'}</dd>
          <dt>Health</dt>
          <dd>{report.errors} errors · {report.warnings} warnings</dd>
        </dl>
        {base && (loading ? <p className="muted">{'Loading past assessments…'}</p> : impact && <Callout kind={impact.changed ? 'warn' : 'ok'}><ImpactSummary impact={impact} base={base} /></Callout>)}
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="publish-comment">Publication comment (shown in the journal and the versions list)</label>
          <textarea id="publish-comment" value={comment} required aria-required="true" aria-invalid={commentError || undefined} aria-describedby={commentError ? 'publish-comment-err' : undefined} onChange={(e) => setComment(e.target.value)} />
          {commentError && <p className="error-text" id="publish-comment-err">Please describe what changed and why.</p>}
        </div>
        {report.warnings > 0 && (
          <div className="field">
            <label className="choice" htmlFor="publish-ack">
              <input type="checkbox" id="publish-ack" checked={ack} aria-invalid={ackError || undefined} aria-describedby={ackError ? 'publish-ack-err' : undefined} onChange={(e) => setAck(e.target.checked)} />
              <span>I understand that {swWarnings} Swahili texts are missing{report.warnings > swWarnings ? ` and that there are ${report.warnings - swWarnings} other warnings` : ''}. Companies assessing in Swahili will see English for those.</span>
            </label>
            {ackError && <p className="error-text" id="publish-ack-err">Please confirm before publishing.</p>}
          </div>
        )}
        <div className="row">
          <button type="submit" className="btn btn-primary">Publish</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Dialog>
  );
}
