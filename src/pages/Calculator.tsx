import { useState } from 'react';
import productJson from '../data/product.json';
import { fmt, useLang, useT } from '../i18n/index.tsx';
import { nutriScore2023 } from '../calculator/nutriscore.ts';
import { nextGradeHint } from '../calculator/nextGrade.ts';
import { Callout, GradeBadge } from '../components/Bits.tsx';
import type { Nutrients } from '../types.ts';

type Key = keyof Nutrients;
const KEYS: { key: Key; label: keyof ReturnType<typeof useT>['calc']; step: number; max: number }[] = [
  { key: 'energy_kj', label: 'energy', step: 10, max: 4000 },
  { key: 'sugars_g', label: 'sugars', step: 0.1, max: 60 },
  { key: 'sat_fat_g', label: 'satfat', step: 0.1, max: 30 },
  { key: 'salt_g', label: 'salt', step: 0.01, max: 6 },
  { key: 'fibre_g', label: 'fibre', step: 0.1, max: 20 },
  { key: 'protein_g', label: 'protein', step: 0.1, max: 40 },
  { key: 'fvl_percent', label: 'fvl', step: 1, max: 100 },
];
const SLIDERS: Key[] = ['sugars_g', 'salt_g', 'sat_fat_g'];

function pick(v: Record<string, unknown>): Nutrients {
  return { energy_kj: v.energy_kj as number, sugars_g: v.sugars_g as number, sat_fat_g: v.sat_fat_g as number, salt_g: v.salt_g as number, fibre_g: v.fibre_g as number, protein_g: v.protein_g as number, fvl_percent: v.fvl_percent as number };
}

function clampNutrients(v: Nutrients): Nutrients {
  const out = { ...v };
  for (const k of KEYS) out[k.key] = Math.min(k.max, Math.max(0, Number.isFinite(out[k.key]) ? out[k.key] : 0));
  return out;
}

