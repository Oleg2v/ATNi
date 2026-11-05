import { useMemo, useState } from 'react';
import { useStore } from '../store/index.tsx';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { useViews } from '../i18n/views.ts';
import { Link } from '../router/index.tsx';
import { useAssessments } from '../lib/useAssessments.ts';
import { downloadJson, fmtDate, fmtDateTime } from '../lib/data.ts';
import { latestOwnAssessment } from '../lib/sample.ts';
import { Callout, GradeBadge, Kv, Sim } from '../components/Bits.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { useLive } from '../components/Live.tsx';

export function AccountPage() {
  const t = useT();
  const v = useViews().account;
  const lang = useLang();
  const { state, update, log, now } = useStore();
  const { all } = useAssessments();
  const { toast, announce } = useLive();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profile = state.profile;
  const companyId = profile?.company_id ?? 'C-001';
  const company = state.companies.find((c) => c.id === companyId) ?? state.companies.find((c) => c.is_current_user);
  const countryDef = state.countries.find((c) => c.code === (profile?.country ?? company?.country));

  const previous = useMemo(() => {
    if (state.accountDeleted) return [];
    const seen = new Set<string>();
    const latest = latestOwnAssessment(state, all);
    const local = state.myAssessments.filter((a) => a.completed_at);
    const list = [...(latest ? [latest] : []), ...local, ...all.filter((a) => a.company_id === companyId && a.completed_at)];
    return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  }, [state, all, companyId]);

  const setConsent = (on: boolean) => {
    update((s) => ({ ...s, investorConsent: on, myAssessments: s.myAssessments.map((a) => ({ ...a, consent_investor_share: on })) }));
    log(on ? 'consent-granted' : 'consent-withdrawn', 'investor-share', `Consent text ${state.settings.consent_text_version}`);
    announce(on ? v.consentOn : v.consentOff);
  };

  const download = () => {
    downloadJson(`my-data-${now().slice(0, 10)}.json`, {
      exported_at: now(),
      consent_text_version: state.settings.consent_text_version,
      investor_consent: state.investorConsent,
      profile: state.profile,
      company: company ?? null,
      draft: state.draft,
      assessments: state.myAssessments,
      tickets: state.tickets,
    });
    log('export-data', 'account', 'JSON download of own data');
    toast(t.account.download + ' ✓');
  };

  const deleteAccount = () => {
    update((s) => ({ ...s, accountDeleted: true, myAssessments: [], draft: null, profile: null, investorConsent: false }));
    log('delete-account', 'account', 'Simulated deletion: local profile, draft and assessments removed');
    setConfirmDelete(false);
    toast(t.account.deleted);
  };

  if (state.accountDeleted) {
    return (
      <div className="grid" style={{ gap: 20 }}>
        <h1>{t.account.title}</h1>
        <Callout kind="warn" role="status">
          <strong>{t.account.deleted}</strong> <Sim />
          <p className="small" style={{ margin: '6px 0 0' }}>{v.deletedLead}</p>
        </Callout>
        <p><Link to="/" className="btn">{v.startOver}</Link></p>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section aria-labelledby="acc-h">
        <div className="page-head">
          <h1 id="acc-h">{t.account.title}</h1>
          <span className="chip">{t.roles.company} · <Sim /></span>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="acc-profile-h">
          <h2 id="acc-profile-h">{v.profile}</h2>
          {profile || company ? (
            <Kv
              items={[
                [v.company, company?.name ?? companyId],
                [v.country, countryDef ? (lang === 'sw' ? countryDef.name_sw : countryDef.name) : '—'],
                [v.size, profile ? t.start.sizes[profile.size] : company ? t.start.sizes[company.size] : '—'],
                [t.lang, profile?.lang === 'sw' ? 'Kiswahili' : 'English'],
              ]}
            />
          ) : (
            <p className="muted">{v.noProfile}</p>
          )}
          {!profile && <p className="hint">{v.noProfile} <Link to="/">{t.start.begin}</Link></p>}
        </section>

        <section className="card" aria-labelledby="acc-consent-h">
          <h2 id="acc-consent-h">{t.account.consent}</h2>
          <label className={`choice${state.investorConsent ? ' choice-selected' : ''}`} style={{ fontWeight: 500 }}>
            <input type="checkbox" checked={state.investorConsent} onChange={(e) => setConsent(e.target.checked)} aria-describedby="acc-consent-hint" />
            <span>{t.results.share}</span>
          </label>
          <p id="acc-consent-hint" className="hint" style={{ margin: '4px 0 0' }}>{t.results.shareHint} {v.consentNote}</p>
          <p className="small muted" style={{ marginTop: 10, marginBottom: 4 }}>{fmt(v.consentVersion, { v: state.settings.consent_text_version })}</p>
          <p className="small muted" style={{ marginBottom: 0 }}>{fmt(v.retention, { n: state.settings.retention_years })}</p>
        </section>
      </div>

      <section className="card" aria-labelledby="acc-prev-h">
        <h2 id="acc-prev-h">{v.previous}</h2>
        {previous.length === 0 ? (
          <p className="muted">{v.noPrevious} <Link to="/">{t.results.goAssess}</Link></p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{v.previous}</caption>
              <thead>
                <tr>
                  <th scope="col">{v.date}</th>
                  <th scope="col">{v.letter}</th>
                  <th scope="col">{v.version}</th>
                  <th scope="col">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {previous.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" style={{ fontWeight: 500, background: 'transparent', color: 'inherit' }}>{fmtDate(a.completed_at, lang)} <span className="tiny muted mono">{a.id}</span></th>
                    <td>{a.result ? <GradeBadge grade={a.result.grade} label={v.letter} /> : '—'} {a.result && <span className="small muted">{a.result.percent}%</span>}</td>
                    <td className="mono">{a.version_id}</td>
                    <td><Link to={`/results?id=${a.id}`} className="btn btn-sm">{v.view}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>{fmt(t.results.staysOn, { v: previous[0]?.version_id ?? '—' })}</p>
      </section>

      <section className="card" aria-labelledby="acc-tickets-h">
        <h2 id="acc-tickets-h">{t.account.tickets}</h2>
        {state.tickets.length === 0 ? (
          <p className="muted">{t.account.noTickets}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {state.tickets.map((tk) => (
              <li key={tk.id} className="issue" style={{ display: 'block' }}>
                <div className="row row-between">
                  <strong><span className="mono muted">{tk.id}</span> · {fmtDateTime(tk.created_at, lang)}</strong>
                  <span className={`chip ${tk.status === 'open' ? 'chip-warn' : 'chip-ok'}`}>{v.status[tk.status]}</span>
                </div>
                <p style={{ margin: '4px 0' }} lang={tk.lang}>{tk.question}</p>
                {tk.answer ? (
                  <div className="panel small">
                    <strong>{v.answer}</strong>{tk.answered_at ? ` · ${fmtDateTime(tk.answered_at, lang)}` : ''}
                    <p style={{ margin: '4px 0 0' }}>{tk.answer}</p>
                  </div>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>{v.awaiting}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="acc-data-h">
        <h2 id="acc-data-h">{v.data}</h2>
        <div className="grid grid-2">
          <div>
            <button type="button" className="btn" onClick={download}>{t.account.download}</button>
            <p className="hint">{v.downloadNote}</p>
          </div>
          <div>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>{t.account.delete} <Sim /></button>
            <p className="hint">{v.deleteNote}</p>
          </div>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>{fmt(v.retention, { n: state.settings.retention_years })}</p>
      </section>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t.account.delete} labelClose={t.common.close}>
        <p>{t.account.deleteConfirm}</p>
        <p className="small muted">{v.deleteNote}</p>
        <div className="row">
          <button type="button" className="btn btn-danger" data-autofocus onClick={deleteAccount}>{t.account.delete} <Sim /></button>
          <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{t.common.cancel}</button>
        </div>
      </Dialog>
    </div>
  );
}
