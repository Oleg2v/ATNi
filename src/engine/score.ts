import type {
  AnswerValue,
  Answers,
  AssessmentResult,
  Grade,
  GradeThreshold,
  MethodologyVersion,
  Question,
  QuestionScore,
  TopicScore,
} from '../types.ts';

/** Score of one answered question, following the survey.json rules. */
export function scoreAnswer(q: Question, a: AnswerValue | undefined): number {
  if (!a) return 0;
  const p = q.propositions;
  if (p.type === 'option') {
    if (a.type !== 'option') return 0;
    const hit = p.propositions.find((o) => o.proposition === a.selected);
    return hit ? hit.score : 0;
  }
  if (p.type === 'choices') {
    if (a.type !== 'choices') return 0;
    const count = a.none ? 0 : a.selected.filter((s) => p.propositions.includes(s)).length;
    return scoreForCount(p.count_score_map, p.count_score_coeff, count);
  }
  return 0; // text always scores 0
}

export function scoreForCount(map: number[] | undefined, coeff: number | undefined, count: number): number {
  if (map && map.length > 0) return map[Math.min(count, map.length - 1)];
  return round2(count * (coeff ?? 0));
}

/** Maximum achievable score of a question (survey.json rules). */
export function maxScore(q: Question): number {
  const p = q.propositions;
  if (p.type === 'option') return p.propositions.reduce((m, o) => Math.max(m, o.score), 0);
  if (p.type === 'choices') {
    if (p.count_score_map && p.count_score_map.length > 0) return Math.max(...p.count_score_map);
    return round2(p.propositions.length * (p.count_score_coeff ?? 0));
  }
  return 0;
}

/** Every score an option/choices question can produce (used by validation). */
export function achievableScores(q: Question): number[] {
  const p = q.propositions;
  const set = new Set<number>();
  if (p.type === 'option') p.propositions.forEach((o) => set.add(o.score));
  else if (p.type === 'choices') {
    for (let c = 0; c <= p.propositions.length; c++) set.add(scoreForCount(p.count_score_map, p.count_score_coeff, c));
  } else set.add(0);
  return [...set].sort((a, b) => a - b);
}

export function isAnswered(_q: Question, a: AnswerValue | undefined): boolean {
  if (!a) return false;
  if (a.type === 'option') return a.selected.length > 0;
  if (a.type === 'choices') return a.none === true || a.selected.length > 0;
  return a.text.trim().length > 0;
}

/**
 * Whether a question applies given the answers so far.
 * - no dependency: applies
 * - x_dependency_answer: parent must have exactly that answer (option) or include it (choices)
 * - otherwise survey.json semantics: option parent answered with anything other than "No";
 *   choices parent with at least one box ticked; text parents never satisfy a dependency
 * Chains are followed recursively; cycles are treated as not applicable.
 */
export function isApplicable(q: Question, answers: Answers, byId: Map<string, Question>, seen: Set<string> = new Set()): boolean {
  if (!q.dependency) return true;
  if (seen.has(q.question_id)) return false;
  seen.add(q.question_id);
  const parent = byId.get(q.dependency);
  if (!parent) return false;
  if (!isApplicable(parent, answers, byId, seen)) return false;
  const pa = answers[parent.question_id];
  if (!isAnswered(parent, pa) || !pa) return false;
  if (q.x_dependency_answer !== undefined) {
    if (pa.type === 'option') return pa.selected === q.x_dependency_answer;
    if (pa.type === 'choices') return !pa.none && pa.selected.includes(q.x_dependency_answer);
    return false;
  }
  if (pa.type === 'option') return pa.selected.trim().toLowerCase() !== 'no';
  if (pa.type === 'choices') return !pa.none && pa.selected.length > 0;
  return false;
}

export function gradeFor(percent: number, thresholds: GradeThreshold[]): Grade {
  const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);
  for (const t of sorted) if (percent >= t.min_percent) return t.grade;
  return sorted[sorted.length - 1]?.grade ?? 'E';
}

export function answerLabel(_q: Question, a: AnswerValue | undefined): string {
  if (!a) return '';
  if (a.type === 'option') return a.text ? `${a.selected} — ${a.text}` : a.selected;
  if (a.type === 'choices') return a.none ? 'None of the above' : a.selected.join(', ');
  return a.text;
}

export function questionMap(v: MethodologyVersion): Map<string, Question> {
  return new Map(v.questions.map((q) => [q.question_id, q]));
}

/** Full result. Max only counts questions that apply to this respondent. */
export function computeResult(v: MethodologyVersion, answers: Answers, computedAt: string): AssessmentResult {
  const byId = questionMap(v);
  const questions: QuestionScore[] = v.questions.map((q) => {
    const applicable = isApplicable(q, answers, byId);
    const a = answers[q.question_id];
    const answered = applicable && isAnswered(q, a);
    return {
      question_id: q.question_id,
      topic: q.topic,
      score: applicable ? scoreAnswer(q, a) : 0,
      max: applicable ? maxScore(q) : 0,
      applicable,
      answered,
      answer_label: applicable ? answerLabel(q, a) : '',
    };
  });
  const topics: TopicScore[] = v.topics.map((t) => {
    const qs = questions.filter((x) => x.topic === t.id);
    const score = round2(qs.reduce((s, x) => s + x.score, 0));
    const max = round2(qs.reduce((s, x) => s + x.max, 0));
    const percent = max > 0 ? round1((score / max) * 100) : 0;
    return { topic: t.id, score, max, percent, grade: gradeFor(percent, v.grading) };
  });
  const total = round2(questions.reduce((s, x) => s + x.score, 0));
  const max = round2(questions.reduce((s, x) => s + x.max, 0));
  const percent = max > 0 ? round1((total / max) * 100) : 0;
  return { version_id: v.id, computed_at: computedAt, total, max, percent, grade: gradeFor(percent, v.grading), topics, questions };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
