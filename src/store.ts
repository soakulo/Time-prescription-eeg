/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { ExperimentalMode, AppConfig, TrialResult, EEGMarkerLog } from "./types";

interface LiveState {
  // Navigation & View Workspace
  activeView: "split" | "participant" | "experimenter";
  participantId: string;
  currentMode: ExperimentalMode;
  activeTrialCondition: ExperimentalMode;
  config: AppConfig;
  
  // Experiment Status & Engine Trackers
  isExperimentRunning: boolean;
  isPaused: boolean;
  currentBlock: number;
  currentTrial: number; // Trial counter in CURRENT block
  totalTrialsCompleted: number;
  isTraining: boolean; // Indicates if current block is a practice block
  trainingTrialIndex: number; // 0-5
  
  // Active Trial State Machine
  activeTrialState: 
    | "idle"              // Waiting for space to start
    | "ready"             // Standby instructions
    | "blank_delay"       // Random delay (0.2s - 0.5s)
    | "motion"            // Shard moving visibly
    | "occluded"          // Shard moving behind the occluder (TTC only)
    | "waiting_response"  // Target finished moving, waiting for reaction/space (or press inside occlusion)
    | "confidence_rating" // Rating 1-5
    | "feedback"          // Detailed feedback summary
    | "block_completed"   // Intermediate stats view
    | "experiment_completed"; // End of research summary
  
  // Dynamic parameters of active trial
  activeSpeed: number; // 300 or 500
  activeDuration: number; // 800, 1700 or 3100 ms
  activeTrajectoryIndex: number; // 0-24 (indexes into 25 UNIQUE_CURVES)
  
  // High precision timestamps (performance.now())
  tsTrialStart: number;
  tsMotionStart: number;
  tsOccluderStart: number;
  tsStimulusEnd: number;
  tsResponse: number;
  
  // Active response recorded for the current trial
  currentResponseTimeMs: number;
  currentConfidence: number;
  currentFeedbackData: {
    errorMs: number;
    errorPercent: number;
    feedbackText: "Excellent" | "Slightly Early" | "Slightly Late" | "Too Early" | "Too Late";
    targetTime: number;
    responseTime: number;
  } | null;
  
  // Real datasets
  trials: TrialResult[];
  trainingTrials: TrialResult[]; // Temp store for practice runs
  
  // Simulated EEG
  eegEnabled: boolean;
  eegInterface: "LSL" | "Serial" | "Disabled";
  eegStatus: "ready" | "streaming" | "disconnected";
  eegMarkers: EEGMarkerLog[];
  
  // Lab Operator console logs
  systemLogs: string[];
}

interface ActionState {
  setConfig: (config: Partial<AppConfig>) => void;
  setParticipantId: (id: string) => void;
  setCurrentMode: (mode: ExperimentalMode) => void;
  setActiveView: (view: "split" | "participant" | "experimenter") => void;
  
  // Control flow actions
  startExperiment: () => void;
  pauseExperiment: () => void;
  resumeExperiment: () => void;
  abortExperiment: () => void;
  nextTrial: () => void;
  submitConfidence: (rating: number) => void;
  recordResponse: (responseTime: number, targetTime: number) => void;
  finishTrialFeedback: () => void;
  skipTraining: () => void;
  proceedToMainBlocks: () => void;
  skipToNextRealBlock: () => void;
  
  // Data actions
  importConfig: (configText: string) => boolean;
  clearAllTrials: () => void;
  seedSimulatedData: () => void;
  
  // Systems
  logSystemMessage: (message: string) => void;
  sendEEGTrigger: (event: string, code: string) => void;
  setTrialState: (state: LiveState["activeTrialState"]) => void;
  updateTrialParams: (speed: number, duration: number) => void;
}

const DEFAULT_CONFIG: AppConfig = {
  blocks: 5,
  durations: [800, 1700, 3100],
  speeds: [300, 500],
  trainingTrialsCount: 24, // Section 5.3: 6 condition trials + 18 randomized practice trials
  trialsPerBlock: 84,      // Section 5.3: 420 trials / 5 blocks = 84 trials per block
  protocolMode: "full_tz",
  feedbackEnabled: true,
  eegEnabled: true,
  eegInterface: "LSL",
};

