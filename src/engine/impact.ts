import type { Assessment, Grade, MethodologyVersion } from '../types.ts';
import { computeResult } from './score.ts';

export interface ImpactRow {
  assessment_id: string;
  company_name: string;
  country: string;
  completed_at: string | null;
  old_grade: Grade;
  new_grade: Grade;
  old_percent: number;
  new_percent: number;
  changed: boolean;
  direction: 'up' | 'down' | 'same';
}

export interface ImpactReport {
  total: number;
  changed: number;
  up: number;
  down: number;
  rows: ImpactRow[];
  by_transition: Record<string, number>;
}

const order: Grade[] = ['E', 'D', 'C', 'B', 'A'];

/**
 * What would happen to past assessments if they were re-scored under a new version.
 * Past results are never rewritten: this is a preview only.
 */
export function computeImpact(assessments: Assessment[], oldV: MethodologyVersion, newV: MethodologyVersion): ImpactReport {
  const rows: ImpactRow[] = [];
  const by_transition: Record<string, number> = {};
  for (const a of assessments) {
    if (!a.completed_at) continue;
    const oldR = a.result && a.result.version_id === oldV.id ? a.result : computeResult(oldV, a.answers, a.completed_at);
    const newR = computeResult(newV, a.answers, a.completed_at);
    const changed = oldR.grade !== newR.grade;
    const direction = !changed ? 'same' : order.indexOf(newR.grade) > order.indexOf(oldR.grade) ? 'up' : 'down';
    if (changed) by_transition[`${oldR.grade}→${newR.grade}`] = (by_transition[`${oldR.grade}→${newR.grade}`] ?? 0) + 1;
    rows.push({
      assessment_id: a.id,
      company_name: a.company_name,
      country: a.country,
      completed_at: a.completed_at,
      old_grade: oldR.grade,
      new_grade: newR.grade,
      old_percent: oldR.percent,
      new_percent: newR.percent,
      changed,
      direction,
    });
  }
  return {
    total: rows.length,
    changed: rows.filter((r) => r.changed).length,
    up: rows.filter((r) => r.direction === 'up').length,
    down: rows.filter((r) => r.direction === 'down').length,
    rows,
    by_transition,
  };
}
