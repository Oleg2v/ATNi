import { useState } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { navigate, Link } from '../router/index.tsx';
import type { CompanySize, CountryCode, Lang } from '../types.ts';
import { Callout, Sim } from '../components/Bits.tsx';
import { withSampleAssessment } from '../lib/sample.ts';
import { useLive } from '../components/Live.tsx';
import { activeVersionFor } from '../lib/data.ts';

const SIZES: CompanySize[] = ['micro', 'small', 'medium', 'large'];

export function StartPage() {
  const t = useT();
  const lang = useLang();
  const { state, update, now } = useStore();
  const { toast } = useLive();
  const [country, setCountry] = useState<CountryCode>(state.profile?.country ?? 'KE');
  const [size, setSize] = useState<CompanySize>(state.profile?.size ?? 'medium');
  const [qLang, setQLang] = useState<Lang>(state.profile?.lang ?? state.lang);
  const countryDef = state.countries.find((c) => c.code === country)!;
  const planned = countryDef.status === 'planned';
  const version = activeVersionFor(state, country);

  const begin = () => {
    const startedAt = now();
    update((s) => ({
      ...s,
      lang: qLang,
      profile: { country, size, lang: qLang, company_id: 'C-001' },
      draft: s.draft && s.draft.version_id === version.id ? s.draft : { id: `D-${startedAt.slice(0, 10)}`, version_id: version.id, started_at: startedAt, answers: {}, pending_sync: [], updated_at: startedAt },
    }));
    navigate('/assess');
  };
  const loadSample = () => {
    update((s) => withSampleAssessment({ ...s, profile: { country, size, lang: qLang, company_id: 'C-001' } }, now()));
    toast(t.start.loadSample + ' ✓');
    navigate('/results');
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section aria-labelledby="start-h">
        <h1 id="start-h">{t.start.title}</h1>
        <p className="lead">{t.start.lead}</p>
        <p className="small muted">{t.start.whoFor}</p>
      </section>
      <div className="grid grid-2">
        <section className="card" aria-labelledby="setup-h">
          <h2 id="setup-h" style={{ marginTop: 0 }}>{t.nav.assess}</h2>
          <div className="field">
            <label htmlFor="country">{t.start.country}</label>
            <select id="country" value={country} onChange={(e) => setCountry(e.target.value as CountryCode)} aria-describedby={planned ? 'country-hint' : undefined}>
              {state.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {lang === 'sw' ? c.name_sw : c.name}{c.status === 'planned' ? ` (${t.start.planned})` : ''}
                </option>
              ))}
            </select>
            {planned && <p id="country-hint" className="hint">{t.start.plannedHint}</p>}
          </div>
          <fieldset>
            <legend>{t.start.size}</legend>
            {SIZES.map((s) => (
              <label key={s} className={`choice${size === s ? ' choice-selected' : ''}`}>
                <input type="radio" name="size" value={s} checked={size === s} onChange={() => setSize(s)} />
                <span>{t.start.sizes[s]}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t.start.language}</legend>
            <label className={`choice${qLang === 'en' ? ' choice-selected' : ''}`}>
              <input type="radio" name="qlang" value="en" checked={qLang === 'en'} onChange={() => setQLang('en')} />
              <span lang="en">English</span>
            </label>
            <label className={`choice${qLang === 'sw' ? ' choice-selected' : ''}`}>
              <input type="radio" name="qlang" value="sw" checked={qLang === 'sw'} onChange={() => setQLang('sw')} />
              <span lang="sw">Kiswahili <span className="tiny muted">({t.draftTranslation})</span></span>
            </label>
          </fieldset>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={begin} disabled={planned}>
              {state.draft && state.draft.version_id === version.id && Object.keys(state.draft.answers).length > 0 ? t.start.continue : t.start.begin}
            </button>
            <button type="button" className="btn" onClick={loadSample} disabled={planned}>{t.start.loadSample}</button>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>{t.common.version}: {version.id} · {t.survey.autosave}</p>
        </section>
        <section className="card" aria-labelledby="tools-h">
          <h2 id="tools-h" style={{ marginTop: 0 }}>{t.start.tools}</h2>
          <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
            <li><Link to="/assess"><strong>{t.nav.assess}</strong></Link> — {lang === 'sw' ? 'maswali 14 katika mada 5, mapendekezo na ramani ya njia' : '14 questions in 5 topics, recommendations and a phased roadmap'}</li>
            <li><Link to="/calculator"><strong>{t.nav.calculator}</strong></Link> — {lang === 'sw' ? 'linganisha mapishi mawili kwa g 100' : 'compare two recipes per 100 g'} <span className="tiny muted">({t.calc.disclaimer})</span></li>
            <li><Link to="/investors"><strong>{t.nav.investors}</strong></Link> — {lang === 'sw' ? 'matokeo ya jumla ya kampuni zilizotoa idhini' : 'aggregated results of consenting companies'}</li>
            <li><Link to="/policy"><strong>{t.nav.policy}</strong></Link> — {lang === 'sw' ? 'jumla kwa nchi na mada' : 'country and topic aggregates'}</li>
            <li><strong>Impact Investment Tool</strong> — <Sim>{lang === 'sw' ? 'haijaundwa katika dhana hii' : 'not prototyped in this concept'}</Sim></li>
          </ul>
          <Callout kind="info">
            <span className="small">{lang === 'sw' ? 'Majukumu ya wafanyakazi (mhariri wa maudhui, mhariri wa mbinu, mchambuzi, msimamizi) yanabadilishwa kwa kibadilishaji kilicho juu — kiingilio kimeigwa.' : 'Staff roles (content editor, methodology editor, analyst, admin) are switched with the selector at the top — login is simulated.'}</span>
          </Callout>
        </section>
      </div>
      <p className="small muted">{fmt(t.roadmap.basis, { n: version.roadmap_rules.length, v: version.id })} · <Link to="/evaluators">{t.nav.evaluators}</Link></p>
    </div>
  );
}
