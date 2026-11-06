import type { Issue } from '../../engine/index.ts';
import { achievableScores, maxScore } from '../../engine/index.ts';
import type { ChoicesPropositions, MethodologyVersion, OptionPropositions, Question, ScoredRecommendationEntry, SwTranslations } from '../../types.ts';
import { CheckField, NumberField, SelectField, TextField } from './fields.tsx';
import { plain } from './shared.tsx';

export type SwQ = NonNullable<SwTranslations['questions']>[string];

interface Props {
  version: MethodologyVersion;
  q: Question;
  canEditFull: boolean;
  canEditSw: boolean;
  issues: Issue[];
  patchQ: (fn: (q: Question) => Question) => void;
  patchSwQ: (fn: (t: SwQ) => SwQ) => void;
  patchSwRec: (recId: string, text: string) => void;
  logEdit: (field: string, before: string, after: string) => void;
}

const EMPTY = 'empty — needs translation';

function nextRecId(version: MethodologyVersion): string {
  let max = 0;
  for (const q of version.questions) {
    const r = q.recommandations;
    const ids = !r ? [] : r.type === 'fixed' ? [r.x_id] : r.recommandations.map((e) => e.x_id);
    for (const id of ids) {
      const m = /^R-(\d+)$/.exec(id ?? '');
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `R-${String(max + 1).padStart(2, '0')}`;
}

/** Editor for one question: texts, scoring, recommendations, dependency and the Swahili texts. */
export function QuestionEditor({ version, q, canEditFull, canEditSw, issues, patchQ, patchSwQ, patchSwRec, logEdit }: Props) {
  const qid = q.question_id;
  const ro = !canEditFull;
  const roSw = !canEditSw;
  const f = (field: string) => `field-${qid}-${field}`;
  const has = (field: string, sev?: Issue['severity']) => issues.some((i) => i.path.field === field && !i.path.lang && (!sev || i.severity === sev));
  const p = q.propositions;
  const enOptions = p.type === 'option' ? p.propositions.map((o) => o.proposition) : p.type === 'choices' ? p.propositions : [];
  const sw = version.translations.sw.questions?.[qid] ?? {};
  const swProps = enOptions.map((_, i) => sw.propositions?.[i] ?? '');
  const scores = achievableScores(q);
  const recs = q.recommandations ?? null;
  const missingScores = recs?.type === 'scored' ? scores.filter((s) => !recs.recommandations.some((e) => e.score === s)) : [];
  const parent = q.dependency ? version.questions.find((x) => x.question_id === q.dependency) : undefined;
  const parentOptions = parent ? (parent.propositions.type === 'option' ? parent.propositions.propositions.map((o) => o.proposition) : parent.propositions.type === 'choices' ? parent.propositions.propositions : []) : [];

  const setSwProp = (i: number, v: string) =>
    patchSwQ((t) => {
      const arr = enOptions.map((_, j) => t.propositions?.[j] ?? '');
      arr[i] = v;
      return { ...t, propositions: arr };
    });

  /* ----- option / choices helpers ----- */
  const setOption = (i: number, patch: Partial<OptionPropositions['propositions'][number]>) =>
    patchQ((x) => (x.propositions.type === 'option' ? { ...x, propositions: { ...x.propositions, propositions: x.propositions.propositions.map((o, j) => (j === i ? { ...o, ...patch } : o)) } } : x));
  const setChoiceLabel = (i: number, label: string) =>
    patchQ((x) => (x.propositions.type === 'choices' ? { ...x, propositions: { ...x.propositions, propositions: x.propositions.propositions.map((o, j) => (j === i ? label : o)) } } : x));
  const addOption = () => {
    patchQ((x) => {
      if (x.propositions.type === 'option') return { ...x, propositions: { ...x.propositions, propositions: [...x.propositions.propositions, { proposition: '', score: 0 }] } };
      if (x.propositions.type === 'choices') return { ...x, propositions: { ...x.propositions, propositions: [...x.propositions.propositions, ''] } };
      return x;
    });
    logEdit('options', `${enOptions.length} options`, `${enOptions.length + 1} options`);
  };
  const removeOption = (i: number) => {
    const label = enOptions[i];
    patchQ((x) => {
      if (x.propositions.type === 'option') return { ...x, propositions: { ...x.propositions, propositions: x.propositions.propositions.filter((_, j) => j !== i) } };
      if (x.propositions.type === 'choices') return { ...x, propositions: { ...x.propositions, propositions: x.propositions.propositions.filter((_, j) => j !== i) } };
      return x;
    });
    patchSwQ((t) => (t.propositions ? { ...t, propositions: t.propositions.filter((_, j) => j !== i) } : t));
    logEdit('options', label, '(removed)');
  };
  const setChoices = (patch: Partial<ChoicesPropositions>) => patchQ((x) => (x.propositions.type === 'choices' ? { ...x, propositions: { ...x.propositions, ...patch } } : x));

  /* ----- recommendations helpers ----- */
  const setRecType = (type: 'none' | 'fixed' | 'scored') => {
    const before = recs?.type ?? 'none';
    if (before === type) return;
    patchQ((x) => {
      if (type === 'none') return { ...x, recommandations: null };
      if (type === 'fixed') return { ...x, recommandations: { type: 'fixed', recommandation: '', x_id: nextRecId(version) } };
      return { ...x, recommandations: { type: 'scored', recommandations: [] } };
    });
    logEdit('recommendation type', before, type);
  };
  const setEntry = (i: number, patch: Partial<ScoredRecommendationEntry>) =>
    patchQ((x) => (x.recommandations?.type === 'scored' ? { ...x, recommandations: { ...x.recommandations, recommandations: x.recommandations.recommandations.map((e, j) => (j === i ? { ...e, ...patch } : e)) } } : x));
  const addEntry = () => {
    const score = missingScores[0] ?? 0;
    const id = nextRecId(version);
    patchQ((x) => (x.recommandations?.type === 'scored' ? { ...x, recommandations: { ...x.recommandations, recommandations: [...x.recommandations.recommandations, { score, recommandation: '', x_id: id }] } } : x));
    logEdit('recommendations', '', `added entry for score ${plain(score)} (${id})`);
  };
  const removeEntry = (i: number) => {
    const e = recs?.type === 'scored' ? recs.recommandations[i] : undefined;
    patchQ((x) => (x.recommandations?.type === 'scored' ? { ...x, recommandations: { ...x.recommandations, recommandations: x.recommandations.recommandations.filter((_, j) => j !== i) } } : x));
    if (e) logEdit('recommendations', `score ${plain(e.score)} (${e.x_id ?? '—'})`, '(removed)');
  };

  return (
    <article className="card" aria-labelledby={`q-${qid}-h`}>
      <div className="row row-between">
        <h2 id={`q-${qid}-h`} style={{ margin: 0 }}>
          <span className="mono">{qid}</span> <span className="muted small">· {q.topic}</span>
        </h2>
        <div className="chips">
          <span className="chip">{p.type}</span>
          <span className="chip">max {plain(maxScore(q))}</span>
          {q.dependency && <span className="chip chip-accent">depends on {q.dependency}</span>}
        </div>
      </div>

      {/* ----- texts ----- */}
      <TextField id={f('question')} label="Question text" value={q.question} multiline readOnly={ro} invalid={has('question', 'error')} onChange={(v) => patchQ((x) => ({ ...x, question: v }))} onCommit={(b, a) => logEdit('question', b, a)} />
      <TextField id={f('info')} label="Why we ask (info shown to the company)" value={q.info ?? ''} multiline readOnly={ro} onChange={(v) => patchQ((x) => ({ ...x, info: v || undefined }))} onCommit={(b, a) => logEdit('info', b, a)} />
      <SelectField id={f('topic')} label="Topic" value={q.topic} readOnly={ro} invalid={has('topic', 'error')} options={[...version.topics.map((t) => ({ value: t.id, label: t.name })), ...(version.topics.some((t) => t.id === q.topic) ? [] : [{ value: q.topic, label: `${q.topic} (unknown topic)` }])]} onChange={(v) => { logEdit('topic', q.topic, v); patchQ((x) => ({ ...x, topic: v })); }} />

      {/* ----- scoring ----- */}
      <fieldset id={f('propositions')} aria-describedby={`${f('propositions')}-hint`}>
        <legend>Answer options and scores</legend>
        <p className="hint" id={`${f('propositions')}-hint`}>
          {p.type === 'option' && 'Single choice: the selected option gives its score.'}
          {p.type === 'choices' && 'Multiple choice: the number of ticked boxes maps to a score (count_score_map) or is multiplied by a coefficient.'}
          {p.type === 'text' && 'Free text: never scored, shown as evidence in the results.'} Achievable scores: {scores.map(plain).join(', ')}.
        </p>
        {p.type === 'option' &&
          p.propositions.map((o, i) => (
            <div className="score-grid" key={i}>
              <TextField id={f(`prop-${i}-label`)} label={`Option ${i + 1} label`} value={o.proposition} readOnly={ro} invalid={has('propositions', 'error') && !o.proposition.trim()} onChange={(v) => setOption(i, { proposition: v })} onCommit={(b, a) => logEdit(`option ${i + 1} label`, b, a)} />
              <NumberField id={f(`prop-${i}-score`)} inputId={`q-${qid}-prop-${i}-score`} label={`Option ${i + 1} score`} value={o.score} readOnly={ro} onChange={(n) => setOption(i, { score: n })} onCommit={(b, a) => logEdit(`option ${i + 1} score`, plain(b), plain(a))} />
              {!ro && <button type="button" className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>Remove</button>}
            </div>
          ))}
        {p.type === 'choices' && (
          <>
            {p.propositions.map((label, i) => (
              <div className="score-grid" key={i}>
                <TextField id={f(`prop-${i}-label`)} label={`Choice ${i + 1} label`} value={label} readOnly={ro} onChange={(v) => setChoiceLabel(i, v)} onCommit={(b, a) => logEdit(`choice ${i + 1} label`, b, a)} />
                <span />
                {!ro && <button type="button" className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => removeOption(i)} aria-label={`Remove choice ${i + 1}`}>Remove</button>}
              </div>
            ))}
            <div id={f('count_score_map')} className="panel" style={{ marginBottom: 12 }}>
              <div className="row row-between">
                <strong>Scoring by number of ticked boxes</strong>
                {!ro && (
                  <button type="button" className="btn btn-sm" onClick={() => {
                    if (p.count_score_map && p.count_score_map.length) {
                      const coeff = p.count_score_map.length > 1 ? p.count_score_map[1] - p.count_score_map[0] : 1;
                      setChoices({ count_score_map: undefined, count_score_coeff: coeff });
                      logEdit('choices scoring', `map ${p.count_score_map.join(',')}`, `coefficient ${plain(coeff)}`);
                    } else {
                      const map = p.propositions.map((_, c) => Math.round(c * (p.count_score_coeff ?? 1) * 100) / 100);
                      map.push(Math.round(p.propositions.length * (p.count_score_coeff ?? 1) * 100) / 100);
                      setChoices({ count_score_map: map, count_score_coeff: undefined });
                      logEdit('choices scoring', `coefficient ${plain(p.count_score_coeff ?? 0)}`, `map ${map.join(',')}`);
                    }
                  }}>
                    {p.count_score_map && p.count_score_map.length ? 'Switch to a coefficient' : 'Switch to a score map'}
                  </button>
                )}
              </div>
              {p.count_score_map && p.count_score_map.length ? (
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  {p.count_score_map.map((s, c) => (
                    <NumberField key={c} id={f(`map-${c}`)} label={`${c} ticked → score`} value={s} readOnly={ro} compact={false} onChange={(n) => setChoices({ count_score_map: p.count_score_map!.map((v, j) => (j === c ? n : v)) })} onCommit={(b, a) => logEdit(`score for ${c} ticked`, plain(b), plain(a))} />
                  ))}
                  {!ro && (
                    <div className="row" style={{ marginBottom: 14 }}>
                      <button type="button" className="btn btn-sm" onClick={() => { setChoices({ count_score_map: [...p.count_score_map!, p.count_score_map![p.count_score_map!.length - 1]] }); logEdit('score map', `${p.count_score_map!.length} entries`, `${p.count_score_map!.length + 1} entries`); }}>Add entry</button>
                      <button type="button" className="btn btn-sm" disabled={p.count_score_map.length < 2} onClick={() => { setChoices({ count_score_map: p.count_score_map!.slice(0, -1) }); logEdit('score map', `${p.count_score_map!.length} entries`, `${p.count_score_map!.length - 1} entries`); }}>Remove last</button>
                    </div>
                  )}
                  <p className="hint" style={{ width: '100%' }}>Counts beyond the last entry keep the last entry’s score ({p.propositions.length} choices, {p.count_score_map.length} entries).</p>
                </div>
              ) : (
                <NumberField id={f('count_score_coeff')} label="Score per ticked box (coefficient)" value={p.count_score_coeff ?? 0} readOnly={ro} invalid={has('count_score_map', 'error')} onChange={(n) => setChoices({ count_score_coeff: n })} onCommit={(b, a) => logEdit('coefficient', plain(b), plain(a))} />
              )}
            </div>
            <CheckField id={f('none_of_the_above')} label="Offer “None of the above” (scores 0)" checked={!!p.none_of_the_above} readOnly={ro} onChange={(v) => { setChoices({ none_of_the_above: v || undefined }); logEdit('none_of_the_above', String(!!p.none_of_the_above), String(v)); }} />
          </>
        )}
        {p.type === 'text' && <TextField id={f('proposition')} label="Placeholder shown in the text box" value={p.proposition} readOnly={ro} onChange={(v) => patchQ((x) => (x.propositions.type === 'text' ? { ...x, propositions: { type: 'text', proposition: v } } : x))} onCommit={(b, a) => logEdit('placeholder', b, a)} />}
        {!ro && p.type !== 'text' && <button type="button" className="btn btn-sm" onClick={addOption}>{p.type === 'option' ? 'Add option' : 'Add choice'}</button>}
      </fieldset>

      {/* ----- recommendations ----- */}
      <fieldset id={f('recommandations')}>
        <legend>Recommendations</legend>
        <SelectField id={f('recommandations-type')} label="Type" value={recs?.type ?? 'none'} readOnly={ro} options={[{ value: 'none', label: 'None' }, { value: 'fixed', label: 'Fixed: one text whatever the score' }, { value: 'scored', label: 'Scored: one text per achievable score' }]} onChange={(v) => setRecType(v as 'none' | 'fixed' | 'scored')} hint={p.type === 'text' ? 'Free-text questions can only carry a fixed recommendation.' : undefined} />
        {recs?.type === 'fixed' && (
          <>
            <TextField id={f('recommandations-text')} label={`Recommendation text (${recs.x_id ?? 'no id'})`} value={recs.recommandation} multiline readOnly={ro} invalid={has('recommandations', 'error')} onChange={(v) => patchQ((x) => (x.recommandations?.type === 'fixed' ? { ...x, recommandations: { ...x.recommandations, recommandation: v } } : x))} onCommit={(b, a) => logEdit('recommendation', b, a)} />
            <TextField id={f('recommandations-id')} label="Stable id (x_id, used by roadmap rules and translations)" value={recs.x_id ?? ''} readOnly={ro} onChange={(v) => patchQ((x) => (x.recommandations?.type === 'fixed' ? { ...x, recommandations: { ...x.recommandations, x_id: v || undefined } } : x))} onCommit={(b, a) => logEdit('recommendation id', b, a)} />
          </>
        )}
        {recs?.type === 'scored' && (
          <>
            {missingScores.length > 0 && (
              <p className="error-text" role="status">No recommendation yet for score{missingScores.length > 1 ? 's' : ''} {missingScores.map(plain).join(', ')}. Every achievable score needs one before publishing (exact match rule).</p>
            )}
            {recs.recommandations.map((e, i) => {
              const unreachable = !scores.includes(e.score);
              return (
                <div key={i} id={f(`recommandations-${e.score}`)} className="panel" style={{ marginBottom: 10 }}>
                  <div className="score-grid">
                    <TextField id={f(`rec-${i}-id`)} label="Id (x_id)" value={e.x_id ?? ''} readOnly={ro} onChange={(v) => setEntry(i, { x_id: v || undefined })} onCommit={(b, a) => logEdit(`recommendation ${i + 1} id`, b, a)} />
                    <NumberField id={f(`rec-${i}-score`)} label="Score" value={e.score} readOnly={ro} invalid={unreachable} onChange={(n) => setEntry(i, { score: n })} onCommit={(b, a) => logEdit(`recommendation ${e.x_id ?? i + 1} score`, plain(b), plain(a))} hint={unreachable ? 'not achievable: never shown' : undefined} />
                    {!ro && <button type="button" className="btn btn-sm" style={{ marginBottom: 14 }} onClick={() => removeEntry(i)} aria-label={`Remove recommendation for score ${plain(e.score)}`}>Remove</button>}
                  </div>
                  <TextField id={f(`rec-${i}-text`)} label={`Text shown at score ${plain(e.score)}`} value={e.recommandation} multiline readOnly={ro} invalid={!e.recommandation.trim()} onChange={(v) => setEntry(i, { recommandation: v })} onCommit={(b, a) => logEdit(`recommendation ${e.x_id ?? i + 1}`, b, a)} />
                </div>
              );
            })}
            {!ro && <button type="button" className="btn btn-sm" data-add onClick={addEntry}>Add recommendation{missingScores.length ? ` (score ${plain(missingScores[0])})` : ''}</button>}
          </>
        )}
      </fieldset>

      {/* ----- dependency ----- */}
      <fieldset>
        <legend>Dependency (when is this question shown?)</legend>
        <SelectField id={f('dependency')} label="Parent question" value={q.dependency ?? ''} readOnly={ro} invalid={has('dependency', 'error')} options={[{ value: '', label: 'None — always shown' }, ...version.questions.filter((x) => x.question_id !== qid).map((x) => ({ value: x.question_id, label: `${x.question_id} — ${x.question.slice(0, 60)}${x.question.length > 60 ? '…' : ''}` }))]} onChange={(v) => { logEdit('dependency', q.dependency ?? '', v); patchQ((x) => ({ ...x, dependency: v || undefined, x_dependency_answer: v ? x.x_dependency_answer : undefined })); }} hint="survey.json rule: shown when the parent is answered with anything other than “No” (single choice) or with at least one box ticked (multiple choice). Chains are followed." />
        {parent && (parent.propositions.type === 'option' || parent.propositions.type === 'choices') && (
          <SelectField id={f('x_dependency_answer')} label="Show only for this parent answer (hub extension)" value={q.x_dependency_answer ?? ''} readOnly={ro} invalid={has('x_dependency_answer', 'error')} options={[{ value: '', label: parent.propositions.type === 'option' ? 'Any answer except “No” (survey.json rule)' : 'At least one box ticked (survey.json rule)' }, ...parentOptions.map((o) => ({ value: o, label: o })), ...(q.x_dependency_answer && !parentOptions.includes(q.x_dependency_answer) ? [{ value: q.x_dependency_answer, label: `${q.x_dependency_answer} (not offered by ${parent.question_id})` }] : [])]} onChange={(v) => { logEdit('x_dependency_answer', q.x_dependency_answer ?? '', v); patchQ((x) => ({ ...x, x_dependency_answer: v || undefined })); }} />
        )}
        {parent && parent.propositions.type === 'text' && <p className="error-text">The parent is a free-text question; in the survey.json rules it never satisfies a dependency.</p>}
      </fieldset>

      {/* ----- Swahili ----- */}
      <fieldset>
        <legend>Swahili texts <span className="chip chip-accent">sw</span></legend>
        <TextField id={f('sw-question')} label="Question (Swahili)" value={sw.question ?? ''} multiline readOnly={roSw} lang="sw" flag={!sw.question?.trim() ? EMPTY : undefined} onChange={(v) => patchSwQ((t) => ({ ...t, question: v || undefined }))} onCommit={(b, a) => logEdit('sw question', b, a)} />
        {(q.info || sw.info) && <TextField id={f('sw-info')} label="Why we ask (Swahili)" value={sw.info ?? ''} multiline readOnly={roSw} lang="sw" flag={!sw.info?.trim() ? EMPTY : undefined} onChange={(v) => patchSwQ((t) => ({ ...t, info: v || undefined }))} onCommit={(b, a) => logEdit('sw info', b, a)} />}
        {enOptions.length > 0 && (
          <div id={f('sw-propositions')}>
            {enOptions.map((en, i) => (
              <TextField key={i} id={f(`sw-prop-${i}`)} label={<>Option {i + 1} (Swahili) <span className="muted small">— en: {en}</span></>} value={swProps[i]} readOnly={roSw} lang="sw" flag={!swProps[i].trim() ? EMPTY : undefined} onChange={(v) => setSwProp(i, v)} onCommit={(b, a) => logEdit(`sw option ${i + 1}`, b, a)} />
            ))}
          </div>
        )}
        {p.type === 'text' && <TextField id={f('sw-text')} label="Placeholder (Swahili)" value={sw.text_proposition ?? ''} readOnly={roSw} lang="sw" flag={!sw.text_proposition?.trim() ? EMPTY : undefined} onChange={(v) => patchSwQ((t) => ({ ...t, text_proposition: v || undefined }))} onCommit={(b, a) => logEdit('sw placeholder', b, a)} />}
        {recs && (recs.type === 'fixed' ? [{ id: recs.x_id ?? `${qid}:fixed`, en: recs.recommandation, score: null as number | null }] : recs.recommandations.map((e) => ({ id: e.x_id ?? `${qid}:${e.score}`, en: e.recommandation, score: e.score }))).map((r) => {
          const val = version.translations.sw.recommendations?.[r.id] ?? '';
          return <TextField key={r.id} id={f(`sw-rec-${r.id}`)} label={<>Recommendation {r.id}{r.score !== null ? ` (score ${plain(r.score)})` : ''} (Swahili) <span className="muted small">— en: {r.en.slice(0, 80)}{r.en.length > 80 ? '…' : ''}</span></>} value={val} multiline readOnly={roSw} lang="sw" flag={!val.trim() ? EMPTY : undefined} onChange={(v) => patchSwRec(r.id, v)} onCommit={(b, a) => logEdit(`sw recommendation ${r.id}`, b, a)} />;
        })}
      </fieldset>
    </article>
  );
}
