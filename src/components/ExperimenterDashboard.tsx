/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { useLabStore } from "../store";
import { calculateMetrics, getBlockSummaries } from "../metrics";
import { Download, ShieldAlert, FastForward, Activity, Trash2, Database } from "lucide-react";

export default function ExperimenterDashboard() {
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  const {
    participantId,
    currentMode,
    isExperimentRunning,
    isPaused,
    currentBlock,
    currentTrial,
    isTraining,
    trainingTrialIndex,
    trials,
    config,
    systemLogs,
    eegMarkers,
    pauseExperiment,
    resumeExperiment,
    abortExperiment,
    clearAllTrials,
    seedSimulatedData,
    skipToNextRealBlock,
    activeView,
  } = useLabStore();

  // Compute live metrics
  const activeTrials = trials.filter((t) => !t.isTraining); // compute only for main trials
  const metrics = calculateMetrics(trials);
  const blockSummaries = getBlockSummaries(trials);

  // Trigger spreadsheet CSV file extraction download
  const handleExportCSV = () => {
    if (trials.length === 0) {
      setExportWarning("Сначала сгенерируйте данные!");
      setTimeout(() => setExportWarning(null), 4000);
      return;
    }

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
    link.setAttribute("download", `timelab_run_subject_${participantId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 font-sans">
      
      {/* 1. Technical Quick Bar (Operator Status & Core Controls) */}
      <div className="bg-[#0c1322] border border-[#1a263e] rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 shadow-lg select-none">
        
        {/* Core telemetry */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-[#5d7290] uppercase tracking-wide">ID ИСПЫТУЕМОГО</span>
            <span className="text-xs font-bold font-mono text-white mt-0.5">{participantId || "БЕЗ_ID"}</span>
          </div>
          <div className="h-6 w-px bg-[#1a263e] hidden sm:block" />
          
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-[#5d7290] uppercase tracking-wide">СТАТУС СЕССИИ</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`h-2 w-2 rounded-full ${isExperimentRunning ? (isPaused ? "bg-yellow-500" : "bg-green-500 animate-pulse") : "bg-slate-600"}`} />
              <span className="text-xs font-bold font-mono text-gray-200">
                {isExperimentRunning ? (isPaused ? "ПАУЗА" : (isTraining ? "ТРЕНИРОВКА" : "АКТИВНЫЙ БЛОК")) : "В ОЖИДАНИИ"}
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-[#1a263e] hidden sm:block" />

          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-[#5d7290] uppercase tracking-wide">ТЕКУЩИЙ ЭТАП</span>
            <span className="text-xs font-bold font-mono text-[#60A5FA] mt-0.5">
              {isExperimentRunning ? `БЛОК ${currentBlock}/${config.blocks} · П${isTraining ? `${trainingTrialIndex}/6 Тренир.` : currentTrial}` : "ОФФЛАЙН"}
            </span>
          </div>
          <div className="h-6 w-px bg-[#1a263e] hidden sm:block" />

          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-[#5d7290] uppercase tracking-wide font-bold">РАЗМЕР ВЫБОРКИ</span>
            <span className="text-xs font-bold font-mono text-[#10b981] mt-0.5">{trials.length} проб</span>
          </div>
        </div>

        {/* Live Session Control Panel */}
        <div className="flex items-center gap-2">
          {isExperimentRunning && (
            <>
              {isPaused ? (
                <button
                  onClick={resumeExperiment}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-[10px] font-mono font-bold text-white rounded-lg cursor-pointer transition-all"
                >
                  ПРОДОЛЖИТЬ
                </button>
              ) : (
                <button
                  onClick={pauseExperiment}
                  className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-[10px] font-mono font-bold text-white rounded-lg cursor-pointer transition-all"
                >
                  ПАУЗА
                </button>
              )}

              {/* Developer Bypass Skip */}
              <button
                onClick={skipToNextRealBlock}
                className="px-2.5 py-2 bg-[#070c14] border border-[#1a263e] hover:bg-slate-850 text-[10px] font-mono text-gray-400 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                title="Пропустить блок для быстрого перехода к экранам результатов"
              >
                <FastForward className="w-3 h-3" />
                СКИП БЛОКА
              </button>

              {showAbortConfirm ? (
                <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-500/30 p-1 rounded-lg animate-fade-in select-none">
                  <span className="text-[9px] text-rose-300 font-mono font-bold px-1">ПРЕРВАТЬ?</span>
                  <button
                    onClick={() => {
                      abortExperiment();
                      setShowAbortConfirm(false);
                    }}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-[9px] font-mono font-bold text-white rounded-md cursor-pointer leading-none uppercase"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => setShowAbortConfirm(false)}
                    className="px-2 py-1 bg-[#1a263e] hover:bg-slate-700 text-[9px] font-mono text-gray-300 rounded-md cursor-pointer leading-none uppercase"
                  >
                    Нет
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAbortConfirm(true)}
                  className="px-3 py-2 bg-[#dc2626] hover:bg-rose-500 text-[10px] font-mono font-bold text-white rounded-lg cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  ПРЕРВАТЬ СЕССИЮ
                </button>
              )}
            </>
          )}

          {!isExperimentRunning && (
            <div className="flex gap-2">
              <button
                onClick={seedSimulatedData}
                className="px-3 py-2 bg-[#111e38] hover:bg-[#1a2c50] text-[10px] font-mono font-bold text-[#1e6bf3] hover:text-white border border-indigo-500/20 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
              >
                <Database className="w-3.5 h-3.5" />
                СГЕНЕРИРОВАТЬ ДАННЫЕ
              </button>
              <button
                onClick={clearAllTrials}
                className="px-3 py-2 bg-[#070c14] border border-[#1a263e] hover:bg-slate-850 text-[10px] font-mono text-slate-400 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                title="Сбросить все данные"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                СБРОС БАЗЫ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Statistical Analysis Cards Grid */}
      <div className={`grid gap-4 select-none ${
        activeView === "split" 
          ? "grid-cols-2 sm:grid-cols-3" 
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      }`}>
        {[
          {
            label: "Постоянное смещение",
            value: metrics ? `${metrics.bias >= 0 ? "+" : ""}${metrics.bias.toFixed(1)} мс` : "--- мс",
            desc: "Средняя знаковая задержка ошибки",
            status: metrics && Math.abs(metrics.bias) < 40 ? "text-emerald-400" : "text-amber-500",
          },
          {
            label: "Дробь Вебера (WF)",
            value: metrics ? metrics.weberFraction.toFixed(4) : "----",
            desc: "std(error)/mean(duration)",
            status: metrics && metrics.weberFraction < 0.12 ? "text-indigo-400" : "text-yellow-400",
          },
          {
            label: "Коэфф. вариации",
            value: metrics ? metrics.cv.toFixed(4) : "----",
            desc: "std(response)/mean(response)",
            status: "text-blue-400",
          },
          {
            label: "Абсолютная ошибка",
            value: metrics ? `${Math.abs(metrics.bias).toFixed(1)} мс` : "--- мс", 
            desc: "Среднее абсолютное отклонение",
            status: "text-pink-400",
          },
          {
            label: "Процент ошибки",
            value: metrics ? `${metrics.meanErrorPercent >= 0 ? "+" : ""}${metrics.meanErrorPercent.toFixed(1)}%` : "---%",
            desc: "Отклонение от целевой точки",
            status: "text-amber-400",
          },
          {
            label: "Точность TTC",
            value: metrics?.ttcAccuracy !== undefined ? `${metrics.ttcAccuracy.toFixed(1)}%` : "Н/Д",
            desc: "Точность соударения за экраном",
            status: "text-emerald-400",
          },
        ].map((met, idx) => (
          <div key={idx} className="bg-[#0c1322] border border-[#1a263e] rounded-xl p-4 flex flex-col justify-between shadow-md">
            <span className="text-[9px] font-mono text-[#5d7290] uppercase tracking-wider block leading-tight">
              {met.label}
            </span>
            <div className={`text-base font-bold font-mono tracking-tight mt-2.5 ${met.status}`}>
              {met.value}
            </div>
            <span className="text-[9px] text-gray-500 font-mono leading-none mt-1.5 block">
              {met.desc}
            </span>
          </div>
        ))}
      </div>

      {/* 4. Split pane: Analytical History Table and System Log Console */}
      <div className={`grid grid-cols-1 gap-6 ${activeView === "split" ? "w-full" : "lg:grid-cols-3"}`}>
        
        {/* CSV Database / Live record feeds (Left side span 2) */}
        <div className={`bg-[#0c1322] border border-[#1a263e] rounded-xl p-5 flex flex-col justify-between shadow-lg ${
          activeView === "split" ? "w-full" : "lg:col-span-2"
        }`}>
          <div className="flex justify-between items-center mb-4 select-none">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold font-mono tracking-wider text-gray-300 uppercase">
                📂 Записи базы данных в реальном времени (CSV)
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              {exportWarning && (
                <span className="text-[10px] text-rose-400 font-mono animate-pulse">{exportWarning}</span>
              )}
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-[#070c14] hover:bg-slate-850 border border-[#1a263e] text-[#93C5FD] hover:text-white text-[10px] font-mono font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all uppercase"
              >
                <Download className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
                ЭКСПОРТ В CSV ({trials.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto h-[180px] border border-[#1a263e] rounded-xl bg-[#070c14]">
            <table className="w-full text-left text-[10px] font-mono text-gray-400 bg-[#070c14]">
              <thead className="bg-[#0d1424] border-b border-[#1a263e] text-[#5d7290] uppercase select-none sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-[9px]">ПОПЫТКА</th>
                  <th className="px-3 py-2 text-[9px]">БЛОК</th>
                  <th className="px-3 py-2 text-[9px]">ИНТЕРВАЛ</th>
                  <th className="px-3 py-2 text-[9px]">СКОРОСТЬ</th>
                  <th className="px-3 py-2 text-[9px]">ОТВЕТ</th>
                  <th className="px-3 py-2 text-[9px]">ОШИБКА МС</th>
                  <th className="px-3 py-2 text-[9px]">ОШИБКА %</th>
                  <th className="px-3 py-2 text-[9px]">УВЕР.</th>
                  <th className="px-3 py-2 text-[9px]">ОБР. СВЯЗЬ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a263e]/55">
                {trials.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-600 italic select-none">
                      Записи экспериментов отсутствуют. Пройдите тренировочный этап или сгенерируйте данные для отображения поведенческих метрик.
                    </td>
                  </tr>
                ) : (
                  [...trials].reverse().map((t, idx) => {
                    const absErr = Math.abs(t.errorPercent);
                    const colorClass = absErr <= 5 ? "text-emerald-400" : absErr <= 15 ? "text-amber-400" : "text-rose-450";
                    return (
                      <tr key={t.id} className="hover:bg-[#0d1424]/40 transition-all">
                        <td className="px-3 py-2 font-bold text-gray-450">#{(trials.length - idx)}</td>
                        <td className="px-3 py-2">{t.blockNumber}</td>
                        <td className="px-3 py-2 font-bold text-teal-400">{t.duration}мс</td>
                        <td className="px-3 py-2 text-cyan-400">{t.speed} пикс/с</td>
                        <td className="px-3 py-2 text-gray-300">{t.responseTime.toFixed(1)}мс</td>
                        <td className={`px-3 py-2 font-bold ${colorClass}`}>
                          {t.errorMs >= 0 ? "+" : ""}{t.errorMs.toFixed(0)}мс
                        </td>
                        <td className={`px-3 py-2 ${colorClass}`}>
                          {t.errorPercent >= 0 ? "+" : ""}{t.errorPercent.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-yellow-400">{"★".repeat(t.confidence)}</td>
                        <td className="px-3 py-2 text-gray-500 uppercase text-[9px]">
                          {t.feedbackType === "Excellent" ? "ОТЛИЧНО" :
                           t.feedbackType === "Slightly Early" ? "РАНЬШЕ" :
                           t.feedbackType === "Slightly Late" ? "ПОЗДНО" :
                           t.feedbackType === "Too Early" ? "CЛИШКОМ РАНО" : "CЛИШКОМ ПОЗДНО"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Console logs of system operations (Right side span 1) */}
        <div className="bg-[#0c1322] border border-[#1a263e] rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <span className="text-xs font-bold font-mono text-[#60A5FA] uppercase block mb-3 tracking-wider select-none">
              📟 Журнал событий оператора лаборатории
            </span>
            <div className="h-[180px] bg-[#070c14] border border-[#1a263e] rounded-xl p-3.5 overflow-y-auto flex flex-col-reverse gap-1.5 scrollbar-thin">
              {systemLogs.map((log, idx) => {
                // translate basic logs on the fly if needed
                let logRu = log
                  .replace("Subjective report for block completed:", "Субъективный отчет для завершенного блока:")
                  .replace("Passage Passage:", "Восприятие времени:")
                  .replace("Est. duration:", "Оценка длительности:")
                  .replace("minutes.", "минут.")
                  .replace("Demonstration target interval completed. Prepare to reproduce duration.", "Демонстрация целевого интервала завершена. Приготовьтесь повторить длительность.")
                  .replace("Standard presentation completed. Prepare to reproduce duration.", "Базовая презентация завершена. Приготовьтесь воспроизвести длительность.");
                return (
                  <div key={idx} className="text-[10px] font-mono text-gray-400 leading-normal animate-fade-in">
                    <span className="text-gray-650 font-bold select-none">&gt;&gt;</span> {logRu}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center text-[9px] font-mono text-[#5d7290] leading-none mt-3 select-none">
            <span>Лимит буфера: 150 строк</span>
            <span>Очередь триггеров: активна</span>
          </div>
        </div>
      </div>

      {/* 5. Block-by-Block Analysis (Performance evolution chart) */}
      {blockSummaries.length > 0 && (
        <div className="bg-[#0c1322] border border-[#1a263e] rounded-xl p-5 shadow-lg select-none">
          <h3 className="text-xs font-bold font-mono tracking-wider text-indigo-300 uppercase mb-4">
            📊 Динамика точности результатов по блокам исследований
          </h3>

          <div className={`grid gap-4 ${
            activeView === "split" 
              ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" 
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-5"
          }`}>
            {blockSummaries.map((b) => {
              const condRu = b.condition
                .replace("REACTION_VISIBLE", "РЕАКЦИЯ (ВИДИМЫЙ)")
                .replace("TTC", "СТОЛКНОВЕНИЕ (TTC)")
                .replace("INTERVAL_REPRODUCTION", "ВОСПР. ИНТЕРВАЛА")
                .replace("DURATION_REPRODUCTION", "ВОСПР. ДЛИТЕЛЬН.");

              return (
                <div key={b.blockNumber} className="bg-[#070c14] border border-[#1a263e] rounded-xl p-4">
                  <div className="flex justify-between items-center border-b border-[#1a263e]/55 pb-2.5 mb-3.5">
                    <span className="text-xs font-bold font-mono text-white">Блок #{b.blockNumber}</span>
                    <span className="text-[9px] bg-indigo-950 border border-indigo-900/40 text-indigo-300 font-mono px-2 py-0.5 rounded leading-none uppercase text-center" title={b.condition}>
                      {condRu}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 text-[10px] font-mono text-gray-400">
                    <div className="flex justify-between">
                      <span>ПОПЫТОК:</span>
                      <span className="font-bold text-gray-200">{b.trialsCount} поп.</span>
                    </div>
                    <div className="flex justify-between border-t border-[#1a263e]/40 pt-1.5">
                      <span>СМЕЩЕНИЕ:</span>
                      <span className={`font-bold ${b.bias >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                        {b.bias >= 0 ? "+" : ""}{b.bias.toFixed(1)} мс
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#1a263e]/40 pt-1.5">
                      <span>ДРОБЬ ВЕБЕРА:</span>
                      <span className="font-bold text-indigo-400">{b.weberFraction.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#1a263e]/40 pt-1.5">
                      <span>КОЭФФ. ВАР. (CV):</span>
                      <span className="font-bold text-blue-400">{b.cv.toFixed(4)}</span>
                    </div>
                    {b.ttcAccuracy !== undefined && (
                      <div className="flex justify-between text-emerald-400 border-t border-[#1a263e]/40 pt-1.5">
                        <span>ТОЧНОСТЬ TTC:</span>
                        <span className="font-bold">{b.ttcAccuracy.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