const STANDARD_CONDITIONS = [
  ExperimentalMode.REACTION_VISIBLE,
  ExperimentalMode.TTC,
  ExperimentalMode.INTERVAL_REPRODUCTION,
  ExperimentalMode.DURATION_REPRODUCTION,
];

const determineTrialCondition = (mode: ExperimentalMode, isTraining: boolean, trainingIndex: number): ExperimentalMode => {
  if (isTraining) {
    if (trainingIndex < 6) {
      if (mode === ExperimentalMode.MIXED) {
        return STANDARD_CONDITIONS[trainingIndex % STANDARD_CONDITIONS.length];
      }
      return mode;
    } else {
      // 18 randomized practice trials (all 4 conditions mixed with feedback)
      return STANDARD_CONDITIONS[Math.floor(Math.random() * STANDARD_CONDITIONS.length)];
    }
  } else {
    if (mode === ExperimentalMode.MIXED) {
      return STANDARD_CONDITIONS[Math.floor(Math.random() * STANDARD_CONDITIONS.length)];
    }
    return mode;
  }
};

const getRandomTrajectory = (current?: number): number => {
  let next = Math.floor(Math.random() * 25);
  if (current !== undefined && next === current) {
    next = (current + 1 + Math.floor(Math.random() * 10)) % 25;
  }
  return next;
};

