import type { GradeThreshold, MethodologyVersion, Question, TopicDef } from '../types.ts';
import { achievableScores } from './score.ts';

export interface ImportReport {
  ok: boolean;
  fatal?: string;
  counts: { questions: number; topics: number; option: number; choices: number; text: number; with_dependency: number; fixed_recs: number; scored_recs: number; no_recs: number };
  topics: string[];
  /** scores an option/choices question can produce that have no scored recommendation (would 500 in the source system) */
  scores_without_recs: { question_id: string; score: number }[];
  /** relations the source format could not express, and how they were mapped */
  unsupported: { question_id: string; kind: string; message: string }[];
  warnings: string[];
  skipped: { index: number; reason: string }[];
}

export const DEFAULT_GRADING: GradeThreshold[] = [
  { grade: 'A', min_percent: 80 },
  { grade: 'B', min_percent: 60 },
  { grade: 'C', min_percent: 40 },
  { grade: 'D', min_percent: 20 },
  { grade: 'E', min_percent: 0 },
];

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Parse one raw question. Returns the question or a reason to skip it. */
function parseQuestion(raw: unknown, index: number): { q?: Question; reason?: string } {
  if (!isObj(raw)) return { reason: 'not an object' };
  const { topic, question, question_id, info, dependency, propositions, recommandations } = raw;
  if (typeof topic !== 'string' || !topic.trim()) return { reason: 'missing topic' };
  if (typeof question !== 'string') return { reason: 'missing question text' };
  if (typeof question_id !== 'string' || !question_id.trim()) return { reason: 'missing question_id' };
  if (!isObj(propositions)) return { reason: 'missing propositions' };
  let props: Question['propositions'];
  const t = propositions.type;
  if (t === 'option') {
    const list = propositions.propositions;
    if (!Array.isArray(list) || list.length === 0) return { reason: 'option question without propositions' };
    const out: { proposition: string; score: number; text_inputs?: boolean }[] = [];
    for (const o of list) {
      if (!isObj(o) || typeof o.proposition !== 'string' || !isNum(o.score)) return { reason: `option proposition malformed in ${question_id}` };
      out.push({ proposition: o.proposition, score: o.score, ...(o.text_inputs === true ? { text_inputs: true } : {}) });
    }
    props = { type: 'option', propositions: out };
  } else if (t === 'choices') {
    const list = propositions.propositions;
    if (!Array.isArray(list) || !list.every((s) => typeof s === 'string')) return { reason: `choices propositions malformed in ${question_id}` };
    const map = Array.isArray(propositions.count_score_map) && propositions.count_score_map.every(isNum) ? (propositions.count_score_map as number[]) : undefined;
    const coeff = isNum(propositions.count_score_coeff) ? propositions.count_score_coeff : undefined;
    props = { type: 'choices', propositions: list as string[], ...(map ? { count_score_map: map } : {}), ...(coeff !== undefined ? { count_score_coeff: coeff } : {}), ...(propositions.none_of_the_above === true ? { none_of_the_above: true } : {}) };
  } else if (t === 'text') {
    props = { type: 'text', proposition: typeof propositions.proposition === 'string' ? propositions.proposition : '' };
  } else return { reason: `unknown proposition type "${String(t)}" in ${question_id}` };

  let recs: Question['recommandations'] = null;
  if (isObj(recommandations)) {
    if (recommandations.type === 'fixed' && typeof recommandations.recommandation === 'string') {
      recs = { type: 'fixed', recommandation: recommandations.recommandation, x_id: `${question_id}:fixed` };
    } else if (recommandations.type === 'scored' && Array.isArray(recommandations.recommandations)) {
      const entries: { score: number; recommandation: string; x_id: string }[] = [];
      for (const e of recommandations.recommandations) {
        if (!isObj(e) || !isNum(e.score) || typeof e.recommandation !== 'string') return { reason: `scored recommendation malformed in ${question_id}` };
        entries.push({ score: e.score, recommandation: e.recommandation, x_id: `${question_id}:${e.score}` });
      }
      recs = { type: 'scored', recommandations: entries };
    } else return { reason: `unknown recommendation type in ${question_id}` };
  }
  void index;
  return {
    q: {
      topic,
      question,
      question_id,
      ...(typeof info === 'string' && info ? { info } : {}),
      ...(typeof dependency === 'string' && dependency ? { dependency } : {}),
      recommandations: recs,
      propositions: props,
    },
  };
}

