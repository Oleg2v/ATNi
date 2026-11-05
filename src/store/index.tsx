import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { initialState, type AppState } from './initial.ts';
import { clearState, loadState, saveState } from './persist.ts';
import type { AuditEntry, Role } from '../types.ts';

export type Updater = (s: AppState) => AppState;

interface StoreApi {
  state: AppState;
  update: (fn: Updater) => void;
  reset: () => void;
  /** append an audit entry (actor = current role) */
  log: (action: string, target: string, details?: string, snapshot?: unknown) => void;
  now: () => string;
}

const StoreContext = createContext<StoreApi | null>(null);

/** keys that are persisted; large static datasets stay out of storage unless edited */
function hydrate(saved: Partial<AppState> | null): AppState {
  const base = initialState();
  if (!saved || saved.schema !== 1) return base;
  return { ...base, ...saved };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => hydrate(loadState<AppState>()));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveState(state);
  }, [state]);
  useEffect(() => {
    document.documentElement.lang = state.lang;
    document.documentElement.classList.toggle('lite', state.settings.lite);
  }, [state.lang, state.settings.lite]);

  const update = useCallback((fn: Updater) => setState((s) => fn(s)), []);
  const reset = useCallback(() => {
    clearState();
    setState(initialState());
  }, []);
  const now = useCallback(() => new Date().toISOString(), []);
  const log = useCallback(
    (action: string, target: string, details?: string, snapshot?: unknown) =>
      setState((s) => {
        const entry: AuditEntry = { id: `AU-${String(s.audit.length + 1).padStart(4, '0')}`, at: new Date().toISOString(), actor_role: s.role, action, target, details, snapshot };
        return { ...s, audit: [...s.audit, entry] };
      }),
    [],
  );
  const api = useMemo(() => ({ state, update, reset, log, now }), [state, update, reset, log, now]);
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider missing');
  return ctx;
}

export const ROLE_ORDER: Role[] = ['company', 'content', 'methodology', 'analyst', 'admin'];

/** permission matrix used by the demo role switcher */
export const can = {
  viewAnswers: (r: Role) => r === 'company' || r === 'analyst' || r === 'admin',
  editContent: (r: Role) => r === 'content' || r === 'methodology' || r === 'admin',
  editMethodology: (r: Role) => r === 'methodology' || r === 'admin',
  publish: (r: Role) => r === 'methodology' || r === 'admin',
  viewAnalytics: (r: Role) => r === 'analyst' || r === 'admin',
  manageUsers: (r: Role) => r === 'admin',
  answerTickets: (r: Role) => r === 'content' || r === 'admin',
  manageCountries: (r: Role) => r === 'admin',
};

export function useActiveVersion() {
  const { state } = useStore();
  return state.versions.find((v) => v.status === 'published') ?? state.versions[0];
}
