import { useState } from 'react';
import { Link } from '../../router/index.tsx';
import { useStore } from '../../store/index.tsx';
import { useT } from '../../i18n/index.tsx';
import { useLive } from '../../components/Live.tsx';
import { Callout } from '../../components/Bits.tsx';
import type { CountryCode, Lang, MethodologyVersion } from '../../types.ts';
import { applyPublish, cloneAsDraft, PageHead, StatusChip, useRoleLabel } from './shared.tsx';

const STEPS = ['Country', 'Languages', 'Methodology', 'Review', 'Activate'];

/** Countries and the add-a-country wizard. */
export function CountriesPage() {
  const { state, update, log, now } = useStore();
  const t = useT();
  const { toast, announce } = useLive();
  const roleLabel = useRoleLabel();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [code, setCode] = useState<CountryCode | ''>('');
  const [sw, setSw] = useState(false);
  const [other, setOther] = useState('');
  const [srcId, setSrcId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const planned = state.countries.filter((c) => c.status === 'planned');
  const published = state.versions.filter((v) => v.status === 'published');
  const country = state.countries.find((c) => c.code === code);
  const src = state.versions.find((v) => v.id === srcId);
  const draftId = src && code ? `${src.id}-${code}` : '';
  const exists = !!draftId && state.versions.some((v) => v.id === draftId);
  const languages: Lang[] = sw ? ['en', 'sw'] : ['en'];

  const reset = () => {
    setStep(0);
    setCode('');
    setSw(false);
    setOther('');
    setSrcId('');
    setError(null);
  };
  const next = () => {
    setError(null);
    if (step === 0 && !code) return setError('Please choose a country.');
    if (step === 2 && (!src || exists)) return setError(exists ? `${draftId} already exists; open it from the versions list.` : 'Please choose a source version.');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    announce(`Step ${step + 2} of ${STEPS.length}: ${STEPS[step + 1]}`);
  };

  const buildDraft = (): MethodologyVersion | null => {
    if (!src || !code || !country) return null;
    const comment = `Country copy of ${src.id} for ${country.name}. Languages: ${[...languages, other.trim()].filter(Boolean).join(', ')}. National thresholds to be provided by the programme team.`;
    return { ...cloneAsDraft(src, draftId, now(), comment, code), national_thresholds: 'to be provided' };
  };
  const finish = (publish: boolean) => {
    const draft = buildDraft();
    if (!draft || !code || !country) return;
    const nowIso = now();
    const langs = languages;
    const otherNote = other.trim();
    if (publish) {
      const withDraft = { ...state, versions: [...state.versions, draft] };
      const { snapshot } = applyPublish(withDraft, draft.id, nowIso, roleLabel);
      update((s) => {
        const s1 = { ...s, versions: [...s.versions, draft] };
        const s2 = applyPublish(s1, draft.id, nowIso, roleLabel).state;
        return { ...s2, countries: s2.countries.map((c) => (c.code === code ? { ...c, status: 'active' as const, languages: langs, methodology_version_id: draft.id } : c)) };
      });
      log('add-country', code, `${country.name} activated with ${draft.id} (copied from ${src!.id}); languages ${langs.join(', ')}${otherNote ? ` + ${otherNote}` : ''}; national thresholds pending.`);
      log('publish', draft.id, `Published for ${country.name} by the add-country wizard. National thresholds: to be provided.`, snapshot);
      toast(`${country.name} is active on ${draft.id}`);
    } else {
      update((s) => ({ ...s, versions: [...s.versions, draft], countries: s.countries.map((c) => (c.code === code ? { ...c, languages: langs } : c)) }));
      log('add-country', code, `${country.name}: draft ${draft.id} saved (copied from ${src!.id}); country stays planned until published.`);
      toast(`Draft ${draft.id} saved for ${country.name}`);
    }
    setOpen(false);
    reset();
  };

  return (
    <section>
      <PageHead title="Countries" lead="Each active country points to a published methodology version: a country-specific copy if it has one, otherwise the shared version." right={<button type="button" className="btn btn-primary" disabled={open || planned.length === 0} onClick={() => { reset(); setOpen(true); }}>Add a country</button>} />
      <div className="table-wrap card" style={{ padding: 0, marginBottom: 16 }}>
        <table>
          <caption className="sr-only">Countries</caption>
          <thead>
            <tr>
              <th scope="col">{t.common.country}</th>
              <th scope="col">Code</th>
              <th scope="col">{t.common.status}</th>
              <th scope="col">Languages</th>
              <th scope="col">Active version</th>
            </tr>
          </thead>
          <tbody>
            {state.countries.map((c) => {
              const v = c.methodology_version_id ? state.versions.find((x) => x.id === c.methodology_version_id) : undefined;
              return (
                <tr key={c.code}>
                  <th scope="row">{c.name}</th>
                  <td className="mono">{c.code}</td>
                  <td><StatusChip status={c.status} /></td>
                  <td>{c.languages.join(', ')}</td>
                  <td>
                    {v ? <><Link to={`/admin/methodology/${v.id}`}>{v.id}</Link> <StatusChip status={v.status} />{v.national_thresholds === 'to be provided' && <> <span className="chip chip-warn">thresholds pending</span></>}</> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <form className="card" aria-labelledby="wizard-h" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <h2 id="wizard-h">Add a country</h2>
          <ol className="steps" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : undefined}>{i + 1}. {s}</li>
            ))}
          </ol>
          {error && <div id="wiz-error"><Callout kind="danger" role="alert">{error}</Callout></div>}

          {step === 0 && (
            <div className="field">
              <label htmlFor="wiz-country">Planned country</label>
              <select id="wiz-country" value={code} onChange={(e) => setCode(e.target.value as CountryCode)} aria-invalid={!!error || undefined} aria-describedby={error ? 'wiz-error' : undefined}>
                <option value="">— choose —</option>
                {planned.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
              <p className="hint">Only countries marked as planned can be added. Adding a country here does not change anything for companies until the version is published.</p>
            </div>
          )}
          {step === 1 && (
            <fieldset>
              <legend>Questionnaire languages</legend>
              <label className="choice"><input type="checkbox" checked readOnly disabled /> <span>English (required in this concept)</span></label>
              <label className="choice"><input type="checkbox" checked={sw} onChange={(e) => setSw(e.target.checked)} /> <span>Swahili (sw) — translations are copied from the source version</span></label>
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="wiz-other">Other language (name only; adding a new language is a content project, not a switch)</label>
                <input type="text" id="wiz-other" value={other} onChange={(e) => setOther(e.target.value)} placeholder="for example Hausa" />
              </div>
            </fieldset>
          )}
          {step === 2 && (
            <div className="field">
              <label htmlFor="wiz-src">Copy methodology from a published version</label>
              <select id="wiz-src" value={srcId} onChange={(e) => setSrcId(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? 'wiz-error' : undefined}>
                <option value="">— choose —</option>
                {published.map((v) => (
                  <option key={v.id} value={v.id}>{v.id} ({v.country === '*' ? 'shared' : v.country}) — {v.questions.length} questions</option>
                ))}
              </select>
              <p className="hint">Creates draft <span className="mono">{draftId || '<version>-<CODE>'}</span> for {country?.name ?? 'the country'} with status draft, based on the source. {exists && <strong>This id already exists.</strong>}</p>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3>Review</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li className="issue"><span className="dot dot-ok" aria-hidden="true" /><span>Country: {country?.name} ({code})</span></li>
                <li className="issue"><span className="dot dot-ok" aria-hidden="true" /><span>Languages: {[...languages, other.trim()].filter(Boolean).join(', ')}</span></li>
                <li className="issue"><span className="dot dot-ok" aria-hidden="true" /><span>Methodology: {draftId} copied from {src?.id} ({src?.questions.length} questions, {src?.roadmap_rules.length} roadmap rules)</span></li>
                <li className="issue"><span className="dot dot-warning" aria-hidden="true" /><span><strong>National thresholds: to be provided by the programme team</strong> <span className="chip chip-warn">pending</span><div className="tiny muted">The concept never invents national numbers. Until provided, the copied version keeps the source scoring and the flag stays visible in the editor.</div></span></li>
              </ul>
            </div>
          )}
          {step === 4 && (
            <div>
              <h3>Activate</h3>
              <p>Publish now makes {country?.name} active immediately on {draftId}. Save as draft keeps the country planned so the team can edit the copy first (the editor flags the pending thresholds).</p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => finish(true)}>Publish now</button>
                <button type="button" className="btn" onClick={() => finish(false)}>Save as draft</button>
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" disabled={step === 0} onClick={() => { setError(null); setStep((s) => s - 1); }}>{t.common.back}</button>
            {step < STEPS.length - 1 && <button type="submit" className="btn btn-primary">Next</button>}
            <button type="button" className="btn btn-link" onClick={() => { setOpen(false); reset(); }}>{t.common.cancel}</button>
          </div>
        </form>
      )}
    </section>
  );
}
