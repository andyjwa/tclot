# FPL gameweek predictions (event-probability model)

TypeScript package: **transparent**, modular **event-rate → Poisson/Bernoulli → Monte Carlo** pipeline for Fantasy Premier League **expected points** and **outcome bands** (not a black-box ML model).

## Layout

- `src/predictions/types.ts` — `Player`, `Team`, `Fixture`, `Prediction`
- `config.ts` — tunable thresholds and simulation count
- `odds.ts` — decimal odds → implied probs, de-vig, implied goals heuristics  
  **Production odds:** integrate [The Odds API](https://the-odds-api.com/) (`soccer_epl`, markets `h2h`, `totals`, etc.) and map responses into `Fixture` fields.
- `minutesModel.ts`, `goalModel.ts`, `assistModel.ts`, `cleanSheetModel.ts`, `defensiveContributionModel.ts`, `savesModel.ts`, `cardsModel.ts`, `bonusModel.ts`
- `fplScoring.ts` — official-style points from sampled outcomes
- `simulation.ts` — Monte Carlo + optional XI/captain team simulation
- `explainPrediction.ts` — short human-readable lines
- `index.ts` — `predictPlayerGameweek`, `predictForPlayerFromMap`, `formatPredictionRecord`
- `src/mockData.ts` — 5 fake players + 2 teams + 1 fixture for tests/demos

## Commands

```bash
cd fpl-predictions
npm install
npm run build    # tsc → dist/
npm test         # vitest
node dist/exampleRun.js
```

## API sketch

```ts
import {
  predictForPlayerFromMap,
  formatPredictionRecord,
  DEFAULT_MODEL_CONFIG,
} from './dist/predictions/index.js';

const teams = new Map([[10, homeTeam], [11, awayTeam]]);
const pred = predictForPlayerFromMap(player, fixture, teams);
console.log(formatPredictionRecord(pred, player.name));
```

## Notes

- **Draft vs classic:** scoring helpers follow common FPL draft rules (goal points by line; CS; saves/3; DC thresholds from `config`). Adjust `fplScoring.ts` if your league differs.
- **Accuracy:** prioritises explainability; tune `DEFAULT_MODEL_CONFIG` and team/player inputs from your data pipeline.
