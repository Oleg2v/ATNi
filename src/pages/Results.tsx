import { useMemo, useState } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { Link, useRoute } from '../router/index.tsx';
import { useAssessments } from '../lib/useAssessments.ts';
import { latestOwnAssessment } from '../lib/sample.ts';
import { fmtDate, fmtDateTime, qText, topicName, versionById } from '../lib/data.ts';
import { Callout, GradeBadge, Kv, Sim } from '../components/Bits.tsx';
import { BarChart } from '../components/BarChart.tsx';
import type { Assessment } from '../types.ts';

export function openAssistant(): void {
  window.dispatchEvent(new CustomEvent('ndh:assistant', { detail: { open: true } }));
}

export function ResultsPage() {
  const t = useT();
  const lang = useLang();
  const { state, update } = useStore();
  const { params } = useRoute();
  const { all, loading } = useAssessments();
  const [whyOpen, setWhyOpen] = useState(true);
  const mine = useMemo(() => {
    const own = all.filter((a) => a.company_id === 'C-001' && !(state.accountDeleted && !a.id.startsWith('L-')));
    return own.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  }, [all, state.accountDeleted]);
  const wanted = params.get('id');
  const assessment: Assessment | null = (wanted ? all.find((a) => a.id === wanted) : null) ?? latestOwnAssessment(state, all.length ? all : null);

  if (loading && !assessment) return <p role="status">{t.common.loading}</p>;
  if (!assessment || !assessment.result) {
    return (
      <div>
        <h1>{t.results.title}</h1>
        <Callout kind="info">
          <p>{t.results.noResult}</p>
          <Link className="btn btn-primary" to="/assess">{t.results.goAssess}</Link>
        </Callout>
      </div>
    );
  }
  const version = versionById(state, assessment.version_id) ?? state.versions[0];
  const r = assessment.result;
  const byId = new Map(version.questions.map((q) => [q.question_id, q]));
  const thresholds = [...version.grading].sort((a, b) => b.min_percent - a.min_percent);
  const isOwn = assessment.company_id === 'C-001';

  return (
    <div>
      <div className="page-head">
        <h1>{t.results.title}</h1>
        <div className="row no-print">
          <button type="button" className="btn btn-primary" data-tour="assistant" onClick={openAssistant}>{t.results.ask}</button>
          <Link className="btn" to={`/roadmap?id=${assessment.id}`}>{t.results.roadmapCta}</Link>
        </div>
      </div>
      <p className="small muted">{assessment.company_name} · {fmtDate(assessment.completed_at, lang)} · {t.results.version} {version.id}</p>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="overall-h" data-tour="grade">
          <h2 id="overall-h" style={{ marginTop: 0 }}>{t.results.overall}</h2>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <GradeBadge grade={r.grade} large label={t.results.overall} />
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>{r.percent} %</div>
              <div className="muted small">{r.total} / {r.max} {t.results.points.toLowerCase()}</div>
            </div>
          </div>
          <h3>{t.results.byTopic}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {r.topics.map((tp) => (
              <li key={tp.topic} className="row row-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span>{topicName(version, tp.topic, lang)}</span>
                <span className="row" style={{ gap: 10 }}>
                  <span className="small muted">{tp.score} / {tp.max} · {tp.percent} %</span>
                  <GradeBadge grade={tp.grade} label={topicName(version, tp.topic, lang)} />
                </span>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: 12 }}>{fmt(t.results.staysOn, { v: version.id })}</p>
        </section>
        <section className="card" aria-labelledby="chart-h">
          <h2 id="chart-h" className="sr-only">{t.results.chartAlt}</h2>
          <BarChart title={t.results.byTopic} bars={r.topics.map((tp) => ({ label: topicName(version, tp.topic, lang), value: tp.percent, note: tp.grade }))} unit="%" max={100} caption={t.results.byTopic} />
          {isOwn && (
            <div className="field" style={{ marginTop: 16 }}>
              <label className="choice" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={state.investorConsent} onChange={(e) => update((s) => ({ ...s, investorConsent: e.target.checked, myAssessments: s.myAssessments.map((a) => ({ ...a, consent_investor_share: e.target.checked })) }))} />
                <span>{t.results.share}<br /><span className="hint">{t.results.shareHint}</span></span>
              </label>
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="why-h" data-tour="why">
        <div className="row row-between">
          <h2 id="why-h" style={{ margin: 0 }}>{t.results.why}</h2>
          <button type="button" className="btn btn-sm no-print" aria-expanded={whyOpen} aria-controls="why-body" onClick={() => setWhyOpen((v) => !v)}>{whyOpen ? t.common.close : t.common.more}</button>
        </div>
        <p className="muted small">{t.results.whyLead}</p>
        <div id="why-body" hidden={!whyOpen}>
          <Kv items={[
            [t.results.formula, <code key="f">{t.results.formulaText}</code>],
            [t.results.overall, `${r.total} ÷ ${r.max} × 100 = ${r.percent} % → ${r.grade}`],
            [t.results.thresholds, thresholds.map((g) => `${g.grade} ≥ ${g.min_percent} %`).join(' · ')],
            [t.results.version, `${version.id} (${version.status}${version.published_at ? `, ${fmtDate(version.published_at, lang)}` : ''})`],
            [t.results.computed, fmtDateTime(r.computed_at, lang)],
          ]} />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <caption>{t.results.why}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t.results.question}</th>
                  <th scope="col">{t.results.answer}</th>
                  <th scope="col" className="num">{t.results.points}</th>
                  <th scope="col" className="num">{t.results.max}</th>
                </tr>
              </thead>
              <tbody>
                {version.topics.map((tp) => (
                  <RowsForTopic key={tp.id} topicId={tp.id} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isOwn && (
        <section className="card" style={{ marginTop: 16 }} aria-labelledby="hist-h" data-tour="history">
          <h2 id="hist-h" style={{ marginTop: 0 }}>{t.results.history}</h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{t.results.history}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.common.date}</th>
                  <th scope="col">{t.results.version}</th>
                  <th scope="col">{t.results.overall}</th>
                  <th scope="col">%</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id} style={a.id === assessment.id ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>{fmtDate(a.completed_at, lang)}</td>
                    <td>{a.version_id} {versionById(state, a.version_id)?.status === 'archived' && <span className="chip">{t.common.archived}</span>}</td>
                    <td><GradeBadge grade={a.result!.grade} /></td>
                    <td className="num">{a.result!.percent}</td>
                    <td>{a.id !== assessment.id && <Link to={`/results?id=${a.id}`}>{t.common.more}</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{fmt(t.results.staysOn, { v: assessment.version_id })} <Sim>{lang === 'sw' ? 'data ya kubuni' : 'synthetic data'}</Sim></p>
        </section>
      )}
    </div>
  );

  function RowsForTopic({ topicId }: { topicId: string }) {
    const rows = r.questions.filter((x) => x.topic === topicId);
    const ts = r.topics.find((x) => x.topic === topicId)!;
    return (
      <>
        <tr>
          <th scope="rowgroup" colSpan={3}>{topicName(version, topicId, lang)} — <GradeBadge grade={ts.grade} /> {ts.percent} %</th>
          <th scope="rowgroup" className="num">{ts.score}</th>
          <th scope="rowgroup" className="num">{ts.max}</th>
        </tr>
        {rows.map((x) => {
          const q = byId.get(x.question_id);
          return (
            <tr key={x.question_id}>
              <td className="mono small">{x.question_id}</td>
              <td>{q ? qText(version, q, lang).question : x.question_id}</td>
              <td>{!x.applicable ? <span className="muted">{t.results.notApplicable}</span> : !x.answered ? <span className="muted">{t.results.unanswered}</span> : x.answer_label}</td>
              <td className="num">{x.applicable ? x.score : '—'}</td>
              <td className="num">{x.applicable ? x.max : '—'}</td>
            </tr>
          );
        })}
      </>
    );
  }
}
