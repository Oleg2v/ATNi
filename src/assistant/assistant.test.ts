import { describe, expect, it } from 'vitest';
import kbJson from '../data/kb.json';
import v10 from '../data/methodology-v1.0.json';
import assessmentsJson from '../data/assessments.json';
import type { Assessment, KbDoc, MethodologyVersion } from '../types.ts';
import { answer, indexKb } from './answer.ts';
import { classify } from './classify.ts';
import { search, tokenize } from './bm25.ts';
import { answerTicket, createTicket, ticketToFaq } from './handoff.ts';
import { computeResult } from '../engine/score.ts';

const KB = kbJson as KbDoc[];
const V10 = v10 as unknown as MethodologyVersion;
const index = indexKb(KB);
const me = (assessmentsJson as unknown as Assessment[]).find((a) => a.company_id === 'C-001')!;
const ctx = { version: V10, result: computeResult(V10, me.answers, me.completed_at!), answers: me.answers };

describe('classify', () => {
  it('detects health questions in English and Swahili', () => {
    expect(classify('Is this porridge good for my diabetes?')).toBe('health');
    expect(classify('How much sugar should I eat per day?')).toBe('health');
    expect(classify('Je, nile uji huu nikiwa na kisukari?')).toBe('health');
  });
  it('detects results questions', () => {
    expect(classify('Why did I get a C on marketing?')).toBe('results');
    expect(classify('Kwa nini nimepata C kwenye masoko?')).toBe('results');
  });
  it('everything else is general', () => {
    expect(classify('Can I download the roadmap as PDF?')).toBe('general');
    expect(classify('What is the weather in Nairobi?')).toBe('general');
  });
});

describe('bm25', () => {
  it('tokenizes with light stemming', () => {
    expect(tokenize('Recommendations are matched to answers')).toEqual(['recommendation', 'match', 'answer']);
  });
  it('finds the offline FAQ', () => {
    const hits = search(index, 'what happens when I lose internet connection');
    expect(hits[0].id).toBe('kb-11');
  });
  it('works for Swahili queries', () => {
    const hits = search(index, 'ninawezaje kupakua ramani ya njia PDF');
    expect(hits[0].id).toBe('kb-14');
  });
});

describe('answer', () => {
  it('explains the Marketing C from the scores with sources', () => {
    const a = answer('Why did I get a C on marketing?', 'en', KB, index, ctx);
    expect(a.status).toBe('answered');
    expect(a.text).toContain('Marketing result is C');
    expect(a.text).toContain('9.5 of 20');
    expect(a.text).toContain('Under 13');
    expect(a.sources.some((s) => s.kind === 'result')).toBe(true);
    expect(a.sources.some((s) => s.kind === 'methodology' && s.id === 'q:2.4')).toBe(true);
    expect(a.sources.some((s) => s.kind === 'recommendation' && s.id === 'rec:R-14')).toBe(true);
  });
  it('answers in Swahili', () => {
    const a = answer('Kwa nini nimepata C kwenye masoko?', 'sw', KB, index, ctx);
    expect(a.status).toBe('answered');
    expect(a.text).toContain('Matokeo yako ya Masoko ni C');
  });
  it('declines health questions politely and offers handoff', () => {
    const a = answer('Should my child eat this cereal every day?', 'en', KB, index, ctx);
    expect(a.status).toBe('declined');
    expect(a.sources).toEqual([]);
    expect(a.text).toMatch(/cannot give health/);
  });
  it('general questions are answered from the knowledge base with kb sources', () => {
    const a = answer('How do I download the roadmap as a PDF?', 'en', KB, index, ctx);
    expect(a.status).toBe('answered');
    expect(a.sources[0]).toMatchObject({ id: 'kb-14', kind: 'kb' });
  });
  it('unknown questions are not answered: handed to a human', () => {
    const a = answer('What is the shipping tariff for containers from Mombasa to Rotterdam?', 'en', KB, index, ctx);
    expect(a.status).toBe('not_found');
    expect(a.sources).toEqual([]);
    expect(a.text).toContain('Send it to the hub team?');
  });
  it('every answered reply has at least one source', () => {
    const qs = ['why C in marketing', 'what do the letters mean', 'who can see my answers', 'is the calculator official', 'how long does it take', 'why was a question hidden'];
    for (const q of qs) {
      const a = answer(q, 'en', KB, index, ctx);
      expect(a.status, q).toBe('answered');
      expect(a.sources.length, q).toBeGreaterThan(0);
    }
  });
});

describe('handoff', () => {
  it('creates a numbered ticket and turns the answer into a FAQ entry', () => {
    const t = createTicket(7, 'Can two users share one company account?', 'en', 'results page', '2026-11-05T10:00:00Z');
    expect(t.id).toBe('HQ-0007');
    const a = answerTicket(t, 'Yes, an admin can invite colleagues to the same company.', '2026-11-05T11:00:00Z');
    const { ticket, doc } = ticketToFaq(a, 'kb-36');
    expect(ticket.status).toBe('published');
    expect(doc.kind).toBe('faq');
    expect(doc.body).toContain('invite colleagues');
    const idx2 = indexKb([...KB, doc]);
    expect(search(idx2, 'share one company account between two users')[0].id).toBe('kb-36');
  });
});
