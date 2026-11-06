import type { ReactNode } from 'react';
import { Link } from '../../router/index.tsx';
import { can, useStore } from '../../store/index.tsx';
import type { AppState } from '../../store/initial.ts';
import { useT } from '../../i18n/index.tsx';
import { useAdminT } from '../../i18n/admin.ts';
import { Callout } from '../../components/Bits.tsx';
import type { Issue } from '../../engine/index.ts';
import type { MethodologyVersion, Role, VersionStatus } from '../../types.ts';

/* ---------- role access per admin page ---------- */

export type Access = (r: Role) => boolean;
const staff: Access = (r) => r !== 'company';

export const access = {
  overview: staff,
  methodologyView: staff,
  methodologyEdit: can.editMethodology,
  health: can.editMethodology,
  import: can.editMethodology,
  analytics: can.viewAnalytics,
  tickets: ((r) => r === 'content' || r === 'methodology' || r === 'admin') as Access,
  audit: staff,
  rollback: can.publish,
  countries: can.manageCountries,
  translations: can.editContent,
  settings: ((r) => r === 'admin') as Access,
  users: can.manageUsers,
};

/** Renders children when the current role passes `allow`; otherwise the standard No-access callout with a reason. */
export function RoleGate({ allow, children }: { allow: Access; children: ReactNode }) {
  const { state } = useStore();
  const t = useT();
  const a = useAdminT();
  const role = state.role;
  if (allow(role)) return <>{children}</>;
  const why = role === 'company' ? a.gate.company : role === 'content' ? a.gate.content : role === 'methodology' ? a.gate.methodology : role === 'analyst' ? a.gate.analyst : a.gate.company;
  return (
    <Callout kind="warn" role="status">
      <strong>{t.common.noAccess}</strong> — {why}
    </Callout>
  );
}

export function useRoleLabel(): string {
  const { state } = useStore();
  const t = useT();
  return t.roles[state.role];
}

/* ---------- small presentational pieces ---------- */

export function StatusChip({ status }: { status: VersionStatus | 'open' | 'answered' | 'published' | 'active' | 'planned' }) {
  const t = useT();
  const cls = status === 'published' || status === 'active' ? 'chip chip-ok' : status === 'draft' || status === 'open' ? 'chip chip-warn' : status === 'answered' ? 'chip chip-accent' : 'chip';
  const label = status === 'published' ? t.common.published : status === 'draft' ? t.common.draft : status === 'archived' ? t.common.archived : status;
  return <span className={cls}>{label}</span>;
}

export function PageHead({ title, lead, right }: { title: string; lead?: ReactNode; right?: ReactNode }) {
  return (
    <>
      <div className="page-head">
        <h1 tabIndex={-1}>{title}</h1>
        {right && <div className="row">{right}</div>}
      </div>
      {lead && <p className="lead">{lead}</p>}
    </>
  );
}

