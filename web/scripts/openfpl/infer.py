#!/usr/bin/env python3
"""
OpenFPL inference (SCAFFOLD — disabled until a trained model + backfilled history exist).

OpenFPL (arXiv:2508.09992) is an FPL + Understat-only machine-learning model that forecasts a
player's expected points for an upcoming gameweek. In this project it is intended to *anchor* the
headline xP produced by the existing `fpl-predictions` Monte Carlo engine, not replace it.

Status: this is a runnable scaffold. It defines the input/output contract and the feature layout,
but ships WITHOUT trained model weights. When no weights are present it writes a `status:
model-not-trained` artifact and exits 0, so the build is never blocked. It is only invoked when the
Node wrapper (`scripts/build-openfpl.mjs`) is explicitly enabled via `OPENFPL_ENABLED=1`.

Activation requires (see README.md):
  1. Backfilled gameweek-level history (e.g. github.com/vaastav/Fantasy-Premier-League) + Understat.
  2. A trained model saved to `scripts/openfpl/model/openfpl.joblib`.
  3. The new season's fixtures published so a target gameweek can be resolved.

Inputs (read from --league-data-dir, all already produced by the JS pipeline):
  - bootstrap_draft.json  : player universe (canonical element ids) + per-90 inputs + form/status
  - understat.json        : player per-90 xG/xA + team xG/xGA aggregates
  - predictions.json      : engine output; supplies the resolved target gameweek + player set
  - fixtures.json         : classic fixtures (opponent + home/away for the target gameweek)

Output (--out, default <league-data-dir>/openfpl-predictions.json):
  {
    "schemaVersion": 1,
    "generatedAt": "<iso>",
    "gameweek": <int|null>,
    "status": "ok" | "model-not-trained" | "no-gameweek" | "no-inputs",
    "model": { "path": "...", "trained": bool, "featureVersion": 1 },
    "predictions": { "<elementId>": <xp_float>, ... }
  }
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

FEATURE_VERSION = 1
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = SCRIPT_DIR / "model" / "openfpl.joblib"

POS_MAP = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


def log(*args: object) -> None:
    print("openfpl.infer:", *args, file=sys.stderr)


def read_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_output(out_path: Path, payload: dict) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh)
    log(f"wrote {payload.get('status')} → {out_path.name} "
        f"({len(payload.get('predictions', {}))} predictions)")


def canonical_team_key(name: str) -> str:
    """Mirror of the JS canonicalTeamKey so Understat titles join to FPL names."""
    base = "".join(ch for ch in (name or "").lower() if ch.isalnum())
    aliases = {
        "manchestercity": "mancity", "mancity": "mancity",
        "manchesterunited": "manutd", "manutd": "manutd", "manunited": "manutd",
        "newcastleunited": "newcastle", "newcastle": "newcastle",
        "wolverhamptonwanderers": "wolves", "wolverhampton": "wolves", "wolves": "wolves",
        "tottenhamhotspur": "spurs", "tottenham": "spurs", "spurs": "spurs",
        "nottinghamforest": "nottmforest", "nottmforest": "nottmforest",
        "westhamunited": "westham", "westham": "westham",
        "brightonhovealbion": "brighton", "brighton": "brighton",
        "leedsunited": "leeds", "leeds": "leeds",
    }
    return aliases.get(base, base)


def build_feature_row(element: dict, understat_player: dict | None,
                      team_agg: dict | None, opp_agg: dict | None,
                      is_home: bool) -> dict:
    """
    The OpenFPL feature contract (FPL + Understat only). Kept explicit so training and inference
    stay in lockstep. Returned as a plain dict; the trained model is responsible for vectorising.
    """
    minutes = float(element.get("minutes") or 0) or 1.0
    ninety = minutes / 90.0

    def per90(key: str) -> float:
        return float(element.get(key) or 0) / ninety if ninety > 0 else 0.0

    pos = POS_MAP.get(int(element.get("element_type") or 0), "MID")
    return {
        "featureVersion": FEATURE_VERSION,
        "pos_GK": 1 if pos == "GK" else 0,
        "pos_DEF": 1 if pos == "DEF" else 0,
        "pos_MID": 1 if pos == "MID" else 0,
        "pos_FWD": 1 if pos == "FWD" else 0,
        "is_home": 1 if is_home else 0,
        "minutes_season": minutes,
        "starts": float(element.get("starts") or 0),
        "form": float(element.get("form") or 0),
        "chance_of_playing": float(element.get("chance_of_playing_next_round") or 100) / 100.0,
        "fpl_xg90": per90("expected_goals"),
        "fpl_xa90": per90("expected_assists"),
        "ict90": per90("ict_index"),
        # Understat player signals (fall back to 0 when unmatched).
        "us_xg90": float((understat_player or {}).get("xG90") or 0),
        "us_xa90": float((understat_player or {}).get("xA90") or 0),
        "us_npxg90": float((understat_player or {}).get("npxG90") or 0),
        # Team + opponent strength.
        "team_xg_for": float((team_agg or {}).get("xGFor") or 0),
        "team_xg_against": float((team_agg or {}).get("xGAgainst") or 0),
        "opp_xg_for": float((opp_agg or {}).get("xGFor") or 0),
        "opp_xg_against": float((opp_agg or {}).get("xGAgainst") or 0),
    }


def resolve_gameweek(predictions: dict | None, args_gw) -> int | None:
    if args_gw is not None:
        return int(args_gw)
    if predictions and predictions.get("gameweek") is not None:
        return int(predictions["gameweek"])
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenFPL inference scaffold (disabled by default).")
    parser.add_argument("--league-data-dir", required=True)
    parser.add_argument("--out", default=None)
    parser.add_argument("--gameweek", default=None)
    parser.add_argument("--model-path", default=str(DEFAULT_MODEL_PATH))
    args = parser.parse_args()

    league_dir = Path(args.league_data_dir)
    out_path = Path(args.out) if args.out else league_dir / "openfpl-predictions.json"
    model_path = Path(args.model_path)

    draft = read_json(league_dir / "bootstrap_draft.json")
    understat = read_json(league_dir / "understat.json")
    fixtures = read_json(league_dir / "fixtures.json")
    predictions = read_json(league_dir / "predictions.json")

    base_payload = {
        "schemaVersion": 1,
        "generatedAt": iso_now(),
        "model": {
            "path": str(model_path),
            "trained": model_path.exists(),
            "featureVersion": FEATURE_VERSION,
        },
        "predictions": {},
    }

    if not draft or not draft.get("elements"):
        write_output(out_path, {**base_payload, "gameweek": None, "status": "no-inputs"})
        return 0

    gameweek = resolve_gameweek(predictions, args.gameweek)
    if gameweek is None:
        write_output(out_path, {**base_payload, "gameweek": None, "status": "no-gameweek"})
        return 0

    # No trained weights yet → emit a clear not-ready status and exit cleanly.
    if not model_path.exists():
        log(f"no trained model at {model_path} — emitting model-not-trained status.")
        write_output(out_path, {**base_payload, "gameweek": gameweek, "status": "model-not-trained"})
        return 0

    # --- Activation path (runs only once weights exist). Lazy-imported so the scaffold has no
    #     heavy dependencies until it is actually switched on. ---
    try:
        import joblib  # noqa: WPS433 (lazy import is intentional)
    except ImportError:
        log("joblib not installed — run: pip install -r scripts/openfpl/requirements.txt")
        write_output(out_path, {**base_payload, "gameweek": gameweek, "status": "model-not-trained"})
        return 0

    model = joblib.load(model_path)

    teams_meta = {int(t["id"]): t for t in draft.get("teams", [])}
    us_teams = (understat or {}).get("teams", {})
    us_team_by_key = {}
    for agg in us_teams.values():
        if agg.get("title"):
            us_team_by_key[canonical_team_key(agg["title"])] = agg
    us_players = {p.get("understatId"): p for p in (understat or {}).get("players", [])}

    # Opponent + home/away for the target GW.
    gw_fixtures = [f for f in (fixtures or []) if int(f.get("event") or -1) == gameweek]
    opp_of = {}
    home_of = {}
    for f in gw_fixtures:
        h, a = int(f["team_h"]), int(f["team_a"])
        opp_of[h], opp_of[a] = a, h
        home_of[h], home_of[a] = True, False

    preds: dict[str, float] = {}
    for el in draft["elements"]:
        if el.get("removed"):
            continue
        team_id = int(el.get("team") or 0)
        if team_id not in opp_of:
            continue  # team not playing this GW
        team_agg = us_team_by_key.get(canonical_team_key(teams_meta.get(team_id, {}).get("name", "")))
        opp_agg = us_team_by_key.get(
            canonical_team_key(teams_meta.get(opp_of[team_id], {}).get("name", ""))
        )
        row = build_feature_row(
            el, us_players.get(str(el.get("code"))), team_agg, opp_agg, home_of.get(team_id, False)
        )
        try:
            xp = float(model.predict_one(row)) if hasattr(model, "predict_one") else float(model.predict([row])[0])
        except Exception as exc:  # noqa: BLE001 — never block the build on a single row
            log(f"predict failed for element {el.get('id')}: {exc}")
            continue
        preds[str(int(el["id"]))] = round(xp, 2)

    write_output(out_path, {**base_payload, "gameweek": gameweek, "status": "ok", "predictions": preds})
    return 0


if __name__ == "__main__":
    sys.exit(main())
