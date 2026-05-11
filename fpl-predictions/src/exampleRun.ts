/**
 * Run with: npx tsx src/exampleRun.ts  (or compile and node dist/exampleRun.js)
 */
import {
  formatPredictionRecord,
  predictForPlayerFromMap,
  DEFAULT_MODEL_CONFIG,
} from './predictions/index.js';
import { mockFixture, mockPlayers, mockTeamsById } from './mockData.js';
import { createSeedRandom } from './predictions/stats.js';

const teams = mockTeamsById();
const player = mockPlayers[0]!;
const cfg = { ...DEFAULT_MODEL_CONFIG, simulationIterations: 2000 };
const rng = createSeedRandom(42);
const rnd = () => rng.next();

const pred = predictForPlayerFromMap(player, mockFixture, teams, cfg, rnd);
// eslint-disable-next-line no-console
console.log(JSON.stringify(formatPredictionRecord(pred, player.name), null, 2));
