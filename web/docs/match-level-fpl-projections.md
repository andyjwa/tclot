# Match-level FPL projections (design note)

**Status:** **Phase A + joint bonus slate shipped** in `fpl-predictions` (`matchSimulation.ts`): team goals pooled via Poisson + multinomial splits, clean sheets keyed off conceded goals (`ga`/`gh`), one **BPS-ish ranking** awarding **3/2/1** across **both clubs** per simulated world.

**Web wiring:** Classic `predictedXpForPickRow` now calls `predictMatchFixture` when heuristic `pickLikelyClassicXiElements` can assemble **both** sides (**cached per GW+fixture+iterations**) so iterating many picks does **not** re-run 8k×22-player sim each time—stars still use per-player RNG for marginal fallback. Draft H2H win-% still uses **independent** draws (`simulateFantasyH2hPercents`).

Historical note: marginal `simulatePlayerGameweekPoints` remains for Live / drafts / fallbacks — fast paths where lineup context is unclear.

This note explains **why** match-level modeling matters and **phased** ways to add it without boiling the ocean.

**Related:** [fpl-projections-benchmark-checklist.md](./fpl-projections-benchmark-checklist.md)

---

## 1. What “match-level” means

**Match-level** = one random draw describes the **whole fixture** (or both clubs’ joint outcomes), then each player’s FPL points are a **function** of that draw + their own minutes/sub role.

Contrast with **player-marginal**: each player’s goals/assists/bonus are sampled **independently** even when they share the same pitch.

---

## 2. Where independence hurts most (priority order)

| Effect | Why marginal MC misbehaves | Match-level fix (conceptually) |
|--------|----------------------------|--------------------------------|
| **Bonus (3 / 2 / 1)** | Real BPS ranks **all** active players in the match; only a few get non-zero bonus. IID `sampleBonusWhole` per player never enforces “one slate, competing scores.” | After each sim, compute a **BPS proxy** (or ordered stats) for every player with minutes &gt; 0 → assign **at most one** 3/2/1 path per match (ties handled explicitly). |
| **Team goals → multiple scorers** | If home goals are drawn once, **assists and goal points** for teammates should branch from that total, not three separate Poissons that don’t add up. | Sample **homeGoals**, **awayGoals** (or xG-based counts) once; **split** among lines using conditional lineup/shooter weights. |
| **Clean sheet** | CS is **one team event**; all DEF/GK + eligible MID share the same Bernoulli with different minute gates. | One **teamCS_home**, **teamCS_away** per sim; each player applies **minutes ≥ 60** rule. |
| **Game state** (optional) | Chasing / leading can shift assist rates and sub patterns slightly. | Later phase: latent **state** variable after goals. |

**Minutes** can stay **player-level** for v1 (each player still has start/cameo draws), or be coupled later (shared sub window).

---

## 3. Architecture options (phases)

### Phase A — **Team totals first** (medium effort, high structural win)

1. For each fixture sim: draw **\(G_h, G_a\)** (e.g. Poisson with correlation or Skellam / bivariate approach) from implied totals + strength.
2. **Allocate** home goals to players using **shares** (historical xG share, pen taker flags, position priors), same for away.
3. **CS:** single Bernoulli per defending team for the 90’ outcome; apply per player with sampled minutes.
4. **Bonus:** defer to Phase B or keep marginal until then.

*API sketch:* `simulateFixtureGameweek({ home[], away[], fixture, config }) → { playerId → points[] }` then mean per player.

### Phase B — **BPS / bonus slate** (where “3-2-1” lives)

1. From the same sim, compute a **scalar BPS proxy** per player:  
   `f(goals, assists, saves, CS minutes, blocks, key passes proxy, cards, …)`  
   Use FPL’s weighting where possible; approximate what you can’t observe.
2. Sort players with **minutes &gt; 0** (and any FPL threshold rules you care about).
3. Assign **3, 2, 1** to top three with **tie-break** rules mirroring FPL (or a documented simplification).

This enforces **competition** and usually improves **star** vs **teammate** separation compared to tiny IID μ.

### Phase C — **Full joint** (optional)

Correlated minutes, red cards reducing one side to 10, injury-time noise, etc. Diminishing returns until A+B are validated on backtests.

---

## 4. Integration with this repo

| Layer | Role |
|-------|------|
| **`fpl-predictions`** | Add `simulateFixture...` or `predictMatchMarginalsFromJoint` next to existing exports; keep **old API** for Live incremental paths that only need a quick λ. |
| **`web/src/livePredictionMappers.js`** | Build **lineups** (or “likely XI” from starters in draft + classic hooks) and pass **both squads** + fixture into match sim for pre-deadline **Projections** tab. |
| **`liveGwMidProjection.js`** | May stay **player/incremental** for mid-GW speed; or hybrid: banked real + match-level only for **remaining** if worth the cost. |

**Performance:** match-level MC is **\(O(\text{players} \times \text{iters})\)** per fixture with a larger constant; cache by `(fixtureId, gw)` for planner views.

---

## 5. Validation

When match-level ships, compare to marginal baseline on the same backlog as the benchmark checklist:

- RMSE / MAE / calibration **by position**
- Specifically **bonus rate** buckets (fraction of worlds with bonus ≥ 1 vs reality)
- **Teammate goal** coherence (distribution of joint goals scored vs naive sum of λ)

---

## 6. Product copy (optional)

If we ship conditional structure, UX can say projections use **“shared match simulation”** so captain and teammates aren’t modeled as statistically unrelated — without promising FPL-perfect BPS.
