import type { HandoffTicket, KbDoc, Lang } from '../types.ts';

export function createTicket(seq: number, question: string, lang: Lang, context: string, now: string): HandoffTicket {
  return { id: `HQ-${String(seq).padStart(4, '0')}`, created_at: now, question, lang, context, status: 'open' };
}

export function answerTicket(t: HandoffTicket, answerText: string, now: string): HandoffTicket {
  return { ...t, status: 'answered', answer: answerText, answered_at: now };
}

/** Turn an answered ticket into a FAQ entry so the next person finds it directly. */
export function ticketToFaq(t: HandoffTicket, kbId: string): { ticket: HandoffTicket; doc: KbDoc } {
  const doc: KbDoc = {
    id: kbId,
    kind: 'faq',
    title: t.question.trim().replace(/\s+/g, ' ').slice(0, 120),
    body: (t.answer ?? '').trim(),
    tags: t.question
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .slice(0, 8),
    topic: 'general',
  };
  if (t.lang === 'sw') {
    doc.title_sw = doc.title;
    doc.body_sw = doc.body;
  }
  return { ticket: { ...t, status: 'published', kb_id: kbId }, doc };
}
