import { describe, expect, it } from 'vitest';
import { ENERGY_KJ, SALT_G, SAT_FAT_G, SUGARS_G, fvlPoints, gradeFromScore, nutriScore2023, pointsAbove } from './nutriscore.ts';
import { nextGradeHint } from './nextGrade.ts';

/**
 * The official documents publish the point tables and the formula but no per-product worked
 * examples, so the cases below are computed by hand from Tables 5 and 6 (Q&A, 17 March 2025).
 */
describe('Nutri-Score 2023 point tables (Table 5, negative component)', () => {
  it('energy: 0 points below 335 kJ, 1 point above, 10 points above 3350 kJ', () => {
    expect(pointsAbove(300, ENERGY_KJ)).toBe(0);
    expect(pointsAbove(335, ENERGY_KJ)).toBe(0); // exactly at the threshold stays in the lower band
    expect(pointsAbove(336, ENERGY_KJ)).toBe(1);
    expect(pointsAbove(1700, ENERGY_KJ)).toBe(5);
    expect(pointsAbove(3351, ENERGY_KJ)).toBe(10);
    expect(pointsAbove(9000, ENERGY_KJ)).toBe(10);
  });
  it('sugars: 0..15 points with the 2023 steps', () => {
    expect(pointsAbove(3.4, SUGARS_G)).toBe(0);
    expect(pointsAbove(3.5, SUGARS_G)).toBe(1);
    expect(pointsAbove(10, SUGARS_G)).toBe(2);
    expect(pointsAbove(10.1, SUGARS_G)).toBe(3);
    expect(pointsAbove(34.5, SUGARS_G)).toBe(10);
    expect(pointsAbove(52, SUGARS_G)).toBe(15);
  });
  it('saturated fat: 1 point per gram above 1 g, max 10', () => {
    expect(pointsAbove(1, SAT_FAT_G)).toBe(0);
    expect(pointsAbove(1.1, SAT_FAT_G)).toBe(1);
    expect(pointsAbove(5.5, SAT_FAT_G)).toBe(5);
    expect(pointsAbove(25, SAT_FAT_G)).toBe(10);
  });
  it('salt: 0..20 points in 0.2 g steps', () => {
    expect(pointsAbove(0.2, SALT_G)).toBe(0);
    expect(pointsAbove(0.21, SALT_G)).toBe(1);
    expect(pointsAbove(1.0, SALT_G)).toBe(4);
    expect(pointsAbove(1.01, SALT_G)).toBe(5);
    expect(pointsAbove(4.1, SALT_G)).toBe(20);
  });
});

describe('Nutri-Score 2023 positive component (Table 6)', () => {
  it('fruits, vegetables, legumes: 0/1/2/5 points', () => {
    expect(fvlPoints(40)).toBe(0);
    expect(fvlPoints(41)).toBe(1);
    expect(fvlPoints(61)).toBe(2);
    expect(fvlPoints(80)).toBe(2);
    expect(fvlPoints(81)).toBe(5);
    expect(fvlPoints(100)).toBe(5);
  });
  it('fibre and protein bands', () => {
    const r = nutriScore2023({ energy_kj: 0, sugars_g: 0, sat_fat_g: 0, salt_g: 0, fibre_g: 7.5, protein_g: 17.1, fvl_percent: 0 });
    expect(r.points.fibre).toBe(5);
    expect(r.points.protein).toBe(7);
  });
});

