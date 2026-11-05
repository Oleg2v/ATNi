import { Link } from '../../router/index.tsx';
import { useStore } from '../../store/index.tsx';
import { BarChart } from '../../components/BarChart.tsx';
import { Callout, PowerBiPlaceholder, Sim } from '../../components/Bits.tsx';
import analyticsJson from '../../data/analytics.json';
import { editorHref, PageHead } from './shared.tsx';

interface Analytics {
  note: string;
  funnel: { month: string; started: number; completed: number; plan_downloaded: number }[];
  dropoff: { question_id: string; topic: string; reached: number; dropped_share: number }[];
  byCountryLang: { country: string; lang: string; started: number; completed: number; plan_downloaded: number }[];
  median_minutes_to_complete: number;
}
const data = analyticsJson as Analytics;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/** Engagement analytics on synthetic data. */
export function AnalyticsPage() {
  const { state } = useStore();
  const started = data.funnel.reduce((s, m) => s + m.started, 0);
  const completed = data.funnel.reduce((s, m) => s + m.completed, 0);
  const downloaded = data.funnel.reduce((s, m) => s + m.plan_downloaded, 0);
  const drop = data.dropoff.map((d) => ({ ...d, value: Math.round(d.dropped_share * 1000) / 10 }));
  const worst = [...drop].sort((a, b) => b.value - a.value)[0];
  const draft = state.versions.find((v) => v.status === 'draft');
  const editorTarget = draft?.id ?? state.versions.find((v) => v.status === 'published')?.id ?? 'v1.1';
  return (
    <section>
      <PageHead title="Engagement analytics" lead="Where companies start, finish and download a plan, and which question loses them. In production this comes from privacy-respecting first-party analytics (no third-party trackers); here every number is synthetic." right={<Sim>synthetic data</Sim>} />
      <div className="grid grid-2">
        <div className="card">
          <h2>Funnel (all months) <Sim>synthetic data</Sim></h2>
          <BarChart title="Companies" unit="" max={started} bars={[
            { label: 'Started', value: started },
            { label: 'Completed', value: completed, note: `${pct(completed, started)} % of started` },
            { label: 'Downloaded plan', value: downloaded, note: `${pct(downloaded, completed)} % of completed` },
          ]} caption="Funnel totals" />
          <p className="small muted" style={{ marginTop: 8 }}>Median time to complete: {data.median_minutes_to_complete} minutes. Completion rate {pct(completed, started)} %, plan download rate {pct(downloaded, completed)} % of completed.</p>
          <div className="table-wrap">
            <table>
              <caption>By month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="num">Started</th>
                  <th scope="col" className="num">Completed</th>
                  <th scope="col" className="num">Plan downloaded</th>
                  <th scope="col" className="num">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((m) => (
                  <tr key={m.month}>
                    <th scope="row">{m.month}</th>
                    <td className="num">{m.started}</td>
                    <td className="num">{m.completed}</td>
                    <td className="num">{m.plan_downloaded}</td>
                    <td className="num">{pct(m.completed, m.started)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Drop-off by question <Sim>synthetic data</Sim></h2>
          {worst && (
            <Callout kind="warn">
              At question <strong>{worst.question_id}</strong> ({worst.topic}) <strong>{worst.value} %</strong> leave — <Link to={editorHref(editorTarget, `field-${worst.question_id}-question`)}>open in editor</Link>
            </Callout>
          )}
          <BarChart title="Share leaving at the question" unit="%" max={Math.max(10, Math.ceil(Math.max(...drop.map((d) => d.value)) / 5) * 5)} bars={drop.map((d) => ({ label: `${d.question_id} ${d.topic}`, value: d.value, note: `${d.reached} reached` }))} caption="Drop-off per question (% of those who reached it)" />
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>By country and language <Sim>synthetic data</Sim></h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Funnel by country and language</caption>
              <thead>
                <tr>
                  <th scope="col">Country</th>
                  <th scope="col">Language</th>
                  <th scope="col" className="num">Started</th>
                  <th scope="col" className="num">Completed</th>
                  <th scope="col" className="num">Plan downloaded</th>
                  <th scope="col" className="num">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {data.byCountryLang.map((r) => (
                  <tr key={`${r.country}-${r.lang}`}>
                    <th scope="row">{r.country}</th>
                    <td>{r.lang}</td>
                    <td className="num">{r.started}</td>
                    <td className="num">{r.completed}</td>
                    <td className="num">{r.plan_downloaded}</td>
                    <td className="num">{pct(r.completed, r.started)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Published report</h2>
          <PowerBiPlaceholder title="Engagement report" />
          <p className="small muted" style={{ marginTop: 8 }}>{data.note}</p>
        </div>
      </div>
    </section>
  );
}
