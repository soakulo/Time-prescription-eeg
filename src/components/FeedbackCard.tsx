/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useLabStore } from "../store";
import { ExperimentalMode } from "../types";

interface FeedbackCardProps {
  onNextTrial: () => void;
}

export default function FeedbackCard({ onNextTrial }: FeedbackCardProps) {
  const {
    currentFeedbackData,
    trials,
    trainingTrials,
    isTraining,
    currentMode,
    activeTrialCondition,
    activeTrialState,
    submitConfidence,
    currentConfidence,
  } = useLabStore();

  const [ratingInput, setRatingInput] = useState<number>(3);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Sync state with store if already rated
  useEffect(() => {
    setRatingInput(3);
    setSubmitted(activeTrialState === "feedback");
  }, [activeTrialState]);

  // Handle rating submittal
  const handleRate = (value: number) => {
    setRatingInput(value);
    submitConfidence(value);
    setSubmitted(true);
  };

  // Listen for Space key, automatically advance feedback if already rated/submitted
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        if (submitted && activeTrialState === "feedback") {
          e.preventDefault();
          onNextTrial();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, activeTrialState, onNextTrial]);

  if (!currentFeedbackData) return null;

  const { errorMs, errorPercent, feedbackText, targetTime, responseTime } = currentFeedbackData;
  const isEarly = errorMs < 0;
  const errorMagnitude = Math.abs(errorMs);
  const percentMagnitude = Math.abs(errorPercent).toFixed(1);

  // Pull last 3 trial results to draw historical trend
  const historyPool = isTraining ? trainingTrials : trials;
  const lastThree = historyPool.slice(-3);

  // Styling helper for early vs late
  let statusColor = "text-emerald-400 border-emerald-500/20";
  let statusBg = "bg-emerald-500/10";
  if (Math.abs(errorPercent) > 15) {
    statusColor = "text-rose-450 border-rose-500/20";
    statusBg = "bg-rose-500/10";
  } else if (Math.abs(errorPercent) > 5) {
    statusColor = "text-amber-400 border-amber-500/20";
    statusBg = "bg-amber-500/10";
  }

  return (
    <div className="w-full bg-[#0c1322] border border-[#142037] rounded-xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden backdrop-blur-sm">
      {/* Premium back glimmers */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#9333ea]/5 rounded-full blur-2xl pointer-events-none" />

      {!submitted ? (
        /* Confidence Rating Step: Mandatory before displaying exact milliseconds feedback to protect experimental objectivity */
        <div className="flex flex-col items-center justify-center py-6 text-center relative z-10">
          {/* Scientific Signal Radar Badge icon */}
          <div className="relative w-14 h-14 mb-4 flex items-center justify-center select-none">
            <span className="absolute inset-0 bg-[#3b82f6]/10 rounded-full animate-pulse pointer-events-none" />
            <div className="w-10 h-10 rounded-full border border-blue-500/30 flex items-center justify-center bg-[#070c14] shadow-[0_0_15px_rgba(30,144,255,0.25)]">
              <span className="text-blue-400 font-mono text-sm">?</span>
            </div>
          </div>

          <h3 className="text-sm font-bold font-display tracking-wide text-white uppercase">
            ОЦЕНИТЕ СВОЮ СУБЪЕКТИВНУЮ УВЕРЕННОСТЬ
          </h3>
          <p className="text-xs text-[#7e8fad] mt-1.5 max-w-sm font-sans leading-relaxed">
            Насколько точным, по вашим собственным ощущениям, был ваш ответ относительно реального момента столкновения?
          </p>

          <div className="flex items-center gap-3 mt-8">
            {[1, 2, 3, 4, 5].map((val) => {
              const label = [
                "Не уверен",
                "Низкая уверенность",
                "Средняя уверенность",
                "Высокая уверенность",
                "Полная уверенность",
              ][val - 1];
              return (
                <button
                  key={val}
                  onClick={() => handleRate(val)}
                  className="flex flex-col items-center gap-1.5 group select-none cursor-pointer"
                  title={label}
                >
                  <div className="w-11 h-11 rounded-xl border border-[#1a263e] hover:border-[#1e6bf3] bg-[#070c14] hover:bg-[#111e38] flex flex-col justify-center items-center text-xs font-mono font-bold text-[#7e8fad] hover:text-white transition-all transform active:scale-95 shadow-md shadow-black/20">
                    <span className="text-[#a78bfa] leading-none mb-0.5">{"★".repeat(val).slice(0, 1)}</span>
                    <span className="leading-none text-gray-200">{val}</span>
                  </div>
                  <span className="text-[9px] text-[#5d7290] group-hover:text-gray-300 font-mono tracking-wider scale-90 uppercase">
                    {val === 1 ? "Мин" : val === 5 ? "Макс" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          
          <p className="text-[9px] font-mono text-[#5d7290] mt-8 uppercase tracking-widest leading-none">
            (Выбор оценки откроет показатели вашей точности)
          </p>
        </div>
      ) : (
        /* Real Scientific Performance & Timeline Feedback Step */
        <div className="flex flex-col gap-6 relative z-10">
          <div className="flex justify-between items-start flex-wrap gap-4 pb-4 border-b border-[#142037]">
            <div>
              <span className="text-[10px] font-bold font-mono tracking-widest text-[#1e6bf3] uppercase block leading-none">
                {isTraining ? "Результат тренировки" : "Анализ текущей попытки"}
              </span>
              <h2 className="text-2xl font-black font-mono tracking-tight text-white mt-1.5 select-none">
                {isEarly ? "-" : "+"}
                {errorMagnitude.toFixed(0)} <span className="text-base font-bold text-[#5d7290] font-sans">мс</span>
              </h2>
              <p className="text-xs text-[#7e8fad] mt-1 font-mono leading-none">
                Ошибка: <span className={isEarly ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>{isEarly ? "-" : "+"}{percentMagnitude}%</span>
              </p>
            </div>

            <div className={`px-4 py-2 border rounded-full text-[10px] font-bold font-mono ${statusColor} ${statusBg} flex items-center gap-1.5 shadow select-none`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {feedbackText === "Excellent" ? "ОТЛИЧНО" :
               feedbackText === "Slightly Early" ? "НЕМНОГО РАНЬШЕ" :
               feedbackText === "Slightly Late" ? "НЕМНОГО ПОЗДНЕЕ" :
               feedbackText === "Too Early" ? "СЛИШКОМ РАНО" : "СЛИШКОМ ПОЗДНО"}
            </div>
          </div>

          {/* SVG Visual Timeline Comparison */}
          <div className="bg-[#070c14] border border-[#1a263e] rounded-xl p-4 shadow-inner">
            <h4 className="text-[10px] font-bold font-mono text-[#5d7290] mb-2 uppercase tracking-wide select-none">
              Сравнение временной шкалы (Ответ участника vs Физический эталон)
            </h4>
            
            <div className="relative h-16 w-full mt-4 flex items-center select-none">
              {/* Reference scale background line */}
              <div className="h-1 w-full bg-[#1a263e] rounded-lg relative" />
              
              {/* Virtual Positions inside 100% boundary */}
              {(() => {
                const maxCap = Math.max(targetTime, responseTime) * 1.15;
                const targetPct = (targetTime / maxCap) * 100;
                const responsePct = (responseTime / maxCap) * 100;
 
                return (
                  <>
                    {/* Tick bounds */}
                    <div className="absolute top-0 bottom-0 flex flex-col justify-between items-center text-[9px] font-mono text-[#5d7290]" style={{ left: "0%" }}>
                      <span className="h-2 w-0.5 bg-[#1a263e]" />
                      <span>0мс</span>
                    </div>

                    <div className="absolute top-0 bottom-0 flex flex-col justify-between items-center text-[9px] font-mono text-gray-400" style={{ left: `${targetPct}%` }}>
                      <span className="h-4 w-1 bg-rose-500 rounded-sm" />
                      <span className="bg-rose-950/45 px-1.5 py-0.5 border border-rose-800/50 text-rose-400 font-bold rounded-lg text-[9px] font-mono">ЭТАЛОН: {targetTime}мс</span>
                    </div>

                    <div className="absolute top-0 bottom-0 flex flex-col justify-between items-center text-[9px] font-mono text-gray-400" style={{ left: `${responsePct}%` }}>
                      <span className="h-4 w-1 bg-blue-500 rounded-sm" />
                      <span className="bg-blue-950/45 px-1.5 py-0.5 border border-blue-800/55 text-blue-300 font-bold rounded-lg text-[9px] font-mono mt-6">НАЖАТО: {responseTime.toFixed(0)}мс</span>
                    </div>

                    {/* Connecting error bracket */}
                    <div 
                      className="absolute h-[2px] bg-amber-400" 
                      style={{
                        left: `${Math.min(targetPct, responsePct)}%`,
                        width: `${Math.abs(targetPct - responsePct)}%`,
                        top: "50%"
                      }} 
                    />
                  </>
                );
              })()}
            </div>
            
            <p className="text-[9px] font-mono text-center text-[#5d7290] mt-3 select-none uppercase tracking-wide">
              Оранжевая полоса отображает окно ошибки отклонения вашего времени.
            </p>
          </div>

          {/* Visual Collision trajectory details under TTC mode */}
          {activeTrialCondition === ExperimentalMode.TTC && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#1a263e] bg-[#070c14] rounded-xl p-4 shadow-sm">
                <span className="text-[9px] font-bold font-mono text-indigo-400 block uppercase mb-1.5">
                  Траектория движения за экраном
                </span>
                <p className="text-xs text-gray-300 leading-relaxed font-sans">
                  Стимул зашел в зону экранирования на отметке <span className="font-mono font-bold text-[#1e6bf3]">600 мс</span> и двигался за экраном <span className="font-mono font-bold text-[#10B981]">{targetTime - 600} мс</span> до момента соприкосновения. Ошибка фиксации составила всего <span className="font-mono font-bold text-[#F59E0B]">{Math.abs(errorMs).toFixed(0)} мс</span>.
                </p>
              </div>

              <div className="border border-[#1a263e] bg-[#070c14] rounded-xl p-4 flex flex-col justify-between shadow-sm">
                <span className="text-[9px] font-bold font-mono text-indigo-400 block uppercase mb-1.5">
                  Показатель уверенности
                </span>
                <div className="flex items-center gap-1.5 my-1.5 select-none">
                  <span className="text-xs text-[#7e8fad] font-mono leading-none">Оценка:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={`text-xs ${s <= currentConfidence ? "text-amber-400 font-bold" : "text-slate-700"}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#1e6bf3] font-mono font-bold ml-1">
                    ({currentConfidence}/5)
                  </span>
                </div>
                <p className="text-[10px] text-[#5d7290] font-mono leading-normal">
                  Показатели уверенности соотносятся с фактической величиной абсолютных ошибок при последующем анализе.
                </p>
              </div>
            </div>
          )}

          {/* Running history error tracking histogram */}
          {lastThree.length > 0 && (
            <div className="border border-[#1a263e] bg-[#070c14] rounded-xl p-4 shadow-sm select-none">
              <span className="text-[10px] font-bold font-mono text-[#5d7290] block uppercase mb-3.5 tracking-wide">
                Профиль последних ошибок (Последние {lastThree.length} попыток)
              </span>
              
              <div className="flex justify-around items-end h-16 pt-2">
                {lastThree.map((item, idx) => {
                  const errorVal = item.errorMs;
                  const direction = errorVal >= 0 ? "ПОЗДНО" : "РАНО";
                  const height = Math.min(100, (Math.abs(errorVal) / 500) * 100); // capped at 500ms
                  
                  return (
                    <div key={item.id} className="flex flex-col items-center gap-2.5 w-20 font-mono">
                      <span className="text-[9px] text-[#7e8fad] font-bold leading-none">{errorVal.toFixed(0)}мс</span>
                      <div 
                        className={`w-3.5 rounded-t-md transition-all duration-300 ${errorVal >= 0 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" : "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]"}`}
                        style={{ height: `${Math.max(5, height)}%` }}
                        title={`Попытка ${item.trialNumber}: ${errorVal}мс`}
                      />
                      <span className="text-[8px] text-[#5d7290] leading-none uppercase">П{item.trialNumber} ({direction})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Space prompt button wrapper to advance */}
          <div className="flex flex-col items-center gap-2.5 mt-2.5 select-none mb-1">
            <button
              onClick={onNextTrial}
              className="w-full md:w-auto px-10 py-3.5 bg-[#1e6bf3] hover:bg-[#1554d4] focus:outline-none text-white text-xs font-bold tracking-widest font-sans uppercase rounded-xl shadow-lg hover:shadow-blue-500/20 cursor-pointer text-center select-none border border-blue-400/20 transform active:scale-98 transition-all"
            >
              ПЕРЕЙТИ К СЛЕДУЮЩЕЙ ПОПЫТКЕ [Пробел] ➔
            </button>
            <p className="text-[9px] font-mono text-[#5d7290] uppercase tracking-widest leading-none">
              (Для продолжения нажмите Пробел)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
