import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { navigate } from '../router/index.tsx';
import { useLive } from '../components/Live.tsx';
import { Callout, Sim } from '../components/Bits.tsx';
import { activeVersionFor, qText, topicName } from '../lib/data.ts';
import { computeResult, isAnswered, isApplicable, questionMap } from '../engine/score.ts';
import type { AnswerValue, Answers, Assessment, Question } from '../types.ts';

export function SurveyPage() {
  const t = useT();
  const lang = useLang();
  const { state, update, now, persistOk } = useStore();
  const { announce, toast } = useLive();
  const version = useMemo(() => (state.draft ? state.versions.find((v) => v.id === state.draft!.version_id) : null) ?? activeVersionFor(state, state.profile?.country), [state]);
  const byId = useMemo(() => questionMap(version), [version]);
  const answers: Answers = state.draft?.answers ?? {};
  const [topicIdx, setTopicIdx] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [openInfo, setOpenInfo] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<number | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topics = version.topics;
  const topic = topics[Math.min(topicIdx, topics.length - 1)];

  // start a draft if the user lands here directly
  useEffect(() => {
    if (!state.draft) {
      const started = now();
      update((s) => ({ ...s, profile: s.profile ?? { country: 'KE', size: 'medium', lang: s.lang, company_id: 'C-001' }, draft: { id: `D-${started.slice(0, 10)}`, version_id: version.id, started_at: started, answers: {}, pending_sync: [], updated_at: started } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applicable = (q: Question) => isApplicable(q, answers, byId);
  const visibleQs = version.questions.filter((q) => q.topic === topic.id && applicable(q));
  const allApplicable = version.questions.filter(applicable);
  const answeredCount = allApplicable.filter((q) => isAnswered(q, answers[q.question_id])).length;
  const unansweredHere = visibleQs.filter((q) => !isAnswered(q, answers[q.question_id]));
  const unansweredAll = allApplicable.filter((q) => !isAnswered(q, answers[q.question_id]));

  const setAnswer = (q: Question, value: AnswerValue | null) => {
    const at = now();
    update((s) => {
      if (!s.draft) return s;
      const next: Answers = { ...s.draft.answers };
      if (value) next[q.question_id] = value;
      else delete next[q.question_id];
      // drop answers of questions that are no longer applicable
      const map = questionMap(version);
      for (const qq of version.questions) if (qq.dependency && !isApplicable(qq, next, map)) delete next[qq.question_id];
      const pending = s.offline ? Array.from(new Set([...s.draft.pending_sync, q.question_id])) : s.draft.pending_sync;
      return { ...s, draft: { ...s.draft, answers: next, pending_sync: pending, updated_at: at } };
    });
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => announce(!persistOk ? (lang === 'sw' ? 'Haikuweza kuhifadhi kwenye kifaa hiki: hifadhi imezuiwa au imejaa' : 'Could not save on this device: storage is blocked or full') : state.offline ? t.savedLocal : t.saved, !persistOk), 900);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const goTopic = (i: number, keepErrors = false) => {
    setTopicIdx(i);
    if (!keepErrors) setShowErrors(false);
    window.setTimeout(() => headingRef.current?.focus(), 50);
  };

  const finish = (force = false) => {
    if (unansweredAll.length > 0 && !force) {
      setShowErrors(true);
      announce(fmt(t.survey.unanswered, { n: unansweredAll.length }), true);
      return;
    }
    const at = now();
    const result = computeResult(version, answers, at);
    const company = state.companies.find((c) => c.id === (state.profile?.company_id ?? 'C-001')) ?? state.companies[0];
    const a: Assessment = {
      id: `L-${String(state.myAssessments.length + 1).padStart(3, '0')}`,
      company_id: company.id,
      company_name: company.name,
      country: state.profile?.country ?? 'KE',
      company_size: state.profile?.size ?? 'medium',
      lang,
      version_id: version.id,
      started_at: state.draft?.started_at ?? at,
      completed_at: at,
      answers,
      result,
      consent_investor_share: state.investorConsent,
      plan_downloaded: false,
    };
    update((s) => ({ ...s, myAssessments: [...s.myAssessments, a], draft: null }));
    toast(`${t.results.title}: ${result.grade}`);
    navigate(`/results?id=${a.id}`);
  };

  const progressPct = allApplicable.length ? Math.round((answeredCount / allApplicable.length) * 100) : 0;

  return (
    <div>
      <div className="page-head">
        <h1>{t.survey.title}</h1>
        <div className="row no-print">
          <button type="button" className="btn btn-sm" aria-pressed={state.offline} onClick={() => update((s) => ({ ...s, offline: !s.offline }))} disabled={state.offline}>
            {t.simulateOffline} <Sim />
          </button>
        </div>
      </div>
      <p className="small muted" aria-live="off">{fmt(t.survey.progress, { done: answeredCount, total: allApplicable.length })} · {version.id} · <span className="tiny">{lang === 'sw' ? 'idadi hubadilika maswali ya masharti yanapoonekana' : 'the total changes as conditional questions appear'}</span></p>
      <div className="progress" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={t.survey.progress.replace('{done}', String(answeredCount)).replace('{total}', String(allApplicable.length))}>
        <div style={{ width: `${progressPct}%` }} />
      </div>

      <ol className="steps" style={{ marginTop: 12 }} aria-label={t.survey.topic}>
        {topics.map((tp, i) => {
          const qs = version.questions.filter((q) => q.topic === tp.id && applicable(q));
          const done = qs.length > 0 && qs.every((q) => isAnswered(q, answers[q.question_id]));
          return (
            <li key={tp.id} aria-current={i === topicIdx ? 'step' : undefined} className={done && i !== topicIdx ? 'done' : undefined} style={{ padding: 0 }}>
              <button type="button" className="btn-link step-btn" style={{ color: 'inherit' }} onClick={() => goTopic(i)}>
                {i + 1}. {topicName(version, tp.id, lang)}{done ? ' ✓' : ''}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="card" aria-labelledby="topic-h">
        <h2 id="topic-h" ref={headingRef} tabIndex={-1} style={{ marginTop: 0 }}>
          {topicIdx + 1}. {topicName(version, topic.id, lang)}
        </h2>
        {showErrors && unansweredHere.length > 0 && topicIdx < topics.length - 1 && (
          <Callout kind="warn" role="alert">
            <strong>{fmt(t.survey.unanswered, { n: unansweredHere.length })}</strong>
            <ul style={{ margin: '6px 0 0' }}>
              {unansweredHere.map((q) => (
                <li key={q.question_id}><a href={`#q-${q.question_id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`q-${q.question_id}`)?.focus(); }}>{q.question_id} · {qText(version, q, lang).question}</a></li>
              ))}
            </ul>
          </Callout>
        )}
        {visibleQs.map((q) => (
          <QuestionBlock key={q.question_id} q={q} value={answers[q.question_id]} onChange={(v) => setAnswer(q, v)} infoOpen={!!openInfo[q.question_id]} onToggleInfo={() => setOpenInfo((o) => ({ ...o, [q.question_id]: !o[q.question_id] }))} invalid={showErrors && !isAnswered(q, answers[q.question_id])} version={version} />
        ))}
        <p className="hint">{t.survey.hiddenNote}</p>
        <div className="row row-between" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => goTopic(topicIdx - 1)} disabled={topicIdx === 0}>{t.survey.prev}</button>
          {topicIdx < topics.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => goTopic(topicIdx + 1)}>{t.survey.next}</button>
          ) : (
            <div className="row">
              {showErrors && unansweredAll.length > 0 && <button type="button" className="btn" onClick={() => finish(true)}>{t.survey.submitAnyway}</button>}
              <button type="button" className="btn btn-primary" onClick={() => finish(false)}>{t.survey.finish}</button>
            </div>
          )}
        </div>
      </section>
      {showErrors && unansweredAll.length > 0 && topicIdx === topics.length - 1 && (
        <Callout kind="warn" role="alert">
          <strong>{fmt(t.survey.unanswered, { n: unansweredAll.length })}</strong>
          <ul style={{ margin: '6px 0 0' }}>
            {unansweredAll.map((q) => (
              <li key={q.question_id}>
                <button type="button" className="btn-link" onClick={() => { goTopic(topics.findIndex((tp) => tp.id === q.topic), true); window.setTimeout(() => document.getElementById(`q-${q.question_id}`)?.focus(), 80); }}>
                  {q.question_id} · {qText(version, q, lang).question}
                </button>
              </li>
            ))}
          </ul>
        </Callout>
      )}
      <p className="hint">{t.survey.autosave}{state.draft?.pending_sync.length ? ` · ${t.savedLocal}: ${state.draft.pending_sync.length}` : ''}</p>
      {!persistOk && <Callout kind="danger" role="alert">{lang === 'sw' ? 'Hifadhi ya kivinjari imezuiwa au imejaa: majibu yatapotea ukifunga ukurasa.' : 'Browser storage is blocked or full: answers will be lost when you leave this page.'}</Callout>}
    </div>
  );
}

function QuestionBlock({ q, value, onChange, infoOpen, onToggleInfo, invalid, version }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue | null) => void; infoOpen: boolean; onToggleInfo: () => void; invalid: boolean; version: ReturnType<typeof activeVersionFor> }) {
  const t = useT();
  const lang = useLang();
  const txt = qText(version, q, lang);
  const p = q.propositions;
  const infoId = `info-${q.question_id}`;
  const errId = `err-${q.question_id}`;
  const describedBy = [infoOpen && txt.info ? infoId : null, invalid ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset id={`q-${q.question_id}`} className="qblock" tabIndex={-1} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
      <legend>
        <span className="muted mono small">{q.question_id}</span> {txt.question}
        {lang === 'sw' && !txt.translated && <span className="chip chip-warn" style={{ marginLeft: 6 }}>{t.draftTranslation}</span>}
      </legend>
      {q.dependency && <p className="tiny muted" style={{ marginTop: -4 }}>{fmt(t.survey.conditional, { id: q.dependency })}</p>}
      {txt.info && (
        <div style={{ marginBottom: 6 }}>
          <button type="button" className="btn btn-link btn-sm" aria-expanded={infoOpen} aria-controls={infoId} onClick={onToggleInfo}>
            {infoOpen ? t.survey.hideInfo : `ⓘ ${t.survey.info}`}
          </button>
          <p id={infoId} className="panel small" hidden={!infoOpen}>{txt.info}</p>
        </div>
      )}
      {invalid && <p id={errId} className="error-text">{t.survey.required}</p>}

      {p.type === 'option' && (
        <div>
          {p.propositions.map((o, i) => {
            const checked = value?.type === 'option' && value.selected === o.proposition;
            return (
              <div key={o.proposition}>
                <label className={`choice${checked ? ' choice-selected' : ''}`}>
                  <input type="radio" name={`q-${q.question_id}`} value={o.proposition} checked={checked} onChange={() => onChange({ type: 'option', selected: o.proposition, text: checked && value?.type === 'option' ? value.text : undefined })} />
                  <span>{txt.options[i]}</span>
                </label>
                {o.text_inputs && checked && (
                  <div className="field" style={{ marginLeft: 36 }}>
                    <label htmlFor={`q-${q.question_id}-text`} className="small">{t.survey.textHint}</label>
                    <input id={`q-${q.question_id}-text`} type="text" value={(value?.type === 'option' && value.text) || ''} onChange={(e) => onChange({ type: 'option', selected: o.proposition, text: e.target.value })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {p.type === 'choices' && (
        <div>
          {p.propositions.map((c, i) => {
            const sel = value?.type === 'choices' ? value.selected : [];
            const checked = sel.includes(c);
            return (
              <label key={c} className={`choice${checked ? ' choice-selected' : ''}`}>
                <input type="checkbox" checked={checked} onChange={(e) => {
                  const next = e.target.checked ? [...sel, c] : sel.filter((x) => x !== c);
                  onChange(next.length ? { type: 'choices', selected: next } : null);
                }} />
                <span>{txt.options[i]}</span>
              </label>
            );
          })}
          {p.none_of_the_above && (
            <label className={`choice${value?.type === 'choices' && value.none ? ' choice-selected' : ''}`}>
              <input type="checkbox" checked={value?.type === 'choices' && !!value.none} onChange={(e) => onChange(e.target.checked ? { type: 'choices', selected: [], none: true } : null)} />
              <span>{t.survey.none}</span>
            </label>
          )}
        </div>
      )}

      {p.type === 'text' && (
        <div className="field">
          <label htmlFor={`q-${q.question_id}-ta`} className="sr-only">{txt.question}</label>
          <textarea id={`q-${q.question_id}-ta`} placeholder={txt.textPlaceholder} value={value?.type === 'text' ? value.text : ''} onChange={(e) => onChange(e.target.value.trim() ? { type: 'text', text: e.target.value } : null)} />
        </div>
      )}
    </fieldset>
  );
}
