# FPL projections — benchmarks & improvement checklist

Internal reference tying **research direction** (FPL Review methodology, Fix positioning) to **this repo**: `../fpl-predictions/` + **`web/src/livePredictionMappers.js`** + callers (`liveGwMidProjection.js`, Live / Projections UI).

Primary external sources used for roadmap language (public docs only):

- [FPL Review — Understanding EV](https://docs.fplreview.com/the-model/projections/expected-value/)
- [FPL Review — Massive Data Model](https://docs.fplreview.com/the-model/projections/massive-data-model/)
- [FPL Review — Benchmark article (“Ultimate Truth”, 2023)](https://docs.fplreview.com/articles/ultimate-truth/)
- [FPL Review — Massive Data vs bookies / short xG (2020)](https://docs.fplreview.com/articles/massive-data/)
- [Fantasy Football Fix — feature overview](https://www.fantasyfootballfix.com/web_features/)

---

## 1. What “good” might look like (sanity benchmarks)

Weekly FPL point prediction is dominated by variance. Third‑party benchmarking suggests **elite public models cluster** roughly where a **conceptually optimal** simulator would lie on **RMSE / MAE**, with **moderate \(R^2\)** vs realized points (often **single‑digit‑tenths** scale on \(R^2\)) — see the “Ultimate Truth” discussion above.

**Do not chase \(R^2 \approx 0.8`** for GW totals; instead:

| Metric | Role |
|--------|------|
| **RMSE / MAE** vs realized GW pts | Primary error gauges on held‑out gameweeks. |
| **Calibration** | Deciles of predicted vs actual averages (similar count of “surprises”). |
| **Regression to external panel** | Optional: correlate against FPL Review / Fix **after** normalization (captain/mult). |

Treat **~0.3–1.5 xP** deltas between pipelines as noisy unless replicated over **many assets × many GWs**.

---

## 2. Evaluation cookbook (recommended)

1. **Snapshot at deadline**: bootstrap `elements`, `teams`, GW `fixtures`, and (if live) lineup flags — store JSON or deterministic hash per GW.
2. **Labels**: GW \(N\) **realized total_points** from `event` live or history endpoint (captain multiples applied consistently with how projections are surfaced).
3. **Predictions**: run the same mapper path production uses (`bootstrapElementToPlayer` → `predictForPlayerFromMap` / `projectedGwTotalLiveBlend`).
4. **Split**: rolling **train / test** by GW (avoid same‑season leakage for learned weights).
5. **Report**: RMSE, MAE, \(R^2\); optional stratify by position; flag gross outliers (&gt;4 pt error buckets).

Automating this remains **future work**; this doc defines the contract so scripts or notebooks stay aligned.

---

## 3. Data & pipeline checklist (highest ROI first)

### A. Minutes & availability ✅ critical

| Item | Risk | Repo touchpoint |
|------|------|-----------------|
| `chance_of_playing_this_round: null` ≠ 0 | Crushes **expectedMinutes** / **appearance** EV for nailed players | `injuryDoubtScoreFromClassicElement` — **never** coerce null to numeric 0 doubt |
| `status === 'i'` | Should map to sustained doubt | Same helper |
| Press‑conference certainty | Missing in API | Optional manual overrides or scraped flags (product decision) |

### B. Fixture & team priors ✅ large gap vs competitors

| Item | Risk | Repo touchpoint |
|------|------|-----------------|
| Identical **`Team`** fields for every club | Flattens fixture difficulty × attack/defense | `bootstrapTeamToPredictionTeam()` — ingest **`strength_*`**, conceded/attack proxies, pace |
| Missing **odds on `Fixture`** | Weaker \(\lambda_{\text{goals}}\) / totals / CS tails | `classicFixtureToPredictionFixture` — populate from FPL `fixtures` odds when present; optional Odds API |
| No **multi‑GW consistency** | OK for Live; weak for planners | Separate “horizon planner” projection path |

### C. Modeling shape (research‑aligned)

| Theme | Guidance | Package |
|-------|----------|---------|
| **Pillar decomposition** | EV = sum/mixture over scoring categories × minutes | Matches `simulatePlayerGameweekPoints` philosophy |
| **Correlations / match‑level sim** | Same‑fixture goals/CS/BPS compete on one slate | See **[match-level-fpl-projections.md](./match-level-fpl-projections.md)** — phased fixture engine vs today’s IID `simulatePlayerGameweekPoints` |
| **Short “hot” goals** | High noise; overweighting chases ghosts | Tune `goalModel` / ICT blend; prefer sustained xGI |
| **Bonus** | Path‑dependent; conservative scale today | `bonusModel.ts`, `bonusScale` in config |
| **Ensembles / calibration** | Average of disparate models modestly hedges misses | Offline weights vs backtests |

### D. UI / UX (avoid misreads)

| Item | Notes |
|------|--------|
| Analytic **`breakdown` lines** | Expected **contributions**, not attainable fractional FPL chips in one GW |
| **Conditional forecasts** “if in XI” | Optional second column — avoids floors like “never &lt;2 if nailed” distorting unconditional EV |

---

## 4. Competitor deltas (inform feature buying, not copying)

| Source | Signals we can ethically mirror | What we lack without spend |
|--------|--------------------------------|----------------------------|
| **FPL Review** | Probabilistic EV, correlations, horizons, hourly refresh metaphor | Premium Massive Data weights |
| **Fix** | “270+ Opta stats” telemetry story | Licenced Opta / proprietary Optibot |

Closest free wins remain: **fixture odds**, **proper team defence/attack scaling**, **clean availability**, richer **bonus / DC** tuning.

---

## 5. Regression tests

Availability logic is guarded by **`web/src/livePredictionMappers.test.js`** (node:test). Extend when adding bootstrap fields or Draft variants.
