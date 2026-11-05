import { useEffect, useState, type ReactNode } from 'react';
import { Link, navigate, useRoute } from '../router/index.tsx';
import { ROLE_ORDER, useStore } from '../store/index.tsx';
import { fmt, useT } from '../i18n/index.tsx';
import type { Lang, Role } from '../types.ts';
import { useLive } from './Live.tsx';
import { Dialog } from './Dialog.tsx';
import { PageWeight } from './PageWeight.tsx';

export function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { state, update, reset } = useStore();
  const { announce, toast } = useLive();
  const route = useRoute();
  const [confirmReset, setConfirmReset] = useState(false);
  const role = state.role;
  const isStaff = role !== 'company';

  // scrollable tables must be keyboard reachable: mark the ones that actually overflow
  useEffect(() => {
    const mark = () => {
      document.querySelectorAll<HTMLElement>('.table-wrap').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1) {
          el.tabIndex = 0;
          el.setAttribute('role', 'region');
          if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.querySelector('caption')?.textContent?.trim() || 'Table');
        } else {
          el.removeAttribute('tabindex');
          el.removeAttribute('role');
        }
      });
    };
    const t1 = window.setTimeout(mark, 50);
    const t2 = window.setTimeout(mark, 600);
    window.addEventListener('resize', mark);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', mark);
    };
  }, [route.path, state.lang, state.role]);

  const setLang = (lang: Lang) => update((s) => ({ ...s, lang }));
  const setRole = (r: Role) => {
    update((s) => ({ ...s, role: r }));
    announce(`${t.role}: ${t.roles[r]}`);
    if (r === 'company' && route.path.startsWith('/admin')) navigate('/');
  };
  const goOnline = () => {
    const n = state.draft?.pending_sync.length ?? 0;
    update((s) => ({ ...s, offline: false, draft: s.draft ? { ...s.draft, pending_sync: [] } : s.draft }));
    toast(fmt(t.synced, { n }));
  };

  return (
    <>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t.skip}</a>
      <div className="banner" role="region" aria-label="Disclaimer">
        <strong>Unofficial concept by Kikkey</strong> · Synthetic data · Not affiliated with or endorsed by ATNi
      </div>
      <header className="header">
        <div className="header-inner">
          <a href="#/" className="brand">{t.appName}<small>{t.concept}</small></a>
          <nav className="nav" aria-label="Main">
            <Link to="/" exact>{t.nav.home}</Link>
            <Link to="/assess">{t.nav.assess}</Link>
            <Link to="/results">{t.nav.results}</Link>
            <Link to="/roadmap">{t.nav.roadmap}</Link>
            <Link to="/calculator">{t.nav.calculator}</Link>
            <Link to="/investors">{t.nav.investors}</Link>
            <Link to="/policy">{t.nav.policy}</Link>
            {isStaff && <Link to="/admin">{t.nav.admin}</Link>}
            <Link to="/account">{t.nav.account}</Link>
            <Link to="/evaluators">{t.nav.evaluators}</Link>
          </nav>
          <div className="header-tools">
            <div className="segmented" role="group" aria-label={t.lang}>
              <button type="button" lang="en" aria-pressed={state.lang === 'en'} onClick={() => setLang('en')}>EN</button>
              <button type="button" lang="sw" aria-pressed={state.lang === 'sw'} onClick={() => setLang('sw')}>SW</button>
            </div>
            <label className="row" style={{ margin: 0, gap: 6, fontWeight: 400 }}>
              <span className="role-badge">{t.role}</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ minHeight: 36, width: 'auto', padding: '4px 8px' }} data-tour="role">
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>{t.roles[r]}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmReset(true)}>{t.resetDemo}</button>
          </div>
        </div>
      </header>
      {state.offline && (
        <div className="offline-bar" role="status">
          {t.offline} <button type="button" className="btn btn-sm" onClick={goOnline}>{t.backOnline}</button>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <div className="print-banner">Unofficial concept by Kikkey · Synthetic data · Not affiliated with or endorsed by ATNi</div>
        {children}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Unofficial concept by Kikkey · Synthetic data · Not affiliated with or endorsed by ATNi</span>
          <Link to="/accessibility">{t.nav.accessibility}</Link>
          <Link to="/evaluators">{t.nav.evaluators}</Link>
          <span>{t.appName} · {t.concept} · v0.1</span>
          <span className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-sm" aria-pressed={state.settings.lite} onClick={() => update((s) => ({ ...s, settings: { ...s.settings, lite: !s.settings.lite } }))}>
              {state.lang === 'sw' ? 'Hali nyepesi' : 'Lite mode'}: {state.settings.lite ? (state.lang === 'sw' ? 'imewashwa' : 'on') : (state.lang === 'sw' ? 'imezimwa' : 'off')}
            </button>
            <PageWeight lang={state.lang} />
          </span>
        </div>
      </footer>
      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title={t.resetDemo}>
        <p>{t.resetConfirm}</p>
        <div className="row">
          <button type="button" className="btn btn-primary" data-autofocus onClick={() => { reset(); setConfirmReset(false); navigate('/'); toast(t.resetDemo + ' ✓'); }}>{t.resetDemo}</button>
          <button type="button" className="btn" onClick={() => setConfirmReset(false)}>{t.common.cancel}</button>
        </div>
      </Dialog>
    </>
  );
}
