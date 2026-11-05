import { useState } from 'react';
import { Link, navigate } from '../../router/index.tsx';
import { useStore } from '../../store/index.tsx';
import { useLive } from '../../components/Live.tsx';
import { Callout, Sim } from '../../components/Bits.tsx';
import { importNutriCheck, type ImportReport } from '../../engine/index.ts';
import type { MethodologyVersion } from '../../types.ts';
import { editorHref, nextVersionId, PageHead, plain } from './shared.tsx';
import sampleText from '../../../public/sample-nutricheck-format.json?raw';

/** Import a questionnaire in the NutriCheck survey.json format into a new draft version. */
export function ImportPage() {
  const { state, update, log, now } = useStore();
  const { toast, announce } = useLive();
  const [source, setSource] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ version: MethodologyVersion | null; report: ImportReport } | null>(null);
  const [created, setCreated] = useState(false);

  const run = (text: string, name: string) => {
    setError(null);
    setCreated(false);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      setResult(null);
      setError(`${name}: not valid JSON (${(e as Error).message}).`);
      return;
    }
    const id = nextVersionId(state.versions, '-import');
    const r = importNutriCheck(json, { id, version: id.replace(/^v/, ''), country: '*', created_at: now(), based_on: undefined });
    setSource(name);
    setResult(r);
    announce(r.report.ok ? `Parsed ${r.report.counts.questions} questions from ${name}` : `Import failed: ${r.report.fatal}`);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => run(String(reader.result ?? ''), file.name);
    reader.onerror = () => setError('The file could not be read.');
    reader.readAsText(file);
  };

  /** The sample ships inside the bundle (no request at all), and goes through the same parser as an uploaded file. */
  const useSample = () => run(sampleText, 'sample-nutricheck-format.json (bundled sample)');

  const createDraft = () => {
    if (!result?.version) return;
    const v = result.version;
    update((s) => ({ ...s, versions: [...s.versions, v] }));
    log('import', v.id, `Imported ${result.report.counts.questions} questions (${result.report.counts.topics} topics) from ${source}; ${result.report.scores_without_recs.length} scores without recommendation; ${result.report.skipped.length} rows skipped.`);
    setCreated(true);
    toast(`Draft ${v.id} created from import`);
    navigate(`/admin/methodology/${v.id}`);
  };

  const c = result?.report.counts;
  const vid = result?.version?.id ?? '';
  return (
    <section>
      <PageHead title="Import a questionnaire" lead="Reads a file in the NutriCheck survey.json format (topic, question, question_id, info, dependency, propositions, recommandations) and turns it into a draft version. Parsing runs in your browser and is real; nothing is uploaded." right={<Sim>import: no server</Sim>} />
      <div className="card">
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="import-file">Choose a .json file</label>
            <input type="file" id="import-file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
            <p className="hint">Read locally with FileReader. Accepts an array of questions or an object with a “questions” array.</p>
          </div>
          <div>
            <span className="label">Or try the bundled sample</span>
            <button type="button" className="btn" onClick={useSample}>Use the sample file</button>
            <p className="hint">A synthetic questionnaire in the same field layout, shipped with the app. It deliberately contains gaps so the report has something to show.</p>
          </div>
        </div>
        {error && <Callout kind="danger" role="alert">{error}</Callout>}
      </div>

      {result && (
        <div className="stack" style={{ marginTop: 16 }}>
          {!result.report.ok && <Callout kind="danger" role="alert"><strong>Import failed.</strong> {result.report.fatal}</Callout>}
          {result.report.ok && c && (
            <>
              <Callout kind="ok" role="status">
                <strong>Parsed {source}:</strong> {c.questions} questions in {c.topics} topics. Review the report, then create the draft {vid}.
              </Callout>
              <div className="grid grid-2">
                <div className="card">
                  <h2>Counts</h2>
                  <div className="table-wrap">
                    <table>
                      <caption className="sr-only">Import counts</caption>
                      <tbody>
                        {([
                          ['Questions', c.questions],
                          ['Topics', c.topics],
                          ['Single choice (option)', c.option],
                          ['Multiple choice (choices)', c.choices],
                          ['Free text', c.text],
                          ['With a dependency', c.with_dependency],
                          ['Fixed recommendations', c.fixed_recs],
                          ['Scored recommendations', c.scored_recs],
                          ['Without recommendation', c.no_recs],
                        ] as [string, number][]).map(([k, v]) => (
                          <tr key={k}>
                            <th scope="row">{k}</th>
                            <td className="num">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>Topics</h3>
                  <ul>
                    {result.report.topics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h2>Scores without a recommendation ({result.report.scores_without_recs.length})</h2>
                  <p className="small muted">In the source system a missing entry for an achieved score is a runtime failure. Here it blocks publishing until added. Links open the field once the draft exists.</p>
                  {result.report.scores_without_recs.length === 0 ? (
                    <p className="muted">None.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <caption className="sr-only">Scores without recommendations</caption>
                        <thead>
                          <tr>
                            <th scope="col">Question</th>
                            <th scope="col" className="num">Score</th>
                            <th scope="col">Field</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.report.scores_without_recs.map((r, i) => (
                            <tr key={i}>
                              <th scope="row" className="mono">{r.question_id}</th>
                              <td className="num">{plain(r.score)}</td>
                              <td>{created ? <Link to={editorHref(vid, `field-${r.question_id}-recommandations-${r.score}`)}>open</Link> : <span className="muted small">after creating the draft</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="card">
                  <h2>Relations the source format could not express ({result.report.unsupported.length})</h2>
                  {result.report.unsupported.length === 0 ? <p className="muted">None.</p> : (
                    <ul>
                      {result.report.unsupported.map((u, i) => (
                        <li key={i}><span className="chip">{u.kind}</span> <span className="mono">{u.question_id}</span> — {u.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="card">
                  <h2>Warnings ({result.report.warnings.length}) and skipped rows ({result.report.skipped.length})</h2>
                  <ul>
                    {result.report.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  {result.report.skipped.length > 0 && (
                    <div className="table-wrap">
                      <table>
                        <caption>Skipped rows</caption>
                        <thead>
                          <tr>
                            <th scope="col" className="num">Row</th>
                            <th scope="col">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.report.skipped.map((s) => (
                            <tr key={s.index}>
                              <td className="num">{s.index + 1}</td>
                              <td>{s.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="row">
                <button type="button" className="btn btn-primary" disabled={created} onClick={createDraft}>Create draft version from this import</button>
                <span className="small muted">Creates {vid} (status draft, country: all) in your browser and opens the editor. Roadmap rules and Swahili texts are empty after import.</span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
