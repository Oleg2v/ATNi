import type { MethodologyVersion, Question } from '../types.ts';
import { achievableScores, maxScore } from './score.ts';
import { recommendationLibrary } from './recommendations.ts';

export type Severity = 'error' | 'warning' | 'ok';

export interface Issue {
  id: string;
  severity: Severity;
  code: string;
  message: string;
  /** where to fix it */
  path: { question_id?: string; field?: string; rec_id?: string; rule_id?: string; score?: number; lang?: 'sw' };
}

export interface ValidationReport {
  issues: Issue[];
  errors: number;
  warnings: number;
  publishable: boolean;
  max_total: number;
  max_by_topic: Record<string, number>;
}

/** Methodology health: everything that must hold before a version can be published. */
export function validateVersion(v: MethodologyVersion): ValidationReport {
  const issues: Issue[] = [];
  let n = 0;
  const add = (severity: Severity, code: string, message: string, path: Issue['path'] = {}) => {
    issues.push({ id: `${code}-${++n}`, severity, code, message, path });
  };
  const byId = new Map<string, Question>();

  // unique ids
  for (const q of v.questions) {
    if (byId.has(q.question_id)) add('error', 'duplicate-id', `Duplicate question id ${q.question_id}`, { question_id: q.question_id, field: 'question_id' });
    byId.set(q.question_id, q);
    if (!q.question.trim()) add('error', 'empty-question', `Question ${q.question_id} has no text`, { question_id: q.question_id, field: 'question' });
    if (!v.topics.some((t) => t.id === q.topic)) add('error', 'unknown-topic', `Question ${q.question_id} uses unknown topic "${q.topic}"`, { question_id: q.question_id, field: 'topic' });
  }

  // propositions sanity
  for (const q of v.questions) {
    const p = q.propositions;
    if (p.type === 'option') {
      if (p.propositions.length < 2) add('error', 'too-few-options', `Question ${q.question_id} needs at least two options`, { question_id: q.question_id, field: 'propositions' });
      const labels = new Set<string>();
      for (const o of p.propositions) {
        if (labels.has(o.proposition)) add('error', 'duplicate-option', `Question ${q.question_id} has duplicate option "${o.proposition}"`, { question_id: q.question_id, field: 'propositions' });
        labels.add(o.proposition);
        if (!Number.isFinite(o.score) || o.score < 0) add('error', 'bad-score', `Question ${q.question_id}: option "${o.proposition}" has an invalid score`, { question_id: q.question_id, field: 'propositions' });
      }
    } else if (p.type === 'choices') {
      if (p.propositions.length === 0) add('error', 'no-choices', `Question ${q.question_id} has no choices`, { question_id: q.question_id, field: 'propositions' });
      if (!(p.count_score_map && p.count_score_map.length) && p.count_score_coeff === undefined)
        add('error', 'no-choice-scoring', `Question ${q.question_id} has neither count_score_map nor count_score_coeff`, { question_id: q.question_id, field: 'count_score_map' });
    }
  }

  // recommendations: every achievable score has an entry; no unreachable entries; no empty text
  for (const q of v.questions) {
    const r = q.recommandations;
    if (!r) continue;
    if (r.type === 'fixed') {
      if (!r.recommandation.trim()) add('error', 'empty-rec', `Question ${q.question_id}: fixed recommendation is empty`, { question_id: q.question_id, field: 'recommandations' });
      continue;
    }
    const scores = achievableScores(q);
    const have = new Set(r.recommandations.map((e) => e.score));
    for (const s of scores) {
      if (!have.has(s)) add('error', 'missing-rec', `No recommendation for score ${s} in question ${q.question_id}`, { question_id: q.question_id, field: 'recommandations', score: s });
    }
    for (const e of r.recommandations) {
      if (!scores.includes(e.score)) add('warning', 'unreachable-rec', `Question ${q.question_id}: recommendation for score ${e.score} can never be shown`, { question_id: q.question_id, field: 'recommandations', score: e.score, rec_id: e.x_id });
      if (!e.recommandation.trim()) add('error', 'empty-rec', `Question ${q.question_id}: recommendation for score ${e.score} is empty`, { question_id: q.question_id, field: 'recommandations', score: e.score, rec_id: e.x_id });
    }
  }

  // dependencies: exist, no self, no cycles, no text parents, specific answers exist
  for (const q of v.questions) {
    if (!q.dependency) continue;
    const parent = byId.get(q.dependency);
    if (!parent) {
      add('error', 'dangling-dependency', `Question ${q.question_id} depends on missing question ${q.dependency}`, { question_id: q.question_id, field: 'dependency' });
      continue;
    }
    if (parent.question_id === q.question_id) add('error', 'self-dependency', `Question ${q.question_id} depends on itself`, { question_id: q.question_id, field: 'dependency' });
    if (parent.propositions.type === 'text') add('warning', 'text-parent', `Question ${q.question_id} depends on a free-text question, which never satisfies a dependency`, { question_id: q.question_id, field: 'dependency' });
    if (q.x_dependency_answer !== undefined) {
      const pp = parent.propositions;
      const ok = pp.type === 'option' ? pp.propositions.some((o) => o.proposition === q.x_dependency_answer) : pp.type === 'choices' ? pp.propositions.includes(q.x_dependency_answer) : false;
      if (!ok) add('error', 'bad-dependency-answer', `Question ${q.question_id} expects parent answer "${q.x_dependency_answer}" which ${q.dependency} does not offer`, { question_id: q.question_id, field: 'x_dependency_answer' });
    }
    // cycle detection
    const seen = new Set<string>([q.question_id]);
    let cur: Question | undefined = parent;
    while (cur && cur.dependency) {
      if (seen.has(cur.question_id)) {
        add('error', 'dependency-cycle', `Dependency cycle through ${[...seen].join(' → ')}`, { question_id: q.question_id, field: 'dependency' });
        break;
      }
      seen.add(cur.question_id);
      cur = byId.get(cur.dependency);
    }
  }

  // translations (sw)
  const sw = v.translations?.sw ?? {};
  for (const q of v.questions) {
    const t = sw.questions?.[q.question_id];
    if (!t || !t.question?.trim()) add('warning', 'missing-translation', `Question ${q.question_id} has no Swahili text`, { question_id: q.question_id, field: 'question', lang: 'sw' });
    else {
      const p = q.propositions;
      const need = p.type === 'option' ? p.propositions.length : p.type === 'choices' ? p.propositions.length : 0;
      if (need > 0 && (t.propositions?.length ?? 0) !== need) add('warning', 'missing-translation', `Question ${q.question_id}: Swahili answer options incomplete (${t.propositions?.length ?? 0}/${need})`, { question_id: q.question_id, field: 'propositions', lang: 'sw' });
    }
  }
  const lib = recommendationLibrary(v.questions);
  const recSw = sw.recommendations ?? {};
  const missingRecSw = lib.filter((r) => !recSw[r.id]?.trim());
  if (missingRecSw.length) add('warning', 'missing-rec-translation', `${missingRecSw.length} of ${lib.length} recommendations have no Swahili text`, { field: 'recommendations', lang: 'sw' });
  for (const r of missingRecSw) add('warning', 'missing-rec-translation-item', `Recommendation ${r.id} (question ${r.question_id}) has no Swahili text`, { question_id: r.question_id, rec_id: r.id, lang: 'sw' });

  // roadmap rules
  const libIds = new Set(lib.map((r) => r.id));
  for (const rule of v.roadmap_rules) {
    const q = byId.get(rule.question_id);
    if (!q) {
      add('error', 'rule-question-missing', `Roadmap rule ${rule.id} points to missing question ${rule.question_id}`, { rule_id: rule.id });
      continue;
    }
    if (!libIds.has(rule.rec_id)) add('error', 'rule-rec-missing', `Roadmap rule ${rule.id} points to missing recommendation ${rule.rec_id}`, { rule_id: rule.id, rec_id: rule.rec_id });
    if (rule.score_eq !== undefined && !achievableScores(q).includes(rule.score_eq)) add('warning', 'rule-unreachable', `Roadmap rule ${rule.id} waits for score ${rule.score_eq}, which ${rule.question_id} cannot produce`, { rule_id: rule.id, question_id: rule.question_id });
    if (rule.score_eq === undefined && rule.max_share === undefined) add('error', 'rule-no-condition', `Roadmap rule ${rule.id} has no condition`, { rule_id: rule.id });
  }

  // grading
  const grades = new Set(v.grading.map((g) => g.grade));
  if (grades.size !== 5) add('error', 'grading-incomplete', 'Grading must define all five letters A–E', { field: 'grading' });

  // max score computed
  const max_by_topic: Record<string, number> = {};
  for (const t of v.topics) max_by_topic[t.id] = round2(v.questions.filter((q) => q.topic === t.id).reduce((s, q) => s + maxScore(q), 0));
  const max_total = round2(Object.values(max_by_topic).reduce((a, b) => a + b, 0));
  if (max_total <= 0) add('error', 'zero-max', 'Maximum score is zero: no question carries points', { field: 'propositions' });
  else add('ok', 'max-computed', `Maximum score computed: ${max_total} points across ${v.topics.length} topics`, {});

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  if (errors === 0) {
    if (!issues.some((i) => i.code === 'missing-rec')) add('ok', 'recs-complete', 'Every achievable score has a recommendation', {});
    if (!issues.some((i) => i.code.startsWith('dangling') || i.code === 'dependency-cycle')) add('ok', 'deps-ok', 'No dangling dependencies or cycles', {});
  }
  if (!issues.some((i) => i.code === 'missing-translation')) add('ok', 'translations-ok', 'Every question has Swahili text', {});
  return { issues, errors, warnings, publishable: errors === 0, max_total, max_by_topic };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
