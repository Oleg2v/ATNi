import { useMemo } from 'react';
import { Link } from '../../router/index.tsx';
import { useStore } from '../../store/index.tsx';
import { useT } from '../../i18n/index.tsx';
import { useAdminT } from '../../i18n/admin.ts';
import { PowerBiPlaceholder, Sim } from '../../components/Bits.tsx';
import { useAssessments } from '../../lib/useAssessments.ts';
import { validateVersion } from '../../engine/index.ts';
import { access, PageHead, Stat } from './shared.tsx';

export function OverviewPage() {
  const { state } = useStore();
  const t = useT();
  const a = useAdminT();
  const { all, loading } = useAssessments();
  const role = state.role;
  const openTickets = state.tickets.filter((x) => x.status === 'open').length;
  const draft = state.versions.find((v) => v.status === 'draft');
  const draftReport = useMemo(() => (draft ? validateVersion(draft) : null), [draft]);
  const published = state.versions.filter((v) => v.status === 'published');

  const links: { to: string; label: string; allow: (r: typeof role) => boolean; note: string }[] = [
    { to: '/admin/methodology', label: a.nav.methodology, allow: access.methodologyView, note: `${state.versions.length} versions, ${published.length} published` },
    { to: draft ? `/admin/methodology/${draft.id}` : '/admin/methodology', label: draft ? `Edit draft ${draft.id}` : 'Versions', allow: access.methodologyView, note: draftReport ? `${draftReport.errors} errors · ${draftReport.warnings} warnings` : 'no draft' },
    { to: '/admin/health', label: a.nav.health, allow: access.health, note: 'checks before publishing' },
    { to: '/admin/tickets', label: a.nav.tickets, allow: access.tickets, note: `${openTickets} open` },
    { to: '/admin/import', label: a.nav.import, allow: access.import, note: 'survey.json format' },
    { to: '/admin/analytics', label: a.nav.analytics, allow: access.analytics, note: 'synthetic data' },
    { to: '/admin/translations', label: a.nav.translations, allow: access.translations, note: 'coverage and CSV' },
    { to: '/admin/countries', label: a.nav.countries, allow: access.countries, note: `${state.countries.filter((c) => c.status === 'active').length} active` },
    { to: '/admin/audit', label: a.nav.audit, allow: access.audit, note: `${state.audit.length} entries` },
    { to: '/admin/settings', label: a.nav.settings, allow: access.settings, note: 'retention, consent, Lite mode' },
    { to: '/admin/users', label: a.nav.users, allow: access.users, note: 'simulated' },
  ];

  return (
    <section>
      <PageHead title={a.overview.title} lead={a.overview.lead} right={<span className="role-badge">{a.overview.role}: {t.roles[role]} <Sim /></span>} />
      <div className="grid grid-3">
        <Stat label={a.overview.versions} value={state.versions.length} to="/admin/methodology" />
        <Stat label={a.overview.openTickets} value={openTickets} to={access.tickets(role) ? '/admin/tickets' : undefined} />
        <Stat label={a.overview.assessments} value={loading ? t.common.loading : all.length} />
        <Stat label={a.overview.draftHealth} value={draftReport ? <span className={draftReport.publishable ? 'chip chip-ok' : 'chip chip-danger'}>{draftReport.publishable ? 'publishable' : `${draftReport.errors} blocking`}</span> : '—'} to={draft ? `/admin/methodology/${draft.id}` : undefined} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>{a.overview.quickLinks}</h2>
          <ul style={{ margin: 0 }}>
            {links.filter((l) => l.allow(role)).map((l) => (
              <li key={l.to + l.label}>
                <Link to={l.to}>{l.label}</Link> <span className="small muted">— {l.note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>{a.overview.engagement}</h2>
          <PowerBiPlaceholder title={a.overview.engagement} />
          <p className="small muted" style={{ marginTop: 8 }}>In production the published report would be embedded here for the programme team; engagement numbers in this concept are synthetic (see Analytics).</p>
        </div>
      </div>
    </section>
  );
}
