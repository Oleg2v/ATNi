import { useEffect, useMemo, useState } from 'react';
import { Link, href, useRoute } from '../../router/index.tsx';
import { can, useStore } from '../../store/index.tsx';
import { useLang, useT } from '../../i18n/index.tsx';
import { useAdminT } from '../../i18n/admin.ts';
import { useLive } from '../../components/Live.tsx';
import { Callout, Kv } from '../../components/Bits.tsx';
import { downloadJson, fmtDate, fmtDateTime } from '../../lib/data.ts';
import { useAssessments } from '../../lib/useAssessments.ts';
import { validateVersion } from '../../engine/index.ts';
import type { MethodologyVersion, Question } from '../../types.ts';
import { applyPublish, editorHref, fieldId, focusField, PageHead, StatusChip, trunc, useCreateDraft, useRoleLabel } from './shared.tsx';
import { QuestionEditor, type SwQ } from './EditorQuestion.tsx';
import { CompareSection, HealthPanel, ImpactSection, PublishDialog, RulesSection } from './EditorPanels.tsx';

function questionIdFromFieldId(fid: string, v: MethodologyVersion): string | null {
  const hits = v.questions.filter((q) => fid.startsWith(`field-${q.question_id}-`)).sort((a, b) => b.question_id.length - a.question_id.length);
  return hits[0]?.question_id ?? null;
}

