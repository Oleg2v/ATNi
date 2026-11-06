# Nutrition Data Hub — concept: delivery report (5 Nov 2026)

Unofficial concept prototype by Kikkey for the RFP "Digital Product Design & Development of the MarketFit Nutrition Data Hub". Synthetic data only. Not affiliated with or endorsed by ATNi. **Not published** — static build archive only, pending the explicit go-ahead.

## 1. Primary sources checked (5 Nov 2026)
- RFP page (homerun): deadline 11 Nov 2026 23:59 CET confirmed; questions deadline (4 Nov) already passed; budget €75,000 incl. VAT; timeline from 4 Jan 2027; five tools; EN/SW; WCAG 2.1/2.2 AA; EU data storage; Power BI dashboards exist and must stay integrable; roadmap = "rules and LLM-based templated generation", AI Policy applies; RFP Q&A: data used to generate roadmaps with an LLM "must be kept secure and must not be used to train the other models", and recurring LLM costs must be itemised; no per-tool functional spec published (Investor/Policy hubs and Impact Investment Tool are names only).
- NutriCheck SURVEY.md: question format (topic, question, question_id, info, dependency, propositions option/choices/text, recommandations fixed/scored, count_score_map / count_score_coeff / none_of_the_above, text_inputs, grading 80/60/40/20) — reproduced as a *format*, no content or code copied. No LICENSE file in that repository.
- Nutri-Score: Santé publique France "Nutri-Score Questions & Answers", English version dated 17 March 2025 (Tables 5–6 and the general-foods formula, pp. 26–28) and the 2022 Scientific Committee update report (§1.8.2 final thresholds). **Thresholds confirmed from the primary source.** The documents contain no per-product worked examples, so unit tests use hand-computed cases from the tables (documented in `src/calculator/nutriscore.test.ts`). Boundary convention: a value exactly on a threshold stays in the lower band (tables use strict ">").
- ATNi AI Ethics Policy (August 2026): transparency and accountability, bias mitigation (Western-trained models), privacy (GDPR, EU AI Act), human-centric oversight, sustainability (energy of models), ethics (no fabricated testimonials or evidence-like imagery). Reflected in: sources on every assistant answer, human hand-off queue, "assembled from sources" labelling, settings page notes.

## 2. Status by priority

### P0 — done and verified (all 9 items)
1. **Start**: country (Kenya, Tanzania active; Nigeria, Senegal, Indonesia, Bangladesh marked planned and not startable), company size, EN/SW; `html lang` follows the language (e2e-tested).
2. **Questionnaire**: 5 topics as steps with progress bar, "Why we ask" toggles, conditional questions (1.2 standard dependency; 2.2 depends on the exact answer *Yes*; 2.3 chains on 2.2), autosave to localStorage with aria-live "Saved", error summary with links to unanswered questions, submit anyway. **Simulate offline**: a pending-sync counter grows while offline, survives reload, and "Back online" announces "N answers synchronised".
3. **Results**: overall and topic letters, SVG chart with table alternative, **Why this score** panel: each question, answer, points, maximum, formula, thresholds, methodology version and publication date, calculation timestamp. Hidden questions are shown as "did not apply" and excluded from the maximum (design decision, explained in the knowledge base).
4. **Roadmap**: now / next / later from 14 published rules; every step shows priority, effort, the recommendation and *Because you answered "…"* with the question and points; topic filter; print stylesheet with the banner (PDF via browser print, labelled).
5. **Calculator**: variants A and B of the synthetic porridge mix, component points table, N, P, protein rule, final score, letter, difference. Nutri-Score 2023 general-foods algorithm confirmed from the Santé publique France primary source (see §1); 24 unit tests. P2 sliders and the "smallest single change to the next letter" hint are included. Disclaimer on the page and in the hint.
6. **Admin → methodology**: versions list (v1.0 published, v1.1 draft), editor per question (texts, options, scores, choice maps, dependencies incl. exact-answer dependency, recommendations, Swahili fields), live health panel, change 5 → 2.5 in question 2.1 produces the error **"No recommendation for score 2.5 in question 2.1"** that links to the field and disables Publish; "Add recommendation" is prefilled with the missing score; warning for empty Swahili; publish dialog with a required comment and warning acknowledgement; journal entry; v1.0 archived; the company's previous result keeps v1.0 and its letter (e2e-tested); new assessments start on v1.1.
7. **Roles**: demo role switcher (labelled) for Company user, Content editor, Methodology editor, Analyst, Admin; content editors get *No access* with an explanation on company answers (results, roadmap) and on scoring pages; permission matrix shown in Admin → Users.
8. **Assistant**: "Ask about my results" → *Why did I get a C on marketing?* answers from the stored scores and the recommendation library with source chips (result v1.0, methodology Q2.2/2.3/2.4, recommendations R-14, knowledge-base ids); health questions are declined with an offer to hand over; unknown questions → "not found in the published materials — send to the hub team?" → ticket HQ-000n → appears in Admin → Hand-off queue → staff answer → "Publish as FAQ" → the assistant finds it on the next ask (e2e-tested end to end). BM25 retrieval over 35 EN/partly-SW knowledge-base entries runs in the browser; the footer line about the EU-hosted model is present.
9. **Power BI**: dashed placeholders without data or iframes on Admin overview, Analytics, Investors and Policy.

