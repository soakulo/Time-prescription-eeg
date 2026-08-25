/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ExperimentalMode {
  REACTION_VISIBLE = "REACTION_VISIBLE",
  TTC = "TTC",
  INTERVAL_REPRODUCTION = "INTERVAL_REPRODUCTION",
  DURATION_REPRODUCTION = "DURATION_REPRODUCTION",
  MIXED = "MIXED",
}

export type EEGInterface = "LSL" | "Serial" | "Disabled";

export interface AppConfig {
  blocks: number;
  durations: number[]; // e.g. [800, 1700, 3100] in ms
  speeds: number[];    // e.g. [300, 500] in units/sec
  trainingTrialsCount: number; // Number of practice trials before main blocks (e.g. 24 or 6)
  trialsPerBlock: number; // Number of trials per block (84 for full 420-trial protocol, or 10 for quick)
  protocolMode: "full_tz" | "quick"; // Full scientific 420-trial protocol vs quick testing
  feedbackEnabled: boolean;
  eegEnabled: boolean;
  eegInterface: EEGInterface;
}

export interface TrialResult {
  id: string; // Unique trial ID
  participantId: string;
  condition: ExperimentalMode;
  duration: number; // Selected reference Ti in ms
  speed: number;    // Velocity (300 or 500)
  trajectoryId: string;
  blockNumber: number;
  trialNumber: number;
  trialStart: number;    // performance.now() timestamp
  motionStart: number;   // performance.now() timestamp
  occluderStart: number; // performance.now() timestamp (or 0 if not applicable)
  responseTime: number;  // Subjective response duration / reaction time in ms
  targetTime: number;    // Ideal target timing in ms
  errorMs: number;       // responseTime - targetTime
  errorPercent: number;  // (errorMs / targetTime) * 100
  confidence: number;    // 1 to 5 user rating
  feedbackType: "Excellent" | "Slightly Early" | "Slightly Late" | "Too Early" | "Too Late";
  adaptiveCoefficient: number; // calculated scale for tracking adaptive adjustments (e.g., 1.0)
  isTraining: boolean;   // distinguishes training runs
}

export interface BlockSummary {
  blockNumber: number;
  condition: ExperimentalMode;
  trialsCount: number;
  meanAccuracy: number; // Absolute error mean closeness
  meanErrorPercent: number;
  bias: number;
  weberFraction: number;
  cv: number;
  ttcAccuracy?: number;
}

export interface EEGMarkerLog {
  timestamp: number;
  trialNumber: number;
  event: string;
  markerCode: string; // e.g., "0x01", "0x02"
  status: "transmitted" | "dropped";
}

export interface EEGChannelData {
  time: number;
  cz: number;
  pz: number;
  o1: number;
  o2: number;
  marker?: string;
  markerText?: string;
}
