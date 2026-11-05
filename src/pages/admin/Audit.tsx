import { useState } from 'react';
import { useStore } from '../../store/index.tsx';
import { useLang } from '../../i18n/index.tsx';
import { useLive } from '../../components/Live.tsx';
import { Dialog } from '../../components/Dialog.tsx';
import { Callout } from '../../components/Bits.tsx';
import { fmtDateTime } from '../../lib/data.ts';
import type { AuditEntry } from '../../types.ts';
import { access, applyPublish, isPublishSnapshot, PageHead, useRoleLabel } from './shared.tsx';

/** The journal: every change with role, time and target; publish entries carry a snapshot for rollback. */
export function AuditPage() {
  const { state, update, log, now } = useStore();
  const lang = useLang();
  const { toast } = useLive();
  const roleLabel = useRoleLabel();
  const [filter, setFilter] = useState('all');
  const [confirm, setConfirm] = useState<AuditEntry | null>(null);
  const actions = [...new Set(state.audit.map((e) => e.action))].sort();
  const entries = [...state.audit].reverse().filter((e) => filter === 'all' || e.action === filter);
  const canRollback = access.rollback(state.role);

  const rollbackTarget = (e: AuditEntry) => (isPublishSnapshot(e.snapshot) && e.snapshot.previous_version ? e.snapshot : null);
  const isCurrent = (e: AuditEntry) => {
    const snap = rollbackTarget(e);
    if (!snap) return false;
    const published = state.versions.find((v) => v.status === 'published' && v.country === snap.country);
    return published?.id === snap.published_id;
  };

  const doRollback = () => {
    if (!confirm) return;
    const snap = rollbackTarget(confirm);
    if (!snap || !snap.previous_version) return;
    const prev = snap.previous_version;
    const nowIso = now();
    update((s) => {
      const base = s.versions.some((v) => v.id === prev.id) ? s : { ...s, versions: [...s.versions, prev] };
      return applyPublish(base, prev.id, nowIso, roleLabel).state;
    });
    log('rollback', prev.id, `Rolled back ${snap.published_id} → ${prev.id} (journal entry ${confirm.id}). ${snap.published_id} archived; country pointers restored.`, { kind: 'rollback', from: snap.published_id, to: prev.id });
    toast(`${prev.id} is published again; ${snap.published_id} archived`);
    setConfirm(null);
  };

  return (
    <section>
      <PageHead title="Journal" lead="Every change in the administration area, newest first. Publish entries keep a snapshot of the version they replaced so a publication can be rolled back." />
      <div className="row" style={{ marginBottom: 12 }}>
        <label htmlFor="audit-filter" style={{ margin: 0 }}>Action</label>
        <select id="audit-filter" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All ({state.audit.length})</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a} ({state.audit.filter((e) => e.action === a).length})</option>
          ))}
        </select>
        <span className="small muted" role="status">{entries.length} entries</span>
      </div>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <caption className="sr-only">Journal entries</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Role</th>
              <th scope="col">Action</th>
              <th scope="col">Target</th>
              <th scope="col">Details</th>
              <th scope="col">Rollback</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const snap = rollbackTarget(e);
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.at, lang)}<div className="tiny muted mono">{e.id}</div></td>
                  <td>{e.actor_role}</td>
                  <td><span className={`chip ${e.action === 'publish' ? 'chip-ok' : e.action === 'rollback' ? 'chip-warn' : ''}`}>{e.action}</span></td>
                  <td className="mono">{e.target}</td>
                  <td className="small" style={{ maxWidth: 420 }}>{e.details ?? '—'}</td>
                  <td>
                    {snap && canRollback && isCurrent(e) && (
                      <button type="button" className="btn btn-sm" onClick={() => setConfirm(e)}>Roll back to {snap.previous_version?.id}</button>
                    )}
                    {snap && canRollback && !isCurrent(e) && <span className="tiny muted">superseded</span>}
                    {snap && !canRollback && <span className="tiny muted">methodology or admin role</span>}
                    {!snap && e.action === 'publish' && <span className="tiny muted">no snapshot</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Roll back a publication">
        {confirm && rollbackTarget(confirm) && (
          <>
            <p>
              <strong>{rollbackTarget(confirm)!.previous_version!.id}</strong> becomes the published version again and <strong>{rollbackTarget(confirm)!.published_id}</strong> is archived. Country pointers move back. Results computed meanwhile keep the version they were computed with.
            </p>
            <Callout kind="warn">The rolled-back version keeps its content exactly as published; nothing is merged. Edits made to drafts are not affected.</Callout>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-primary" data-autofocus onClick={doRollback}>Roll back</button>
              <button type="button" className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
