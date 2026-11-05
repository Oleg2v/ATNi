/**
 * Nutri-Score 2023 algorithm for general foods (not beverages, not fats/oils/nuts/seeds,
 * not red meat, not cheese special rules).
 *
 * Source: Santé publique France, "Nutri-Score Questions & Answers", English version dated
 * 17 March 2025, Tables 5 and 6 and the "Calculation of the nutritional score" section
 * (pp. 26–28); final thresholds from the Scientific Committee update report (2022), §1.8.2.
 *
 * Illustrative calculation only. Not a result of ATNi, not a medical or dietary recommendation.
 */
import type { Grade, Nutrients } from '../types.ts';

/** value > threshold[i] ⇒ at least i+1 points */
export const ENERGY_KJ = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];
export const SUGARS_G = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];
export const SAT_FAT_G = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const SALT_G = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4];
export const PROTEIN_G = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];
export const FIBRE_G = [3.0, 4.1, 5.2, 6.3, 7.4];

export function pointsAbove(value: number, thresholds: number[]): number {
  let p = 0;
  // small epsilon so that values like 3.4000000001 from float arithmetic behave as the table intends
  for (const t of thresholds) if (value > t + 1e-9) p++;
  return p;
}

/** Fruits, vegetables and legumes: > 40 % → 1, > 60 % → 2, > 80 % → 5 (Table 6) */
export function fvlPoints(percent: number): number {
  if (percent > 80 + 1e-9) return 5;
  if (percent > 60 + 1e-9) return 2;
  if (percent > 40 + 1e-9) return 1;
  return 0;
}

export interface NutriScoreResult {
  points: {
    energy: number;
    sugars: number;
    sat_fat: number;
    salt: number;
    protein: number;
    fibre: number;
    fvl: number;
  };
  n_total: number;
  p_total: number;
  protein_counted: boolean;
  score: number;
  grade: Grade;
}

export function gradeFromScore(score: number): Grade {
  if (score <= 0) return 'A';
  if (score <= 2) return 'B';
  if (score <= 10) return 'C';
  if (score <= 18) return 'D';
  return 'E';
}

export function nutriScore2023(n: Nutrients): NutriScoreResult {
  const points = {
    energy: pointsAbove(n.energy_kj, ENERGY_KJ),
    sugars: pointsAbove(n.sugars_g, SUGARS_G),
    sat_fat: pointsAbove(n.sat_fat_g, SAT_FAT_G),
    salt: pointsAbove(n.salt_g, SALT_G),
    protein: pointsAbove(n.protein_g, PROTEIN_G),
    fibre: pointsAbove(n.fibre_g, FIBRE_G),
    fvl: fvlPoints(n.fvl_percent),
  };
  const n_total = points.energy + points.sugars + points.sat_fat + points.salt;
  const p_total = points.protein + points.fibre + points.fvl;
  // General foods: if N ≥ 11, protein points are not counted (cheese exception not modelled here).
  const protein_counted = n_total < 11;
  const score = protein_counted ? n_total - p_total : n_total - points.fibre - points.fvl;
  return { points, n_total, p_total, protein_counted, score, grade: gradeFromScore(score) };
}
