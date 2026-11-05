/**
 * Deterministic generator for the large synthetic datasets.
 * Run: node scripts/gen-data.ts   (Node 22 type stripping)
 * Writes: src/data/assessments.json, src/data/methodology-v1.1.json, public/sample-nutricheck-format.json, src/data/analytics.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { computeResult } from '../src/engine/score.ts';
import type { Answers, Assessment, CompanySize, CountryCode, MethodologyVersion, Question } from '../src/types.ts';

const v10 = JSON.parse(readFileSync(new URL('../src/data/methodology-v1.0.json', import.meta.url), 'utf8')) as MethodologyVersion;
const companies = JSON.parse(readFileSync(new URL('../src/data/companies.json', import.meta.url), 'utf8')) as { id: string; name: string; country: CountryCode; size: CompanySize }[];

// mulberry32 PRNG
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261105);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const weighted = <T,>(items: [T, number][]): T => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
};

const kePrefixes = ['Nakuru', 'Thika', 'Eldoret', 'Mombasa', 'Kisumu', 'Nyeri', 'Machakos', 'Kitale', 'Meru', 'Naivasha'];
const tzPrefixes = ['Arusha', 'Mbeya', 'Tanga', 'Morogoro', 'Zanzibar', 'Iringa', 'Moshi', 'Dar', 'Mtwara', 'Tabora'];
const suffixes = ['Foods', 'Millers', 'Dairy', 'Bakers', 'Beverages', 'Agro', 'Snacks', 'Oils', 'Nutrition', 'Harvest'];

function makeCompanies(country: CountryCode, n: number, start: number) {
  const out: { id: string; name: string; country: CountryCode; size: CompanySize }[] = [];
  const prefixes = country === 'KE' ? kePrefixes : tzPrefixes;
  for (let i = 0; i < n; i++) {
    const name = `${prefixes[i % prefixes.length]} ${suffixes[(i * 3 + start) % suffixes.length]} ${country}-${String(i + 1).padStart(2, '0')} (synthetic)`;
    out.push({ id: `S-${country}-${String(start + i).padStart(3, '0')}`, name, country, size: weighted([['micro', 2], ['small', 4], ['medium', 3], ['large', 1]]) });
  }
  return out;
}

const pool = [...companies, ...makeCompanies('KE', 26, 100), ...makeCompanies('TZ', 20, 200)];

/** answer generator with a per-company "maturity" so results spread across A–E */
function genAnswers(qs: Question[], maturity: number): Answers {
  const answers: Answers = {};
  const byId = new Map(qs.map((q) => [q.question_id, q]));
  for (const q of qs) {
    const p = q.propositions;
    if (p.type === 'option') {
      // sort by score desc; higher maturity → higher chance of top option
      const sorted = [...p.propositions].sort((a, b) => b.score - a.score);
      const weights: [typeof sorted[number], number][] = sorted.map((o, i) => [o, Math.max(0.05, maturity - i * 0.3) + (1 - maturity) * (i / sorted.length)]);
      const sel = weighted(weights);
      answers[q.question_id] = { type: 'option', selected: sel.proposition, ...(sel.text_inputs && rand() < 0.7 ? { text: pick(['National standards committee on cereals', 'Consultation on front-of-pack labelling', 'Industry working group on fortification']) } : {}) };
    } else if (p.type === 'choices') {
      const n = p.propositions.length;
      const k = Math.max(0, Math.min(n, Math.round(maturity * n + (rand() - 0.5) * 2)));
      if (k === 0 && p.none_of_the_above) answers[q.question_id] = { type: 'choices', selected: [], none: true };
      else {
        const shuffled = [...p.propositions].sort(() => rand() - 0.5);
        answers[q.question_id] = { type: 'choices', selected: shuffled.slice(0, Math.max(k, p.none_of_the_above ? 0 : 1)).sort((a, b) => p.propositions.indexOf(a) - p.propositions.indexOf(b)) };
      }
    } else {
      answers[q.question_id] = { type: 'text', text: pick(['Reduced added sugar in our flagship porridge mix by a third in 2025.', 'Replaced palm oil with sunflower oil in two snack lines.', 'Cut salt in the seasoning blend from 2.1 g to 1.4 g per 100 g.', 'No change yet; planning a reformulation trial this year.']) };
    }
  }
  // dependency hygiene: drop answers to questions that would be hidden (keeps the data honest)
  for (const q of qs) {
    if (!q.dependency) continue;
    const parent = byId.get(q.dependency)!;
    const pa = answers[parent.question_id];
    let shown = false;
    if (pa?.type === 'option') shown = q.x_dependency_answer !== undefined ? pa.selected === q.x_dependency_answer : pa.selected.toLowerCase() !== 'no';
    if (pa?.type === 'choices') shown = !pa.none && pa.selected.length > 0;
    if (!shown || !answers[parent.question_id]) delete answers[q.question_id];
  }
  return answers;
}

