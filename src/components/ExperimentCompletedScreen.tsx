/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLabStore } from "../store";
import { calculateMetrics } from "../metrics";
import { Download, RefreshCw, CheckCircle, BrainCircuit } from "lucide-react";

export default function ExperimentCompletedScreen() {
  const { participantId, trials, abortExperiment } = useLabStore();

  const metrics = calculateMetrics(trials);
  const totalTrials = trials.filter((t) => !t.isTraining).length;

  const handleExportCSV = () => {
    // 17 headers described in instructions:
    const headers = [
      "participantId",
      "condition",
      "duration",
      "speed",
      "trajectoryId",
      "blockNumber",
      "trialNumber",
      "trialStart",
      "motionStart",
      "occluderStart",
      "responseTime",
      "targetTime",
      "errorMs",
      "errorPercent",
      "confidence",
      "feedbackType",
      "adaptiveCoefficient"
    ];

    const rows = trials.map((t) => [
      t.participantId,
      t.condition,
      t.duration,
      t.speed,
      t.trajectoryId,
      t.blockNumber,
      t.trialNumber,
      t.trialStart.toFixed(3),
      t.motionStart.toFixed(3),
      t.occluderStart.toFixed(3),
      t.responseTime.toFixed(3),
      t.targetTime.toFixed(3),
      t.errorMs.toFixed(1),
      t.errorPercent.toFixed(2),
      t.confidence,
      t.feedbackType,
      t.adaptiveCoefficient.toFixed(2)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `timelab_FULL_PROCESSED_${participantId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metacognitive awareness: Compute mean absolute error for each confidence rating (1 to 5)
  const confidenceStats = [1, 2, 3, 4, 5].map((rating) => {
    const subset = trials.filter((t) => t.confidence === rating);
    if (subset.length === 0) return { rating, avgError: 0, count: 0 };
    const sumError = subset.reduce((sum, t) => sum + Math.abs(t.errorMs), 0);
    return {
      rating,
      avgError: sumError / subset.length,
      count: subset.length,
    };
  });

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#0c1322] border border-[#142037] rounded-2xl p-8 shadow-2xl relative overflow-hidden font-sans">
      {/* Premium back glimmers */}
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Styled Brain/Signal Central Icon */}
      <div className="mx-auto w-16 h-16 relative flex items-center justify-center select-none mb-4">
        <span className="absolute inset-0 bg-emerald-400/10 rounded-full animate-ping pointer-events-none" />
        <div className="w-12 h-12 rounded-full border border-emerald-500/30 flex items-center justify-center bg-[#070c14] shadow-[0_0_15px_rgba(16,185,129,0.25)]">
          <BrainCircuit className="w-6 h-6 text-emerald-400" />
        </div>
      </div>

      <div className="text-center flex flex-col items-center gap-2 mb-8 select-none relative z-10">
        <h1 className="text-xl font-bold font-display tracking-tight text-white uppercase">
          ЭКСПЕРИМЕНТ УСПЕШНО ЗАВЕРШЕН
        </h1>
        <p className="text-xs text-[#7e8fad] font-mono leading-relaxed max-w-lg">
          Сформирован подробный когнитивный профиль испытуемого <span className="text-[#1e6bf3] font-bold">{participantId}</span>. Все собранные показатели сессии заблокированы и подготовлены для экспорта.
        </p>
      </div>

      {/* Global Board stats summary with styled cards */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 select-none relative z-10">
          {[
            { label: "Всего попыток", value: totalTrials, color: "text-white" },
            { label: "Пост. смещение", value: `${metrics.bias >= 0 ? "+" : ""}${metrics.bias.toFixed(1)} мс`, color: metrics.bias >= 0 ? "text-amber-500" : "text-rose-450" },
            { label: "Дробь Вебера", value: metrics.weberFraction.toFixed(4), color: "text-indigo-400" },
            { label: "Коэфф. вариации (CV)", value: metrics.cv.toFixed(4), color: "text-blue-400" },
          ].map((item, idx) => (
            <div key={idx} className="bg-[#070c14] border border-[#1a263e] hover:border-blue-500/10 p-3.5 rounded-xl text-center shadow-inner transition-all">
              <span className="text-[9px] font-mono text-[#5d7290] uppercase block mb-1.5 font-bold tracking-wider">{item.label}</span>
              <span className={`text-base font-bold font-mono leading-none ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metacognitive Calibration Report */}
      <div className="bg-[#070c14]/80 backdrop-blur-sm border border-[#1a263e] rounded-xl p-5 mb-8 shadow-inner relative z-10">
        <h3 className="text-xs font-bold font-mono text-indigo-300 uppercase mb-2 text-center select-none tracking-wide">
          🧠 Калибровка метакогнитивной точности восприятия времени
        </h3>
        <p className="text-[10px] text-[#5d7290] text-center font-mono leading-relaxed mb-4 max-w-lg mx-auto select-none">
          Сравнение средней абсолютной ошибки во времени (в мс) для каждой оценки вашей уверенности (от 1 до 5 звезд). Снижение высоты столбцов при росте уверенности указывает на хорошую калибровку метапознания.
        </p>

        <div className="flex justify-around items-end h-32 pt-4 select-none">
          {confidenceStats.map((item) => {
            const height = item.count > 0 ? Math.min(100, (item.avgError / 400) * 100) : 0;
            return (
              <div key={item.rating} className="flex flex-col items-center gap-2 w-16">
                {item.count > 0 ? (
                  <>
                    <span className="text-[9px] font-mono text-[#7e8fad] font-bold leading-none mb-1">{item.avgError.toFixed(0)}мс</span>
                    <div 
                      className="w-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-300 shadow-[0_0_8px_rgba(30,144,255,0.25)] hover:scale-x-110"
                      style={{ height: `${Math.max(6, height)}%` }}
                      title={`Уверенность ${item.rating}★: средняя ошибка ${item.avgError.toFixed(1)} мс (${item.count} поп.)`}
                    />
                  </>
                ) : (
                  <div className="h-4 text-[9px] font-mono text-[#5d7290] mb-2 font-bold uppercase select-none">Н/Д</div>
                )}
                
                <span className="text-[10px] font-mono text-amber-500 leading-none">
                  {"★".repeat(item.rating)}
                </span>
                <span className="text-[8px] font-mono text-[#5d7290] uppercase leading-none mt-1">
                  ({item.count} поп.)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export & Reset triggers */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center select-none relative z-10">
        <button
          onClick={abortExperiment}
          className="w-full sm:w-auto px-5 py-3 border border-[#1a263e] hover:bg-slate-800/40 text-gray-400 hover:text-white font-mono text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer select-none active:scale-95"
        >
          <RefreshCw className="w-4 h-4 text-[#5d7290]" />
          В НАЧАЛО
        </button>

        <button
          onClick={handleExportCSV}
          className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-bold tracking-wider uppercase rounded-lg shadow-lg hover:shadow-emerald-500/20 flex justify-center items-center gap-2 transition-all cursor-pointer border border-emerald-400/20 active:scale-98 text-center leading-none"
        >
          <Download className="w-4 h-4 text-emerald-150" />
          СКАЧАТЬ ОТЧЕТ CSV
        </button>
      </div>
    </div>
  );
}
