import { useStore } from '../store/index.tsx';
import { useT } from '../i18n/index.tsx';
import { useViews } from '../i18n/views.ts';
import { Callout } from '../components/Bits.tsx';

const DONE: { check: string; detail: string }[] = [
  { check: 'Automated scan with axe-core (Playwright)', detail: 'Last run 5 Nov 2026 on 22 routes at 1280 px with the rule sets wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice: 0 violations. Automated tools find only part of the barriers; a clean scan is not a conformance claim.' },
  { check: 'Keyboard-only walkthrough of the key scenarios', detail: 'Start → questionnaire → results → roadmap; methodology edit and publish; assistant and hand-off; account actions. Every control is reachable in a sensible order and nothing depends on hover.' },
  { check: 'Colour contrast of the palette', detail: 'Text and interactive colours were computed against their backgrounds at ≥ 4.5:1; grade colours are always paired with the letter and never carry meaning alone.' },
  { check: 'Reduced motion respected', detail: 'With prefers-reduced-motion the one flash animation is disabled and scrolling is instant; no other animations exist.' },
  { check: 'Visible focus', detail: 'A 3 px high-contrast focus ring, distinct from the accent colour, on every focusable element.' },
  { check: 'Skip link and landmarks', detail: 'Skip link to the main content; header, navigation, main and footer landmarks; one h1 per page.' },
  { check: 'Live regions for status', detail: 'Autosave, sync, consent changes, role changes and confirmations are announced through aria-live regions; a visual toast mirrors them.' },
  { check: 'Dialogs', detail: 'Native dialog element with Esc to close and focus return to the opening control; the tour box is non-modal and also closes with Esc.' },
  { check: 'Target size', detail: 'Buttons are at least 40 × 40 px, small buttons 32 px, links in the navigation at least 24 px tall.' },
  { check: 'Language attribute', detail: 'The html lang attribute switches with the UI language; passages in the other language carry their own lang attribute.' },
  { check: 'Tables and charts', detail: 'Tables have captions or accessible names and header scopes; every bar chart has a text alternative and a "show as table" toggle; Lite mode shows tables only.' },
  { check: 'Forms', detail: 'Every input has a label or an accessible name, groups use fieldset and legend, validation errors are listed with links and marked with aria-invalid.' },
];

const NOT_DONE = [
  'No testing with users of assistive technology.',
  'No formal audit by an accessibility specialist and no conformance claim.',
  'No screen-reader testing is claimed; only the markup patterns that support screen readers were applied and checked automatically.',
  'Swahili content has not been reviewed by a native speaker, so pronunciation and reading order in that language are unverified.',
  'Print and PDF output was checked visually only.',
];

export function AccessibilityPage() {
  const t = useT();
  const v = useViews().a11y;
  const { state } = useStore();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <section aria-labelledby="a11y-h">
        <div className="page-head">
          <h1 id="a11y-h">{v.title} <span className="muted" style={{ fontWeight: 400 }}>({t.concept})</span></h1>
        </div>
        {state.lang === 'sw' && <p className="hint" lang="en">{v.note}</p>}
        <p className="lead" lang="en">
          The target for this concept is WCAG 2.2 level AA. This statement lists what was actually checked and what was not. It is not a conformance claim.
        </p>
      </section>

      <section className="card" aria-labelledby="a11y-done-h" lang="en">
        <h2 id="a11y-done-h">Checks performed in this concept</h2>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Accessibility checks performed</caption>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">How / result</th>
              </tr>
            </thead>
            <tbody>
              {DONE.map((d) => (
                <tr key={d.check}>
                  <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>{d.check}</th>
                  <td>{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="a11y-not-h" lang="en">
        <h2 id="a11y-not-h">Not done</h2>
        <ul className="small stack" style={{ marginBottom: 0 }}>
          {NOT_DONE.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <section aria-labelledby="a11y-contact-h" lang="en">
        <h2 id="a11y-contact-h">Feedback</h2>
        <Callout kind="info">
          <span className="small">Accessibility feedback on this concept goes to the proposal team through the RFP correspondence channel. There is no feedback form in the prototype, and nothing on this page sends data anywhere.</span>
        </Callout>
        <p className="tiny muted">Statement for prototype v0.1, written by the prototype team. In production this page would name the organisation, the date of the last review and the method used.</p>
      </section>
    </div>
  );
}
