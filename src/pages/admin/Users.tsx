import { useState } from 'react';
import { can, ROLE_ORDER } from '../../store/index.tsx';
import { useT } from '../../i18n/index.tsx';
import { Callout, Sim } from '../../components/Bits.tsx';
import type { Role } from '../../types.ts';
import { PageHead } from './shared.tsx';

const SEED: { id: string; name: string; email: string; role: Role }[] = [
  { id: 'u1', name: 'A. Editor (synthetic)', email: 'a.editor@example.invalid', role: 'content' },
  { id: 'u2', name: 'B. Methodologist (synthetic)', email: 'b.method@example.invalid', role: 'methodology' },
  { id: 'u3', name: 'C. Analyst (synthetic)', email: 'c.analyst@example.invalid', role: 'analyst' },
  { id: 'u4', name: 'D. Admin (synthetic)', email: 'd.admin@example.invalid', role: 'admin' },
  { id: 'u5', name: 'E. Translator (synthetic)', email: 'e.translator@example.invalid', role: 'content' },
];

const PERMS: { key: keyof typeof can; label: string }[] = [
  { key: 'viewAnswers', label: 'View company answers' },
  { key: 'editContent', label: 'Edit texts and Swahili translations' },
  { key: 'editMethodology', label: 'Edit scoring, dependencies, recommendations' },
  { key: 'publish', label: 'Publish and roll back versions' },
  { key: 'viewAnalytics', label: 'View engagement analytics' },
  { key: 'answerTickets', label: 'Answer hand-off tickets, publish FAQ' },
  { key: 'manageCountries', label: 'Add countries' },
  { key: 'manageUsers', label: 'Manage users and settings' },
];

/** Users and roles: a static, simulated list and the permission matrix the demo actually enforces. */
export function UsersPage() {
  const t = useT();
  const [users, setUsers] = useState(SEED);
  return (
    <section>
      <PageHead title="Users & roles" lead="Who can do what. The permission matrix below is the one the prototype enforces on every admin page." right={<Sim>no real accounts</Sim>} />
      <Callout kind="info">There is no login in this concept. The role switcher in the header is a demo stand-in: in production, staff would sign in with the organisation’s identity provider and roles would be assigned here. Changing a role below only changes this table.</Callout>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Staff users <Sim>no real accounts</Sim></h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Synthetic staff users</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">{u.name}</th>
                    <td className="small mono">{u.email}</td>
                    <td>
                      <label htmlFor={`user-${u.id}-role`} className="sr-only">Role of {u.name}</label>
                      <select id={`user-${u.id}-role`} value={u.role} style={{ minHeight: 36, width: 'auto' }} onChange={(e) => setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, role: e.target.value as Role } : x)))}>
                        {ROLE_ORDER.filter((r) => r !== 'company').map((r) => (
                          <option key={r} value={r}>{t.roles[r]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Permission matrix</h2>
          <div className="table-wrap">
            <table className="matrix">
              <caption className="sr-only">Permissions by role</caption>
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  {ROLE_ORDER.map((r) => (
                    <th scope="col" key={r}>{t.roles[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMS.map((p) => (
                  <tr key={p.key}>
                    <th scope="row">{p.label}</th>
                    {ROLE_ORDER.map((r) => {
                      const ok = can[p.key](r);
                      return (
                        <td key={r} className={ok ? 'yes' : undefined} style={{ textAlign: 'center' }}>
                          <span aria-hidden="true">{ok ? '✓' : '—'}</span>
                          <span className="sr-only">{ok ? 'yes' : 'no'}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
