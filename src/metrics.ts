/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrialResult, BlockSummary, ExperimentalMode } from "./types";

/**
 * Calculates behavioral timing metrics for a given subset of trials.
 */
export function calculateMetrics(trials: TrialResult[], blockNumber?: number): BlockSummary | null {
  const filtered = blockNumber 
    ? trials.filter((t) => t.blockNumber === blockNumber && !t.isTraining)
    : trials.filter((t) => !t.isTraining);

  if (filtered.length === 0) return null;

  const N = filtered.length;

  // 1. Bias (Mean Signed Error in milliseconds)
  const sumError = filtered.reduce((sum, t) => sum + t.errorMs, 0);
  const bias = sumError / N;

  // 2. Absolute Error (Mean Absolute Error in milliseconds)
  const sumAbsError = filtered.reduce((sum, t) => sum + Math.abs(t.errorMs), 0);
  const absoluteError = sumAbsError / N;

  // 3. Percent Error (Mean percentage deviation)
  const sumPercentError = filtered.reduce((sum, t) => sum + t.errorPercent, 0);
  const meanErrorPercent = sumPercentError / N;

  // Standard deviation calculations
  const errors = filtered.map((t) => t.errorMs);
  const responseTimes = filtered.map((t) => t.responseTime);
  const targetTimes = filtered.map((t) => t.targetTime);

  // Mean Response Time
  const meanResponseTime = responseTimes.reduce((sum, r) => sum + r, 0) / N;

  // Variance of Error
  const varError = errors.reduce((sum, e) => sum + Math.pow(e - bias, 0), 0) / N; // Wait, actually standard deviation is calculated from errors
  const meanTarget = targetTimes.reduce((sum, t) => sum + t, 0) / N;
  
  // Real standard deviation of error
  const avgError = errors.reduce((sum, e) => sum + e, 0) / N;
  const varianceError = errors.reduce((sum, e) => sum + Math.pow(e - avgError, 2), 0) / Math.max(1, N - 1);
  const stdError = Math.sqrt(varianceError);

  // Weber Fraction = Standard Deviation of response errors / Mean target duration
  // In psychophysics, Weber Fraction is standard_deviation(responses) / duration
  const weberFraction = stdError / Math.max(10, meanTarget);

  // Coefficient of Variation (CV) = Standard Deviation of response times / Mean response time
  const avgResponse = responseTimes.reduce((sum, r) => sum + r, 0) / N;
  const varianceResponse = responseTimes.reduce((sum, r) => sum + Math.pow(r - avgResponse, 2), 0) / Math.max(1, N - 1);
  const stdResponse = Math.sqrt(varianceResponse);
  const cv = stdResponse / Math.max(10, avgResponse);

  // TTC Accuracy (Percentage accuracy of collision estimate)
  // Accuracy = Constant bound clapped at 100%: 100 * (1 - abs(errorMs)/targetTime)
  const ttcAccuracies = filtered.map((t) => {
    const acc = (1 - Math.min(1.0, Math.abs(t.errorMs) / t.targetTime)) * 100;
    return acc;
  });
  const ttcAccuracy = ttcAccuracies.reduce((sum, a) => sum + a, 0) / N;

  const firstCondition = filtered[0]?.condition || ExperimentalMode.REACTION_VISIBLE;

  return {
    blockNumber: blockNumber || 0,
    condition: firstCondition,
    trialsCount: N,
    meanAccuracy: 100 - Math.min(100, Math.abs(meanErrorPercent)),
    meanErrorPercent,
    bias,
    weberFraction,
    cv,
    ttcAccuracy: firstCondition === ExperimentalMode.TTC ? ttcAccuracy : undefined,
  };
}

/**
 * Group trials by block and return summaries for all completed blocks
 */
export function getBlockSummaries(trials: TrialResult[]): BlockSummary[] {
  const activeTrials = trials.filter((t) => !t.isTraining);
  const blockNumbers = Array.from(new Set(activeTrials.map((t) => t.blockNumber))).sort((a, b) => a - b);
  
  const summaries: BlockSummary[] = [];
  for (const blockNo of blockNumbers) {
    const sum = calculateMetrics(activeTrials, blockNo);
    if (sum) summaries.push(sum);
  }
  return summaries;
}
