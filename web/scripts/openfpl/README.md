# OpenFPL inference add-on (flagged, disabled by default)

[OpenFPL](https://arxiv.org/abs/2508.09992) is an FPL + Understat-only ML model that forecasts a
player's expected points for an upcoming gameweek. In this project it is intended to **anchor** the
headline xP from the existing `fpl-predictions` Monte Carlo engine — not replace it.

This directory is a **runnable scaffold**: the input/output contract and feature layout are defined,
but it ships **without trained model weights**, so it is wired into the build as a safe no-op.

## Pipeline position

`build-predictions.mjs` → **`build-openfpl.mjs`** → (rest of build)

`build-openfpl.mjs` is the Node wrapper. With the flag off it never invokes Python and never writes
anything; with the flag on it runs `infer.py` and (optionally) anchors `predictions.json`.

## Status today

- `OPENFPL_ENABLED` is unset, so `build-openfpl.mjs` logs `disabled` and exits 0.
- Even if enabled, `infer.py` finds no trained model and writes
  `openfpl-predictions.json` with `status: "model-not-trained"`, so nothing is anchored.

## Activation steps

1. **Backfill training data** — gameweek-level FPL history
   ([vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League)) joined with
   Understat per-90 + team xG, using the feature contract in `infer.py:build_feature_row`.
2. **Train + save** a model to `scripts/openfpl/model/openfpl.joblib` exposing `predict([...rows])`
   (or `predict_one(row)`), where each row is a `build_feature_row(...)` dict.
3. **Install deps**: `pip install -r web/scripts/openfpl/requirements.txt`.
4. **Wait for fixtures** — the new season's fixtures must be published so a target gameweek resolves
   (`build-predictions.mjs` populates `predictions.json.gameweek`, which `infer.py` reuses).
5. **Enable**:
   - `OPENFPL_ENABLED=1` — run inference and write `openfpl-predictions.json`.
   - `OPENFPL_ANCHOR_WEIGHT=0.0–1.0` — blend weight toward OpenFPL xP in `predictions.json`
     (default `0` = keep engine output but still record `forecast.openFplXp`). Raise gradually after
     backtesting against actuals.

## Artifacts

- `openfpl-predictions.json` — `{ schemaVersion, generatedAt, gameweek, status, model, predictions }`
  where `predictions` is `{ "<elementId>": xp }` keyed by the canonical (draft) element id.
- When anchored, each `predictions.json` player gains `forecast.openFplXp`, and `totalPoints` is the
  blended value; top-level `openFpl` records the gameweek, weight, and anchored count.

The blend math lives in `web/src/openfplAnchor.js` (unit-tested) so it is locked down before the
feature is switched on.
