import type { Answers, AssessmentResult, MethodologyVersion, Phase, RoadmapRule } from '../types.ts';
import { recommendationLibrary } from './recommendations.ts';
import { answerLabel, questionMap } from './score.ts';

export interface RoadmapStep {
  rule_id: string;
  phase: Phase;
  priority: RoadmapRule['priority'];
  effort: RoadmapRule['effort'];
  question_id: string;
  topic: string;
  title: string;
  recommendation: string;
  rec_id: string;
  because: { question: string; answer: string; score: number; max: number };
}

export function ruleFires(rule: RoadmapRule, score: number, max: number): boolean {
  if (rule.score_eq !== undefined) return score === rule.score_eq;
  if (rule.max_share !== undefined) return max > 0 ? score / max <= rule.max_share : false;
  return false;
}

const phaseOrder: Phase[] = ['now', 'next', 'later'];
const prioOrder = { high: 0, medium: 1, low: 2 };

/** Deterministic rules-based roadmap. Every step carries the answer that triggered it. */
export function buildRoadmap(v: MethodologyVersion, result: AssessmentResult, answers: Answers): RoadmapStep[] {
  const byId = questionMap(v);
  const lib = new Map(recommendationLibrary(v.questions).map((r) => [r.id, r]));
  const steps: RoadmapStep[] = [];
  for (const rule of v.roadmap_rules) {
    const qs = result.questions.find((x) => x.question_id === rule.question_id);
    const q = byId.get(rule.question_id);
    if (!qs || !q || !qs.applicable || !qs.answered) continue;
    if (!ruleFires(rule, qs.score, qs.max)) continue;
    const rec = lib.get(rule.rec_id);
    steps.push({
      rule_id: rule.id,
      phase: rule.phase,
      priority: rule.priority,
      effort: rule.effort,
      question_id: q.question_id,
      topic: q.topic,
      title: rule.title,
      recommendation: rec?.text ?? '',
      rec_id: rule.rec_id,
      because: { question: q.question, answer: answerLabel(q, answers[q.question_id]), score: qs.score, max: qs.max },
    });
  }
  return steps.sort(
    (a, b) => phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase) || prioOrder[a.priority] - prioOrder[b.priority] || a.question_id.localeCompare(b.question_id),
  );
}