/** Editor for one methodology version: the core authoring scenario. */
export function EditorPage({ id }: { id: string }) {
  const { state, update, log, now } = useStore();
  const t = useT();
  const a = useAdminT();
  const lang = useLang();
  const { params } = useRoute();
  const { toast, announce } = useLive();
  const roleLabel = useRoleLabel();
  const createDraft = useCreateDraft();
  const { all: assessments, loading } = useAssessments();
  const version = state.versions.find((v) => v.id === id) ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{ id: string; n: number } | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const focusParam = params.get('focus');
  const compareParam = params.get('compare');
  const report = useMemo(() => (version ? validateVersion(version) : null), [version]);

  useEffect(() => {
    if (focusParam) setPendingFocus((p) => ({ id: focusParam, n: (p?.n ?? 0) + 1 }));
  }, [focusParam]);
  useEffect(() => {
    if (version && (!selected || !version.questions.some((q) => q.question_id === selected))) setSelected(version.questions[0]?.question_id ?? null);
  }, [version, selected]);
  useEffect(() => {
    if (!pendingFocus || !version) return;
    const qid = questionIdFromFieldId(pendingFocus.id, version);
    if (qid && selected !== qid) {
      setSelected(qid);
      return;
    }
    const timer = window.setTimeout(() => {
      if (!focusField(pendingFocus.id)) announce('Field not found on this page');
      setPendingFocus(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [pendingFocus, selected, version, announce]);

  if (!version || !report) {
    return (
      <section>
        <PageHead title={`${t.common.version} ${id}`} />
        <Callout kind="warn">{a.common.notFound} <Link to="/admin/methodology">{a.common.backToVersions}</Link></Callout>
      </section>
    );
  }

  const role = state.role;
  const readOnly = version.status !== 'draft';
  const canEditFull = !readOnly && can.editMethodology(role);
  const canEditSw = !readOnly && can.editContent(role);
  const others = state.versions.filter((v) => v.id !== version.id);
  const defaultBaseId = compareParam ?? version.based_on ?? state.versions.find((v) => v.status === 'published' && v.id !== version.id && v.country === version.country)?.id ?? others[0]?.id ?? null;
  const base = state.versions.find((v) => v.id === (compareId ?? defaultBaseId)) ?? null;
  const publishBase = state.versions.find((v) => v.status === 'published' && v.country === version.country && v.id !== version.id) ?? (version.based_on ? state.versions.find((v) => v.id === version.based_on) ?? null : null);
  const blocking = report.issues.filter((i) => i.severity === 'error');
  const mayPublish = can.publish(role) && version.status === 'draft';
  const publishable = mayPublish && report.publishable;
  const selectedQ = version.questions.find((q) => q.question_id === selected) ?? null;

  /* ----- immutable patch helpers ----- */
  const patchVersion = (fn: (v: MethodologyVersion) => MethodologyVersion) => update((s) => ({ ...s, versions: s.versions.map((v) => (v.id === id ? fn(v) : v)) }));
  const patchQ = (qid: string) => (fn: (q: Question) => Question) => patchVersion((v) => ({ ...v, questions: v.questions.map((q) => (q.question_id === qid ? fn(q) : q)) }));
  const patchSwQ = (qid: string) => (fn: (x: SwQ) => SwQ) =>
    patchVersion((v) => ({ ...v, translations: { sw: { ...v.translations.sw, questions: { ...(v.translations.sw.questions ?? {}), [qid]: fn(v.translations.sw.questions?.[qid] ?? {}) } } } }));
  const patchSwRec = (recId: string, text: string) =>
    patchVersion((v) => {
      const recs = { ...(v.translations.sw.recommendations ?? {}) };
      if (text) recs[recId] = text;
      else delete recs[recId];
      return { ...v, translations: { sw: { ...v.translations.sw, recommendations: recs } } };
    });
  const logEdit = (qid: string) => (field: string, before: string, after: string) => log('edit', `${id} · Q${qid}`, `${field}: "${trunc(before)}" → "${trunc(after)}"`);

  const doPublish = (comment: string, summary: string) => {
    const nowIso = now();
    const { snapshot } = applyPublish(state, id, nowIso, roleLabel, comment);
    update((s) => applyPublish(s, id, nowIso, roleLabel, comment).state);
    log('publish', id, `${comment} · ${summary}${snapshot.previous_version ? ` · replaces ${snapshot.previous_version.id}` : ''}${snapshot.countries_updated.length ? ` · countries: ${snapshot.countries_updated.join(', ')}` : ''}`, snapshot);
    setPublishOpen(false);
    toast(`${id} published. ${snapshot.previous_version ? `${snapshot.previous_version.id} archived.` : ''}`);
  };

  const byTopic = version.topics.map((tp) => ({ topic: tp, questions: version.questions.filter((q) => q.topic === tp.id) }));
  const orphan = version.questions.filter((q) => !version.topics.some((tp) => tp.id === q.topic));
  if (orphan.length) byTopic.push({ topic: { id: '?', name: 'Unknown topic' }, questions: orphan });
  const issuesFor = (qid: string) => report.issues.filter((i) => i.path.question_id === qid);

  return (
    <section className="admin-editor" data-tour="editor">
      <PageHead
        title={`Methodology ${version.id}`}
        right={
          <>
            <StatusChip status={version.status} />
            <Link to="/admin/methodology" className="btn btn-sm">{a.common.backToVersions}</Link>
            <button type="button" className="btn btn-sm" onClick={() => downloadJson(`methodology-${version.id}.json`, version)}>Export JSON</button>
            {readOnly && can.editMethodology(role) && <button type="button" className="btn btn-sm" onClick={() => { createDraft(version.id); toast(`Draft created from ${version.id}`); }}>{a.common.createDraft}</button>}
          </>
        }
      />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <Kv
            items={[
              [t.common.country, version.country === '*' ? 'all countries (shared)' : version.country],
              [a.common.basedOn, version.based_on ? <Link to={`/admin/methodology/${version.based_on}`}>{version.based_on}</Link> : '—'],
              [a.common.created, fmtDate(version.created_at, lang)],
              [a.common.publishedAt, version.published_at ? `${fmtDateTime(version.published_at, lang)} · ${version.published_by ?? ''}` : '—'],
              [a.common.comment, version.comment ?? '—'],
              ['Scope', `${version.questions.length} questions · ${version.topics.length} topics · ${version.roadmap_rules.length} roadmap rules`],
              ...(version.national_thresholds ? [['National thresholds', version.national_thresholds === 'provided' ? 'provided' : <span className="chip chip-warn">to be provided by the programme team</span>] as [string, React.ReactNode]] : []),
            ]}
          />
          <div>
            {version.status === 'published' && <Callout kind="info">{a.common.immutable}</Callout>}
            {version.status === 'archived' && <Callout kind="info">{a.common.immutable} {a.common.archivedNote}</Callout>}
            {!readOnly && !canEditFull && canEditSw && <Callout kind="info">{a.gate.swOnly}</Callout>}
            {!readOnly && !canEditFull && !canEditSw && <Callout kind="info">{a.gate.methodologyEditNote}</Callout>}
            {version.status === 'draft' && (
              <div className="panel" style={{ marginTop: 8 }}>
                <div className="row">
                  <button type="button" className="btn btn-primary" data-tour="publish" disabled={!publishable} aria-describedby="health-summary publish-reason" onClick={() => setPublishOpen(true)}>Publish {version.id}</button>
                  <span className="small muted">Publishing archives the current version for the same scope and moves country pointers. Past results keep their version.</span>
                </div>
                <div id="publish-reason" className="small" style={{ marginTop: 8 }}>
                  {!can.publish(role) && <p className="muted" style={{ margin: 0 }}>Publishing requires the methodology or admin role.</p>}
                  {can.publish(role) && blocking.length > 0 && (
                    <>
                      <p style={{ margin: '0 0 4px' }} className="error-text"><strong>Cannot publish: {blocking.length} blocking {blocking.length === 1 ? 'error' : 'errors'}.</strong></p>
                      <ul style={{ margin: 0 }}>
                        {blocking.map((i) => {
                          const fid = fieldId(i.path);
                          return (
                            <li key={i.id}>
                              {fid ? <a href={href(editorHref(version.id, fid))} onClick={(e) => { e.preventDefault(); setPendingFocus((p) => ({ id: fid, n: (p?.n ?? 0) + 1 })); }}>{i.message}</a> : i.message}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                  {can.publish(role) && blocking.length === 0 && <p className="muted" style={{ margin: 0 }}>All checks pass{report.warnings ? ` with ${report.warnings} warnings` : ''}. The publish dialog shows the impact on past assessments and asks for a comment.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="editor-layout">
        <nav className="card qnav" aria-label="Questions">
          <h2 className="small" style={{ marginTop: 0 }}>Questions</h2>
          {byTopic.map(({ topic, questions }) => (
            <div key={topic.id}>
              <h3 className="tiny muted" style={{ margin: '8px 0 2px' }}>{topic.name}</h3>
              <ul>
                {questions.map((q) => {
                  const iss = issuesFor(q.question_id);
                  const e = iss.filter((i) => i.severity === 'error').length;
                  const w = iss.filter((i) => i.severity === 'warning').length;
                  return (
                    <li key={q.question_id}>
                      <button type="button" aria-current={selected === q.question_id ? 'true' : undefined} onClick={() => setSelected(q.question_id)}>
                        <span className="qid">{q.question_id}</span>
                        <span style={{ flex: 1 }}>{trunc(q.question, 48)}</span>
                        {e > 0 && <span className="dot dot-error" title={`${e} errors`} style={{ marginTop: 4 }}><span className="sr-only">{e} errors</span></span>}
                        {w > 0 && <span className="dot dot-warning" title={`${w} warnings`} style={{ marginTop: 4 }}><span className="sr-only">{w} warnings</span></span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div>
          {selectedQ ? (
            <QuestionEditor key={selectedQ.question_id} version={version} q={selectedQ} canEditFull={canEditFull} canEditSw={canEditSw} issues={issuesFor(selectedQ.question_id)} patchQ={patchQ(selectedQ.question_id)} patchSwQ={patchSwQ(selectedQ.question_id)} patchSwRec={patchSwRec} logEdit={logEdit(selectedQ.question_id)} />
          ) : (
            <p className="muted">This version has no questions.</p>
          )}
        </div>
        <aside className="card" data-tour="health" aria-labelledby="health-h">
          <HealthPanel version={version} report={report} onIssue={(fid) => setPendingFocus((p) => ({ id: fid, n: (p?.n ?? 0) + 1 }))} />
        </aside>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <CompareSection version={version} base={base} others={others} onBase={setCompareId} />
        <ImpactSection version={version} base={publishBase ?? base} assessments={assessments} loading={loading} />
        <RulesSection version={version} />
      </div>

      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} version={version} base={publishBase} report={report} assessments={assessments} loading={loading} onPublish={doPublish} />
    </section>
  );
}
