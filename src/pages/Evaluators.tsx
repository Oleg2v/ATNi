import { useState } from 'react';
import { useStore } from '../store/index.tsx';
import { useT } from '../i18n/index.tsx';
import { useViews } from '../i18n/views.ts';
import { Link, navigate } from '../router/index.tsx';
import { useAssessments } from '../lib/useAssessments.ts';
import { latestOwnAssessment, withSampleAssessment } from '../lib/sample.ts';
import { Callout, Sim } from '../components/Bits.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { useLive } from '../components/Live.tsx';

interface Req {
  quote: string;
  where: { to?: string; label: string }[];
  note?: string;
}

const REQUIREMENTS: Req[] = [
  { quote: 'NBM Self-Assessment Tool … provides recommendations based on survey responses', where: [{ to: '/assess', label: 'Self-assessment' }, { to: '/results', label: 'Results' }, { to: '/roadmap', label: 'Roadmap' }] },
  { quote: 'Nutrition Score Calculator', where: [{ to: '/calculator', label: 'Calculator' }] },
  { quote: 'Investor Insights Hub', where: [{ to: '/investors', label: 'Investors' }] },
  { quote: 'Policy Insights Hub', where: [{ to: '/policy', label: 'Policy' }] },
  { quote: 'Impact Investment Tool', where: [{ label: 'Not prototyped' }], note: 'Not prototyped; a placeholder and the intended approach are described in the proposal.' },
  { quote: 'multilingual (English, Swahili)', where: [{ label: 'EN / SW switch in the header' }, { to: '/admin/translations', label: 'Admin › Translations' }] },
  { quote: 'login-protected and public-facing areas … role-based user management system for internal staff', where: [{ label: 'Demo role switcher in the header (login simulated)' }, { to: '/admin/users', label: 'Admin › Users' }] },
  { quote: 'routine content management, user management, and configuration updates without requiring software development expertise', where: [{ to: '/admin/methodology/v1.1', label: 'Admin › Methodology v1.1' }, { to: '/admin/countries', label: 'Admin › Countries' }, { to: '/admin/import', label: 'Admin › Import' }] },
  { quote: 'tracking user engagement analytics', where: [{ to: '/admin/analytics', label: 'Admin › Analytics' }] },
  { quote: 'translating the recommendations library into a phased roadmap … rules and LLM-based templated generation', where: [{ to: '/roadmap', label: 'Roadmap (rules)' }, { label: 'Assistant footer note (LLM wording is simulated)' }] },
  { quote: 'WCAG 2.1/2.2 level AA', where: [{ to: '/accessibility', label: 'Accessibility statement' }] },
  { quote: 'data … stored securely (in the EU)', where: [{ to: '/admin/settings', label: 'Admin › Settings (hosting note)' }] },
  { quote: 'compatible with current tools (Power BI dashboards)', where: [{ to: '/admin', label: 'Admin' }, { to: '/investors', label: 'Investors' }, { to: '/policy', label: 'Policy' }], note: 'Placeholders only, no external frame.' },
  { quote: 'designed for scaling across contexts / other countries and languages', where: [{ to: '/admin/countries', label: 'Admin › Countries (add-country wizard)' }] },
  { quote: 'AI Policy: transparency, human oversight, bias, sustainability', where: [{ label: 'Assistant shows its sources' }, { to: '/admin/tickets', label: 'Admin › Hand-off queue' }, { to: '/admin/settings', label: 'Admin › Settings' }] },
];

const WORKS = [
  'Scoring engine (survey.json rules: option, choices with count maps, text scores 0, maximum counts only applicable questions)',
  'Conditional logic between questions (dependency and exact-answer dependency)',
  'Offline save on this device and sync counter when the connection "returns"',
  'Roadmap rules: deterministic steps in now / next / later, each with the triggering answer',
  'Methodology editor with validation (orphaned scores, missing recommendations) and publish gate',
  'Impact preview: re-scoring stored assessments against a draft version',
  'Importer: parsing of a NutriCheck-style survey.json into the hub format',
  'Assistant retrieval (BM25 over methodology and knowledge base), refusal rules, hand-off tickets',
  'Nutrition score calculator algorithm (general foods, 2023 algorithm) with what-if sliders',
  'Persistence in localStorage, reset, audit journal',
  'Language switch (English, draft Swahili) including questionnaire content',
];

const SIMULATED = [
  'Login and roles: a demo role switcher instead of authentication',
  'Network and offline state: a toggle, not real connectivity detection',
  'E-mail notifications: shown as text, nothing is sent',
  'PDF export: the browser print dialog',
  'The assistant’s wording: assembled from retrieved sources, no language model is called',
  'Power BI embed: dashed placeholder, no external frame',
  'Analytics numbers: a synthetic dataset',
  'Data deletion and account management: local state only, no server',
  'Users in the admin area: a synthetic list',
];

