import { useMemo, useState } from 'react';
import { Link } from '../../router/index.tsx';
import { useStore } from '../../store/index.tsx';
import { validateVersion, type Issue } from '../../engine/index.ts';
import { PageHead, plain, StatusChip } from './shared.tsx';
import { IssueRow } from './EditorPanels.tsx';

/** Methodology health across versions: the checklist a version must pass before publishing. */
export function HealthPage() {
  const { state } = useStore();
  const draft = state.versions.find((v) => v.status === 'draft');
  const [sel, setSel] = useState(draft?.id ?? state.versions[0]?.id ?? '');
  const version = state.versions.find((v) => v.id === sel) ?? state.versions[0];
  const report = useMemo(() => validateVersion(version), [version]);
  const codes = new Set(report.issues.map((i) => i.code));
  const hasError = (prefixes: string[]) => report.issues.some((i) => i.severity === 'error' && prefixes.some((p) => i.code.startsWith(p)));
  const checks: { label: string; ok: boolean; detail: string }[] = [
    { label: 'Every achievable score has a recommendation', ok: !codes.has('missing-rec') && !codes.has('empty-rec'), detail: `${report.issues.filter((i) => i.code === 'missing-rec').length} missing` },
    { label: 'Every question has Swahili text', ok: !codes.has('missing-translation'), detail: `${report.issues.filter((i) => i.code === 'missing-translation').length} gaps` },
    { label: 'No dangling dependencies or cycles', ok: !hasError(['dangling', 'dependency-cycle', 'self-dependency', 'bad-dependency-answer']), detail: 'dependency chains are evaluated recursively' },
    { label: 'Roadmap rules point to existing recommendations and questions', ok: !hasError(['rule-']), detail: `${version.roadmap_rules.length} rules` },
    { label: 'Grading defines all five letters', ok: !codes.has('grading-incomplete'), detail: version.grading.map((g) => `${g.grade} ≥ ${g.min_percent} %`).join(' · ') },
    { label: `Maximum computed: ${plain(report.max_total)} points`, ok: !codes.has('zero-max'), detail: version.topics.map((t) => `${t.name} ${plain(report.max_by_topic[t.id] ?? 0)}`).join(' · ') },
  ];
  const groups: { sev: Issue['severity']; title: string }[] = [
    { sev: 'error', title: 'Errors (block publishing)' },
    { sev: 'warning', title: 'Warnings' },
    { sev: 'ok', title: 'Passed' },
  ];
  return (
    <section>
      <PageHead title="Methodology health" lead="Automated checks run on every edit. Each finding links to the field in the editor. Errors block publishing; warnings are shown again in the publish dialog." />
      <div className="row" style={{ marginBottom: 12 }}>
        <label htmlFor="health-version" style={{ margin: 0 }}>Version</label>
        <select id="health-version" value={version.id} onChange={(e) => setSel(e.target.value)} style={{ width: 'auto' }}>
          {state.versions.map((v) => (
            <option key={v.id} value={v.id}>{v.id} ({v.status})</option>
          ))}
        </select>
        <StatusChip status={version.status} />
        <Link to={`/admin/methodology/${version.id}`} className="btn btn-sm">Open in editor</Link>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h2>Checklist</h2>
          <p className="small" role="status"><strong>{report.errors} errors · {report.warnings} warnings · publishable {report.publishable ? 'yes' : 'no'}</strong></p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {checks.map((c) => (
              <li key={c.label} className="issue">
                <span className={`dot ${c.ok ? 'dot-ok' : 'dot-error'}`} aria-hidden="true" />
                <span>
                  <span className="sr-only">{c.ok ? 'passed' : 'failed'}: </span>
                  {c.label}
                  <div className="tiny muted">{c.detail}</div>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Findings ({report.issues.length})</h2>
          {groups.map((g) => {
            const list = report.issues.filter((i) => i.severity === g.sev);
            if (!list.length) return null;
            return (
              <div key={g.sev}>
                <h3 className="small">{g.title} ({list.length})</h3>
                {list.map((i) => (
                  <IssueRow key={i.id} issue={i} versionId={version.id} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