export function Stat({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
  return (
    <div className="card admin-stat">
      <strong>{value}</strong>
      <span className="small muted">{to ? <Link to={to}>{label}</Link> : label}</span>
    </div>
  );
}

/* ---------- helpers ---------- */

export function trunc(s: string, n = 60): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

export function plain(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Next free version id in the vMAJOR.MINOR family (v1.0, v1.1 → v1.2). */
export function nextVersionId(versions: MethodologyVersion[], suffix = ''): string {
  let major = 1;
  let minor = -1;
  for (const v of versions) {
    const m = /^v(\d+)\.(\d+)/.exec(v.id);
    if (!m) continue;
    const ma = Number(m[1]);
    const mi = Number(m[2]);
    if (ma > major || (ma === major && mi > minor)) {
      major = ma;
      minor = mi;
    }
  }
  let candidate = `v${major}.${minor + 1}${suffix}`;
  let bump = minor + 1;
  while (versions.some((v) => v.id === candidate)) {
    bump += 1;
    candidate = `v${major}.${bump}${suffix}`;
  }
  return candidate;
}

/** Deep copy of a version as a new draft. */
export function cloneAsDraft(src: MethodologyVersion, id: string, createdAt: string, comment: string, country: MethodologyVersion['country'] = src.country): MethodologyVersion {
  const copy = JSON.parse(JSON.stringify(src)) as MethodologyVersion;
  delete copy.published_at;
  delete copy.published_by;
  return { ...copy, id, version: id.replace(/^v/, ''), country, status: 'draft', created_at: createdAt, based_on: src.id, comment };
}

/** Element id of the editor field that a validation issue points to. */
export function fieldId(p: Issue['path']): string | null {
  if (p.rule_id) return `field-rule-${p.rule_id}`;
  if (!p.question_id) return p.field === 'grading' ? 'field-grading' : null;
  if (p.lang === 'sw') {
    if (p.rec_id) return `field-${p.question_id}-sw-rec-${p.rec_id}`;
    return `field-${p.question_id}-sw-${p.field ?? 'question'}`;
  }
  const base = `field-${p.question_id}-${p.field ?? 'question'}`;
  return p.score !== undefined ? `${base}-${p.score}` : base;
}

/** Scroll a field container into view and focus its first control. Falls back to parent containers. */
export function focusField(id: string): boolean {
  let target = id;
  for (let i = 0; i < 4 && target; i++) {
    const el = document.getElementById(target);
    if (el) {
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
      // when a recommendation for a specific score is missing, land on the "Add recommendation" button rather than the type select
      const addBtn = i > 0 && /recommandations-/.test(id) ? el.querySelector<HTMLElement>('[data-add]') : null;
      const first = addBtn ?? el.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button, a[href]');
      (first ?? el).focus({ preventScroll: true });
      if (!first && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      if (!first) el.focus({ preventScroll: true });
      return true;
    }
    target = target.slice(0, target.lastIndexOf('-'));
  }
  return false;
}

export function editorHref(versionId: string, focus?: string | null): string {
  return `/admin/methodology/${versionId}${focus ? `?focus=${encodeURIComponent(focus)}` : ''}`;
}

/* ---------- publish / rollback (pure) ---------- */

export interface PublishSnapshot {
  kind: 'publish';
  published_id: string;
  country: string;
  previous_version: MethodologyVersion | null;
  countries_updated: string[];
}

/**
 * Publish version `id`: it becomes 'published', the previously published version for the same
 * country becomes 'archived', and country pointers move to the new id.
 */
export function applyPublish(s: AppState, id: string, nowIso: string, by: string, comment?: string, opts: { keepMetadata?: boolean } = {}): { state: AppState; snapshot: PublishSnapshot } {
  const v = s.versions.find((x) => x.id === id);
  if (!v) return { state: s, snapshot: { kind: 'publish', published_id: id, country: '*', previous_version: null, countries_updated: [] } };
  const previous = s.versions.find((x) => x.status === 'published' && x.country === v.country && x.id !== id) ?? null;
  const versions = s.versions.map((x) => {
    if (x.id === id) return opts.keepMetadata && x.published_at ? { ...x, status: 'published' as const } : { ...x, status: 'published' as const, published_at: nowIso, published_by: by, ...(comment !== undefined ? { comment } : {}) };
    if (previous && x.id === previous.id) return { ...x, status: 'archived' as const };
    return x;
  });
  const updated: string[] = [];
  const countries = s.countries.map((c) => {
    if (v.country === '*') {
      const pointsAtOld = previous ? c.methodology_version_id === previous.id : false;
      const unassigned = c.status === 'active' && !c.methodology_version_id;
      if (pointsAtOld || unassigned) {
        updated.push(c.code);
        return { ...c, methodology_version_id: id };
      }
      return c;
    }
    if (c.code === v.country) {
      updated.push(c.code);
      return { ...c, methodology_version_id: id, status: 'active' as const };
    }
    return c;
  });
  return { state: { ...s, versions, countries }, snapshot: { kind: 'publish', published_id: id, country: v.country, previous_version: previous, countries_updated: updated } };
}

export function isPublishSnapshot(x: unknown): x is PublishSnapshot {
  return typeof x === 'object' && x !== null && (x as PublishSnapshot).kind === 'publish' && 'previous_version' in (x as object);
}

/* ---------- create draft (shared by Versions and Editor) ---------- */

export function useCreateDraft(): (srcId: string) => void {
  const { state, update, log, now } = useStore();
  return (srcId: string) => {
    const src = state.versions.find((v) => v.id === srcId);
    if (!src) return;
    const id = nextVersionId(state.versions);
    const draft = cloneAsDraft(src, id, now(), `Draft created from ${src.id}.`);
    update((s) => ({ ...s, versions: [...s.versions, draft] }));
    log('create-draft', id, `Draft created from ${src.id}.`);
    window.location.hash = `#/admin/methodology/${id}`;
  };
}