function isoDate(y: number, m: number, d: number, h = 9, mi = 0) {
  return new Date(Date.UTC(y, m - 1, d, h, mi)).toISOString();
}

const assessments: Assessment[] = [];
let idx = 0;
const target = { KE: 42, TZ: 32 };
for (const country of ['KE', 'TZ'] as CountryCode[]) {
  const cs = pool.filter((c) => c.country === country);
  for (let i = 0; i < target[country]; i++) {
    // featured companies (first 3 of each country) get exactly one assessment; repeats go to the generated pool
    const c = i < cs.length ? cs[i] : cs[3 + ((i - cs.length) % (cs.length - 3))];
    const maturity = Math.min(1, Math.max(0, 0.15 + rand() * 0.85 + (c.size === 'large' ? 0.15 : c.size === 'micro' ? -0.15 : 0)));
    const month = 3 + Math.floor(rand() * 8); // Mar–Oct 2026
    const day = 1 + Math.floor(rand() * 27);
    const started = isoDate(2026, month, day, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60));
    const completed = new Date(new Date(started).getTime() + (12 + Math.floor(rand() * 40)) * 60000).toISOString();
    const answers = genAnswers(v10.questions, maturity);
    const lang = country === 'TZ' ? (rand() < 0.55 ? 'sw' : 'en') : rand() < 0.2 ? 'sw' : 'en';
    const a: Assessment = {
      id: `A-${String(++idx).padStart(3, '0')}`,
      company_id: c.id,
      company_name: c.name,
      country,
      company_size: c.size,
      lang,
      version_id: 'v1.0',
      started_at: started,
      completed_at: completed,
      answers,
      result: computeResult(v10, answers, completed),
      consent_investor_share: rand() < 0.45,
      plan_downloaded: rand() < 0.6,
    };
    assessments.push(a);
  }
}
// make the current user's own past assessment deterministic: Marketing = C
const me = assessments.find((a) => a.company_id === 'C-001')!;
me.answers = {
  '1.1': { type: 'option', selected: 'Yes, in draft' },
  '1.2': { type: 'choices', selected: ['Reformulation targets (sugar, salt, fat)', 'Affordable healthier product lines'] },
  '1.3': { type: 'option', selected: 'Some products' },
  '1.4': { type: 'text', text: 'Reduced added sugar in our flagship porridge mix from 18 g to 9 g per 100 g (trial batch, 2026).' },
  '2.1': { type: 'option', selected: 'Yes' },
  '2.2': { type: 'option', selected: 'Under 13' },
  '2.3': { type: 'choices', selected: ['Television and radio', 'Packaging and in-store promotion'] },
  '2.4': { type: 'option', selected: 'No' },
  '3.1': { type: 'option', selected: 'Yes, at some sites' },
  '3.2': { type: 'choices', selected: ['Healthier food or snacks at work', 'Nutrition education for employees'] },
  '4.1': { type: 'option', selected: 'Most products' },
  '4.2': { type: 'choices', selected: ['Clear allergen highlighting'] },
  '5.1': { type: 'option', selected: 'No' },
  '5.2': { type: 'choices', selected: ['Industry associations', 'Government ministries or agencies'] },
};
me.started_at = isoDate(2026, 9, 14, 10, 5);
me.completed_at = isoDate(2026, 9, 14, 10, 41);
me.lang = 'en';
me.consent_investor_share = true;
me.plan_downloaded = true;
me.result = computeResult(v10, me.answers, me.completed_at);

assessments.sort((a, b) => a.completed_at!.localeCompare(b.completed_at!));
assessments.forEach((a, i) => (a.id = `A-${String(i + 1).padStart(3, '0')}`));
writeFileSync(new URL('../src/data/assessments.json', import.meta.url), JSON.stringify(assessments, null, 1));

