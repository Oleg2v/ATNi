import type { Question, Recommandations } from '../types.ts';

export type RecLookup =
  | { status: 'ok'; id: string; text: string; kind: 'fixed' | 'scored' }
  | { status: 'none' }
  | { status: 'missing'; score: number };

/** Recommendation for a question at a given score. Exact match for scored entries (survey.json rule). */
export function recommendationFor(q: Question, score: number): RecLookup {
  const r: Recommandations | undefined = q.recommandations;
  if (!r) return { status: 'none' };
  if (r.type === 'fixed') return { status: 'ok', id: r.x_id ?? `${q.question_id}:fixed`, text: r.recommandation, kind: 'fixed' };
  const hit = r.recommandations.find((e) => e.score === score);
  if (!hit) return { status: 'missing', score };
  return { status: 'ok', id: hit.x_id ?? `${q.question_id}:${hit.score}`, text: hit.recommandation, kind: 'scored' };
}

/** All recommendation entries in a version, flattened as a library. */
export function recommendationLibrary(questions: Question[]): { id: string; question_id: string; score: number | null; text: string }[] {
  const out: { id: string; question_id: string; score: number | null; text: string }[] = [];
  for (const q of questions) {
    const r = q.recommandations;
    if (!r) continue;
    if (r.type === 'fixed') out.push({ id: r.x_id ?? `${q.question_id}:fixed`, question_id: q.question_id, score: null, text: r.recommandation });
    else for (const e of r.recommandations) out.push({ id: e.x_id ?? `${q.question_id}:${e.score}`, question_id: q.question_id, score: e.score, text: e.recommandation });
  }
  return out;
}
