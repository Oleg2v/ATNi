import { describe, expect, it } from 'vitest';
import v10 from '../data/methodology-v1.0.json';
import v11 from '../data/methodology-v1.1.json';
import assessmentsJson from '../data/assessments.json';
import type { Answers, Assessment, MethodologyVersion, Question } from '../types.ts';
import { achievableScores, computeResult, gradeFor, isApplicable, maxScore, questionMap, scoreAnswer } from './score.ts';
import { recommendationFor } from './recommendations.ts';
import { buildRoadmap } from './roadmap.ts';
import { validateVersion } from './validate.ts';
import { diffVersions } from './diff.ts';
import { computeImpact } from './impact.ts';
import { importNutriCheck } from './importer.ts';

const V10 = v10 as unknown as MethodologyVersion;
const V11 = v11 as unknown as MethodologyVersion;
const ASSESSMENTS = assessmentsJson as unknown as Assessment[];
const q = (id: string): Question => V10.questions.find((x) => x.question_id === id)!;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('scoring (survey.json rules)', () => {
  it('option: score of the selected proposition', () => {
    expect(scoreAnswer(q('1.1'), { type: 'option', selected: 'Yes, in draft' })).toBe(2.5);
    expect(scoreAnswer(q('1.1'), { type: 'option', selected: 'Nonsense' })).toBe(0);
  });
  it('choices with count_score_map indexes by count and clamps', () => {
    const qq = q('1.2');
    expect(scoreAnswer(qq, { type: 'choices', selected: [] , none: true })).toBe(0);
    expect(scoreAnswer(qq, { type: 'choices', selected: ['Reformulation targets (sugar, salt, fat)', 'Portion and pack sizes'] })).toBe(2);
    const big = clone(qq);
    if (big.propositions.type === 'choices') big.propositions.count_score_map = [0, 2.5];
    expect(scoreAnswer(big, { type: 'choices', selected: ['Reformulation targets (sugar, salt, fat)', 'Portion and pack sizes', 'Fortification with vitamins or minerals'] })).toBe(2.5);
  });
  it('choices with coefficient multiply the count', () => {
    expect(scoreAnswer(q('4.2'), { type: 'choices', selected: ['An interpretive front-of-pack label', 'Clear allergen highlighting'] })).toBe(2.5);
  });
  it('text scores 0', () => {
    expect(scoreAnswer(q('1.4'), { type: 'text', text: 'anything' })).toBe(0);
  });
  it('max score per type', () => {
    expect(maxScore(q('1.1'))).toBe(5);
    expect(maxScore(q('1.2'))).toBe(5);
    expect(maxScore(q('4.2'))).toBe(5);
    expect(maxScore(q('2.3'))).toBe(5);
    expect(maxScore(q('1.4'))).toBe(0);
  });
  it('achievable scores enumerate options and counts', () => {
    expect(achievableScores(q('1.1'))).toEqual([0, 2.5, 5]);
    expect(achievableScores(q('3.2'))).toEqual([0, 1.25, 2.5, 3.75, 5]);
    expect(achievableScores(q('2.3'))).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('grade thresholds A≥80 B≥60 C≥40 D≥20 else E', () => {
    const g = V10.grading;
    expect(gradeFor(80, g)).toBe('A');
    expect(gradeFor(79.9, g)).toBe('B');
    expect(gradeFor(60, g)).toBe('B');
    expect(gradeFor(40, g)).toBe('C');
    expect(gradeFor(20, g)).toBe('D');
    expect(gradeFor(19.9, g)).toBe('E');
  });
});

describe('dependencies', () => {
  const byId = questionMap(V10);
  it('standard dependency: parent answered with anything but No', () => {
    expect(isApplicable(q('1.2'), {}, byId)).toBe(false);
    expect(isApplicable(q('1.2'), { '1.1': { type: 'option', selected: 'No' } }, byId)).toBe(false);
    expect(isApplicable(q('1.2'), { '1.1': { type: 'option', selected: 'Yes, in draft' } }, byId)).toBe(true);
  });
  it('specific-answer dependency (x_dependency_answer)', () => {
    expect(isApplicable(q('2.2'), { '2.1': { type: 'option', selected: 'Yes' } }, byId)).toBe(true);
    expect(isApplicable(q('2.2'), { '2.1': { type: 'option', selected: 'No' } }, byId)).toBe(false);
  });
  it('chain 2.1 → 2.2 → 2.3', () => {
    expect(isApplicable(q('2.3'), { '2.1': { type: 'option', selected: 'Yes' } }, byId)).toBe(false);
    expect(isApplicable(q('2.3'), { '2.1': { type: 'option', selected: 'Yes' }, '2.2': { type: 'option', selected: 'Under 16' } }, byId)).toBe(true);
    expect(isApplicable(q('2.3'), { '2.1': { type: 'option', selected: 'No' }, '2.2': { type: 'option', selected: 'Under 16' } }, byId)).toBe(false);
  });
  it('cycles do not hang', () => {
    const v = clone(V10);
    v.questions.find((x) => x.question_id === '1.1')!.dependency = '1.2';
    expect(isApplicable(v.questions[0], { '1.1': { type: 'option', selected: 'Yes, in draft' } }, questionMap(v))).toBe(false);
  });
  it('max only counts applicable questions', () => {
    const r = computeResult(V10, { '2.1': { type: 'option', selected: 'No' } }, '2026-01-01T00:00:00Z');
    const mk = r.topics.find((t) => t.topic === 'Marketing')!;
    expect(mk.max).toBe(10); // 2.1 and 2.4 only
  });
});

describe('results', () => {
  it('current user’s stored assessment: Marketing is C', () => {
    const me = ASSESSMENTS.find((a) => a.company_id === 'C-001')!;
    const r = computeResult(V10, me.answers, me.completed_at!);
    expect(r.topics.find((t) => t.topic === 'Marketing')!.grade).toBe('C');
    expect(r.grade).toBe(me.result!.grade);
    expect(r.percent).toBe(me.result!.percent);
  });
  it('a perfect answer set is A with 100 %', () => {
    const answers: Answers = {
      '1.1': { type: 'option', selected: 'Yes, approved by senior management' },
      '1.2': { type: 'choices', selected: (q('1.2').propositions as { propositions: string[] }).propositions },
      '1.3': { type: 'option', selected: 'All or most products' },
      '1.4': { type: 'text', text: 'x' },
      '2.1': { type: 'option', selected: 'Yes' },
      '2.2': { type: 'option', selected: 'Under 18' },
      '2.3': { type: 'choices', selected: (q('2.3').propositions as { propositions: string[] }).propositions },
      '2.4': { type: 'option', selected: 'Yes, by an independent audit' },
      '3.1': { type: 'option', selected: 'Yes, at all sites' },
      '3.2': { type: 'choices', selected: (q('3.2').propositions as { propositions: string[] }).propositions },
      '4.1': { type: 'option', selected: 'Yes, all products' },
      '4.2': { type: 'choices', selected: (q('4.2').propositions as { propositions: string[] }).propositions },
      '5.1': { type: 'option', selected: 'Yes', text: 'committee' },
      '5.2': { type: 'choices', selected: (q('5.2').propositions as { propositions: string[] }).propositions },
    };
    const r = computeResult(V10, answers, '2026-01-01T00:00:00Z');
    expect(r.max).toBe(65);
    expect(r.total).toBe(65);
    expect(r.grade).toBe('A');
  });
});

describe('recommendations', () => {
  it('exact score match; missing score reported instead of crashing', () => {
    expect(recommendationFor(q('1.1'), 2.5)).toMatchObject({ status: 'ok', id: 'R-02' });
    expect(recommendationFor(q('1.1'), 3)).toEqual({ status: 'missing', score: 3 });
    expect(recommendationFor(q('1.2'), 4)).toMatchObject({ status: 'ok', kind: 'fixed' });
    expect(recommendationFor(q('2.2'), 4)).toEqual({ status: 'none' });
  });
});

describe('roadmap', () => {
  it('every step carries the triggering answer', () => {
    const me = ASSESSMENTS.find((a) => a.company_id === 'C-001')!;
    const r = computeResult(V10, me.answers, me.completed_at!);
    const steps = buildRoadmap(V10, r, me.answers);
    expect(steps.length).toBeGreaterThan(3);
    for (const s of steps) {
      expect(s.because.answer.length).toBeGreaterThan(0);
      expect(s.recommendation.length).toBeGreaterThan(0);
    }
    expect(steps.map((s) => s.phase)).toEqual([...steps.map((s) => s.phase)].sort((a, b) => ['now', 'next', 'later'].indexOf(a) - ['now', 'next', 'later'].indexOf(b)));
    expect(steps.some((s) => s.rule_id === 'RR-08')).toBe(true); // answered No to 2.4
  });
  it('does not fire for hidden questions', () => {
    const r = computeResult(V10, { '2.1': { type: 'option', selected: 'No' } }, '2026-01-01T00:00:00Z');
    const steps = buildRoadmap(V10, r, { '2.1': { type: 'option', selected: 'No' } });
    expect(steps.some((s) => s.question_id === '2.3')).toBe(false);
    expect(steps.some((s) => s.rule_id === 'RR-06')).toBe(true);
  });
});

describe('validation (methodology health)', () => {
  it('v1.0 is publishable with only translation warnings', () => {
    const rep = validateVersion(V10);
    expect(rep.errors).toBe(0);
    expect(rep.publishable).toBe(true);
    expect(rep.max_total).toBe(65);
    expect(rep.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(rep.issues.some((i) => i.code === 'missing-rec-translation')).toBe(true);
  });
  it('v1.1 draft warns about the missing Swahili text of 1.3', () => {
    const rep = validateVersion(V11);
    expect(rep.publishable).toBe(true);
    expect(rep.issues.some((i) => i.code === 'missing-translation' && i.path.question_id === '1.3')).toBe(true);
  });
  it('changing an option score 5 → 2.5 without a recommendation blocks publication with a field link', () => {
    const v = clone(V11);
    const q21 = v.questions.find((x) => x.question_id === '2.1')!;
    if (q21.propositions.type === 'option') q21.propositions.propositions[0].score = 2.5;
    const rep = validateVersion(v);
    expect(rep.publishable).toBe(false);
    const issue = rep.issues.find((i) => i.code === 'missing-rec')!;
    expect(issue.message).toBe('No recommendation for score 2.5 in question 2.1');
    expect(issue.path).toMatchObject({ question_id: '2.1', field: 'recommandations', score: 2.5 });
    expect(rep.issues.some((i) => i.code === 'unreachable-rec' && i.path.score === 5)).toBe(true);
    // adding the recommendation unblocks it
    if (q21.recommandations?.type === 'scored') {
      q21.recommandations.recommandations[0].score = 2.5;
    }
    expect(validateVersion(v).publishable).toBe(true);
  });
  it('detects dangling dependencies and cycles', () => {
    const v = clone(V10);
    v.questions.find((x) => x.question_id === '1.2')!.dependency = '9.9';
    v.questions.find((x) => x.question_id === '2.1')!.dependency = '2.3';
    const rep = validateVersion(v);
    expect(rep.issues.some((i) => i.code === 'dangling-dependency' && i.path.question_id === '1.2')).toBe(true);
    expect(rep.issues.some((i) => i.code === 'dependency-cycle')).toBe(true);
    expect(rep.publishable).toBe(false);
  });
});

describe('diff and impact', () => {
  it('diff lists the edits in the v1.1 draft', () => {
    const changes = diffVersions(V10, V11);
    expect(changes.some((c) => c.scope === 'question' && c.id === '1.3' && c.field === 'question')).toBe(true);
    expect(changes.some((c) => c.scope === 'question' && c.id === '5.2' && c.field === 'propositions')).toBe(true);
    expect(changes.some((c) => c.scope === 'translation' && c.id === '1.3' && c.kind === 'removed')).toBe(true);
  });
  it('impact of the unchanged-scoring draft is zero letter changes', () => {
    const imp = computeImpact(ASSESSMENTS, V10, V11);
    expect(imp.total).toBe(74);
    expect(imp.changed).toBe(0);
  });
  it('impact of the 5 → 2.5 edit changes some letters; past results stay on v1.0', () => {
    const v = clone(V11);
    const q21 = v.questions.find((x) => x.question_id === '2.1')!;
    if (q21.propositions.type === 'option') q21.propositions.propositions[0].score = 2.5;
    const imp = computeImpact(ASSESSMENTS, V10, v);
    expect(imp.changed).toBeGreaterThan(0);
    expect(imp.up + imp.down).toBe(imp.changed);
    expect(imp.down).toBeGreaterThan(0); // companies that answered Yes lose points
    expect(imp.up).toBeGreaterThan(0); // the lower maximum lifts some who answered No: the classic denominator shift
    // stored results are untouched
    for (const a of ASSESSMENTS) expect(a.result!.version_id).toBe('v1.0');
    const me = ASSESSMENTS.find((a) => a.company_id === 'C-001')!;
    expect(computeResult(V10, me.answers, me.completed_at!).grade).toBe(me.result!.grade);
  });
});

describe('importer (survey.json format)', () => {
  it('imports the sample file and reports the missing recommendation', () => {
    // sample file is generated from v1.0 with the 2.5 recommendation of 2.4 removed on purpose
    const sample = clone(V10.questions).map((qq) => {
      const r = qq.recommandations;
      if (qq.question_id === '2.4' && r?.type === 'scored') r.recommandations = r.recommandations.filter((e) => e.score !== 2.5);
      delete qq.x_dependency_answer;
      return qq;
    });
    const { version, report } = importNutriCheck(sample, { id: 'imp-1', version: '0.1', country: '*', created_at: '2026-01-01T00:00:00Z' });
    expect(report.ok).toBe(true);
    expect(version?.questions.length).toBe(14);
    expect(report.counts).toMatchObject({ option: 8, choices: 5, text: 1, with_dependency: 3 });
    expect(report.scores_without_recs).toEqual([{ question_id: '2.4', score: 2.5 }]);
    expect(report.unsupported.some((u) => u.kind === 'chain' && u.question_id === '2.3')).toBe(true);
    expect(report.unsupported.some((u) => u.kind === 'any-answer-but-no')).toBe(true);
    expect(validateVersion(version!).publishable).toBe(false);
  });
  it('rejects garbage and skips malformed rows', () => {
    expect(importNutriCheck({ hello: 1 }, { id: 'x', version: '0', country: '*', created_at: '' }).report.fatal).toBeTruthy();
    const { report } = importNutriCheck([{ topic: 'T', question: 'Q', question_id: '1', propositions: { type: 'weird' } }, { topic: 'T', question: 'Q', question_id: '2', propositions: { type: 'text', proposition: 'p' } }], { id: 'x', version: '0', country: '*', created_at: '' });
    expect(report.ok).toBe(true);
    expect(report.skipped.length).toBe(1);
    expect(report.counts.questions).toBe(1);
  });
  it('flags unscored choices and self-dependencies for review', () => {
    const { report } = importNutriCheck([{ topic: 'T', question: 'Q', question_id: '1', dependency: '1', propositions: { type: 'choices', propositions: ['a', 'b'] } }], { id: 'x', version: '0', country: '*', created_at: '' });
    expect(report.needs_review.map((r) => r.message.slice(0, 20))).toEqual(['Multiple-choice ques', 'Depends on itself; t']);
  });
});