// ---- v1.1 draft: a few non-scoring edits already made by the editor ----
const v11: MethodologyVersion = JSON.parse(JSON.stringify(v10));
v11.id = 'v1.1';
v11.version = '1.1';
v11.status = 'draft';
v11.created_at = '2026-10-20T14:00:00Z';
v11.based_on = 'v1.0';
delete v11.published_at;
delete v11.published_by;
v11.comment = 'Draft: clarified wording of 1.3, added "Consumer groups" to 5.2.';
const q13 = v11.questions.find((q) => q.question_id === '1.3')!;
q13.question = 'What share of your products has been assessed with a recognised nutrient profiling model in the last three years?';
delete v11.translations.sw.questions!['1.3'];
const q52 = v11.questions.find((q) => q.question_id === '5.2')!;
if (q52.propositions.type === 'choices') {
  q52.propositions.propositions.push('Consumer groups');
  q52.propositions.count_score_map = [0, 1, 2, 3, 4, 5, 5];
}
v11.translations.sw.questions!['5.2'].propositions!.push('Vikundi vya walaji');
writeFileSync(new URL('../src/data/methodology-v1.1.json', import.meta.url), JSON.stringify(v11, null, 2));

// ---- sample file in the exact survey.json format (strips hub extensions) ----
const sample = v10.questions.map((q) => {
  const out: Record<string, unknown> = { topic: q.topic, question: q.question, question_id: q.question_id, info: q.info ?? '' };
  if (q.dependency) out.dependency = q.dependency;
  const r = q.recommandations;
  if (r?.type === 'fixed') out.recommandations = { type: 'fixed', recommandation: r.recommandation };
  else if (r?.type === 'scored') out.recommandations = { type: 'scored', recommandations: r.recommandations.map((e) => ({ score: e.score, recommandation: e.recommandation })) };
  else out.recommandations = null;
  out.propositions = q.propositions;
  return out;
});
// deliberately include one question whose scored recommendations miss a score, to exercise the import report
const broken = sample.find((q) => q.question_id === '2.4') as { recommandations: { recommandations: { score: number }[] } };
broken.recommandations.recommandations = broken.recommandations.recommandations.filter((e) => e.score !== 2.5);
writeFileSync(new URL('../public/sample-nutricheck-format.json', import.meta.url), JSON.stringify(sample, null, 2));

// ---- synthetic engagement analytics ----
const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const funnel = months.map((m, i) => {
  const started = 18 + i * 4 + Math.floor(rand() * 6);
  const completed = Math.round(started * (0.55 + rand() * 0.2));
  const downloaded = Math.round(completed * (0.5 + rand() * 0.25));
  return { month: m, started, completed, plan_downloaded: downloaded };
});
const dropoff = v10.questions.map((q, i) => {
  const base = q.question_id === '2.3' ? 0.19 : q.question_id === '1.4' ? 0.11 : q.propositions.type === 'choices' ? 0.05 : 0.03;
  return { question_id: q.question_id, topic: q.topic, reached: 240 - i * 9, dropped_share: Math.round((base + rand() * 0.02) * 1000) / 1000 };
});
const byCountryLang = [
  { country: 'KE', lang: 'en', started: 128, completed: 92, plan_downloaded: 61 },
  { country: 'KE', lang: 'sw', started: 31, completed: 19, plan_downloaded: 10 },
  { country: 'TZ', lang: 'en', started: 54, completed: 38, plan_downloaded: 24 },
  { country: 'TZ', lang: 'sw', started: 67, completed: 41, plan_downloaded: 22 },
];
writeFileSync(new URL('../src/data/analytics.json', import.meta.url), JSON.stringify({ note: 'Synthetic engagement analytics generated for the demo. No real users were tracked.', funnel, dropoff, byCountryLang, median_minutes_to_complete: 23 }, null, 2));

// summary
const grades = assessments.reduce<Record<string, number>>((acc, a) => ((acc[a.result!.grade] = (acc[a.result!.grade] ?? 0) + 1), acc), {});
console.log('assessments', assessments.length, grades, 'consented', assessments.filter((a) => a.consent_investor_share).length);
console.log('me', me.id, me.result!.grade, me.result!.topics.map((t) => `${t.topic}:${t.grade}`).join(' '));
