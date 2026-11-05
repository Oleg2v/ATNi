import { Link } from '../../router/index.tsx';
import { can, useStore } from '../../store/index.tsx';
import { useLang, useT } from '../../i18n/index.tsx';
import { useAdminT } from '../../i18n/admin.ts';
import { useLive } from '../../components/Live.tsx';
import { fmtDate } from '../../lib/data.ts';
import { PageHead, StatusChip, useCreateDraft } from './shared.tsx';

export function VersionsPage() {
  const { state } = useStore();
  const t = useT();
  const a = useAdminT();
  const lang = useLang();
  const { toast } = useLive();
  const canEdit = can.editMethodology(state.role);
  const order = { draft: 0, published: 1, archived: 2 };
  const versions = [...state.versions].sort((x, y) => order[x.status] - order[y.status] || y.created_at.localeCompare(x.created_at));

  const create = useCreateDraft();
  const createDraft = (srcId: string) => {
    create(srcId);
    toast(`Draft created from ${srcId}`);
  };

  return (
    <section>
      <PageHead title="Methodology versions" lead="A version is the complete questionnaire, scoring, recommendations, roadmap rules and translations. Published versions are immutable; results always reference the version they were computed with." />
      {!canEdit && <p className="small muted">{a.gate.methodologyEditNote}</p>}
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <caption className="sr-only">Methodology versions</caption>
          <thead>
            <tr>
              <th scope="col">{t.common.version}</th>
              <th scope="col">{t.common.country}</th>
              <th scope="col">{t.common.status}</th>
              <th scope="col">{a.common.created}</th>
              <th scope="col">{a.common.publishedAt}</th>
              <th scope="col">{a.common.publishedBy}</th>
              <th scope="col">{a.common.comment}</th>
              <th scope="col">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <th scope="row" className="mono">
                  <Link to={`/admin/methodology/${v.id}`}>{v.id}</Link>
                  {v.based_on && <div className="tiny muted">{a.common.basedOn} {v.based_on}</div>}
                </th>
                <td>{v.country === '*' ? 'all countries' : v.country}</td>
                <td><StatusChip status={v.status} /></td>
                <td>{fmtDate(v.created_at, lang)}</td>
                <td>{fmtDate(v.published_at, lang)}</td>
                <td>{v.published_by ?? '—'}</td>
                <td className="small" style={{ maxWidth: 280 }}>{v.comment ?? '—'}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <Link className="btn btn-sm" to={`/admin/methodology/${v.id}`}>{a.common.open}</Link>
                    {canEdit && (
                      <button type="button" className="btn btn-sm" onClick={() => createDraft(v.id)}>{a.common.createDraft}</button>
                    )}
                    {state.versions.length > 1 && (
                      <details className="admin-menu">
                        <summary className="btn btn-sm">{a.common.compareWith}</summary>
                        {/* static (not absolute): .table-wrap scrolls, which would trap a floating menu */}
                        <ul style={{ position: 'static', boxShadow: 'none' }}>
                          {state.versions.filter((o) => o.id !== v.id).map((o) => (
                            <li key={o.id}><Link to={`/admin/methodology/${v.id}?compare=${encodeURIComponent(o.id)}`}>{o.id} ({o.status})</Link></li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Country-specific versions (for example v1.0-NG) take precedence over the shared one (country “all countries”) when a company from that country assesses. New country copies are created in <Link to="/admin/countries">Countries</Link>.
      </p>
    </section>
  );
}