### P1 — done (all 9 items)
10. For evaluators page: what really works, what is simulated, requirement → screen table with links, limitations, sources, tour button.
11. Guided tour: 6 steps across routes (results → why → roadmap → assistant → publish gate → immutable past result), keyboard operable, Esc skips, focus returns to the start button (e2e-tested).
12. Impact before publication: "Of N past assessments, M would have a different letter (x lower, y higher); they stay on v1.0 until the company assesses again", transitions table, per-assessment rows, plus the line-by-line diff v1.0 → v1.1. The impact engine also shows the denominator effect: lowering a maximum moves some past letters *up*.
13. Methodology health: every achievable score has a recommendation, every question has Swahili text, no dangling dependencies or cycles, roadmap rules point to existing recommendations, maximum computed; green/red items linking to the field in the editor.
14. Importer: file upload or the bundled `sample-nutricheck-format.json` → report (counts, topics, scores without recommendations, relations the source format could not express, needs-review items, skipped rows) → draft version. Result of the local check on the public survey.json in §4.
15. Engagement analytics (synthetic, labelled): funnel started → completed → downloaded plan, monthly table, drop-off per question with "At question 2.3 19.3 % leave — open in editor", country × language table.
16. Investor view: consenting companies only, country and topic filters, letter distributions, typical gaps, priorities for engagement (most frequent roadmap rules), no investment recommendation.
17. Policy view: Kenya vs Tanzania by topic, example policy indicators derived from questions, small cells suppressed (n < 5), no company-level data.
18. Add a country wizard: planned country → languages → copy methodology as `v1.0-NG` draft → review with "national thresholds: to be provided" → publish now or save as draft (e2e-tested).

### P2 — done (all 5 items)
19. Calculator sliders for sugars, salt, saturated fat and the next-letter hint (labelled illustrative).
20. Translation coverage per section, CSV export (RFC 4180) and import into a draft.
21. Account: download my data (JSON), delete my account (simulated), consent toggle; retention period and consent text version in Admin → Settings.
22. Lite mode (footer toggle and Admin → Settings): charts become tables, decoration removed; the footer shows the **really measured** transferred bytes of the current page load from the Resource Timing API.
23. Rollback of a publication from the journal (e2e-tested).

## 3. What is simulated (and labelled as such in the UI)
Login and roles (role switcher), offline/online state (toggle), e-mails (none sent), PDF (browser print), the assistant's wording (assembled from retrieved sources, no model call), Power BI (placeholder), the assistant spend limit (no effect), analytics numbers (synthetic dataset), import "server" (parsing is real, nothing is uploaded), data deletion and the users list (local state only). Everything else — scoring, conditional logic, roadmap rules, validation and publish gate, impact and diff, importer parsing, BM25 retrieval, calculator, persistence, language switch — is real code running in the browser.

## 4. Importer check on the public NutriCheck survey.json (local only, file not shipped)
Run with `node scripts/check-importer.ts <path to survey.json>` on 5 Nov 2026.
- Parsed: 50 questions, 5 topics (Management & Products 15, Marketing 12, Labeling 11, Engagement 8, Workforce Programs 4); 33 option, 16 choices, 1 text; 12 with a dependency; recommendations: 11 fixed, 22 scored, 17 none; 0 rows skipped.
- Scores without a recommendation: **none** (every scored option question has an entry for every achievable score).
- Relations the source format could not express: 12 dependencies of the "anything but No" kind (imported as-is; the hub can now attach a specific answer), **2 chained dependencies** present in the file although the source documentation says chains are unsupported.
- Needs review before publishing: **6 multiple-choice questions without count_score_map or count_score_coeff** (1.6.2, 2.2, 2.3.2, 2.5, 2.6, 4.3.2 — the source system applies an undocumented default); **1 self-dependency (5.4.1 depends on 5.4.1)** which the hub's cycle check rejects.
- Validation of the imported draft: 8 errors (6 unscored choices, 1 self-dependency, 1 cycle), 121 warnings (no Swahili text, as expected for an English-only source), maximum 200 points (Management & Products 90, Marketing 30, Workforce 20, Labeling 50, Engagement 10). Not publishable until the 8 errors are resolved — which is exactly what the health panel is for.

