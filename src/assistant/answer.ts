import type { Answers, AssessmentResult, KbDoc, Lang, MethodologyVersion } from '../types.ts';
import { buildIndex, search, tokenize, type Bm25Index } from './bm25.ts';
import { classify, type Intent } from './classify.ts';
import { recommendationFor } from '../engine/recommendations.ts';

export interface Source {
  id: string;
  label: string;
  kind: 'kb' | 'methodology' | 'recommendation' | 'result';
}

export interface AssistantAnswer {
  status: 'answered' | 'declined' | 'not_found';
  intent: Intent;
  text: string;
  sources: Source[];
}

export interface ResultsContext {
  version: MethodologyVersion;
  result: AssessmentResult;
  answers: Answers;
}

/** Minimum BM25 score to consider a knowledge-base hit a real source. */
export const MIN_HIT_SCORE = 2.5;

export function indexKb(docs: KbDoc[]): Bm25Index {
  return buildIndex(docs.map((d) => ({ id: d.id, fields: [d.title, d.title_sw ?? '', d.body, d.body_sw ?? '', d.tags.join(' ')] })));
}

const T = {
  en: {
    declined: 'I can only explain your assessment results, the methodology and how to use this hub. I cannot give health, dietary or medical advice. If you like, I can pass your question to the hub team.',
    notFound: 'I could not find this in the published materials. Send it to the hub team?',
    noResult: 'You have not completed an assessment yet, so there is no score to explain. Here is what the methodology says:',
    topicIs: (topic: string, grade: string, score: number, max: number, pct: number) => `Your ${topic} result is ${grade}: ${score} of ${max} points (${pct} %).`,
    overallIs: (grade: string, score: number, max: number, pct: number) => `Your overall result is ${grade}: ${score} of ${max} points (${pct} %).`,
    band: (grade: string, lo: number, hi: number | null) => (hi === null ? `${grade} means ${lo} % or more.` : `${grade} covers ${lo} % to ${hi} %.`),
    lost: 'Points were lost on:',
    full: 'All applicable questions scored the maximum.',
    recs: 'Recommendations that apply:',
    seeAlso: 'See also:',
    answeredWith: (q: string, a: string, s: number, m: number) => `${q} — you answered "${a}" (${s} of ${m}).`,
  },
  sw: {
    declined: 'Naweza kuelezea tu matokeo ya tathmini yako, mbinu na jinsi ya kutumia jukwaa hili. Siwezi kutoa ushauri wa afya, lishe au kitabibu. Ukipenda, naweza kupeleka swali lako kwa timu ya jukwaa.',
    notFound: 'Sikupata hili katika nyaraka zilizochapishwa. Nilipeleke kwa timu ya jukwaa?',
    noResult: 'Bado hujakamilisha tathmini, kwa hivyo hakuna alama ya kuelezea. Hivi ndivyo mbinu inavyosema:',
    topicIs: (topic: string, grade: string, score: number, max: number, pct: number) => `Matokeo yako ya ${topic} ni ${grade}: alama ${score} kati ya ${max} (${pct} %).`,
    overallIs: (grade: string, score: number, max: number, pct: number) => `Matokeo yako ya jumla ni ${grade}: alama ${score} kati ya ${max} (${pct} %).`,
    band: (grade: string, lo: number, hi: number | null) => (hi === null ? `${grade} inamaanisha ${lo} % au zaidi.` : `${grade} inahusu ${lo} % hadi ${hi} %.`),
    lost: 'Alama zilipotea kwenye:',
    full: 'Maswali yote yaliyohusika yalipata alama za juu kabisa.',
    recs: 'Mapendekezo yanayohusika:',
    seeAlso: 'Tazama pia:',
    answeredWith: (q: string, a: string, s: number, m: number) => `${q} — ulijibu "${a}" (${s} kati ya ${m}).`,
  },
};

function gradeBand(version: MethodologyVersion, grade: string): { lo: number; hi: number | null } {
  const sorted = [...version.grading].sort((a, b) => b.min_percent - a.min_percent);
  const i = sorted.findIndex((g) => g.grade === grade);
  const lo = sorted[i]?.min_percent ?? 0;
  const hi = i > 0 ? Math.round((sorted[i - 1].min_percent - 0.1) * 10) / 10 : null;
  return { lo, hi };
}

function detectTopic(question: string, version: MethodologyVersion): string | null {
  const q = question.toLowerCase();
  for (const t of version.topics) {
    const names = [t.name.toLowerCase(), (version.translations.sw.topics?.[t.id] ?? '').toLowerCase()].filter(Boolean);
    const words = names.flatMap((n) => n.split(/\s+and\s+|\s+na\s+|\s+/)).filter((w) => w.length > 3);
    if (names.some((n) => q.includes(n)) || words.some((w) => q.includes(w))) return t.id;
  }
  if (/label/.test(q)) return version.topics.find((t) => /label/i.test(t.id))?.id ?? null;
  return null;
}

/**
 * Compose an answer strictly from (a) the respondent's own scores, (b) the published
 * recommendation library and (c) the knowledge base. Every answer carries sources;
 * when no source is found, the question is handed to a human instead of guessed.
 */
