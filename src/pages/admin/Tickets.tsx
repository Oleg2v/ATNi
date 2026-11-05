import { useState } from 'react';
import { can, useStore } from '../../store/index.tsx';
import { useLang, useT } from '../../i18n/index.tsx';
import { useLive } from '../../components/Live.tsx';
import { Callout } from '../../components/Bits.tsx';
import { fmtDateTime } from '../../lib/data.ts';
import { answerTicket, ticketToFaq } from '../../assistant/index.ts';
import { PageHead, StatusChip } from './shared.tsx';

function nextKbId(ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    const m = /^kb-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `kb-${String(max + 1).padStart(2, '0')}`;
}

/** Staff side of the assistant hand-off: questions the assistant declined or could not source. */
export function TicketsPage() {
  const { state, update, log, now } = useStore();
  const t = useT();
  const lang = useLang();
  const { toast } = useLive();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const canAnswer = can.answerTickets(state.role);
  const order = { open: 0, answered: 1, published: 2 };
  const tickets = [...state.tickets].sort((a, b) => order[a.status] - order[b.status] || b.created_at.localeCompare(a.created_at));

  const save = (id: string) => {
    const text = (drafts[id] ?? '').trim();
    if (!text) {
      setErrors((e) => ({ ...e, [id]: true }));
      document.getElementById(`ticket-${id}-answer`)?.focus();
      return;
    }
    const nowIso = now();
    update((s) => ({ ...s, tickets: s.tickets.map((x) => (x.id === id ? answerTicket(x, text, nowIso) : x)) }));
    log('answer-ticket', id, `Answer saved (${text.length} characters).`);
    setErrors((e) => ({ ...e, [id]: false }));
    toast(`Answer saved for ${id}`);
  };
  const publish = (id: string) => {
    const kbId = nextKbId(state.kb.map((d) => d.id));
    update((s) => {
      const tk = s.tickets.find((x) => x.id === id);
      if (!tk || !tk.answer) return s;
      const { ticket, doc } = ticketToFaq(tk, kbId);
      return { ...s, tickets: s.tickets.map((x) => (x.id === id ? ticket : x)), kb: [...s.kb, doc] };
    });
    log('publish-faq', kbId, `From ticket ${id}: the assistant can now cite this answer.`);
    toast(`Published as FAQ ${kbId}`);
  };

  return (
    <section>
      <PageHead title="Assistant hand-off queue" lead="Questions the assistant passed to a person. Answers can be published as FAQ entries so the assistant cites them next time instead of escalating again." />
      {!canAnswer && <Callout kind="info">Your role can read the queue. Answering and publishing is done by content editors or administrators.</Callout>}
      {tickets.length === 0 && <p className="muted">No tickets.</p>}
      <div className="stack">
        {tickets.map((tk) => (
          <article key={tk.id} className="card" aria-labelledby={`ticket-${tk.id}-h`}>
            <div className="row row-between">
              <h2 id={`ticket-${tk.id}-h`} style={{ margin: 0 }}><span className="mono">{tk.id}</span></h2>
              <div className="chips">
                <StatusChip status={tk.status} />
                <span className="chip">{tk.lang}</span>
                <span className="chip">context: {tk.context}</span>
              </div>
            </div>
            <p className="small muted" style={{ margin: '4px 0 8px' }}>{t.common.date}: {fmtDateTime(tk.created_at, lang)}</p>
            <p lang={tk.lang} style={{ fontSize: '1.05rem' }}>“{tk.question}”</p>
            {tk.status === 'open' && canAnswer && (
              <div className="field">
                <label htmlFor={`ticket-${tk.id}-answer`}>Answer (in the user’s language: {tk.lang})</label>
                <textarea id={`ticket-${tk.id}-answer`} lang={tk.lang} value={drafts[tk.id] ?? ''} aria-invalid={errors[tk.id] || undefined} aria-describedby={errors[tk.id] ? `ticket-${tk.id}-err` : undefined} onChange={(e) => setDrafts((d) => ({ ...d, [tk.id]: e.target.value }))} />
                {errors[tk.id] && <p className="error-text" id={`ticket-${tk.id}-err`}>Please write an answer before saving.</p>}
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-primary" onClick={() => save(tk.id)}>Save answer</button>
                  <span className="small muted">The company sees the answer in “My account”. No e-mail is sent in this concept.</span>
                </div>
              </div>
            )}
            {tk.answer && (
              <div className="panel">
                <strong className="small">Answer</strong> <span className="small muted">· {fmtDateTime(tk.answered_at, lang)}</span>
                <p lang={tk.lang} style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{tk.answer}</p>
              </div>
            )}
            {tk.status === 'answered' && canAnswer && (
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => publish(tk.id)}>Publish as FAQ</button>
                <span className="small muted">Adds a knowledge-base entry the assistant can cite.</span>
              </div>
            )}
            {tk.status === 'published' && <p className="small muted" style={{ marginTop: 8 }}>Published as knowledge-base entry <span className="mono">{tk.kb_id}</span>.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
