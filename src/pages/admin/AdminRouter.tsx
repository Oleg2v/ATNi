import { Link, useRoute } from '../../router/index.tsx';
import { useStore } from '../../store/index.tsx';
import { useAdminT } from '../../i18n/admin.ts';
import { access, RoleGate } from './shared.tsx';
import { OverviewPage } from './Overview.tsx';
import { VersionsPage } from './Versions.tsx';
import { EditorPage } from './Editor.tsx';
import { HealthPage } from './Health.tsx';
import { ImportPage } from './Import.tsx';
import { AnalyticsPage } from './Analytics.tsx';
import { TicketsPage } from './Tickets.tsx';
import { AuditPage } from './Audit.tsx';
import { CountriesPage } from './Countries.tsx';
import { TranslationsPage } from './Translations.tsx';
import { SettingsPage } from './Settings.tsx';
import { UsersPage } from './Users.tsx';

const NAV = [
  { to: '/admin', key: 'overview', allow: access.overview, exact: true },
  { to: '/admin/methodology', key: 'methodology', allow: access.methodologyView },
  { to: '/admin/health', key: 'health', allow: access.health },
  { to: '/admin/import', key: 'import', allow: access.import },
  { to: '/admin/analytics', key: 'analytics', allow: access.analytics },
  { to: '/admin/tickets', key: 'tickets', allow: access.tickets },
  { to: '/admin/audit', key: 'audit', allow: access.audit },
  { to: '/admin/countries', key: 'countries', allow: access.countries },
  { to: '/admin/translations', key: 'translations', allow: access.translations },
  { to: '/admin/settings', key: 'settings', allow: access.settings },
  { to: '/admin/users', key: 'users', allow: access.users },
] as const;

/** Secondary router for every path under /admin (lazy-loaded by App). */
export function AdminRouter() {
  const { path } = useRoute();
  const { state } = useStore();
  const a = useAdminT();
  const role = state.role;
  const parts = path.split('/').filter(Boolean); // ['admin', 'methodology', 'v1.1']
  const section = parts[1] ?? '';
  const arg = parts[2] ? decodeURIComponent(parts[2]) : undefined;

  let page: React.ReactNode;
  if (section === '') page = <RoleGate allow={access.overview}><OverviewPage /></RoleGate>;
  else if (section === 'methodology' && arg) page = <RoleGate allow={access.methodologyView}><EditorPage id={arg} /></RoleGate>;
  else if (section === 'methodology') page = <RoleGate allow={access.methodologyView}><VersionsPage /></RoleGate>;
  else if (section === 'health') page = <RoleGate allow={access.health}><HealthPage /></RoleGate>;
  else if (section === 'import') page = <RoleGate allow={access.import}><ImportPage /></RoleGate>;
  else if (section === 'analytics') page = <RoleGate allow={access.analytics}><AnalyticsPage /></RoleGate>;
  else if (section === 'tickets') page = <RoleGate allow={access.tickets}><TicketsPage /></RoleGate>;
  else if (section === 'audit') page = <RoleGate allow={access.audit}><AuditPage /></RoleGate>;
  else if (section === 'countries') page = <RoleGate allow={access.countries}><CountriesPage /></RoleGate>;
  else if (section === 'translations') page = <RoleGate allow={access.translations}><TranslationsPage /></RoleGate>;
  else if (section === 'settings') page = <RoleGate allow={access.settings}><SettingsPage /></RoleGate>;
  else if (section === 'users') page = <RoleGate allow={access.users}><UsersPage /></RoleGate>;
  else page = <RoleGate allow={access.overview}><p>Unknown admin page. <Link to="/admin">{a.nav.overview}</Link></p></RoleGate>;

  const links = NAV.filter((n) => n.allow(role));
  return (
    <div className="admin">
      {role !== 'company' && (
        <nav aria-label="Admin">
          <ul className="admin-nav">
            {links.map((n) => (
              <li key={n.to}>
                <Link to={n.to} exact={'exact' in n && n.exact}>{a.nav[n.key]}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <p className="tiny muted" style={{ marginTop: 0 }}>{a.englishOnly}</p>
      {page}
    </div>
  );
}
