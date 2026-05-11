import type { Prediction } from './types.js';

/**
 * Human-readable lines for UI / API consumers (transparent model).
 */
export function buildExplanationFixed(p: Prediction): string[] {
  const lines: string[] = [];
  lines.push(
    `Projected for ~${Math.round(p.expectedMinutes)} minutes (≈${(p.P_start * 100).toFixed(0)}% start chance).`,
  );
  if (p.goalProbability > 0.18) {
    lines.push('Goal expectation boosted vs this opponent / fixture context.');
  } else if (p.goalProbability < 0.06) {
    lines.push('Limited goal threat this week relative to minutes.');
  }
  if (p.cleanSheetProbability > 0.28) {
    lines.push('Clean sheet outlook uses odds or implied-goals fallback.');
  }
  if (p.defensiveContributionProbability > 0.15) {
    lines.push('Defensive workload could reach the FPL contribution threshold.');
  }
  lines.push('ICT form nudges underlying xG/xA in the goal and assist models.');
  lines.push(`Simulated band: p10 ${p.p10}, median ${p.p50}, p90 ${p.p90}.`);
  return lines;
}

export function applyExplanation(pred: Prediction): Prediction {
  return { ...pred, explanation: buildExplanationFixed(pred) };
}
