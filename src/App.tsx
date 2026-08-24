/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLabStore } from "./store";
import { ExperimentalMode } from "./types";
import StartScreen from "./components/StartScreen";
import ExperimentCanvas from "./components/ExperimentCanvas";
import FeedbackCard from "./components/FeedbackCard";
import BlockCompletedScreen from "./components/BlockCompletedScreen";
import ExperimentCompletedScreen from "./components/ExperimentCompletedScreen";
import ExperimenterDashboard from "./components/ExperimenterDashboard";
import { Split, User, LayoutDashboard, BrainCircuit } from "lucide-react";

export default function App() {
  const {
    activeView,
    setActiveView,
    isExperimentRunning,
    activeTrialState,
    setTrialState,
    recordResponse,
    finishTrialFeedback,
    isTraining,
    trainingTrialIndex,
    currentBlock,
    currentTrial,
    currentMode,
    activeDuration,
    activeSpeed,
    config,
  } = useLabStore();

  // Handles trial completion results inside canvas
  const handleTrialComplete = (recordedTimeMs: number) => {
    // Current Mode target calculations
    // Mode 1 Visible Reaction, Mode 2 TTC -> Target ideal time is 600ms of visible motion + Ti duration
    // Mode 3 and Mode 4 -> Target ideal time is exact Ti duration
    let targetTime = activeDuration;
    if (currentMode === ExperimentalMode.REACTION_VISIBLE || currentMode === ExperimentalMode.TTC) {
      targetTime = 600 + activeDuration;
    }
    
    recordResponse(recordedTimeMs, targetTime);
  };

  // Participant screen sub-state router
  const renderParticipantScreen = () => {
    if (!isExperimentRunning) {
      return (
        <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
          <StartScreen />
        </div>
      );
    }

    switch (activeTrialState) {
      case "ready":
        return (
          <div className="w-full max-w-xl mx-auto bg-[#0c1322] border border-[#142037] rounded-2xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            {/* Subtle premium background radial glow */}
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

            {/* Glowing Sensor Scanner SVG Icon */}
            <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center select-none">
              <span className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping pointer-events-none" />
              <div className="w-12 h-12 rounded-full border border-blue-500/30 flex items-center justify-center bg-[#070c14] shadow-[0_0_15px_rgba(30,144,255,0.25)]">
                <svg className="w-8 h-8 text-cyan-400 stroke-cyan-400 animate-spin-slow" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="2" className="opacity-25" strokeDasharray="6 6" />
                  <circle cx="50" cy="50" r="15" fill="none" strokeWidth="2" className="opacity-45" />
                  <path d="M50 10 L50 90 M10 50 L90 50" strokeWidth="1" className="opacity-35" />
                  <line x1="50" y1="50" x2="80" y2="20" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-bold font-display tracking-tight text-white uppercase text-center">
              {isTraining ? "ПОДГОТОВКА ТРЕНИРОВКИ" : `КАЛИБРОВКА БЛОКА ${currentBlock}`}
            </h2>
            
            <p className="text-xs text-[#7e8fad] font-sans mt-3 px-3 leading-relaxed text-center">
              {isTraining 
                ? "Вы запускаете цикл из 6 обязательных тренировочных попыток. Комплекс предоставит подробную обратную связь для адаптации вашей сенсомоторной реакции."
                : `Экспериментальный блок ${currentBlock} полностью готов. Все калибровочные маркеры и триггеры аппаратной синхронизации приведены в активное состояние.`}
            </p>

            {/* Structured Stats/Status Grid for matching lab design */}
            <div className="grid grid-cols-2 gap-3 mt-6 mb-8 text-left font-mono text-[10px] select-none">
              <div className="bg-[#070c14] border border-[#1a263e] p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[#5d7290] font-bold uppercase tracking-wider block">РЕЖИМ ЭКСПЕРИМЕНТА:</span>
                <span className="text-white font-bold mt-1.5 uppercase truncate text-[11px]">
                  {currentMode === ExperimentalMode.REACTION_VISIBLE ? "Реакция на Дв." :
                   currentMode === ExperimentalMode.TTC ? "Время TTC" :
                   currentMode === ExperimentalMode.INTERVAL_REPRODUCTION ? "Отмеривание Вр." :
                   currentMode === ExperimentalMode.DURATION_REPRODUCTION ? "Длительность Стимула" :
                   "Смешанный Дизайн"}
                </span>
              </div>

              <div className="bg-[#070c14] border border-[#1a263e] p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[#5d7290] font-bold uppercase tracking-wider block">ПАТТЕРН ТЕЛЕМЕТРИИ:</span>
                <span className="text-emerald-400 font-bold mt-1.5 flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  АКТИВЕН / 128Hz
                </span>
              </div>

              <div className="bg-[#070c14] border border-[#1a263e] p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[#5d7290] font-bold uppercase tracking-wider block">УДЕРЖАНИЕ СТИМУЛА:</span>
                <span className="text-[#60A5FA] font-bold mt-1.5 text-[11px] font-mono">
                  {activeDuration} мс
                </span>
              </div>

              <div className="bg-[#070c14] border border-[#1a263e] p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[#5d7290] font-bold uppercase tracking-wider block">СКОРОСТЬ ОБЪЕКТА:</span>
                <span className="text-[#A78BFA] font-bold mt-1.5 text-[11px] font-mono">
                  {activeSpeed} пикс/с
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setTrialState("idle")}
                className="w-full py-3.5 bg-[#1e6bf3] hover:bg-[#1554d4] cursor-pointer font-sans text-xs font-bold text-white uppercase rounded-xl transition-all shadow-[0_4px_16px_rgba(30,144,255,0.2)] hover:shadow-[0_4px_22px_rgba(30,144,255,0.35)] active:scale-98 border border-blue-400/20 text-center select-none"
              >
                Начать серию попыток [Пробел] ➔
              </button>
              <span className="text-[9px] font-mono text-[#5d7290] uppercase tracking-widest leading-none select-none">
                Нажмите пробел для запуска первого стимула
              </span>
            </div>
          </div>
        );

      case "idle":
      case "blank_delay":
      case "motion":
      case "occluded":
      case "waiting_response":
        return <ExperimentCanvas onTrialComplete={handleTrialComplete} />;

      case "confidence_rating":
      case "feedback":
        return <FeedbackCard onNextTrial={finishTrialFeedback} />;

      case "block_completed":
        return <BlockCompletedScreen />;

      case "experiment_completed":
        return <ExperimentCompletedScreen />;

      default:
        return (
          <div className="text-center text-[#5d7290] py-12 font-mono">
            НЕИЗВЕСТНЫЙ СТАТУС ДАТЧИКА ЭКСПЕРИМЕНТА
          </div>
        );
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-[#070c14] text-[#c9d1d9] font-sans flex flex-col selection:bg-blue-600/30 selection:text-white">
      
      {/* 1. Global Scientific Workspace Nav Header */}
      <header className="bg-[#0d1424] border-b border-[#1a263e] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-20 shrink-0">
        
        {/* Lab Title Block */}
        <div className="flex items-center gap-3 select-none">
          <div className="bg-gradient-to-tr from-[#1651cd] to-[#1e6bf3] p-2 rounded-lg border border-blue-400/20 shadow-md shadow-blue-500/10">
            <BrainCircuit className="w-5 h-5 text-emerald-300 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest font-mono text-white leading-none uppercase">
              КОМПЛЕКС ДЛЯ ИССЛЕДОВАНИЯ ВОСПРИЯТИЯ ВРЕМЕНИ
            </h1>
            <span className="text-[10px] text-[#7e8fad] font-mono leading-none mt-1.5 block">
              Университетская лаборатория · Терминал когнитивного восприятия времени и скорости
            </span>
          </div>
        </div>

        {/* View Workspace Mode Select Buttons */}
        <div className="flex items-center bg-[#070c14] border border-[#1a263e] rounded-xl p-1 select-none">
          {/* Dual Split */}
          <button
            onClick={() => setActiveView("split")}
            className={`px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "split"
                ? "bg-[#1e6bf3] text-white shadow"
                : "text-[#7e8fad] hover:text-white hover:bg-slate-800/45"
            }`}
            title="Оценивайте одновременно экран испытуемого и панель оператора в реальном времени"
          >
            <Split className="w-3.5 h-3.5 text-current" />
            Комбинированный режим
          </button>

          {/* Participant screen only */}
          <button
            onClick={() => setActiveView("participant")}
            className={`px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "participant"
                ? "bg-[#1e6bf3] text-white shadow"
                : "text-[#7e8fad] hover:text-white hover:bg-slate-800/45"
            }`}
            title="Экран участника без отвлекающих факторов"
          >
            <User className="w-3.5 h-3.5 text-current" />
            Экран испытуемого
          </button>

          {/* Control board only */}
          <button
            onClick={() => setActiveView("experimenter")}
            className={`px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "experimenter"
                ? "bg-[#1e6bf3] text-white shadow"
                : "text-[#7e8fad] hover:text-white hover:bg-slate-800/45"
            }`}
            title="Выделенная панель показателей и настроек оператора"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-current" />
            Панель оператора
          </button>
        </div>
      </header>

      {/* 2. Responsive Main Simulation Stage Wrapper */}
      <main className="flex-1 overflow-auto bg-[#070c14] p-4 md:p-6 lg:p-8 flex items-center justify-center">
        {activeView === "split" ? (
          
          /* Dual Side-by-Side Simulation: Highly informative evaluation viewport! */
          <div className="w-full max-w-7xl h-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column (Participant Canvas screen frame): Spans 5 cols */}
            <div className="lg:col-span-5 bg-[#0d1424] border border-[#1a263e] rounded-2xl p-5 flex flex-col justify-between shadow-xl relative backdrop-blur-sm">
              <div className="w-full flex justify-between items-center pb-3 border-b border-[#1a263e]/55 mb-4 select-none">
                <span className="text-[10px] font-bold font-mono text-[#60A5FA] uppercase tracking-widest flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  👤 Экран участника (Симуляция)
                </span>
                
                {isExperimentRunning && (
                  <span className="text-[9px] bg-blue-900/40 border border-blue-800/40 px-2 py-0.5 font-mono text-blue-300 rounded leading-none uppercase">
                    {isTraining ? `Тренировка ${trainingTrialIndex + 1}/${config.trainingTrialsCount || 5}` : `Блок ${currentBlock} · Проба ${currentTrial}`}
                  </span>
                )}
              </div>
              
              <div className="flex-1 flex items-center justify-center min-h-[360px]">
                {renderParticipantScreen()}
              </div>

              <div className="mt-4 pt-3 border-t border-[#1a263e]/55 text-center select-none text-[10px] text-[#5d7290] font-mono">
                Клавиатурный ввод (клавиша Пробел) работает в активной области этого экрана.
              </div>
            </div>

            {/* Right Column (Experimenter dashboards): Spans 7 cols */}
            <div className="lg:col-span-7 bg-[#0d1424] border border-[#1a263e] rounded-2xl p-5 shadow-xl relative overflow-auto backdrop-blur-sm">
              <div className="w-full pb-3 border-b border-[#1a263e]/55 mb-4 flex justify-between items-center select-none">
                <span className="text-[10px] font-bold font-mono text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  🔬 Панель исследователя и телеметрия
                </span>
                <span className="text-[9px] font-mono text-[#5d7290] uppercase">
                  СИНХРОНИЗАЦИЯ UTC: ДАТЧИК 128 Гц
                </span>
              </div>

              <ExperimenterDashboard />
            </div>
          </div>
          
        ) : activeView === "participant" ? (
          
          /* Participant Screen ONLY: Completely focused view */
          <div className="w-full max-w-4xl bg-[#0d1424] border border-[#1a263e] rounded-2xl p-6 shadow-2xl min-h-[500px] flex flex-col justify-between">
            <div className="w-full flex justify-between items-center pb-3 border-b border-[#1a263e]/55 mb-6 select-none">
              <span className="text-xs font-bold font-mono text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                ВЫДЕЛЕННЫЙ ТЕРМИНАЛ УЧАСТНИКА (ПОЛНАЯ КОНЦЕНТРАЦИЯ)
              </span>
              
              {isExperimentRunning && (
                <span className="text-xs bg-indigo-900 border border-indigo-700/50 px-3 py-1 font-mono text-indigo-300 rounded">
                  {isTraining ? `Тренировочная попытка: ${trainingTrialIndex + 1}/${config.trainingTrialsCount || 5}` : `Блок: ${currentBlock} / Проба: ${currentTrial}`}
                </span>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center">
              {renderParticipantScreen()}
            </div>

            <div className="text-center text-xs text-slate-500 font-mono mt-6 select-none uppercase tracking-widest flex items-center justify-center gap-1">
              <span>Пожалуйста, сфокусируйтесь и избегайте отвлекающих факторов во время движения объекта.</span>
            </div>
          </div>
          
        ) : (
          
          /* Control Console ONLY: Clean operator analyzer dashboard view */
          <div className="w-full max-w-5xl bg-[#0d1424] border border-[#1a263e] rounded-2xl p-6 shadow-2xl">
            <div className="w-full pb-3 border-b border-[#1a263e]/55 mb-6 flex justify-between items-center select-none">
              <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
                ВЫДЕЛЕННЫЙ ПУЛЬТ УПРАВЛЕНИЯ
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                СИНХРОНИЗАЦИЯ ЧАСОВ LSL: СИНХР_OK
              </span>
            </div>

            <ExperimenterDashboard />
          </div>
        )}
      </main>

      {/* 3. Scientific Footer Signature */}
      <footer className="bg-[#0d1424] border-t border-[#1a263e] py-3.5 px-6 text-center select-none shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-2">
          <p className="text-[9px] font-mono text-gray-500">
            Комплекс нейровосприятия разработан с использованием высокопроизводительного Canvas API и высокоточных счетчиков TypeScript.
          </p>
          <p className="text-[9px] font-mono text-indigo-400/80">
            © 2026 Лаборатория когнитивных исследований. Университет Сириус.
          </p>
        </div>
      </footer>
    </div>
  );
}
