import { useMemo, useState } from 'react';
import { can, useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { Link, useRoute } from '../router/index.tsx';
import { useAssessments } from '../lib/useAssessments.ts';
import { latestOwnAssessment } from '../lib/sample.ts';
import { fmtDate, localizeAnswerLabel, qText, recText, ruleTitle, topicName, versionById } from '../lib/data.ts';
import { noAccessReason } from './Results.tsx';
import { buildRoadmap } from '../engine/roadmap.ts';
import { Callout, GradeBadge, Sim } from '../components/Bits.tsx';
import type { Phase } from '../types.ts';

const PHASES: Phase[] = ['now', 'next', 'later'];

export function RoadmapPage() {
  const t = useT();
  const lang = useLang();
  const { state, update } = useStore();
  const { params } = useRoute();
  const { all, loading } = useAssessments();
  const [topic, setTopic] = useState('all');
  const wanted = params.get('id');
  const assessment = (wanted ? all.find((a) => a.id === wanted) : null) ?? latestOwnAssessment(state, all.length ? all : null);
  const version = assessment ? versionById(state, assessment.version_id) ?? state.versions[0] : null;
  const steps = useMemo(() => (assessment?.result && version ? buildRoadmap(version, assessment.result, assessment.answers) : []), [assessment, version]);

  if (!can.viewAnswers(state.role)) {
    return (
      <div>
        <h1>{t.roadmap.title}</h1>
        <Callout kind="warn" role="status">
          <strong>{t.common.noAccess}</strong> — {noAccessReason(state.role, lang)}
        </Callout>
      </div>
    );
  }
  if (loading && !assessment) return <p role="status">{t.common.loading}</p>;
  if (assessment && state.role === 'company' && assessment.company_id !== 'C-001') {
    return (
      <div>
        <h1>{t.roadmap.title}</h1>
        <Callout kind="warn" role="status"><strong>{t.common.noAccess}</strong> — {lang === 'sw' ? 'Kampuni huona ramani yake pekee.' : 'A company can only open its own roadmap.'}</Callout>
      </div>
    );
  }
  if (!assessment || !assessment.result || !version) {
    return (
      <div>
        <h1>{t.roadmap.title}</h1>
        <Callout kind="info"><p>{t.roadmap.noResult}</p><Link className="btn btn-primary" to="/assess">{t.results.goAssess}</Link></Callout>
      </div>
    );
  }
  const filtered = topic === 'all' ? steps : steps.filter((s) => s.topic === topic);
  const print = () => {
    update((s) => ({ ...s, myAssessments: s.myAssessments.map((a) => (a.id === assessment.id ? { ...a, plan_downloaded: true } : a)) }));
    window.print();
  };
  const byId = new Map(version.questions.map((q) => [q.question_id, q]));
  const unanswered = assessment.result.questions.filter((x) => x.applicable && !x.answered).length;

  return (
    <div data-tour="roadmap">
      <div className="page-head">
        <h1>{t.roadmap.title}</h1>
        <div className="row no-print">
          <button type="button" className="btn" onClick={print}>{t.roadmap.print} <Sim>PDF</Sim></button>
          <Link className="btn" to={`/results?id=${assessment.id}`}>{t.nav.results}</Link>
        </div>
      </div>
      <p className="lead">{t.roadmap.lead}</p>
      <p className="small muted">
        {assessment.company_name} · {fmtDate(assessment.completed_at, lang)} · <GradeBadge grade={assessment.result.grade} /> · {fmt(t.roadmap.basis, { n: version.roadmap_rules.length, v: version.id })}
      </p>
      {unanswered > 0 && (
        <Callout kind="warn">
          {lang === 'sw' ? `Maswali ${unanswered} hayakujibiwa, kwa hivyo hakuna hatua zilizotengenezwa kwa ajili yake. ` : `${unanswered} question${unanswered === 1 ? ' was' : 's were'} left unanswered, so no steps were generated for them. `}
          <Link to={`/assess?from=${assessment.id}`}>{lang === 'sw' ? 'Jibu ili kukamilisha ramani' : 'Answer them to complete the roadmap'}</Link>
        </Callout>
      )}
      <div className="field no-print" style={{ maxWidth: 360 }}>
        <label htmlFor="topic-filter">{t.roadmap.filter}</label>
        <select id="topic-filter" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">{t.roadmap.all}</option>
          {version.topics.map((tp) => (
            <option key={tp.id} value={tp.id}>{topicName(version, tp.id, lang)}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-3">
        {PHASES.map((ph) => {
          const list = filtered.filter((s) => s.phase === ph);
          return (
            <section key={ph} className={`card phase phase-${ph}`} aria-labelledby={`ph-${ph}`}>
              <h2 id={`ph-${ph}`} style={{ marginTop: 0 }}>{t.roadmap[ph]} <span className="chip">{list.length}</span></h2>
              {list.length === 0 && <p className="muted small">{t.roadmap.empty}</p>}
              <ol style={{ paddingLeft: 18, margin: 0 }} className="stack">
                {list.map((s) => {
                  const q = byId.get(s.question_id);
                  const rec = recText(version, s.rec_id, s.recommendation, lang);
                  return (
                    <li key={s.rule_id}>
                      <strong>{ruleTitle(version, s.rule_id, s.title, lang)}</strong>
                      <div className="chips" style={{ margin: '4px 0' }}>
                        <span className="chip">{topicName(version, s.topic, lang)}</span>
                        <span className={`chip ${s.priority === 'high' ? 'chip-danger' : s.priority === 'medium' ? 'chip-warn' : ''}`}>{t.roadmap.priority}: {t.roadmap[s.priority]}</span>
                        <span className="chip">{t.roadmap.effort}: {t.roadmap[s.effort]}</span>
                      </div>
                      <p className="small" style={{ margin: '4px 0' }}>{rec.text} {lang === 'sw' && !rec.translated && <span className="chip chip-warn">{t.draftTranslation}</span>}</p>
                      <p className="tiny muted" style={{ margin: 0 }}>
                        {t.roadmap.because} <q>{q ? localizeAnswerLabel(version, q, s.because.answer, lang) : s.because.answer}</q> — {q ? qText(version, q, lang).question : s.question_id} ({s.because.score}/{s.because.max}) · {s.rule_id}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
