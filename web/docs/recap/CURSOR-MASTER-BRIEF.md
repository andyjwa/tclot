# TCLOT Recap + Preview blurbs — master brief for Cursor

Implement this end-to-end in the TCLOT repo. Fully automatic — **no human edit/publish step**.

## Out of scope for THIS build
- **Do NOT implement awards** (Warlord / Stumble / etc.). Leave awards / ceremony UI alone for now.
- No Commish publish flow.
- No share-pack work required.

Attach / `@`-mention:
- `CURSOR-MASTER-BRIEF.md` (this file)
- `recap-blurb-config.v1.json`
- `motty-vegan-oneliners-100.json` (Recap / post-match)
- `motty-vegan-preview-oneliners-50.json` (Preview / pre-match)
- `GW5-sample-blurbs.md` (Recap style reference)

---

## Product intent

Improve **written Preview and Recap blurbs** for all **4 H2H fixtures**.

- One data-driven angle per fixture
- Succinct, fun, automatic
- **Less frequent lore** for most managers
- **Motty exception:** vegan one-liner every time he appears (tagged to data; different banks for Preview vs Recap)

Do not rebuild navigation or scoring. Blurbs only.

---

## Shared blurb engine (Preview + Recap)

### Shape
| | Preview | Recap |
|---|---|---|
| Sentence 1 | Required fact line (odds / projection / waiver / tape) | Required fact line (result / margin / waiver haul / model) |
| Sentence 2 | Optional voice — **rarer** for non-Motty | Optional voice — **rarer** for non-Motty |
| Motty sentence 2 | **Required** vegan line from preview bank | **Required** vegan line from recap bank |
| Max sentences | **2** (prefer 1 unless Motty/rivalry) | **2** |
| Length | Tighter than today — aim ≤18 words for sentence 1 | Aim ≤20 words for sentence 1 |

### Angles
Use `recap-blurb-config.v1.json` angles for **Recap**.

For **Preview**, use the same spirit with forward-looking angles:
- `odds_fav` / `odds_dog` / `coin_flip`
- `projected_margin` (blowout vs squeaker projection)
- `model_pick`
- `waiver_claim`
- `tape` / season series
- `rivalry` overlay (brand required when applicable)
- `fallback_preview`

Pick **exactly one** primary angle per fixture. Ban the old fingerprint (both top scorers + % of team + total / wall of projected stats in prose).

### Quality gates (both surfaces)
Reject / regenerate if:
- >2 sentences
- Invented numbers
- Fingerprint stack of redundant stats in one graf
- Same `templateId` reused for that manager within cooldown
- Named rivalry missing exact brand:
  - Andrew Ward vs John Ward → **The Battle of Warderloo**
  - Andrew Ward vs Nick Goodacre → **The Bad Blood Derby**
  - David Higman vs Mike Sutton → **The Respect Derby**
  - David Higman vs Luke Butcher → **The East Asian Derby**

### Lore frequency (non-Motty) — KEEP IT LOW
- Default: **fact line only** (no sentence 2) for most fixtures
- Optional witty closer or thin lore on ≤**1 fixture per GW per surface** (Preview and Recap counted separately), unless rivalry requires the brand (brand can sit inside sentence 1)
- Do **not** checklist personality traits
- Iconic spam (Samsung, lampshade, etc.): if used at all, long cooldown 6–8 GWs, max ~2/season
- **Titanic Duo:** max 1/GW across both surfaces, 3-GW cooldown

### Motty / Nick Mottershead
Whenever Motty appears in a fixture blurb:
- **Preview** → pick from `motty-vegan-preview-oneliners-50.json` via tags (`fav`/`dog`/`coin`, `waiver_in`, `projected_high`/`low`, `model_likes`/`hates`, `vs_andrew`, etc.)
- **Recap** → pick from `motty-vegan-oneliners-100.json` via post-match tags (`win`/`loss`/`draw`, `bench`, `waiver`, `blowout`, …)
- Hard-skip outcome/odds conflicts
- Cooldowns per file; no repeat ids while alternatives remain
- Vegan theme every Motty appearance; rotate the line via data

---

## Preview-specific rules (succinct)

Preview blurbs should answer **one** question, e.g.:
- Who does the book fancy?
- Who just came in off waivers?
- Is this a projected mismatch or a coin flip?
- Is this a named derby?

**Good Preview (succinct):**
- `The book has Brampton at 6/5 and Bilbo at 10/11.`
- `Seoul sit at 79% — Toronto the long shots at 19%. Hall is live off the wire.`
- `The Bad Blood Derby: Nick the safer price; Andrew the louder build-up.`

**Bad Preview (current failure mode):**
- Odds + waiver + title longshot + personality paragraph + second personality paragraph

Templates: keep short. Prefer local slot-fill. Fun OK; don’t pad.

If Motty is involved, sentence 1 = odds/projection/waiver claim; sentence 2 = one tagged vegan preview line.

---

## Recap-specific rules

Same as prior plan without awards:
- All 4 fixtures get a blurb
- One angle; fun fact templates from `recap-blurb-config.v1.json`
- Motty gets tagged recap vegan line
- Less non-Motty lore than today

Style targets in `GW5-sample-blurbs.md`.

---

## Engineering deliverables

1. Find current Preview + Recap blurb generation. Propose touch list first.
2. Add configs to repo (e.g. `docs/recap/` or `data/recap/`):
   - `recap-blurb-config.v1.json`
   - `motty-vegan-oneliners-100.json`
   - `motty-vegan-preview-oneliners-50.json`
3. Persist cooldowns (templates, Motty preview lines, Motty recap lines, opener patterns, lore caps).
4. Wire generators for **both** surfaces; stop old fingerprint prose.
5. Do **not** change awards UI/data in this PR.
6. Short note on regenerating a GW Preview and Recap.

### Done when
- Preview + Recap each emit 4 succinct blurbs
- Motty always gets an appropriate vegan line (preview bank vs recap bank)
- Rivalries always named
- Non-Motty lore is rare
- Awards codepaths untouched

Start with the touch list, then implement blurbs only.
