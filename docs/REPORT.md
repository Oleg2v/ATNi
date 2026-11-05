# Nutrition Data Hub — concept: delivery report (draft, updated at the end of the build)

Unofficial concept prototype by Kikkey for the RFP "Digital Product Design & Development of the MarketFit Nutrition Data Hub". Synthetic data only. Not affiliated with or endorsed by ATNi. **Not published** — static build archive only, pending the explicit go-ahead.

## 1. Primary sources checked (5 Nov 2026)
- RFP page (homerun): deadline 11 Nov 2026 23:59 CET confirmed; questions deadline (4 Nov) already passed; budget €75,000 incl. VAT; timeline from 4 Jan 2027; five tools; EN/SW; WCAG 2.1/2.2 AA; EU data storage; Power BI dashboards exist and must stay integrable; roadmap = "rules and LLM-based templated generation", AI Policy applies; no per-tool functional spec published (Investor/Policy hubs and Impact Investment Tool are names only).
- NutriCheck SURVEY.md: question format (topic, question, question_id, info, dependency, propositions option/choices/text, recommandations fixed/scored, count_score_map / count_score_coeff / none_of_the_above, text_inputs, grading 80/60/40/20) — reproduced as a *format*, no content or code copied. No LICENSE file in that repository.
- Nutri-Score: Santé publique France "Nutri-Score Questions & Answers", English version dated 17 March 2025 (Tables 5–6 and the general-foods formula, pp. 26–28) and the 2022 Scientific Committee update report (§1.8.2 final thresholds). **Thresholds confirmed from the primary source.** The documents contain no per-product worked examples, so unit tests use hand-computed cases from the tables (documented in `src/calculator/nutriscore.test.ts`). Boundary convention: a value exactly on a threshold stays in the lower band (tables use strict ">").
- ATNi AI Ethics Policy (August 2026): transparency and accountability, bias mitigation (Western-trained models), privacy (GDPR, EU AI Act), human-centric oversight, sustainability (energy of models), ethics (no fabricated testimonials or evidence-like imagery). Reflected in: sources on every assistant answer, human hand-off queue, "assembled from sources" labelling, settings page notes.

## 2. Status by priority
(filled at the end of the build)

## 3. What is simulated
(filled at the end of the build)

## 4. Importer check on the public NutriCheck survey.json (local only, file not shipped)
Run with `node scripts/check-importer.ts <path to survey.json>` on 5 Nov 2026.
- Parsed: 50 questions, 5 topics (Management & Products 15, Marketing 12, Labeling 11, Engagement 8, Workforce Programs 4); 33 option, 16 choices, 1 text; 12 with a dependency; recommendations: 11 fixed, 22 scored, 17 none; 0 rows skipped.
- Scores without a recommendation: **none** (every scored option question has an entry for every achievable score).
- Relations the source format could not express: 12 dependencies of the "anything but No" kind (imported as-is; the hub can now attach a specific answer), **2 chained dependencies** present in the file although the source documentation says chains are unsupported.
- Needs review before publishing: **6 multiple-choice questions without count_score_map or count_score_coeff** (1.6.2, 2.2, 2.3.2, 2.5, 2.6, 4.3.2 — the source system applies an undocumented default); **1 self-dependency (5.4.1 depends on 5.4.1)** which the hub's cycle check rejects.
- Validation of the imported draft: 8 errors (6 unscored choices, 1 self-dependency, 1 cycle), 121 warnings (no Swahili text, as expected for an English-only source), maximum 200 points (Management & Products 90, Marketing 30, Workforce 20, Labeling 50, Engagement 10). Not publishable until the 8 errors are resolved — which is exactly what the health panel is for.

## 5. Known limitations
(filled at the end of the build)

## 6. Verification results
(filled at the end of the build)
