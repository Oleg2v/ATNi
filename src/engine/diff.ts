import type { MethodologyVersion, Question } from '../types.ts';
import { maxScore } from './score.ts';

export interface Change {
  kind: 'added' | 'removed' | 'modified';
  scope: 'question' | 'rule' | 'translation' | 'topic' | 'grading';
  id: string;
  field?: string;
  before?: string;
  after?: string;
  affects_scoring: boolean;
}

function fmtProps(q: Question): string {
  const p = q.propositions;
  if (p.type === 'option') return p.propositions.map((o) => `${o.proposition} = ${o.score}`).join('; ');
  if (p.type === 'choices') return `${p.propositions.join(' | ')} (map: ${p.count_score_map?.join(',') ?? '—'}; coeff: ${p.count_score_coeff ?? '—'}; none: ${p.none_of_the_above ? 'yes' : 'no'})`;
  return `text: ${p.proposition}`;
}

function fmtRecs(q: Question): string {
  const r = q.recommandations;
  if (!r) return '—';
  if (r.type === 'fixed') return `fixed: ${r.recommandation}`;
  return r.recommandations.map((e) => `${e.score}: ${e.recommandation}`).join(' || ');
}

/** Field-level comparison of two methodology versions. */
export function diffVersions(a: MethodologyVersion, b: MethodologyVersion): Change[] {
  const out: Change[] = [];
  const am = new Map(a.questions.map((q) => [q.question_id, q]));
  const bm = new Map(b.questions.map((q) => [q.question_id, q]));
  for (const [id, q] of am) if (!bm.has(id)) out.push({ kind: 'removed', scope: 'question', id, before: q.question, affects_scoring: maxScore(q) > 0 });
  for (const [id, q] of bm) if (!am.has(id)) out.push({ kind: 'added', scope: 'question', id, after: q.question, affects_scoring: maxScore(q) > 0 });
  for (const [id, qa] of am) {
    const qb = bm.get(id);
    if (!qb) continue;
    const cmp = (field: string, x: string, y: string, scoring: boolean) => {
      if (x !== y) out.push({ kind: 'modified', scope: 'question', id, field, before: x, after: y, affects_scoring: scoring });
    };
    cmp('question', qa.question, qb.question, false);
    cmp('info', qa.info ?? '', qb.info ?? '', false);
    cmp('topic', qa.topic, qb.topic, false);
    cmp('dependency', qa.dependency ?? '', qb.dependency ?? '', true);
    cmp('x_dependency_answer', qa.x_dependency_answer ?? '', qb.x_dependency_answer ?? '', true);
    cmp('propositions', fmtProps(qa), fmtProps(qb), scoringChanged(qa, qb));
    cmp('recommandations', fmtRecs(qa), fmtRecs(qb), false);
  }
  const ar = new Map(a.roadmap_rules.map((r) => [r.id, r]));
  const br = new Map(b.roadmap_rules.map((r) => [r.id, r]));
  for (const [id, r] of ar) if (!br.has(id)) out.push({ kind: 'removed', scope: 'rule', id, before: r.title, affects_scoring: false });
  for (const [id, r] of br) if (!ar.has(id)) out.push({ kind: 'added', scope: 'rule', id, after: r.title, affects_scoring: false });
  for (const [id, ra] of ar) {
    const rb = br.get(id);
    if (!rb) continue;
    const sa = JSON.stringify(ra);
    const sb = JSON.stringify(rb);
    if (sa !== sb) out.push({ kind: 'modified', scope: 'rule', id, before: `${ra.phase}/${ra.priority}/${ra.effort} ${ra.title}`, after: `${rb.phase}/${rb.priority}/${rb.effort} ${rb.title}`, affects_scoring: false });
  }
  const ta = a.translations?.sw ?? {};
  const tb = b.translations?.sw ?? {};
  const ids = new Set([...Object.keys(ta.questions ?? {}), ...Object.keys(tb.questions ?? {})]);
  for (const id of ids) {
    const x = JSON.stringify(ta.questions?.[id] ?? null);
    const y = JSON.stringify(tb.questions?.[id] ?? null);
    if (x !== y) out.push({ kind: x === 'null' ? 'added' : y === 'null' ? 'removed' : 'modified', scope: 'translation', id, field: 'sw', before: ta.questions?.[id]?.question ?? '', after: tb.questions?.[id]?.question ?? '', affects_scoring: false });
  }
  const recIds = new Set([...Object.keys(ta.recommendations ?? {}), ...Object.keys(tb.recommendations ?? {})]);
  for (const id of recIds) {
    const x = ta.recommendations?.[id] ?? '';
    const y = tb.recommendations?.[id] ?? '';
    if (x !== y) out.push({ kind: !x ? 'added' : !y ? 'removed' : 'modified', scope: 'translation', id: `rec ${id}`, field: 'sw', before: x, after: y, affects_scoring: false });
  }
  if (JSON.stringify(a.grading) !== JSON.stringify(b.grading)) out.push({ kind: 'modified', scope: 'grading', id: 'grading', before: a.grading.map((g) => `${g.grade}≥${g.min_percent}%`).join(' '), after: b.grading.map((g) => `${g.grade}≥${g.min_percent}%`).join(' '), affects_scoring: true });
  return out;
}

function scoringChanged(a: Question, b: Question): boolean {
  const pa = a.propositions;
  const pb = b.propositions;
  if (pa.type !== pb.type) return true;
  if (pa.type === 'option' && pb.type === 'option') {
    if (pa.propositions.length !== pb.propositions.length) return true;
    return pa.propositions.some((o, i) => o.score !== pb.propositions[i].score || o.proposition !== pb.propositions[i].proposition);
  }
  if (pa.type === 'choices' && pb.type === 'choices') {
    return JSON.stringify([pa.propositions, pa.count_score_map, pa.count_score_coeff]) !== JSON.stringify([pb.propositions, pb.count_score_map, pb.count_score_coeff]);
  }
  return false;
}