describe('final score and letters', () => {
  it('letter thresholds: A ≤ 0, B 1–2, C 3–10, D 11–18, E ≥ 19', () => {
    expect(gradeFromScore(-15)).toBe('A');
    expect(gradeFromScore(0)).toBe('A');
    expect(gradeFromScore(1)).toBe('B');
    expect(gradeFromScore(2)).toBe('B');
    expect(gradeFromScore(3)).toBe('C');
    expect(gradeFromScore(10)).toBe('C');
    expect(gradeFromScore(11)).toBe('D');
    expect(gradeFromScore(18)).toBe('D');
    expect(gradeFromScore(19)).toBe('E');
    expect(gradeFromScore(40)).toBe('E');
  });

  it('hand-computed: demo porridge variant A', () => {
    // energy 1560 → 4; sugars 18 → 5; sat fat 1.8 → 1; salt 0.9 → 4 ⇒ N = 14 (≥ 11 ⇒ protein not counted)
    // fibre 4.5 → 2; protein 7.5 → 3; fvl 0 → 0 ⇒ score = 14 − 2 − 0 = 12 ⇒ D
    const r = nutriScore2023({ energy_kj: 1560, sugars_g: 18, sat_fat_g: 1.8, salt_g: 0.9, fibre_g: 4.5, protein_g: 7.5, fvl_percent: 0 });
    expect(r.points).toEqual({ energy: 4, sugars: 5, sat_fat: 1, salt: 4, protein: 3, fibre: 2, fvl: 0 });
    expect(r.n_total).toBe(14);
    expect(r.protein_counted).toBe(false);
    expect(r.score).toBe(12);
    expect(r.grade).toBe('D');
  });

  it('hand-computed: demo porridge variant B', () => {
    // energy 1490 → 4; sugars 9 → 2; sat fat 1.1 → 1; salt 0.5 → 2 ⇒ N = 9 (< 11 ⇒ protein counted)
    // fibre 6.5 → 4; protein 8.5 → 3; fvl 12 → 0 ⇒ P = 7 ⇒ score = 2 ⇒ B
    const r = nutriScore2023({ energy_kj: 1490, sugars_g: 9, sat_fat_g: 1.1, salt_g: 0.5, fibre_g: 6.5, protein_g: 8.5, fvl_percent: 12 });
    expect(r.n_total).toBe(9);
    expect(r.p_total).toBe(7);
    expect(r.protein_counted).toBe(true);
    expect(r.score).toBe(2);
    expect(r.grade).toBe('B');
  });

  it('N ≥ 11: protein is ignored even with 5 fruit/veg points (2023 general-foods rule)', () => {
    const r = nutriScore2023({ energy_kj: 2400, sugars_g: 30, sat_fat_g: 0, salt_g: 0, fibre_g: 0, protein_g: 20, fvl_percent: 90 });
    // energy 7 + sugars 8 = 15 ≥ 11 ⇒ score = 15 − 0 − 5 = 10 ⇒ C
    expect(r.n_total).toBe(15);
    expect(r.protein_counted).toBe(false);
    expect(r.score).toBe(10);
    expect(r.grade).toBe('C');
  });

  it('a plain high-fibre, low-everything product scores A', () => {
    const r = nutriScore2023({ energy_kj: 300, sugars_g: 1, sat_fat_g: 0.2, salt_g: 0.1, fibre_g: 8, protein_g: 5, fvl_percent: 0 });
    expect(r.score).toBe(-7);
    expect(r.grade).toBe('A');
  });
});

describe('next grade hint', () => {
  it('finds a single-nutrient change that reaches the next letter', () => {
    const h = nextGradeHint({ energy_kj: 1560, sugars_g: 18, sat_fat_g: 1.8, salt_g: 0.9, fibre_g: 4.5, protein_g: 7.5, fvl_percent: 0 });
    expect(h.current).toBe('D');
    expect(h.target).toBe('C');
    expect(h.change).not.toBeNull();
    const n = { energy_kj: 1560, sugars_g: 18, sat_fat_g: 1.8, salt_g: 0.9, fibre_g: 4.5, protein_g: 7.5, fvl_percent: 0, [h.change!.nutrient]: h.change!.to };
    expect(nutriScore2023(n).grade).toBe('C');
  });
  it('returns no target for A', () => {
    const h = nextGradeHint({ energy_kj: 300, sugars_g: 1, sat_fat_g: 0.2, salt_g: 0.1, fibre_g: 8, protein_g: 5, fvl_percent: 0 });
    expect(h.target).toBeNull();
  });
});