export function answer(question: string, lang: Lang, kb: KbDoc[], index: Bm25Index, ctx: ResultsContext | null): AssistantAnswer {
  const t = T[lang];
  const intent = classify(question);
  if (intent === 'health') return { status: 'declined', intent, text: t.declined, sources: [] };
  if (intent === 'empty') return { status: 'not_found', intent, text: t.notFound, sources: [] };
  const byId = new Map(kb.map((d) => [d.id, d]));
  const qTermCount = Math.max(1, new Set(tokenize(question)).size);
  // a hit is a usable source only if it is strong enough: either most query terms matched, or a high score
  const hits = search(index, question, 4).filter((h) => h.score >= MIN_HIT_SCORE && (h.matched.length / qTermCount >= 0.34 || h.score >= 6));
  const kbSources = (ids: string[]): Source[] => ids.map((id) => ({ id, label: `${byId.get(id)?.kind ?? 'kb'} ${id}`, kind: 'kb' as const }));
  const docText = (id: string) => {
    const d = byId.get(id)!;
    return lang === 'sw' && d.body_sw ? d.body_sw : d.body;
  };

  if (intent === 'results') {
    if (!ctx) {
      const ids = hits.slice(0, 2).map((h) => h.id);
      if (!ids.length) return { status: 'not_found', intent, text: t.notFound, sources: [] };
      return { status: 'answered', intent, text: `${t.noResult}\n\n${docText(ids[0])}`, sources: kbSources(ids) };
    }
    const { version, result, answers } = ctx;
    const topicId = detectTopic(question, version);
    const sources: Source[] = [{ id: `result:${result.version_id}`, label: `${lang === 'sw' ? 'matokeo' : 'result'} ${result.version_id} · ${result.computed_at.slice(0, 10)}`, kind: 'result' }];
    const lines: string[] = [];
    const qs = result.questions.filter((x) => x.applicable && (!topicId || x.topic === topicId));
    if (topicId) {
      const ts = result.topics.find((x) => x.topic === topicId)!;
      const tName = lang === 'sw' ? (version.translations.sw.topics?.[topicId] ?? topicId) : topicId;
      lines.push(t.topicIs(tName, ts.grade, ts.score, ts.max, ts.percent));
      const band = gradeBand(version, ts.grade);
      lines.push(t.band(ts.grade, band.lo, band.hi));
    } else {
      lines.push(t.overallIs(result.grade, result.total, result.max, result.percent));
      const band = gradeBand(version, result.grade);
      lines.push(t.band(result.grade, band.lo, band.hi));
    }
    const lost = qs.filter((x) => x.max > 0 && x.score < x.max);
    if (lost.length) {
      lines.push('', t.lost);
      for (const x of lost) {
        const q = version.questions.find((qq) => qq.question_id === x.question_id)!;
        const qText = lang === 'sw' ? (version.translations.sw.questions?.[q.question_id]?.question ?? q.question) : q.question;
        lines.push(`• ${t.answeredWith(qText, x.answer_label || '—', x.score, x.max)}`);
        sources.push({ id: `q:${q.question_id}`, label: `${lang === 'sw' ? 'mbinu' : 'methodology'} ${version.id} · Q${q.question_id}`, kind: 'methodology' });
      }
    } else lines.push(t.full);
    const recs: string[] = [];
    for (const x of lost) {
      const q = version.questions.find((qq) => qq.question_id === x.question_id)!;
      const r = recommendationFor(q, x.score);
      if (r.status === 'ok') {
        const text = lang === 'sw' ? (version.translations.sw.recommendations?.[r.id] ?? r.text) : r.text;
        recs.push(`• ${text}`);
        sources.push({ id: `rec:${r.id}`, label: `${lang === 'sw' ? 'pendekezo' : 'recommendation'} ${r.id}`, kind: 'recommendation' });
      }
    }
    if (recs.length) lines.push('', t.recs, ...recs);
    void answers;
    const kbIds = hits.filter((h) => !topicId || byId.get(h.id)?.topic === topicId || byId.get(h.id)?.topic === 'general').slice(0, 2).map((h) => h.id);
    if (kbIds.length) {
      lines.push('', t.seeAlso, ...kbIds.map((id) => `• ${lang === 'sw' ? (byId.get(id)?.title_sw ?? byId.get(id)?.title) : byId.get(id)?.title}`));
      sources.push(...kbSources(kbIds));
    }
    return { status: 'answered', intent, text: lines.join('\n'), sources };
  }

  // general question: knowledge base only
  if (!hits.length) return { status: 'not_found', intent, text: t.notFound, sources: [] };
  const top = hits[0];
  const rest = hits.slice(1, 3).map((h) => h.id);
  const lines = [docText(top.id)];
  if (rest.length) lines.push('', t.seeAlso, ...rest.map((id) => `• ${lang === 'sw' ? (byId.get(id)?.title_sw ?? byId.get(id)?.title) : byId.get(id)?.title}`));
  return { status: 'answered', intent, text: lines.join('\n'), sources: kbSources([top.id, ...rest]) };
}
