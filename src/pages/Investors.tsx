import { useMemo, useState } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { useViews } from '../i18n/views.ts';
import { useAssessments } from '../lib/useAssessments.ts';
import { activeVersionFor, fmtDate, qText, ruleTitle, topicName, versionById } from '../lib/data.ts';
import { buildRoadmap } from '../engine/index.ts';
import { BarChart } from '../components/BarChart.tsx';
import { Callout, GradeBadge, PowerBiPlaceholder, Sim } from '../components/Bits.tsx';
import type { Assessment, CountryCode, Grade, Phase } from '../types.ts';

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E'];

/** One row per company: the latest completed assessment. */
export function latestPerCompany(list: Assessment[]): Assessment[] {
  const m = new Map<string, Assessment>();
  for (const a of list) {
    if (!a.completed_at || !a.result) continue;
    const prev = m.get(a.company_id);
    if (!prev || (prev.completed_at ?? '') < a.completed_at) m.set(a.company_id, a);
  }
  return [...m.values()].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
}

export function InvestorsPage() {
  const t = useT();
  const v = useViews().investors;
  const lang = useLang();
  const { state } = useStore();
  const { all, loading } = useAssessments();
  const [country, setCountry] = useState<'all' | CountryCode>('all');
  const [topic, setTopic] = useState<string>('all');
  const version = activeVersionFor(state, null);
  const countryName = (c: CountryCode) => {
    const d = state.countries.find((x) => x.code === c);
    return d ? (lang === 'sw' ? d.name_sw : d.name) : c;
  };
  const versionOf = (a: Assessment) => versionById(state, a.version_id) ?? version;

  const data = useMemo(() => {
    const inCountry = (a: Assessment) => country === 'all' || a.country === country;
    const completed = latestPerCompany(all.filter(inCountry));
    const consenting = completed.filter((a) => a.consent_investor_share);
    return { totalCompanies: completed.length, consenting };
  }, [all, country]);

  const { consenting } = data;

  /* letter distribution for one topic, or average percent per topic */
  const chart = useMemo(() => {
    if (consenting.length === 0) return null;
    if (topic === 'all') {
      return {
        title: v.avgChart,
        bars: version.topics.map((tp) => {
          const vals = consenting.map((a) => a.result!.topics.find((x) => x.topic === tp.id)?.percent).filter((x): x is number => typeof x === 'number');
          const avg = vals.length ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10 : 0;
          return { label: topicName(version, tp.id, lang), value: avg, note: `n = ${vals.length}` };
        }),
      };
    }
    const scored = consenting.map((a) => a.result!.topics.find((x) => x.topic === topic)?.grade).filter((g): g is Grade => !!g);
    return {
      title: fmt(v.lettersChart, { topic: topicName(version, topic, lang) }),
      bars: GRADES.map((g) => {
        const n = scored.filter((x) => x === g).length;
        return { label: g, value: scored.length ? Math.round((n / scored.length) * 100) : 0, note: `${n} / ${scored.length}` };
      }),
    };
  }, [consenting, topic, version, lang, v]);

  /* typical gaps: questions most often below half of their maximum */
  const gaps = useMemo(() => {
    const acc = new Map<string, { below: number; applicable: number; topic: string }>();
    for (const a of consenting) {
      for (const q of a.result!.questions) {
        if (!q.applicable || !q.answered || q.max <= 0) continue;
        if (topic !== 'all' && q.topic !== topic) continue;
        const e = acc.get(q.question_id) ?? { below: 0, applicable: 0, topic: q.topic };
        e.applicable += 1;
        if (q.score < q.max / 2) e.below += 1;
        acc.set(q.question_id, e);
      }
    }
    return [...acc.entries()]
      .map(([id, e]) => ({ id, share: Math.round((e.below / e.applicable) * 100), below: e.below, applicable: e.applicable, topic: e.topic }))
      .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))
      .slice(0, 5);
  }, [consenting, topic]);

  /* most frequent roadmap rules */
  const priorities = useMemo(() => {
    const acc = new Map<string, { title: string; phase: Phase; count: number; versionId: string }>();
    for (const a of consenting) {
      const ver = versionOf(a);
      for (const s of buildRoadmap(ver, a.result!, a.answers)) {
        if (topic !== 'all' && s.topic !== topic) continue;
        const e = acc.get(s.rule_id) ?? { title: ruleTitle(ver, s.rule_id, s.title, lang), phase: s.phase, count: 0, versionId: ver.id };
        e.count += 1;
        acc.set(s.rule_id, e);
      }
    }
    return [...acc.entries()]
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
      .slice(0, 5);
  }, [consenting, topic, lang, state.versions]);

  const questionText = (qid: string) => {
    const q = version.questions.find((x) => x.question_id === qid) ?? state.versions.flatMap((x) => x.questions).find((x) => x.question_id === qid);
    return q ? qText(version, q, lang).question : qid;
  };
  const phaseLabel: Record<Phase, string> = { now: t.roadmap.now, next: t.roadmap.next, later: t.roadmap.later };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section aria-labelledby="inv-h">
        <div className="page-head">
          <h1 id="inv-h">{v.title} <span className="muted" style={{ fontWeight: 400 }}>({t.concept})</span></h1>
        </div>
        <p className="lead">{v.lead}</p>
        <Callout kind="warn" role="note">
          <strong>{v.notice}</strong>
        </Callout>
      </section>

      <section className="card" aria-labelledby="inv-filters-h">
        <h2 id="inv-filters-h" className="sr-only">{v.country} · {v.topic}</h2>
        <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, minWidth: 180 }}>
            <label htmlFor="inv-country">{v.country}</label>
            <select id="inv-country" value={country} onChange={(e) => setCountry(e.target.value as 'all' | CountryCode)}>
              <option value="all">{v.allCountries}</option>
              <option value="KE">{countryName('KE')}</option>
              <option value="TZ">{countryName('TZ')}</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label htmlFor="inv-topic">{v.topic}</label>
            <select id="inv-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">{v.allTopics}</option>
              {version.topics.map((tp) => (
                <option key={tp.id} value={tp.id}>{topicName(version, tp.id, lang)}</option>
              ))}
            </select>
          </div>
        </div>
        <p role="status" style={{ marginTop: 12, marginBottom: 0 }}>
          {loading ? v.loading : <strong>{fmt(v.consenting, { n: consenting.length, total: data.totalCompanies })}</strong>}
        </p>
        <p className="hint">{v.unit} {v.sourceNote}</p>
      </section>

      {!loading && consenting.length === 0 && <Callout kind="info">{v.noMatch}</Callout>}

      {chart && (
        <section className="card" aria-label={chart.title}>
          <BarChart title={chart.title} bars={chart.bars} unit="%" max={100} caption={chart.title} />
        </section>
      )}

      <div className="grid grid-2">
        <section className="card" aria-labelledby="inv-gaps-h">
          <h2 id="inv-gaps-h">{v.gaps}</h2>
          <p className="small muted">{v.gapsLead}</p>
          {gaps.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">{v.gaps}</caption>
                <thead>
                  <tr>
                    <th scope="col">{v.question}</th>
                    <th scope="col" className="num">{v.share}</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.id}>
                      <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>
                        <span className="mono muted">{g.id}</span> {questionText(g.id)}
                        <div className="tiny muted">{topicName(version, g.topic, lang)}</div>
                      </th>
                      <td className="num">{g.share}% <span className="tiny muted">({g.below}/{g.applicable})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card" aria-labelledby="inv-prio-h">
          <h2 id="inv-prio-h">{v.priorities}</h2>
          <p className="small muted">{v.prioritiesLead}</p>
          {priorities.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">{v.priorities}</caption>
                <thead>
                  <tr>
                    <th scope="col">{v.step}</th>
                    <th scope="col">{v.phase}</th>
                    <th scope="col" className="num">{v.companies}</th>
                  </tr>
                </thead>
                <tbody>
                  {priorities.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>
                        {p.title} <span className="tiny muted mono">{p.id} · {p.versionId}</span>
                      </th>
                      <td><span className={`chip chip-${p.phase === 'now' ? 'danger' : p.phase === 'next' ? 'warn' : 'accent'}`}>{phaseLabel[p.phase]}</span></td>
                      <td className="num">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="inv-table-h">
        <h2 id="inv-table-h">{v.table} <span className="muted" style={{ fontWeight: 400 }}>({consenting.length})</span></h2>
        <p className="small muted">{v.tableLead}</p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{v.table}</caption>
            <thead>
              <tr>
                <th scope="col">{v.company}</th>
                <th scope="col">{v.size}</th>
                <th scope="col">{v.country}</th>
                <th scope="col">{v.overall}</th>
                {version.topics.map((tp) => (
                  <th key={tp.id} scope="col" title={topicName(version, tp.id, lang)}>{topicName(version, tp.id, lang)}</th>
                ))}
                <th scope="col">{v.date}</th>
              </tr>
            </thead>
            <tbody>
              {consenting.map((a) => (
                <tr key={a.id}>
                  <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>{a.company_name}</th>
                  <td>{t.start.sizes[a.company_size]}</td>
                  <td>{countryName(a.country)}</td>
                  <td><GradeBadge grade={a.result!.grade} label={v.overall} /></td>
                  {version.topics.map((tp) => {
                    const ts = a.result!.topics.find((x) => x.topic === tp.id);
                    return <td key={tp.id}>{ts ? <GradeBadge grade={ts.grade} label={topicName(version, tp.id, lang)} /> : '—'}</td>;
                  })}
                  <td>{fmtDate(a.completed_at, lang)} <span className="tiny muted mono">{a.version_id}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Power BI">
        <PowerBiPlaceholder />
      </section>

      <p className="small muted">
        <Sim /> {v.notice}
      </p>
    </div>
  );
}