const LIMITATIONS = [
  'No backend: every change lives in this browser’s localStorage and is lost when the demo is reset or storage is cleared.',
  'Single-browser state: two people cannot see each other’s edits; the "publish" flow has no server-side review.',
  'Swahili strings are drafts by the prototype team and need native review.',
  'The calculator covers general foods only; beverages, fats, cheese and red meat are not modelled.',
  'The Impact Investment Tool is not prototyped.',
  'All 74 seeded assessments, companies, tickets and analytics are synthetic and do not describe any real company or market.',
];

const SOURCES = [
  'The RFP page "Digital Product Design & Development of the MarketFit Nutrition Data Hub" (requirements quoted in the table above).',
  'The description of the survey.json format (topic, question, question_id, info, dependency, propositions, recommandations) used for field compatibility of the importer; no content was reused.',
  'Nutri-Score Q&A, Santé publique France, 17 March 2025 (general-foods algorithm and tables used by the calculator).',
  'AI Ethics Policy, August 2026 (transparency, human oversight, bias and sustainability principles reflected in the assistant and the hand-off queue).',
];

export function EvaluatorsPage() {
  const t = useT();
  const v = useViews().evaluators;
  const { state, update, reset, now } = useStore();
  const { all } = useAssessments();
  const { toast } = useLive();
  const [confirmReset, setConfirmReset] = useState(false);

  const startTour = () => {
    update((s) => {
      const base = latestOwnAssessment(s, all) ? s : withSampleAssessment(s, now());
      return { ...base, role: 'company', tour: 0 };
    });
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section aria-labelledby="ev-h">
        <div className="page-head">
          <h1 id="ev-h">{v.title} <span className="muted" style={{ fontWeight: 400 }}>({t.concept})</span></h1>
        </div>
        {state.lang === 'sw' && <p className="hint" lang="en">{v.note}</p>}
        <p className="lead" lang="en">
          This is an unofficial concept prototype by Kikkey, built for the RFP “Digital Product Design &amp; Development of the MarketFit Nutrition Data Hub”. Every number, company, answer and ticket in it is synthetic. Nothing on these pages is an output of ATNi, and no ATNi content, branding or data is used.
        </p>
        <div className="row">
          <button type="button" id="start-tour" className="btn btn-primary" style={{ minHeight: 48, fontSize: '1.05rem', padding: '10px 20px' }} onClick={startTour}>
            Start the 2-minute guided tour
          </button>
          {state.tourDone && <span className="chip chip-ok">Tour completed</span>}
        </div>
        <p className="hint">The tour creates a sample assessment if none exists, then walks through result, explanation, roadmap, assistant, publish gate and immutability of past results. Esc closes it at any time.</p>
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="ev-works-h">
          <h2 id="ev-works-h">What really works</h2>
          <ul className="small stack" style={{ marginBottom: 0 }}>
            {WORKS.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
        <section className="card" aria-labelledby="ev-sim-h">
          <h2 id="ev-sim-h">What is simulated <Sim /></h2>
          <ul className="small stack" style={{ marginBottom: 0 }}>
            {SIMULATED.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="ev-req-h">
        <h2 id="ev-req-h">RFP requirement → where in the prototype</h2>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">RFP requirements mapped to prototype pages</caption>
            <thead>
              <tr>
                <th scope="col">Requirement (short quote)</th>
                <th scope="col">Where in the prototype</th>
              </tr>
            </thead>
            <tbody>
              {REQUIREMENTS.map((r) => (
                <tr key={r.quote}>
                  <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>“{r.quote}”</th>
                  <td>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {r.where.map((w) => (
                        <li key={w.label}>{w.to ? <Link to={w.to}>{w.label}</Link> : w.label}</li>
                      ))}
                    </ul>
                    {r.note && <div className="tiny muted">{r.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="ev-lim-h">
          <h2 id="ev-lim-h">Known limitations</h2>
          <ul className="small stack" style={{ marginBottom: 0 }}>
            {LIMITATIONS.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
        <section className="card" aria-labelledby="ev-reset-h">
          <h2 id="ev-reset-h">How to reset</h2>
          <p className="small">Reset returns every page to the original synthetic set: answers, drafts, tickets, methodology edits, settings and the tour state. The same button sits in the header.</p>
          <button type="button" className="btn" onClick={() => setConfirmReset(true)}>{t.resetDemo}</button>
          <Callout kind="info">
            <span className="small">Staff pages (Admin) appear after choosing a staff role in the header. Audit entries record which demo role made a change.</span>
          </Callout>
        </section>
      </div>

      <section className="card" aria-labelledby="ev-src-h">
        <h2 id="ev-src-h">Primary sources used</h2>
        <ul className="small stack" style={{ marginBottom: 0 }}>
          {SOURCES.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="tiny muted" style={{ marginTop: 10 }}>No external requests are made from this prototype; sources are listed as plain text.</p>
      </section>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title={t.resetDemo}>
        <p>{t.resetConfirm}</p>
        <div className="row">
          <button type="button" className="btn btn-primary" data-autofocus onClick={() => { reset(); setConfirmReset(false); navigate('/'); toast(t.resetDemo + ' ✓'); }}>{t.resetDemo}</button>
          <button type="button" className="btn" onClick={() => setConfirmReset(false)}>{t.common.cancel}</button>
        </div>
      </Dialog>
    </div>
  );
}
