import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt } from '../i18n/index.tsx';
import { useViews } from '../i18n/views.ts';
import { navigate } from '../router/index.tsx';
import type { Role } from '../types.ts';

interface TourStep {
  route: string;
  anchor: string;
  role?: Role;
}

/** Titles and texts live in i18n/views.ts (tour.steps), in the same order. */
const STEPS: TourStep[] = [
  { route: '/results', anchor: '[data-tour="grade"]' },
  { route: '/results', anchor: '[data-tour="why"]' },
  { route: '/roadmap', anchor: '[data-tour="roadmap"]' },
  { route: '/results', anchor: '[data-tour="assistant"]' },
  { route: '/admin/methodology/v1.1', anchor: '[data-tour="publish"]', role: 'methodology' },
  { route: '/results', anchor: '[data-tour="history"]', role: 'company' },
];

const POLL_MS = 100;
const POLL_MAX_MS = 3000;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/** Guided tour rendered globally. Runs while state.tour is a step index. */
export function Tour() {
  const { state, update } = useStore();
  const v = useViews().tour;
  const step = state.tour;
  const [status, setStatus] = useState<'searching' | 'found' | 'missing'>('searching');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const highlighted = useRef<Element | null>(null);

  const clearHighlight = useCallback(() => {
    highlighted.current?.classList.remove('tour-highlight');
    highlighted.current = null;
  }, []);

  const finish = useCallback(() => {
    clearHighlight();
    update((s) => ({ ...s, tour: null, tourDone: true, role: 'company' }));
    navigate('/evaluators');
    // the evaluators page may still be loading: look for the start button for up to 2 s
    let waited = 0;
    const timer = window.setInterval(() => {
      const btn = document.getElementById('start-tour');
      waited += POLL_MS;
      if (btn || waited >= 2000) {
        window.clearInterval(timer);
        btn?.focus();
      }
    }, POLL_MS);
  }, [clearHighlight, update]);

  /* navigate, set role, then poll for the anchor */
  useEffect(() => {
    if (step === null || step < 0 || step >= STEPS.length) return;
    const def = STEPS[step];
    setStatus('searching');
    clearHighlight();
    if (def.role && state.role !== def.role) update((s) => ({ ...s, role: def.role! }));
    const current = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
    if (current !== def.route) navigate(def.route);

    let waited = 0;
    let done = false;
    const focusHeading = () => window.setTimeout(() => headingRef.current?.focus(), 50);
    const timer = window.setInterval(() => {
      if (done) return;
      const el = document.querySelector(def.anchor);
      waited += POLL_MS;
      if (el) {
        done = true;
        window.clearInterval(timer);
        highlighted.current = el;
        el.classList.add('tour-highlight');
        try {
          el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
        } catch {
          /* ignore */
        }
        setStatus('found');
        focusHeading();
      } else if (waited >= POLL_MAX_MS) {
        done = true;
        window.clearInterval(timer);
        setStatus('missing');
        focusHeading();
      }
    }, POLL_MS);
    return () => {
      done = true;
      window.clearInterval(timer);
      clearHighlight();
    };
    // state.role is read once per step on purpose
  }, [step, clearHighlight, update]);

  /* Esc closes the tour */
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // an open native dialog owns Esc; let it close first
        if (document.querySelector('dialog[open]')) return;
        e.preventDefault();
        finish();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, finish]);

  /* clean up on unmount */
  useEffect(() => () => clearHighlight(), [clearHighlight]);

  if (step === null || step < 0 || step >= STEPS.length) return null;
  const text = v.steps[step];
  const last = step === STEPS.length - 1;
  const go = (n: number) => update((s) => ({ ...s, tour: n }));

  return (
    <div
      className="tour-box no-print"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      style={{ left: '50%', bottom: 16, transform: 'translateX(-50%)' }}
    >
      <p className="tiny muted" style={{ margin: '0 0 2px' }}>{v.tourLabel} · {fmt(v.stepOf, { n: step + 1, total: STEPS.length })}</p>
      <h2 id="tour-title" ref={headingRef} tabIndex={-1} style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
        {text.title}
      </h2>
      <p id="tour-text" className="small" style={{ margin: '0 0 10px' }}>
        {text.text}
        {status === 'missing' && <span className="muted"> {v.notOnScreen}</span>}
      </p>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => go(step - 1)} disabled={step === 0}>{v.back}</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => (last ? finish() : go(step + 1))}>{last ? v.finish : v.next}</button>
        <button type="button" className="btn btn-sm btn-link right" onClick={finish}>{v.skip}</button>
      </div>
    </div>
  );
}