/** Defined at module level so React keeps the inputs mounted (and focused) between keystrokes. */
function VariantInputs({ which, v, set, labels }: { which: 'A' | 'B'; v: Nutrients; set: (n: Nutrients) => void; labels: ReturnType<typeof useT>['calc'] }) {
  return (
    <fieldset>
      <legend>{labels.variant} {which} — {productJson.variants[which].label}</legend>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {KEYS.map((k) => (
          <div key={k.key} className="field" style={{ margin: 0 }}>
            <label htmlFor={`${which}-${k.key}`} className="small">{labels[k.label] as string}</label>
            <input id={`${which}-${k.key}`} type="number" inputMode="decimal" min={0} max={k.max} step={k.step} value={v[k.key]} onChange={(e) => set(clampNutrients({ ...v, [k.key]: Number(e.target.value) }))} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function CalculatorPage() {
  const t = useT();
  const lang = useLang();
  const [a, setA] = useState<Nutrients>(pick(productJson.variants.A));
  const [b, setB] = useState<Nutrients>(pick(productJson.variants.B));
  const ra = nutriScore2023(a);
  const rb = nutriScore2023(b);
  const hint = nextGradeHint(b);
  const nutrientLabel = (k: Key) => t.calc[KEYS.find((x) => x.key === k)!.label] as string;
  const nutrientName = (k: Key) => nutrientLabel(k).replace(/\s*\(.*\)\s*$/, '').toLowerCase();
  const rows: { label: string; a: number | string; b: number | string }[] = [
    { label: `${t.calc.energy}`, a: ra.points.energy, b: rb.points.energy },
    { label: `${t.calc.sugars}`, a: ra.points.sugars, b: rb.points.sugars },
    { label: `${t.calc.satfat}`, a: ra.points.sat_fat, b: rb.points.sat_fat },
    { label: `${t.calc.salt}`, a: ra.points.salt, b: rb.points.salt },
    { label: t.calc.unfavourable, a: ra.n_total, b: rb.n_total },
    { label: `${t.calc.fibre}`, a: ra.points.fibre, b: rb.points.fibre },
    { label: `${t.calc.protein}${!ra.protein_counted || !rb.protein_counted ? ' *' : ''}`, a: ra.protein_counted ? ra.points.protein : `(${ra.points.protein})`, b: rb.protein_counted ? rb.points.protein : `(${rb.points.protein})` },
    { label: `${t.calc.fvl}`, a: ra.points.fvl, b: rb.points.fvl },
    { label: t.calc.favourable, a: ra.protein_counted ? ra.p_total : ra.p_total - ra.points.protein, b: rb.protein_counted ? rb.p_total : rb.p_total - rb.points.protein },
    { label: t.calc.score, a: ra.score, b: rb.score },
  ];

  return (
    <div>
      <h1>{t.calc.title}</h1>
      <Callout kind="warn"><strong>{t.calc.disclaimer}</strong></Callout>
      <p className="lead" style={{ marginTop: 12 }}>{t.calc.lead}</p>
      <p className="small muted">{t.calc.product}: {productJson.name} · {productJson.basis}</p>
      <div className="grid grid-2">
        <div className="card">
          <VariantInputs which="A" v={a} set={setA} labels={t.calc} />
          <VariantInputs which="B" v={b} set={setB} labels={t.calc} />
          <section aria-labelledby="sliders-h">
            <h2 id="sliders-h" style={{ fontSize: '1rem' }}>{t.calc.sliders}</h2>
            {SLIDERS.map((k) => {
              const def = KEYS.find((x) => x.key === k)!;
              return (
                <div key={k} className="field">
                  <label htmlFor={`sl-${k}`} className="small">{nutrientLabel(k)}: <strong>{b[k]}</strong></label>
                  <input id={`sl-${k}`} type="range" min={0} max={def.max} step={def.step} value={b[k]} onChange={(e) => setB({ ...b, [k]: Number(e.target.value) })} />
                </div>
              );
            })}
            <Callout kind="info">
              {hint.target ? (
                <>
                  <strong>{fmt(t.calc.nextGrade, { g: hint.target })}:</strong>{' '}
                  {hint.change ? fmt(t.calc.nextGradeText, { nutrient: nutrientName(hint.change.nutrient), from: hint.change.from, to: hint.change.to }) : t.calc.nextGradeNotFound}
                </>
              ) : (
                t.calc.nextGradeNone
              )}
              <div className="tiny muted" style={{ marginTop: 4 }}>{t.calc.disclaimer}</div>
            </Callout>
          </section>
        </div>
        <div className="card">
          <div className="row" style={{ gap: 24, justifyContent: 'space-around', marginBottom: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="small muted">{t.calc.variant} A</div>
              <GradeBadge grade={ra.grade} large label="A" />
              <div className="small">{t.calc.score}: {ra.score}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="small muted">{t.calc.variant} B</div>
              <GradeBadge grade={rb.grade} large label="B" />
              <div className="small">{t.calc.score}: {rb.score}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="small muted">{t.calc.difference}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600 }}>{rb.score - ra.score > 0 ? '+' : ''}{rb.score - ra.score}</div>
              <div className="small">{ra.grade} → {rb.grade}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{t.calc.component}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.calc.component}</th>
                  <th scope="col" className="num">{t.calc.pointsA}</th>
                  <th scope="col" className="num">{t.calc.pointsB}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} style={r.label === t.calc.score || r.label === t.calc.unfavourable || r.label === t.calc.favourable ? { fontWeight: 600 } : undefined}>
                    <th scope="row" style={{ fontWeight: 'inherit', background: 'transparent' }}>{r.label}</th>
                    <td className="num">{r.a}</td>
                    <td className="num">{r.b}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" style={{ background: 'transparent' }}>{t.calc.letter}</th>
                  <td className="num"><GradeBadge grade={ra.grade} /></td>
                  <td className="num"><GradeBadge grade={rb.grade} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          {(!ra.protein_counted || !rb.protein_counted) && <p className="hint">* {t.calc.proteinNotCounted}</p>}
          <p className="tiny muted" style={{ marginTop: 12 }}>{t.calc.source}</p>
          <p className="tiny muted">{lang === 'sw' ? 'Thamani za kielelezo za bidhaa ya kubuni.' : 'Illustrative values of a synthetic product.'}</p>
        </div>
      </div>
    </div>
  );
}
