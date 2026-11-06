import type { Grade, Nutrients } from '../types.ts';
import { SALT_G, SAT_FAT_G, SUGARS_G, nutriScore2023 } from './nutriscore.ts';

const better: Record<Grade, Grade | null> = { A: null, B: 'A', C: 'B', D: 'C', E: 'D' };

export interface NextGradeHint {
  current: Grade;
  target: Grade | null;
  /** cheapest single-nutrient change found, or null if none reaches the next letter */
  change: { nutrient: 'sugars_g' | 'salt_g' | 'sat_fat_g'; from: number; to: number; delta: number } | null;
}

function rank(g: Grade): number {
  return ['E', 'D', 'C', 'B', 'A'].indexOf(g);
}

/**
 * Smallest reduction of ONE nutrient (sugars, salt or saturated fat) that reaches the next better letter.
 * Points only change at the table thresholds, so only those values are tested (bounded, no loops over the input range).
 * Illustrative only.
 */
export function nextGradeHint(n: Nutrients): NextGradeHint {
  const current = nutriScore2023(n).grade;
  const target = better[current];
  if (!target) return { current, target: null, change: null };
  const specs: { key: 'sugars_g' | 'salt_g' | 'sat_fat_g'; thresholds: number[] }[] = [
    { key: 'sugars_g', thresholds: SUGARS_G },
    { key: 'salt_g', thresholds: SALT_G },
    { key: 'sat_fat_g', thresholds: SAT_FAT_G },
  ];
  const candidates: NonNullable<NextGradeHint['change']>[] = [];
  for (const { key, thresholds } of specs) {
    const from = n[key];
    // candidate values: each threshold below the current value (landing exactly on it keeps the lower band), then 0
    const values = [...thresholds.filter((t) => t < from).sort((a, b) => b - a), 0];
    for (const to of values) {
      const g = nutriScore2023({ ...n, [key]: to }).grade;
      if (rank(g) >= rank(target)) {
        candidates.push({ nutrient: key, from, to, delta: Math.round((from - to) * 100) / 100 });
        break;
      }
    }
  }
  if (!candidates.length) return { current, target, change: null };
  candidates.sort((a, b) => a.delta / Math.max(a.from, 0.01) - b.delta / Math.max(b.from, 0.01));
  return { current, target, change: candidates[0] };
}