## 5. Known limitations
- No backend: all state lives in this browser's localStorage; two people cannot see each other's edits; "Reset demo" restores the synthetic set.
- Swahili UI and content strings are drafts written by the prototype team and are marked "draft translation, needs native review"; 12 of 24 recommendations have Swahili text by design to demonstrate the coverage tooling.
- Calculator covers the 2023 general-foods algorithm only (no beverages, fats/oils/nuts, cheese or red-meat rules); official documents provide no per-product worked examples, so tests are hand-computed from the tables.
- Impact Investment Tool is not prototyped (stated on the start and evaluators pages).
- Grading thresholds and roadmap rules are shown but not editable in the admin UI (rules are listed read-only; thresholds are validated and displayed).
- Assistant intent detection is keyword-based (EN/SW lists); a production system would add a classifier and native-speaker review of the Swahili lists.
- Admin interface is English only.

## 6. Verification results (5 Nov 2026, build v0.1)
| Check | Result |
|---|---|
| Unit tests (Vitest) | 53 passed: engine (scoring, dependencies, grades, recommendations, roadmap, validation incl. 5 → 2.5 block, diff, impact, importer), assistant (classify, BM25, answer, hand-off), calculator (tables, letters, protein rule, next-letter hint) |
| End-to-end (Playwright, Chromium) | 40 passed across desktop (1280 px) and mobile (360 px) projects: company flow with conditional questions and offline sync, language switch, assistant (sources, refusal, hand-off), calculator, keyboard-only scenario, methodology edit → block → publish → immutability, roles and health page, importer, hand-off queue → FAQ, add-country wizard, guided tour, Lite mode, account data rights, translations CSV, rollback |
| axe-core (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) | 0 violations on all 22 routes at 1280 px (logged-in sample data, admin role for admin routes) |
| Keyboard-only | Automated scenario passes (skip link, radios/checkboxes, info toggles, focus moves to topic headings, dialogs with Esc and focus return, assistant drawer, tour) |
| "ATNi" in code | Only in the banner (Layout), the calculator disclaimer, the Power BI placeholder string, the evaluators page statement and one source comment; none in data files |
| External requests | None (grep for http(s)://, fetch(, iframe, beacon, XHR in src: no hits; the sample import file is bundled) |
| First load (measured by `npm run size` on dist) | about 110 KB gzipped JS (index 24 KB + store/data 15 KB + shared 6 KB + React 68 KB), 4 KB CSS, total about 115 KB gzip / 99 KB brotli; admin chunk 35 KB gzip and the 74 assessments 14 KB gzip load lazily. Budget: 250 KB gzip JS |
| Screenshots | 44 files in `docs/screenshots` (22 routes × 360 and 1280 px) |

## 6a. Adversarial review round (6 Nov 2026)
After the build, four independent review passes (honesty of wording, accessibility beyond axe, engine correctness, evaluator UX) produced 65 candidate findings; each was verified adversarially before fixing. Fixed, among others: focus containment and focus return of the assistant drawer; per-dialog label ids; calculator inputs losing focus on each keystroke; unbounded search in the next-letter hint on large inputs; company role able to open another company's result via the URL; content and methodology roles reading answers through the assistant; a published country copy leaving the country "planned"; rollback overwriting the original publication date; "Saved" announced while browser storage was failing; consent withdrawal not reaching the seeded assessment; validation gaps (blank or duplicate labels, negative scores, over-long score maps, duplicated cycle errors); keyword health detection matching "treat" or "dose" inside other words; results intent hijacking knowledge-base questions; tour step 5 breaking once v1.1 had been published; horizontal overflow at 360 px (grid items, table captions); sticky header hiding focused controls; invisible focus on the language switch; input border contrast; 15 px topic-step buttons; misleading sentences (re-consent flow, Swahili coverage, "most companies finish in…", investor "working on" wording, unsourced evidence claims); unanswered questions silently scoring 0 without a notice; English answer labels inside Swahili text. Refuted (left as is): the assistant footer sentence, the 20–30 minute estimate (now softened), the Swahili word choice for "simulated login" (adjusted anyway).

## 7. Deliverables in this repository
- `release/nutrition-data-hub-concept-static.zip` — static build (open `index.html` from any static server; hash routing, no server required).
- Source: `src/` (engine, assistant, calculator, data, pages), `e2e/` tests, `scripts/` (data generator, size measurement, importer check, screenshots).
- `docs/screenshots/`, `docs/DEMO-SCRIPT.md` (two-minute walkthrough), `docs/CONVENTIONS.md`, this report.
- Not published anywhere. Deployment waits for the explicit "publish" instruction.

## 8. How to run
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build && npm run e2e   # end-to-end + axe (needs Chromium via Playwright)
npm run size       # first-load measurement on dist/
```