export const useLabStore = create<LiveState & ActionState>((set, get) => ({
  // Defaults
  activeView: "split",
  participantId: "SUB-402",
  currentMode: ExperimentalMode.TTC,
  activeTrialCondition: ExperimentalMode.TTC,
  config: DEFAULT_CONFIG,
  
  isExperimentRunning: false,
  isPaused: false,
  currentBlock: 1,
  currentTrial: 1,
  totalTrialsCompleted: 0,
  isTraining: true,
  trainingTrialIndex: 0,
  
  activeTrialState: "idle",
  activeSpeed: 300,
  activeDuration: 1700,
  activeTrajectoryIndex: 0,
  
  tsTrialStart: 0,
  tsMotionStart: 0,
  tsOccluderStart: 0,
  tsStimulusEnd: 0,
  tsResponse: 0,
  
  currentResponseTimeMs: 0,
  currentConfidence: 3,
  currentFeedbackData: null,
  
  trials: [],
  trainingTrials: [],
  
  eegEnabled: true,
  eegInterface: "LSL",
  eegStatus: "ready",
  eegMarkers: [],
  
  systemLogs: [
    "System Initialized. Ready for cognitive EEG timing session.",
    "LSL Network Interface listening on lsl_type='EEG' lsl_name='TimeLab-Marker'.",
  ],

  // Actions
  setConfig: (newConfig) => set((state) => {
    const updated = { ...state.config, ...newConfig };
    
    // Auto sync EEG enabled settings
    const eegStatus = updated.eegEnabled 
      ? (updated.eegInterface === "Disabled" ? "disconnected" : "ready") 
      : "disconnected";

    return { 
      config: updated,
      eegEnabled: updated.eegEnabled,
      eegInterface: updated.eegInterface,
      eegStatus: eegStatus as any
    };
  }),

  setParticipantId: (id) => set({ participantId: id.trim() || "SUB-ANONYMOUS" }),
  
  setCurrentMode: (mode) => {
    set({ currentMode: mode });
    get().logSystemMessage(`Experimental Mode switched to: ${mode}`);
  },

  setActiveView: (view) => set({ activeView: view }),

  logSystemMessage: (message) => set((state) => {
    const timestamp = new Date().toLocaleTimeString();
    return {
      systemLogs: [`[${timestamp}] ${message}`, ...state.systemLogs].slice(0, 150),
    };
  }),

  sendEEGTrigger: (event, code) => {
    const { eegEnabled, eegInterface, eegStatus } = get();
    if (!eegEnabled || eegInterface === "Disabled") return;

    const marker: EEGMarkerLog = {
      timestamp: performance.now(),
      trialNumber: get().currentTrial,
      event,
      markerCode: code,
      status: eegStatus === "streaming" || eegStatus === "ready" ? "transmitted" : "dropped",
    };

    set((state) => ({
      eegMarkers: [marker, ...state.eegMarkers].slice(0, 100),
    }));

    get().logSystemMessage(`EEG Trigger Sent: Event [${event}] -> Byte [${code}] via ${eegInterface}`);
  },

  setTrialState: (state) => {
    set({ activeTrialState: state });
    // Dynamic trigger synchronization based on experimental milestones
    const { sendEEGTrigger } = get();
    if (state === "blank_delay") {
      set({ tsTrialStart: performance.now() });
      sendEEGTrigger("Trial Start", "0x01");
    } else if (state === "motion") {
      set({ tsMotionStart: performance.now() });
      sendEEGTrigger("Motion Start", "0x02");
    } else if (state === "occluded") {
      set({ tsOccluderStart: performance.now() });
      sendEEGTrigger("Occluder Start", "0x03");
    } else if (state === "waiting_response") {
      set({ tsStimulusEnd: performance.now() });
      sendEEGTrigger("Stimulus End", "0x04");
    } else if (state === "feedback") {
      sendEEGTrigger("Feedback Start", "0x06");
    }
  },

  updateTrialParams: (speed, duration) => set({ activeSpeed: speed, activeDuration: duration }),

  startExperiment: () => {
    const { participantId, currentMode, config, logSystemMessage } = get();
    
    // Choose starting speed, duration, and trajectory randomly
    const randSpeed = config.speeds[Math.floor(Math.random() * config.speeds.length)] || 300;
    const randDuration = config.durations[Math.floor(Math.random() * config.durations.length)] || 1700;
    const initCondition = determineTrialCondition(currentMode, true, 0);
    const initTrajectory = getRandomTrajectory();

    set({
      isExperimentRunning: true,
      isPaused: false,
      currentBlock: 1,
      currentTrial: 1,
      isTraining: true,
      trainingTrialIndex: 0,
      activeTrialState: "ready", // screen says "Instructions"
      activeSpeed: randSpeed,
      activeDuration: randDuration,
      activeTrajectoryIndex: initTrajectory,
      activeTrialCondition: initCondition,
      trials: [],
      trainingTrials: [],
      eegStatus: config.eegEnabled && config.eegInterface !== "Disabled" ? "streaming" : "disconnected",
      eegMarkers: [],
    });

    logSystemMessage(`🚀 STARTING RESEARCH EXPERIMENT. Subject: ${participantId}. Mode: ${currentMode}`);
    logSystemMessage(`Запущена тренировочная серия из ${config.trainingTrialsCount || 5} калибровочных проб.`);
  },

  pauseExperiment: () => {
    set({ isPaused: true });
    get().logSystemMessage("Experiment execution suspended by operator.");
  },

  resumeExperiment: () => {
    set({ isPaused: false });
    get().logSystemMessage("Experiment execution resumed.");
  },

  abortExperiment: () => {
    set({
      isExperimentRunning: false,
      isPaused: false,
      activeTrialState: "idle",
      eegStatus: get().config.eegEnabled && get().config.eegInterface !== "Disabled" ? "ready" : "disconnected",
    });
    get().logSystemMessage("⚠️ EXPERIMENT ABORTED BY OPERATOR. State reset.");
  },

  recordResponse: (responseTime, targetTime) => {
    const now = performance.now();
    set({ tsResponse: now, currentResponseTimeMs: responseTime });
    get().sendEEGTrigger("Response Keypress", "0x05");

    // Math calculation for accuracy feedback
    const errorMs = responseTime - targetTime;
    const errorPercent = (errorMs / targetTime) * 100;

    let feedbackText: "Excellent" | "Slightly Early" | "Slightly Late" | "Too Early" | "Too Late";
    const absPercent = Math.abs(errorPercent);

    if (absPercent <= 5) {
      feedbackText = "Excellent";
    } else if (errorPercent < 0) {
      feedbackText = absPercent <= 15 ? "Slightly Early" : "Too Early";
    } else {
      feedbackText = absPercent <= 15 ? "Slightly Late" : "Too Late";
    }

    set({
      currentFeedbackData: {
        errorMs,
        errorPercent,
        feedbackText,
        targetTime,
        responseTime,
      },
      activeTrialState: "confidence_rating",
    });
  },

  submitConfidence: (rating) => {
    const {
      participantId,
      currentMode,
      activeTrialCondition,
      activeSpeed,
      activeDuration,
      activeTrajectoryIndex,
      currentBlock,
      currentTrial,
      config,
      isTraining,
      trainingTrialIndex,
      currentFeedbackData,
      tsTrialStart,
      tsMotionStart,
      tsOccluderStart,
      logSystemMessage,
    } = get();

    if (!currentFeedbackData) return;

    set({ currentConfidence: rating });

    // Store trial record
    const trialRecord: TrialResult = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      participantId,
      condition: activeTrialCondition,
      duration: activeDuration,
      speed: activeSpeed,
      trajectoryId: `curve_${activeTrajectoryIndex + 1}_${activeSpeed}_${activeDuration}`,
      blockNumber: currentBlock,
      trialNumber: isTraining ? trainingTrialIndex + 1 : currentTrial,
      trialStart: tsTrialStart,
      motionStart: tsMotionStart,
      occluderStart: tsOccluderStart,
      responseTime: currentFeedbackData.responseTime,
      targetTime: currentFeedbackData.targetTime,
      errorMs: currentFeedbackData.errorMs,
      errorPercent: currentFeedbackData.errorPercent,
      confidence: rating,
      feedbackType: currentFeedbackData.feedbackText,
      adaptiveCoefficient: 1.0,
      isTraining,
    };

    if (isTraining) {
      set((state) => ({
        trainingTrials: [...state.trainingTrials, trialRecord],
        trainingTrialIndex: state.trainingTrialIndex + 1,
      }));
      const totalTrain = config.trainingTrialsCount || 5;
      logSystemMessage(`Тренировочная проба ${trainingTrialIndex + 1}/${totalTrain} завершена. Траектория #${activeTrajectoryIndex + 1}. Ошибка: ${currentFeedbackData.errorMs.toFixed(0)}мс (${currentFeedbackData.errorPercent.toFixed(1)}%)`);
    } else {
      set((state) => ({
        trials: [...state.trials, trialRecord],
        totalTrialsCompleted: state.totalTrialsCompleted + 1,
      }));
      logSystemMessage(`Trial ${currentTrial} in Block ${currentBlock} complete. Trajectory #${activeTrajectoryIndex + 1}. Condition: ${activeTrialCondition}. Error: ${currentFeedbackData.errorMs.toFixed(0)}ms`);
    }

    // Switch to presentation feedback
    get().setTrialState("feedback");
  },

  finishTrialFeedback: () => {
    const { isTraining, trainingTrialIndex, currentMode, currentTrial, config, currentBlock, activeTrajectoryIndex, logSystemMessage } = get();

    if (isTraining) {
      const maxTraining = config.trainingTrialsCount || 24;
      if (trainingTrialIndex >= maxTraining) {
        // Practice phase complete, prompt to proceed
        get().setTrialState("block_completed"); // Shows practice completed screen
        logSystemMessage(`Обучение завершено. Участник успешно прошел все ${maxTraining} тренировочных проб.`);
      } else {
        // Roll next training trial
        const nextSpeed = config.speeds[Math.floor(Math.random() * config.speeds.length)] || 300;
        const nextDuration = config.durations[Math.floor(Math.random() * config.durations.length)] || 1700;
        const nextCondition = determineTrialCondition(currentMode, true, trainingTrialIndex);
        const nextTrajectory = getRandomTrajectory(activeTrajectoryIndex);
        set({
          activeSpeed: nextSpeed,
          activeDuration: nextDuration,
          activeTrialCondition: nextCondition,
          activeTrajectoryIndex: nextTrajectory,
        });
        get().setTrialState("idle");
      }
    } else {
      const trialsPerBlock = config.trialsPerBlock || (config.protocolMode === "quick" ? 10 : 84);
      if (currentTrial >= trialsPerBlock) {
        // Current block completed
        if (currentBlock >= config.blocks) {
          // Completed entire experiment
          get().setTrialState("experiment_completed");
          set({ isExperimentRunning: false });
          logSystemMessage("🏁 EXPERIMENT PHASE COMPLETED SECURELY. All analytical blocks captured.");
        } else {
          // Progress block
          get().setTrialState("block_completed");
        }
      } else {
        // Next trial in active block
        const nextSpeed = config.speeds[Math.floor(Math.random() * config.speeds.length)] || 300;
        const nextDuration = config.durations[Math.floor(Math.random() * config.durations.length)] || 1700;
        const nextCondition = determineTrialCondition(currentMode, false, 0);
        const nextTrajectory = getRandomTrajectory(activeTrajectoryIndex);
        set({
          currentTrial: currentTrial + 1,
          activeSpeed: nextSpeed,
          activeDuration: nextDuration,
          activeTrialCondition: nextCondition,
          activeTrajectoryIndex: nextTrajectory,
        });
        get().setTrialState("idle");
      }
    }
  },

  skipTraining: () => {
    const { currentMode, activeTrajectoryIndex } = get();
    const nextCondition = determineTrialCondition(currentMode, false, 0);
    const nextTrajectory = getRandomTrajectory(activeTrajectoryIndex);
    set({
      isTraining: false,
      trainingTrialIndex: 0,
      currentTrial: 1,
      activeTrialCondition: nextCondition,
      activeTrajectoryIndex: nextTrajectory,
    });
    get().setTrialState("idle");
    get().logSystemMessage("Practice training skipped. Proceeding to main metrics tracking block.");
  },

  proceedToMainBlocks: () => {
    const { isTraining, currentBlock, config, currentMode, activeTrajectoryIndex } = get();
    const nextCondition = determineTrialCondition(currentMode, false, 0);
    const nextTrajectory = getRandomTrajectory(activeTrajectoryIndex);
    if (isTraining) {
      set({
        isTraining: false,
        currentTrial: 1,
        currentBlock: 1,
        activeTrialCondition: nextCondition,
        activeTrajectoryIndex: nextTrajectory,
      });
      get().logSystemMessage(`Снятие тренировочного заслона. Запуск Блока 1. Настройка шкал точности измерений.`);
    } else {
      // Advance to next block
      set({
        currentBlock: currentBlock + 1,
        currentTrial: 1,
        activeTrialCondition: nextCondition,
        activeTrajectoryIndex: nextTrajectory,
      });
      get().logSystemMessage(`Запуск Блока ${currentBlock + 1}/${config.blocks}. Калибровка датчиков триггеров ЭЭГ.`);
    }
    get().setTrialState("idle");
  },

  skipToNextRealBlock: () => {
    // Advanced skip for experimentation testing
    const { currentBlock, config, isTraining, currentMode, activeTrajectoryIndex } = get();
    const nextCondition = determineTrialCondition(currentMode, false, 0);
    const nextTrajectory = getRandomTrajectory(activeTrajectoryIndex);
    if (isTraining) {
      set({
        isTraining: false,
        currentBlock: 1,
        currentTrial: 1,
        isPaused: false,
        activeTrialState: "ready",
        activeTrialCondition: nextCondition,
        activeTrajectoryIndex: nextTrajectory,
      });
      get().logSystemMessage("🧪 Пропущен этап обучения. Переход к первому основному блоку со сбросом паузы.");
    } else if (currentBlock < config.blocks) {
      set({
        currentBlock: currentBlock + 1,
        currentTrial: 1,
        isPaused: false,
        activeTrialState: "ready",
        activeTrialCondition: nextCondition,
        activeTrajectoryIndex: nextTrajectory,
      });
      get().logSystemMessage(`🧪 Блок ${currentBlock} пропущен. Переход к блоку ${currentBlock + 1} со сбросом паузы.`);
    } else {
      set({
        isExperimentRunning: false,
        isPaused: false,
        activeTrialState: "experiment_completed"
      });
      get().logSystemMessage("🧪 Все блоки завершены или пропущены оператором.");
    }
  },

  nextTrial: () => {
    get().setTrialState("blank_delay");
  },

  importConfig: (configText) => {
    try {
      const parsed = JSON.parse(configText);
      if (typeof parsed.blocks !== "number" || !Array.isArray(parsed.durations) || !Array.isArray(parsed.speeds)) {
        throw new Error("Invalid structure");
      }
      get().setConfig(parsed);
      get().logSystemMessage("Experiment parameters configured from uploaded JSON.");
      return true;
    } catch (e) {
      get().logSystemMessage("Failed to upload config: Invalid JSON structure.");
      return false;
    }
  },

  clearAllTrials: () => {
    set({
      trials: [],
      trainingTrials: [],
      totalTrialsCompleted: 0,
      currentBlock: 1,
      currentTrial: 1,
    });
    get().logSystemMessage("Database cleared. Subject trial records formatted.");
  },

  seedSimulatedData: () => {
    const { participantId, currentMode, config } = get();
    const mockTrials: TrialResult[] = [];
    const totalBlocks = config.blocks;
    const trialsPerBlock = 10;

    let timestamp = performance.now() - 3600 * 1000; // 1 hour ago

    for (let blk = 1; blk <= totalBlocks; blk++) {
      for (let trl = 1; trl <= trialsPerBlock; trl++) {
        // Select randomized configuration
        const dur = config.durations[Math.floor(Math.random() * config.durations.length)] || 1700;
        const spd = config.speeds[Math.floor(Math.random() * config.speeds.length)] || 300;
        
        // Add random gaussian noise to simulate standard human perception (Weber Fraction ~0.08)
        // Simulate normal distribution for response times
        const rand = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2; // approximation
        const standardDeviation = dur * 0.09; // 9% Weber fraction
        const constantBias = -25; // slightly underestimating early presses on average
        
        const errorMs = Math.round(rand * standardDeviation + constantBias);
        const responseTime = Math.max(200, dur + errorMs);
        const errorPercent = (errorMs / dur) * 100;

        let feedbackText: "Excellent" | "Slightly Early" | "Slightly Late" | "Too Early" | "Too Late";
        const absPercent = Math.abs(errorPercent);
        if (absPercent <= 5) feedbackText = "Excellent";
        else if (errorPercent < 0) feedbackText = absPercent <= 15 ? "Slightly Early" : "Too Early";
        else feedbackText = absPercent <= 15 ? "Slightly Late" : "Too Late";

        mockTrials.push({
          id: `seeded-${blk}-${trl}-${Math.random().toString(36).substr(2, 4)}`,
          participantId,
          condition: currentMode,
          duration: dur,
          speed: spd,
          trajectoryId: `traj_${spd}_${dur}`,
          blockNumber: blk,
          trialNumber: trl,
          trialStart: timestamp,
          motionStart: timestamp + 400,
          occluderStart: currentMode === ExperimentalMode.TTC ? timestamp + 1000 : 0,
          responseTime,
          targetTime: dur,
          errorMs,
          errorPercent,
          confidence: Math.round(3 + Math.random() * 2), // 3,4,5 confidence mostly
          feedbackType: feedbackText,
          adaptiveCoefficient: 1.0,
          isTraining: false,
        });

        timestamp += 12 * 1000; // 12 seconds per trial
      }
    }

    set({
      trials: mockTrials,
      totalTrialsCompleted: mockTrials.length,
      currentBlock: totalBlocks,
      currentTrial: trialsPerBlock,
      isTraining: false,
    });

    get().logSystemMessage(`Database seeded. ${mockTrials.length} experimental records added to session logs.`);
  },
}));
