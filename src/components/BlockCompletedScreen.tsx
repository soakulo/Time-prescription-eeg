/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { useLabStore } from "../store";
import { calculateMetrics } from "../metrics";
import { Check, ArrowRight, Award } from "lucide-react";

export default function BlockCompletedScreen() {
  const {
    currentBlock,
    isTraining,
    trials,
    trainingTrials,
    proceedToMainBlocks,
    skipTraining,
    logSystemMessage,
  } = useLabStore();

  const [subjectiveRating, setSubjectiveRating] = useState<number>(50); // Scale from 0 to 100 (time flew vs dragged)
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>("3");
  const [providedEstimate, setProvidedEstimate] = useState<boolean>(false);

  // Compute stats for current block
  const blockData = isTraining ? trainingTrials : trials.filter((t) => t.blockNumber === currentBlock);
  const metrics = calculateMetrics(blockData as any);

  const handleSubmitEstimate = () => {
    setProvidedEstimate(true);
    logSystemMessage(
      `Subjective report for block completed: Passage Passage: ${subjectiveRating}/100, Est. duration: ${estimatedMinutes} minutes.`
    );
  };

  const handleProceed = () => {
    proceedToMainBlocks();
    setProvidedEstimate(false);
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#0c1322] border border-[#142037] rounded-2xl p-8 shadow-2xl relative overflow-hidden font-sans">
      {/* Premium back glow elements */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-[#9333ea]/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col items-center gap-2 mb-6 select-none relative z-10 text-center">
        {/* Styled Science Glowing Badge */}
        <div className="relative w-16 h-16 mb-2 flex items-center justify-center">
          <span className="absolute inset-0 bg-[#c084fc]/10 rounded-full animate-pulse pointer-events-none" />
          <div className="w-12 h-12 rounded-full border border-purple-500/30 flex items-center justify-center bg-[#070c14] shadow-[0_0_15px_rgba(168,85,247,0.25)]">
            <Award className="w-6 h-6 text-[#c084fc]" />
          </div>
        </div>

        <h2 className="text-xl font-bold font-display tracking-tight text-white uppercase">
          {isTraining ? "ТРЕНИРОВОЧНЫЙ БЛОК ВЫПОЛНЕН" : `БЛОК ${currentBlock} ИЗ СЕССИИ ЗАВЕРШЕН`}
        </h2>
        <p className="text-xs text-[#7e8fad] font-mono mt-1 px-4 leading-relaxed">
          {isTraining 
            ? "Вы прошли все 6 обязательных тренировочных попыток. Комплекс откалиброван."
            : "Аналитические метрики блока успешно записаны в массив данных научных исследований."}
        </p>
      </div>

      {metrics && (
        <div className="bg-[#070c14] border border-[#1a263e] rounded-xl p-5 mb-6 text-left select-none shadow-inner relative z-10">
          <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-widest block mb-4 text-center">
            Сводка результатов завершенного блока
          </span>
          
          <div className="grid grid-cols-2 gap-4 text-xs font-mono text-gray-400">
            <div className="border border-[#1a263e] bg-[#0c1322]/40 hover:border-amber-500/20 p-3 rounded-lg transition-all">
              <span className="text-[#5d7290] text-[9px] uppercase font-bold tracking-wider">СМЕЩЕНИЕ (СРЕДНЯЯ ОШИБКА):</span>
              <div className={`text-sm font-bold mt-1.5 ${metrics.bias >= 0 ? "text-amber-500" : "text-rose-400"}`}>
                {metrics.bias >= 0 ? "+" : ""}{metrics.bias.toFixed(1)} мс
              </div>
            </div>
            
            <div className="border border-[#1a263e] bg-[#0c1322]/40 hover:border-indigo-500/20 p-3 rounded-lg transition-all">
              <span className="text-[#5d7290] text-[9px] uppercase font-bold tracking-wider">ДРОБЬ ВЕБЕРА (WF):</span>
              <div className="text-sm font-bold text-indigo-400 mt-1.5">
                {metrics.weberFraction.toFixed(4)}
              </div>
            </div>

            <div className="border border-[#1a263e] bg-[#0c1322]/40 hover:border-blue-500/20 p-3 rounded-lg transition-all">
              <span className="text-[#5d7290] text-[9px] uppercase font-bold tracking-wider">КОЭФФ. ВАРИАЦИИ (CV):</span>
              <div className="text-sm font-bold text-blue-400 mt-1.5">
                {metrics.cv.toFixed(4)}
              </div>
            </div>

            <div className="border border-[#1a263e] bg-[#0c1322]/40 hover:border-emerald-500/20 p-3 rounded-lg transition-all">
              <span className="text-[#5d7290] text-[9px] uppercase font-bold tracking-wider font-bold">СТЕПЕНЬ ТОЧНОСТИ:</span>
              <div className="text-sm font-bold text-emerald-400 mt-1.5">
                {metrics.meanAccuracy.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block subjective temporal passage feedback details */}
      {!providedEstimate ? (
        <div className="bg-[#070c14]/80 backdrop-blur-sm border border-[#1a263e] rounded-xl p-5 mb-8 text-left flex flex-col gap-5 shadow-md relative z-10">
          <span className="text-[10px] font-bold font-mono text-amber-500 uppercase tracking-widest block text-center select-none">
            🔬 Субъективная оценка течения времени (Обязательно)
          </span>

          {/* Time passage rating slider */}
          <div className="space-y-3">
            <div className="flex justify-between text-[9px] font-mono text-[#5d7290] leading-none select-none">
              <span className="uppercase tracking-wider">ВРЕМЯ ЛЕТЕЛО БЫСТРО</span>
              <span className="uppercase tracking-wider">ВРЕМЯ ТЯНУЛОСЬ МЕДЛЕННО</span>
            </div>
            
            <div className="relative pt-1 flex items-center">
              <input
                type="range"
                min="0"
                max="100"
                value={subjectiveRating}
                onChange={(e) => setSubjectiveRating(Number(e.target.value))}
                className="w-full h-1.5 bg-[#0c1322] border border-[#1a263e] rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="text-center mt-1 select-none">
              <span className="inline-block px-3 py-1 rounded bg-amber-550/10 border border-amber-500/20 text-amber-400 font-bold text-[11px] font-mono leading-none">
                Оценка скорости восприятия: {subjectiveRating} / 100
              </span>
            </div>
          </div>

          {/* Estimated duration numeric appraisal */}
          <div className="space-y-3 border-t border-[#1a263e]/40 pt-4">
            <label className="block text-[10px] font-mono text-[#7e8fad] leading-normal uppercase select-none tracking-wide">
              Сколько физического времени длился этот блок по вашему ощущению?
            </label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="bg-[#0c1322] border border-[#1a263e] rounded-lg px-4 py-2 text-xs text-white hover:border-[#1e6bf3]/50 focus:border-[#1e6bf3] font-mono w-28 text-center focus:outline-none transition-all"
                  placeholder="Минут"
                />
              </div>
              <span className="text-xs font-mono text-[#5d7290] select-none uppercase tracking-wide">Минут/Секунд</span>
            </div>
          </div>

          <button
            onClick={handleSubmitEstimate}
            className="w-full py-3 bg-[#1e6bf3] hover:bg-[#1554d4] text-white font-sans text-xs font-bold uppercase rounded-lg transition-all cursor-pointer shadow-lg shadow-blue-500/10 border border-blue-400/20 active:scale-98"
          >
            Зафиксировать данные субъективного отчета
          </button>
        </div>
      ) : (
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 mb-8 flex items-center gap-3 animate-fade-in text-left relative z-10">
          <div className="p-2 bg-emerald-500 rounded-full text-white shrink-0 select-none shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs text-emerald-400 font-sans leading-relaxed">
            Субъективная оценка успешно заблокирована, депонирована в базу и связана с соответствующими сессионными пробами текущего блока исследования.
          </p>
        </div>
      )}

      {/* Mandatory Break Advice */}
      {!isTraining && (currentBlock === 2 || currentBlock === 4) && providedEstimate && (
        <div className="my-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left animate-fade-in select-none relative z-10">
          <span className="text-[10px] font-bold font-mono text-amber-500 uppercase tracking-widest block mb-1">
            ⏸️ РЕКОМЕНДУЕМЫЙ ПЕРЕРЫВ (СПЕЦИФИКА ТЗНЫ СЕССИИ)
          </span>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Вы завершили {currentBlock} блока экспериментов. Настоятельно рекомендуется сделать перерыв на 1–2 минуты для отдыха глаз, восстановления фокуса и снижения мышечного напряжения. Это позволит получить чистые данные ЭЭГ в последующих блоках.
          </p>
        </div>
      )}

      {/* Navigation pathways */}
      <div className="flex flex-col gap-2 relative z-10">
        {providedEstimate && (
          <button
            onClick={handleProceed}
            className="w-full py-3.5 bg-[#1e6bf3] hover:bg-[#1554d4] text-white font-sans text-xs font-bold uppercase rounded-lg shadow-lg hover:shadow-blue-500/15 flex justify-center items-center gap-2 transition-all cursor-pointer border border-blue-400/20 active:scale-98 text-center"
          >
            {isTraining ? "ПЕРЕЙТИ К ОСНОВНЫМ ЭКСПЕРИМЕНТАЛЬНЫМ БЛОКАМ" : "ПРОДОЛЖИТЬ СЕССИЮ (СЛЕДУЮЩИЙ БЛОК)"}
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        )}

        {isTraining && (
          <button
            onClick={skipTraining}
            className="text-xs font-mono text-[#5d7290] hover:text-[#7e8fad] hover:underline mt-4 cursor-pointer text-center"
          >
            Пропустить цикл тренировки и перейти напрямую к эксперименту
          </button>
        )}
      </div>
    </div>
  );
}
