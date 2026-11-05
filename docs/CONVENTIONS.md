# Build conventions (read before touching the UI)

This is an **unofficial concept prototype by Kikkey**. Synthetic data only. Not affiliated with or endorsed by ATNi.

## Hard rules (every page)
1. The persistent banner is rendered by `Layout` — never add another, never remove it.
2. The string "ATNi" may appear only in: the banner, `src/pages/Evaluators.tsx`, the calculator disclaimer, the Power BI placeholder text, and short explanatory notes about what production would integrate. Never as a logo, brand colour, or copied text. Never invent ATNi statements.
3. No external requests of any kind (no fetch, no iframes, no fonts, no analytics, no images from the web). Everything works offline after load.
4. Everything simulated is labelled where it is visible with `<Sim/>` (from `components/Bits.tsx`) or the word "simulated": roles/login, offline, e-mails, PDFs, the assistant's model, Power BI, spend limits, analytics, import, deletion.
5. No medical, dietary, investment or legal advice. No untrue claims in the UI (never "WCAG compliant", never "tested with screen readers").
6. Mobile first: company-facing pages must be comfortable at 360 px; admin must be usable on a laptop and not break at 360 px.

## Stack and imports
- React 19 + TypeScript, Vite, hash router. Import with explicit extensions: `import { useStore } from '../store/index.tsx'`, `import type { Question } from '../types.ts'`.
- State: `const { state, update, log, now } = useStore()` (`src/store/index.tsx`). `update(s => ({...s, ...}))` is immutable. `log(action, target, details?, snapshot?)` appends to the audit journal with the current role. Persisted in localStorage automatically (try/catch inside). Never mutate `state` objects in place.
- Role gating: `can.editMethodology(state.role)` etc. from `src/store/index.tsx`. Role names: company | content | methodology | analyst | admin. When a role lacks access, render a `<Callout kind="warn">` headed with `t.common.noAccess` **and a one-sentence explanation of why that role cannot see it** (e.g. content editors do not see company answers).
- i18n: `const t = useT()` gives the dictionary in `src/i18n/strings.ts`; `const lang = useLang()`; `fmt(t.x, {n})` for placeholders. **Do not edit `strings.ts`** (merge conflicts). Put new strings in your own module, e.g. `src/i18n/admin.ts` exporting `{ en: {...}, sw: {...} }` and a hook that picks by `useLang()`. Swahili may be a draft; admin UI may stay English with an English-only note.
- Router: `useRoute()` → `{ path, params }`; `navigate('/path')`; `<Link to="/path">`; `href('/path')`.
- Live announcements: `const { announce, toast } = useLive()` (`components/Live.tsx`). Use `toast()` for confirmations; `announce()` for silent screen-reader updates.
- Dialogs: `<Dialog open onClose title>` (`components/Dialog.tsx`) — native `<dialog>`, Esc and focus return handled.
- Charts: `<BarChart title bars unit max />` (`components/BarChart.tsx`) — SVG with a table alternative built in. No other chart libs.
- Data: methodology versions in `state.versions`; published version for a country via `activeVersionFor(state, country)` (`lib/data.ts`); localisation helpers `topicName`, `qText`, `recText`, `ruleTitle`, `fmtDate`; downloads via `downloadJson`/`downloadText`. The 74 seeded assessments: `const { all, loading } = useAssessments()` (`lib/useAssessments.ts`) — lazy loaded.
- Engine (pure, tested): `src/engine/index.ts` → `computeResult, buildRoadmap, validateVersion, diffVersions, computeImpact, importNutriCheck, recommendationFor, maxScore, achievableScores`. Assistant: `src/assistant/index.ts`. Calculator: `src/calculator/*`.
- CSS: use existing classes in `src/styles.css` (card, panel, callout-*, chip-*, btn, btn-primary, btn-sm, grid grid-2, row, kv, table-wrap, issue/dot-*, phase-*, steps, sim, sr-only). Add page-specific CSS only if unavoidable, scoped under a page class, appended to `styles.css` in a clearly marked block.

## Accessibility checklist for every page
- One `<h1>`, then a sensible heading order. Pages render inside `<main id="main">` already.
- Every input has a `<label>` (or `aria-label`), groups use `<fieldset><legend>`.
- Form errors: a summary at the top with links to fields, `aria-invalid` + `aria-describedby` on the field.
- Keyboard: everything reachable and operable; no hover-only actions; visible focus comes from global CSS.
- Targets ≥ 24×24 px (`.btn` is 40 px; `.btn-sm` 32 px; icon-only buttons need `aria-label`).
- Status changes announced via `useLive()`.
- Tables have `<caption>` or an accessible name and `scope` on headers.
- Respect `prefers-reduced-motion` (global CSS does; add no animations).

## Definition of done for a page
`npx tsc -b` passes, `npx vite build` passes, the page renders without console errors at 360 and 1280 px, labels for simulated things are present, no forbidden "ATNi" usage, no external requests.
