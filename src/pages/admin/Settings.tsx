import { useState } from 'react';
import { useStore } from '../../store/index.tsx';
import { useLive } from '../../components/Live.tsx';
import { Callout, Sim } from '../../components/Bits.tsx';
import { CheckField, NumberField, TextField } from './fields.tsx';
import { PageHead } from './shared.tsx';

/** Platform settings: retention, consent version, Lite mode, data residency and assistant notes. */
export function SettingsPage() {
  const { state, update, log } = useStore();
  const { toast } = useLive();
  const s = state.settings;
  const [cap, setCap] = useState(200);
  const set = (patch: Partial<typeof s>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  return (
    <section>
      <PageHead title="Settings" lead="Platform-wide settings. Changes are journaled. Everything here is stored in your browser in this concept." />
      <div className="grid grid-2">
        <div className="card">
          <h2>Data</h2>
          <NumberField id="field-settings-retention" label="Retention of assessment data (years after last activity)" value={s.retention_years} step={1} min={1} onChange={(n) => set({ retention_years: Math.max(1, Math.round(n)) })} onCommit={(b, a) => { log('settings', 'retention_years', `${b} → ${a}`); toast('Retention updated'); }} hint="Shown to companies in “My account”. Deletion after the period would be a scheduled job in production." />
          <TextField id="field-settings-consent" label="Consent text version" value={s.consent_text_version} onChange={(v) => set({ consent_text_version: v })} onCommit={(b, a) => { log('settings', 'consent_text_version', `"${b}" → "${a}"`); toast('Consent version updated'); }} hint="Companies whose recorded consent is older than this version are asked again at their next assessment." />
          <h3>Data residency</h3>
          <Callout kind="info">Production: data stored in the EU (requirement); this concept stores everything in your browser only.</Callout>
        </div>
        <div className="card">
          <h2>Presentation</h2>
          <CheckField id="field-settings-lite" label="Lite mode" checked={s.lite} onChange={(v) => { set({ lite: v }); log('settings', 'lite', `${s.lite} → ${v}`); toast(v ? 'Lite mode on' : 'Lite mode off'); }} hint="For slow connections and older devices: charts are replaced by their tables, shadows and non-essential decoration are removed. Content and functions stay identical." />
          <h2>AI assistant</h2>
          <ul className="small">
            <li>Answers are assembled strictly from the knowledge base and the company’s own results; questions outside scope are passed to a person (hand-off queue).</li>
            <li>Production: EU-hosted model, no training on the programme’s data (requirement). In this concept no model is called at all.</li>
          </ul>
          <NumberField id="field-settings-cap" label={<>Monthly spend cap for the assistant (EUR) <Sim>spend limit: no effect</Sim></>} value={cap} step={50} min={0} onChange={setCap} hint="Simulated: in production the cap would pause model calls and fall back to source excerpts plus hand-off when reached." />
        </div>
      </div>
    </section>
  );
}
