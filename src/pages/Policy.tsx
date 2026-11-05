import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { useViews } from '../i18n/views.ts';
import { useAssessments } from '../lib/useAssessments.ts';
import { activeVersionFor, topicName } from '../lib/data.ts';
import { BarChart, type Bar } from '../components/BarChart.tsx';
import { Callout, PowerBiPlaceholder, Sim } from '../components/Bits.tsx';
import { latestPerCompany } from './Investors.tsx';
import type { Assessment, CompanySize, CountryCode, Grade } from '../types.ts';

const MIN_N = 5;
const COUNTRIES: CountryCode[] = ['KE', 'TZ'];
const SIZES: CompanySize[] = ['micro', 'small', 'medium', 'large'];
const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E'];

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function PolicyPage() {
  const t = useT();
  const v = useViews().policy;
  const lang = useLang();
  const { state } = useStore();
  const { all, loading } = useAssessments();
  const version = activeVersionFor(state, null);
  const [letterTopic, setLetterTopic] = useState<string>(version.topics[0]?.id ?? '');
  const countryName = (c: CountryCode) => {
    const d = state.countries.find((x) => x.code === c);
    return d ? (lang === 'sw' ? d.name_sw : d.name) : c;
  };

  const companies = useMemo(() => latestPerCompany(all), [all]);
  const byCountry = useMemo(() => {
    const m: Record<CountryCode, Assessment[]> = { KE: [], TZ: [], NG: [], SN: [], ID: [], BD: [] };
    for (const a of companies) m[a.country].push(a);
    return m;
  }, [companies]);

  /** A cell: suppressed when fewer than MIN_N companies. */
  const cell = (n: number, children: ReactNode) => (n < MIN_N ? <span className="muted small">{v.suppressed}</span> : <>{children}</>);

  const avgBars = (list: Assessment[]): Bar[] =>
    version.topics.map((tp) => {
      const vals = list.map((a) => a.result!.topics.find((x) => x.topic === tp.id)?.percent).filter((x): x is number => typeof x === 'number');
      return { label: topicName(version, tp.id, lang), value: vals.length ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10 : 0, note: `n = ${vals.length}` };
    });
  const letterBars = (list: Assessment[]): Bar[] => {
    const grades = list.map((a) => a.result!.topics.find((x) => x.topic === letterTopic)?.grade).filter((g): g is Grade => !!g);
    return GRADES.map((g) => {
      const n = grades.filter((x) => x === g).length;
      return { label: g, value: pct(n, grades.length), note: `${n} / ${grades.length}` };
    });
  };

  const indicator = (list: Assessment[], qid: string, answer: string) => {
    const applicable = list.filter((a) => a.result!.questions.find((q) => q.question_id === qid)?.applicable && a.answers[qid]);
    const yes = applicable.filter((a) => {
      const ans = a.answers[qid];
      return ans?.type === 'option' && ans.selected === answer;
    });
    return { n: applicable.length, yes: yes.length, share: pct(yes.length, applicable.length) };
  };
  const indicators = [
    { id: '2.1', label: v.ind21, answer: 'Yes' },
    { id: '4.1', label: v.ind41, answer: 'Yes, all products' },
  ];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section aria-labelledby="pol-h">
        <div className="page-head">
          <h1 id="pol-h">{v.title} <span className="muted" style={{ fontWeight: 400 }}>({t.concept})</span></h1>
        </div>
        <p className="lead">{v.lead}</p>
        <Callout kind="info" role="note">{v.noCompanies}</Callout>
        <p className="hint" role="status">
          {loading ? v.loading : <>{fmt(v.unit, { v: version.id })} {COUNTRIES.map((c) => `${countryName(c)}: n = ${byCountry[c].length}`).join(' · ')}</>}
        </p>
      </section>

      <section aria-labelledby="pol-avg-h">
        <h2 id="pol-avg-h" className="sr-only">{v.avgChart.split(' — ')[0]}</h2>
        <div className="grid grid-2">
          {COUNTRIES.map((c) => (
            <div className="card" key={c}>
              {byCountry[c].length < MIN_N ? (
                <p><strong>{fmt(v.avgChart, { country: countryName(c) })}</strong><br /><span className="muted">{v.suppressed}</span></p>
              ) : (
                <BarChart title={fmt(v.avgChart, { country: countryName(c) })} bars={avgBars(byCountry[c])} unit="%" max={100} caption={fmt(v.avgChart, { country: countryName(c) })} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="pol-letters-h">
        <h2 id="pol-letters-h">{fmt(v.lettersChart, { country: `${countryName('KE')} / ${countryName('TZ')}` })}</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="pol-topic">{v.lettersTopic}</label>
          <select id="pol-topic" value={letterTopic} onChange={(e) => setLetterTopic(e.target.value)}>
            {version.topics.map((tp) => (
              <option key={tp.id} value={tp.id}>{topicName(version, tp.id, lang)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-2">
          {COUNTRIES.map((c) => (
            <div className="panel" key={c}>
              {byCountry[c].length < MIN_N ? (
                <p><strong>{countryName(c)}</strong><br /><span className="muted">{v.suppressed}</span></p>
              ) : (
                <BarChart title={`${countryName(c)} — ${topicName(version, letterTopic, lang)}`} bars={letterBars(byCountry[c])} unit="%" max={100} caption={fmt(v.lettersChart, { country: countryName(c) })} />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="pol-size-h">
          <h2 id="pol-size-h">{v.sizes}</h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{v.sizes}</caption>
              <thead>
                <tr>
                  <th scope="col">{v.sizeCol}</th>
                  {COUNTRIES.map((c) => <th key={c} scope="col" className="num">{countryName(c)}</th>)}
                </tr>
              </thead>
              <tbody>
                {SIZES.map((s) => (
                  <tr key={s}>
                    <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>{t.start.sizes[s]}</th>
                    {COUNTRIES.map((c) => {
                      const n = byCountry[c].filter((a) => a.company_size === s).length;
                      return <td key={c} className="num">{cell(n, n)}</td>;
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row">{v.total}</th>
                  {COUNTRIES.map((c) => <td key={c} className="num"><strong>{byCountry[c].length}</strong></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-labelledby="pol-ind-h">
          <h2 id="pol-ind-h">{v.indicators}</h2>
          <p className="small muted">{v.indicatorsLead}</p>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{v.indicators}</caption>
              <thead>
                <tr>
                  <th scope="col">{v.indicator}</th>
                  {COUNTRIES.map((c) => <th key={c} scope="col" className="num">{countryName(c)}</th>)}
                </tr>
              </thead>
              <tbody>
                {indicators.map((ind) => (
                  <tr key={ind.id}>
                    <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>{ind.label}</th>
                    {COUNTRIES.map((c) => {
                      const r = indicator(byCountry[c], ind.id, ind.answer);
                      return (
                        <td key={c} className="num">
                          {cell(r.n, <><strong>{r.share}%</strong> <span className="tiny muted">({r.yes} {fmt(v.ofN, { n: r.n })})</span></>)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BarChart
            title={v.indicator}
            bars={indicators.flatMap((ind) =>
              COUNTRIES.filter((c) => indicator(byCountry[c], ind.id, ind.answer).n >= MIN_N).map((c) => ({
                label: `${ind.id} · ${countryName(c)}`,
                value: indicator(byCountry[c], ind.id, ind.answer).share,
                note: `n = ${indicator(byCountry[c], ind.id, ind.answer).n}`,
              })),
            )}
            unit="%"
            max={100}
          />
        </section>
      </div>

      <section aria-label="Power BI">
        <PowerBiPlaceholder />
      </section>

      <p className="small muted"><Sim /> {v.smallPrint}</p>
    </div>
  );
}
