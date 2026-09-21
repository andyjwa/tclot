# TCLOT Preview + Recap blurbs

Config-driven fixture blurbs for the Recap tab. **This pack is blurbs only — no awards.**

Configs live in `web/src/recap/` (the repo-root `data/` folder is gitignored):

| File | Role |
|---|---|
| `recap-blurb-config.v1.json` | Recap angles, templates, gates, rivalries, lore bank |
| `preview-blurb-config.v1.json` | Preview angles and short templates |
| `motty-vegan-oneliners-100.json` | Motty Recap vegan lines (data-tagged) |
| `motty-vegan-preview-oneliners-50.json` | Motty Preview vegan lines (data-tagged) |
| `CURSOR-MASTER-BRIEF.md` | Product brief for this build |

Runtime engine: `web/src/blurbEngine.js` with configs in `web/src/recap/`. Wired into:

- Preview generators: `matchupPreviewSentences`
- Recap generators: `matchupRecapSentences`
- Scan recap box: `personalityRecap` / `glanceFixture`

Cooldowns (templates, Motty lines, lore, openers) persist under `web/public/league-data/recap-state/` when weekly recaps are rebuilt.

## Regenerating a GW Preview and Recap

From `web/`:

```bash
node scripts/build-weekly-recaps.mjs
```

That rebuilds `public/league-data/weekly-recaps.json` (all finished Recaps + locked Previews) and refreshes `public/league-data/recap-state/`. Run it after lineup lock for a Preview, and after the gameweek finishes for a Recap.

The Recap tab also generates blurbs at runtime from the same engine, so copy updates without a bake. A bake keeps JSON, cooldowns, and live refresh in sync.

Do **not** use a Commish publish step. Fully automatic.