/**
 * Import a survey.json-format document into a draft methodology version.
 * Accepts an array of questions or an object with a `questions` array.
 */
export function importNutriCheck(input: unknown, opts: { id: string; version: string; country: MethodologyVersion['country']; created_at: string; based_on?: string }): { version: MethodologyVersion | null; report: ImportReport } {
  const report: ImportReport = {
    ok: false,
    counts: { questions: 0, topics: 0, option: 0, choices: 0, text: 0, with_dependency: 0, fixed_recs: 0, scored_recs: 0, no_recs: 0 },
    topics: [],
    scores_without_recs: [],
    unsupported: [],
    warnings: [],
    skipped: [],
  };
  const list: unknown = Array.isArray(input) ? input : isObj(input) && Array.isArray(input.questions) ? input.questions : null;
  if (!list) {
    report.fatal = 'Expected a JSON array of questions (survey.json format) or an object with a "questions" array.';
    return { version: null, report };
  }
  const questions: Question[] = [];
  const seen = new Set<string>();
  (list as unknown[]).forEach((raw, i) => {
    const { q, reason } = parseQuestion(raw, i);
    if (!q) {
      report.skipped.push({ index: i, reason: reason ?? 'unknown' });
      return;
    }
    if (seen.has(q.question_id)) {
      report.skipped.push({ index: i, reason: `duplicate question_id ${q.question_id}` });
      return;
    }
    seen.add(q.question_id);
    questions.push(q);
  });
  if (questions.length === 0) {
    report.fatal = 'No valid questions found.';
    return { version: null, report };
  }
  const byId = new Map(questions.map((q) => [q.question_id, q]));
  const topicsSeen: string[] = [];
  for (const q of questions) {
    if (!topicsSeen.includes(q.topic)) topicsSeen.push(q.topic);
    report.counts[q.propositions.type]++;
    if (q.dependency) report.counts.with_dependency++;
    const r = q.recommandations;
    if (!r) report.counts.no_recs++;
    else if (r.type === 'fixed') report.counts.fixed_recs++;
    else {
      report.counts.scored_recs++;
      const have = new Set(r.recommandations.map((e) => e.score));
      for (const s of achievableScores(q)) if (!have.has(s)) report.scores_without_recs.push({ question_id: q.question_id, score: s });
    }
    if (q.dependency) {
      const parent = byId.get(q.dependency);
      if (!parent) report.unsupported.push({ question_id: q.question_id, kind: 'dangling', message: `Depends on ${q.dependency}, which is not in the file.` });
      else {
        if (parent.propositions.type === 'option')
          report.unsupported.push({ question_id: q.question_id, kind: 'any-answer-but-no', message: `Source format can only express "show when ${q.dependency} is answered with anything other than No". Imported as-is; you can now set a specific answer (x_dependency_answer).` });
        if (parent.propositions.type === 'text')
          report.unsupported.push({ question_id: q.question_id, kind: 'text-parent', message: `Depends on free-text question ${q.dependency}; in the source format this never shows. Review the dependency.` });
        if (parent.dependency) report.unsupported.push({ question_id: q.question_id, kind: 'chain', message: `Chained dependency ${q.question_id} → ${q.dependency} → ${parent.dependency}. The source format did not support chains; the hub evaluates them.` });
      }
    }
  }
  const topics: TopicDef[] = topicsSeen.map((t) => ({ id: t, name: t }));
  report.counts.questions = questions.length;
  report.counts.topics = topics.length;
  report.topics = topicsSeen;
  if (report.scores_without_recs.length) report.warnings.push(`${report.scores_without_recs.length} achievable score(s) have no recommendation; the draft cannot be published until they are added.`);
  report.warnings.push('No Swahili translations in the source format: all strings imported as English only.');
  report.warnings.push('Grading thresholds are not part of the source format; the standard A ≥ 80 %, B ≥ 60 %, C ≥ 40 %, D ≥ 20 % scale was applied and can be edited.');
  report.ok = true;
  const version: MethodologyVersion = {
    id: opts.id,
    version: opts.version,
    tool: 'self-assessment',
    country: opts.country,
    status: 'draft',
    created_at: opts.created_at,
    based_on: opts.based_on,
    comment: 'Imported from survey.json format',
    grading: DEFAULT_GRADING,
    topics,
    questions,
    roadmap_rules: [],
    translations: { sw: { questions: {}, recommendations: {}, topics: {} } },
  };
  return { version, report };
}
