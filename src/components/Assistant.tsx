import { useEffect, useMemo, useRef, useState } from 'react';
import { can, useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { useRoute } from '../router/index.tsx';
import { answer, indexKb, type AssistantAnswer } from '../assistant/answer.ts';
import { createTicket } from '../assistant/handoff.ts';
import { useAssessments } from '../lib/useAssessments.ts';
import { latestOwnAssessment } from '../lib/sample.ts';
import { versionById } from '../lib/data.ts';
import { useLive } from './Live.tsx';
import { Sim } from './Bits.tsx';

interface Msg {
  id: number;
  who: 'user' | 'bot';
  text: string;
  reply?: AssistantAnswer;
  question?: string;
  ticketId?: string;
}

/** Global assistant drawer. Opens from the FAB or a 'ndh:assistant' event (Results page button). */
export function AssistantDrawer() {
  const t = useT();
  const lang = useLang();
  const { state, update, now } = useStore();
  const { announce, toast } = useLive();
  const { path } = useRoute();
  const { all } = useAssessments();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const seq = useRef(0);
  const opener = useRef<Element | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => indexKb(state.kb), [state.kb]);
  const latest = latestOwnAssessment(state, all.length ? all : null);
  const mayViewAnswers = can.viewAnswers(state.role);
  const ctx = useMemo(() => {
    if (!latest?.result || !mayViewAnswers) return null;
    const version = versionById(state, latest.version_id);
    return version ? { version, result: latest.result, answers: latest.answers } : null;
  }, [latest, state, mayViewAnswers]);

  useEffect(() => {
    const on = () => {
      opener.current = document.activeElement;
      setOpen(true);
    };
    window.addEventListener('ndh:assistant', on);
    return () => window.removeEventListener('ndh:assistant', on);
  }, []);
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [msgs]);

  const close = () => {
    setOpen(false);
    const o = opener.current as HTMLElement | null;
    window.setTimeout(() => {
      if (o && o.isConnected) o.focus();
      else document.querySelector<HTMLElement>('.fab')?.focus();
    }, 30);
  };

  /* keep Tab inside the drawer while it is open (aria-modal) */
  const drawerRef = useRef<HTMLDivElement>(null);
  const onTrapKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const nodes = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const reply = answer(question, lang, state.kb, index, ctx);
    setMsgs((m) => [...m, { id: ++seq.current, who: 'user', text: question }, { id: ++seq.current, who: 'bot', text: reply.text, reply, question }]);
    setInput('');
    announce(reply.text.split('\n')[0]);
  };

  const handoff = (m: Msg) => {
    const id = `HQ-${String(state.ticketSeq + 1).padStart(4, '0')}`;
    const where = path.startsWith('/results') ? 'results page' : path.startsWith('/roadmap') ? 'roadmap page' : path === '/' ? 'start page' : path.replace(/^\//, '') + ' page';
    const why = m.reply?.status === 'declined' ? 'declined by the assistant (health or dietary question)' : 'no published source found';
    const ticket = createTicket(state.ticketSeq + 1, m.question ?? '', lang, `Asked on the ${where}; ${why}.`, now());
    update((s) => ({ ...s, tickets: [...s.tickets, ticket], ticketSeq: s.ticketSeq + 1 }));
    setMsgs((ms) => ms.map((x) => (x.id === m.id ? { ...x, ticketId: id } : x)));
    toast(fmt(t.assistant.sent, { id }));
  };

  if (path.startsWith('/admin')) return null;
  // no floating button on the questionnaire (it would cover form controls) or before any result exists
  const showFab = !open && !path.startsWith('/assess') && (!!latest?.result || path.startsWith('/results') || path.startsWith('/calculator'));

  return (
    <>
      {showFab && (
        <button type="button" className="btn btn-primary fab no-print" onClick={() => { opener.current = document.activeElement; setOpen(true); }} aria-haspopup="dialog">
          {t.assistant.open}
        </button>
      )}
      {open && (
        <div className="drawer no-print" role="dialog" aria-modal="true" aria-labelledby="asst-h" ref={drawerRef} onKeyDown={onTrapKey}>
          <div className="drawer-head">
            <h2 id="asst-h" style={{ margin: 0, fontSize: '1.1rem' }}>{t.assistant.title} <Sim>{lang === 'sw' ? 'maandishi yameunganishwa kutoka vyanzo' : 'text assembled from sources'}</Sim></h2>
            <button type="button" className="btn btn-sm" onClick={close} aria-label={t.assistant.close}>✕</button>
          </div>
          <div className="drawer-body" ref={bodyRef}>
            {!ctx && <p className="hint">{!mayViewAnswers ? (lang === 'sw' ? 'Jukumu hili halioni majibu ya kampuni; msaidizi anajibu kutoka kwa nyaraka zilizochapishwa pekee.' : 'This role does not see company answers; the assistant answers from the published materials only.') : t.assistant.noContext}</p>}
            {msgs.length === 0 && (
              <div>
                <p className="small muted">{t.assistant.placeholder}</p>
                <div className="chips">
                  {t.assistant.suggestions.map((s) => (
                    <button key={s} type="button" className="btn btn-sm" onClick={() => ask(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            <div role="log" aria-live="polite" aria-relevant="additions">
              {msgs.map((m) => (
                <div key={m.id} className={`msg msg-${m.who}`}>
                  {m.text}
                  {m.reply && (
                    <div style={{ marginTop: 8 }}>
                      {m.reply.sources.length > 0 && (
                        <div className="chips" aria-label={t.assistant.sources}>
                          <span className="tiny muted">{t.assistant.sources}:</span>
                          {m.reply.sources.slice(0, 8).map((s) => (
                            <span key={s.id} className="chip chip-accent" title={s.id}>{s.label}</span>
                          ))}
                          {m.reply.sources.length > 8 && <span className="chip">+{m.reply.sources.length - 8}</span>}
                        </div>
                      )}
                      {(m.reply.status === 'not_found' || m.reply.status === 'declined') && !m.ticketId && (
                        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => handoff(m)}>
                          {m.reply.status === 'declined' ? t.assistant.declinedHandoff : t.assistant.sendToTeam} <Sim />
                        </button>
                      )}
                      {m.ticketId && <p className="tiny" style={{ margin: '6px 0 0' }}>{fmt(t.assistant.sent, { id: m.ticketId })}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="drawer-foot">
            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="row" style={{ flexWrap: 'nowrap' }}>
              <label htmlFor="asst-input" className="sr-only">{t.assistant.placeholder}</label>
              <input id="asst-input" ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.assistant.placeholder} autoComplete="off" />
              <button type="submit" className="btn btn-primary">{t.assistant.send}</button>
            </form>
            <p className="tiny muted" style={{ margin: '8px 0 0' }}>{t.assistant.footer}</p>
          </div>
        </div>
      )}
    </>
  );
}
