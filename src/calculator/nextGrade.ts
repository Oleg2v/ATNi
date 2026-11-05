import type { Grade, Nutrients } from '../types.ts';
import { nutriScore2023 } from './nutriscore.ts';

const better: Record<Grade, Grade | null> = { A: null, B: 'A', C: 'B', D: 'C', E: 'D' };

export interface NextGradeHint {
  current: Grade;
  target: Grade | null;
  /** cheapest single-nutrient change found, or null if none within the search range */
  change: { nutrient: 'sugars_g' | 'salt_g' | 'sat_fat_g'; from: number; to: number; delta: number } | null;
}

/**
 * Smallest reduction of ONE nutrient (sugars, salt or saturated fat) that reaches the next better letter.
 * Brute-force search in table-friendly steps; illustrative only.
 */
export function nextGradeHint(n: Nutrients): NextGradeHint {
  const current = nutriScore2023(n).grade;
  const target = better[current];
  if (!target) return { current, target: null, change: null };
  const candidates: NextGradeHint['change'][] = [];
  const specs: { key: 'sugars_g' | 'salt_g' | 'sat_fat_g'; step: number }[] = [
    { key: 'sugars_g', step: 0.1 },
    { key: 'salt_g', step: 0.01 },
    { key: 'sat_fat_g', step: 0.1 },
  ];
  for (const { key, step } of specs) {
    const from = n[key];
    for (let v = from; v >= -1e-9; v -= step) {
      const to = Math.max(0, Math.round(v * 100) / 100);
      const g = nutriScore2023({ ...n, [key]: to }).grade;
      if (rank(g) >= rank(target)) {
        candidates.push({ nutrient: key, from, to, delta: Math.round((from - to) * 100) / 100 });
        break;
      }
    }
  }
  if (!candidates.length) return { current, target, change: null };
  // "smallest" = smallest relative reduction
  candidates.sort((a, b) => a!.delta / Math.max(a!.from, 0.01) - b!.delta / Math.max(b!.from, 0.01));
  return { current, target, change: candidates[0] };
}

function rank(g: Grade): number {
  return ['E', 'D', 'C', 'B', 'A'].indexOf(g);
}
