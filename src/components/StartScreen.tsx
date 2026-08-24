/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useLabStore } from "../store";
import { ExperimentalMode, EEGInterface } from "../types";
import { 
  Settings, 
  ChevronRight, 
  User, 
  GraduationCap, 
  Target, 
  Database, 
  FileCode, 
  Check, 
  Sparkles, 
  AlertTriangle, 
  Trash2, 
  Clock,
  Sliders,
  Cpu,
  BookOpen,
  Printer
} from "lucide-react";

export default function StartScreen() {
  const {
    participantId,
    setParticipantId,
    currentMode,
    setCurrentMode,
    config,
    setConfig,
    startExperiment,
    seedSimulatedData,
    clearAllTrials,
    trials,
    logSystemMessage,
    activeView,
  } = useLabStore();

  // Local state for participant profile attributes to enrich form matching
  const [age, setAge] = useState<string>("25");
  const [comment, setComment] = useState<string>("");

  // Select training mode or main experiment
  const [isTrainingSelection, setIsTrainingSelection] = useState<boolean>(true);

  // Settings modal visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // User manual and documentation visibility
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [docsTab, setDocsTab] = useState<"intro" | "subject" | "operator" | "eeg" | "metrics">("intro");

  // Calibration states inside Settings
  const [durationsOption, setDurationsOption] = useState<number[]>([800, 1700, 3100]);
  const [speedsOption, setSpeedsOption] = useState<number[]>([300, 500]);
  const [blocksInput, setBlocksInput] = useState<number>(config.blocks || 5);
  const [trainingTrialsInput, setTrainingTrialsInput] = useState<number>(config.trainingTrialsCount || 5);
  const [eegOn, setEegOn] = useState<boolean>(config.eegEnabled);
  const [selectedInterface, setSelectedInterface] = useState<EEGInterface>(config.eegInterface);
  const [configText, setConfigText] = useState(JSON.stringify(config, null, 2));

  // Visual notification feedback
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const triggerNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Sync settings parameters when changed
  const handleToggleDuration = (dur: number) => {
    let next = [...durationsOption];
    if (next.includes(dur)) {
      if (next.length > 1) next = next.filter((d) => d !== dur);
    } else {
      next.push(dur);
    }
    setDurationsOption(next);
    setConfig({ durations: next.sort((a, b) => a - b) });
  };

  const handleToggleSpeed = (speed: number) => {
    let next = [...speedsOption];
    if (next.includes(speed)) {
      if (next.length > 1) next = next.filter((s) => s !== speed);
    } else {
      next.push(speed);
    }
    setSpeedsOption(next);
    setConfig({ speeds: next.sort((a, b) => a - b) });
  };

  const handleApplyJSONConfig = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfig(parsed);
      setBlocksInput(parsed.blocks || 5);
      setDurationsOption(parsed.durations || [800, 1700, 3100]);
      setSpeedsOption(parsed.speeds || [300, 500]);
      setEegOn(parsed.eegEnabled !== false);
      setSelectedInterface(parsed.eegInterface || "LSL");
      logSystemMessage("Конфигурация успешно обновлена из пользовательского шаблона JSON.");
      triggerNotification("success", "Параметры эксперимента успешно применились!");
    } catch (e) {
      triggerNotification("error", "Ошибка при обработке JSON-структуры. Проверьте валидность.");
    }
  };

  const handlePrintToPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      triggerNotification("error", "Разрешите всплывающие окна для печати PDF.");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Руководство пользователя TimeLab — Интегрированный ЭЭГ комплекс</title>
          <style>
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              color: #1a202c;
              line-height: 1.6;
              padding: 40px;
              max-width: 900px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #1e6bf3;
              padding-bottom: 20px;
              margin-bottom: 35px;
            }
            .brand {
              font-size: 28px;
              font-weight: bold;
              color: #1e6bf3;
              margin: 0;
              letter-spacing: 1px;
            }
            .subtitle {
              font-size: 14px;
              color: #718096;
              margin: 5px 0 0 0;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            h1 {
              color: #2d3748;
              font-size: 22px;
              border-left: 5px solid #1e6bf3;
              padding-left: 12px;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            h2 {
              color: #4a5568;
              font-size: 17px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 5px;
              margin-top: 25px;
            }
            h3 {
              color: #1a202c;
              font-size: 14px;
              margin-top: 15px;
              margin-bottom: 5px;
            }
            p {
              margin: 10px 0;
              font-size: 13.5px;
              text-align: justify;
            }
            ul, ol {
              margin: 10px 0;
              padding-left: 20px;
              font-size: 13.5px;
            }
            li {
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: 12.5px;
            }
            th, td {
              border: 1px solid #cbd5e0;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f7fafc;
              font-weight: bold;
              color: #2d3748;
            }
            .badge {
              display: inline-block;
              background-color: #ebf8ff;
              color: #2b6cb0;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: bold;
              font-family: monospace;
            }
            .alert {
              background-color: #f0fff4;
              border-left: 4px solid #38a169;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .alert-title {
              font-weight: bold;
              color: #276749;
              margin-bottom: 5px;
              font-size: 13px;
            }
            @media print {
              body {
                padding: 10px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">TIMELAB — EEG SYNC</div>
            <div class="subtitle">Интегрированный программный комплекс когнитивных исследований</div>
          </div>
          
          <h1>1. Архитектура и суть эксперимента</h1>
          <p>Программный комплекс <strong>TimeLab</strong> предназначен для прецизионной оценки сенсомоторных реакций, когнитивной интеграции временных промежутков и выявления корреляций с биоэлектрической активностью мозга (ЭЭГ). Работа комплекса базируется на четырех ключевых сценариях:</p>
          <ul>
            <li><strong>Реакция на динамическое движение (REACTION_VISIBLE)</strong>: Оценка пространствено-временной точности моторного ответа при видимом движении стимула.</li>
            <li><strong>Пространственная экстраполяция (TTC / Time-To-Collision)</strong>: Измерение времени когнитивной экстраполяции невидимой траектории стимула при заходе в зону окклюзии (маскирования).</li>
            <li><strong>Отмеривание интервала (INTERVAL_REPRODUCTION)</strong>: Оценка внутреннего отсчета времени через удержание или дозирование длительности.</li>
            <li><strong>Воспроизведение статической длительности (DURATION_REPRODUCTION)</strong>: Оценка субъективно прошедшего времени экспонирования.</li>
          </ul>

          <h1>2. Инструкция для испытуемого (Респондента)</h1>
          <p>Ваша задача в ходе исследования заключается в обеспечении максимальной стабильности и сфокусированности реакций. Постарайтесь абстрагироваться от внешнего информационного шума.</p>
          <ol>
            <li><strong>Экран калибровки</strong>: Ознакомьтесь с информацией на дисплее (отображается текущая физическая скорость стимула и целевая временная константа). Подготовьте пальцы и нажмите клавишу <strong>ПРОБЕЛ</strong> для запуска.</li>
            <li><strong>Выполнение попытки</strong>: Вы увидите движение синей сферы к финишной линии. Если сфера заходит в черную зону (окклюдер), визуальное отображение прекращается. Мысленно продолжите ее полет с той же скоростью.</li>
            <li><strong>Регистрация ответа</strong>: Нажмите клавишу <strong>ПРОБЕЛ</strong> в момент гипотетического совмещения центра сферы с финишной линией.</li>
            <li><strong>Субъективная уверенность</strong>: Сразу после ответа система предложит вам оценить успешность попадания по шкале от 1 до 5 звезд. Кликните на выбранное число.</li>
            <li><strong>Обратная связь</strong>: Вы увидите детальное временно́е смещение вашего ответа в миллисекундах. Нажмите <strong>ПРОБЕЛ</strong>, чтобы перейти к следующей попытке.</li>
            <li><strong>Субъективный отчет в конце блока</strong>: По завершении серии проб укажите субъективную скорость течения времени в блоке и введите гипотетическую суммарную длительность блока.</li>
          </ol>

          <h1>3. Руководство для Оператора (Исследователя)</h1>
          <p>Приборный комплекс позволяет тонко конфигурировать и осуществлять мониторинг экспериментальной сессии в режиме реального времени.</p>
          <ul>
            <li><strong>Конфигурирование</strong>: В меню «Настройки» вы можете изменить идентификатор испытуемого, скорректировать спектр активных скоростей стимула (300/500 px/s) или интервалов (800, 1700, 3100 мс). Также доступно сохранение/запуск эксперимента по кастомной JSON-схеме.</li>
            <li><strong>Контроль ЭЭГ</strong>: При активации аппаратной синхронизации система передает прецизионные маркеры событий по протоколам LSL или Serial. Все изменения отображаются на осциллографе и фиксируются в реальном времени.</li>
            <li><strong>Выгрузка отчетов</strong>: Финальный отчет выгружается в структурированном CSV-формате со всеми полями оценок, вектором ошибок, уверенности и показателями Вебера.</li>
          </ul>

          <h1>4. Спецификация кодов синхронизации ЭЭГ</h1>
          <p>Для прецизионного анализа фазовых ССП (вызванных потенциалов головного мозга) в момент наступления ключевых вех стимуляции отправляются следующие маркеры:</p>
          
          <table>
            <thead>
              <tr>
                <th>Событие эксперимента</th>
                <th>Байт-код (Hex)</th>
                <th>Описание метки синхронизации</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Trial Start</strong></td>
                <td><span class="badge">0x01</span></td>
                <td>Старт новой пробы (отрисовка холста)</td>
              </tr>
              <tr>
                <td><strong>Motion Start</strong></td>
                <td><span class="badge">0x02</span></td>
                <td>Инициация физического движения стимула</td>
              </tr>
              <tr>
                <td><strong>Occluder Start</strong></td>
                <td><span class="badge">0x03</span></td>
                <td>Вход стимула под непрозрачную маску окклюдера</td>
              </tr>
              <tr>
                <td><strong>Stimulus End</strong></td>
                <td><span class="badge">0x04</span></td>
                <td>Момент пересечения целевой линии (окончание стимула)</td>
              </tr>
              <tr>
                <td><strong>Response Keypress</strong></td>
                <td><span class="badge">0x05</span></td>
                <td>Фиксация нажатия SPACE испытуемым</td>
              </tr>
              <tr>
                <td><strong>Feedback Start</strong></td>
                <td><span class="badge">0x06</span></td>
                <td>Вывод экрана обратной связи на дисплей</td>
              </tr>
            </tbody>
          </table>

          <div class="alert">
            <div class="alert-title">📢 Важное примечание по аппаратной интеграции:</div>
            Функция синхронизации ЭЭГ может быть полностью отключена оператором в настройках системы, предотвращая передачу сигналов в порт в случае оффлайн-исследований.
          </div>

          <h1>5. Интерпретация математических метрик</h1>
          <ul>
            <li><strong>Постоянное смещение (Bias, мс)</strong>: Систематический сдвиг ответов (раннее упреждение при отрицательных значениях, запаздывание — при положительных).</li>
            <li><strong>Дробь Вебера (Weber Fraction)</strong>: Показатель относительной точности когнитивного таймера. Рассчитывается как стандартное отклонение реакций, нормированное на величину целевого интервала.</li>
            <li><strong>Коэффициент Вариации (CV)</strong>: Индицирует общую стабильность и монотонность удерживаемого внимания испытуемого на протяжении сессии.</li>
          </ul>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleLaunch = () => {
    // Commit configurations on start
    setConfig({
      blocks: blocksInput,
      durations: durationsOption,
      speeds: speedsOption,
      feedbackEnabled: config.feedbackEnabled,
      eegEnabled: eegOn,
      eegInterface: selectedInterface,
    });
    
    // Call store action
    startExperiment();
    
    // Override isTraining dynamically in store based on user select block choices
    useLabStore.setState({ isTraining: isTrainingSelection });
    
    // Save metadata locally to console logs if provided
    if (age) {
      logSystemMessage(`Служебные метаданные: Возраст испытуемого: ${age} лет.`);
    }
    if (comment) {
      logSystemMessage(`Служебный комментарий: "${comment}".`);
    }
  };

  const handleLoadSimulated = () => {
    seedSimulatedData();
    triggerNotification("success", "База данных сессии успешно заполнена симулированными результатами (50 попыток).");
  };

  const handleClearDatabase = () => {
    clearAllTrials();
    triggerNotification("success", "База данных успешно отформатирована. Все записи удалены.");
  };

  // Clock ticks visualization effect
  const [clockDegrees, setClockDegrees] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setClockDegrees((prev) => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`w-full ${activeView === "split" ? "max-w-full p-1" : "max-w-6xl p-2 md:p-4"} mx-auto bg-[#070c14] text-[#c9d1d9] font-sans antialiased select-none`}>
      
      {/* 1. Header Information Grid with Brain Clock graphics */}
      <div className={`flex border-b border-[#142037] ${
        activeView === "split" 
          ? "flex-col pb-3 mb-4 gap-2 text-left" 
          : "flex-col md:flex-row justify-between items-start md:items-center pb-8 mb-8 gap-6"
      }`}>
        <div className="flex-1">
          <span className="text-[10px] font-bold font-mono tracking-[0.15em] text-[#5d7290] uppercase block">
            ИССЛЕДОВАНИЕ
          </span>
          <h1 className={`${activeView === "split" ? "text-lg font-bold" : "text-3xl font-bold"} text-white mt-1 font-display tracking-tight`}>
            Восприятие времени
          </h1>
          <p className="text-xs text-[#7e8fad] mt-1 font-sans max-w-xl leading-relaxed">
            Эксперимент по изучению субъективного восприятия времени и связанных процессов
          </p>
        </div>

        {/* Neural Brain & Time Processing SVG Graphic Node */}
        {activeView !== "split" && (
          <div className="relative w-48 h-40 flex items-center justify-center self-center md:self-auto shrink-0 mr-4">
          
          {/* Subtle glowing dark blue/cyan circular background radial gradients */}
          <div className="absolute inset-0 bg-radial from-blue-500/10 to-transparent blur-xl pointer-events-none" />
          
          <svg className="absolute w-full h-full text-blue-500/20 stroke-blue-500/45 saturate-150 animate-pulse drop-shadow-[0_0_20px_rgba(30,144,255,0.1)]" viewBox="0 0 200 200" fill="none">
            {/* Brain Hemisphere Nodes */}
            <path d="M100 50C75 50 60 65 60 85C60 92 65 98 62 108C59 118 68 128 75 130C78 135 83 145 100 145M100 50C125 50 140 65 140 85C140 92 135 98 138 108C141 118 132 128 125 130C122 135 117 145 100 145" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M100 50V145" strokeWidth="0.8" strokeDasharray="3 3" />
            
            {/* Connected Neural Pathways network lines */}
            <line x1="60" y1="85" x2="100" y2="85" strokeWidth="0.5" />
            <line x1="140" y1="85" x2="100" y2="85" strokeWidth="0.5" />
            <line x1="62" y1="108" x2="100" y2="100" strokeWidth="0.5" />
            <line x1="138" y1="108" x2="100" y2="100" strokeWidth="0.5" />
            <line x1="75" y1="130" x2="100" y2="120" strokeWidth="0.5" />
            <line x1="125" y1="130" x2="100" y2="120" strokeWidth="0.5" />

            {/* Neural synapsis dots */}
            <circle cx="100" cy="50" r="2.5" fill="#1e6bf3" />
            <circle cx="100" cy="145" r="2.5" fill="#1e6bf3" />
            <circle cx="60" cy="85" r="2" fill="#50e4ff" />
            <circle cx="140" cy="85" r="2" fill="#50e4ff" />
            <circle cx="62" cy="108" r="2" fill="#50e4ff" />
            <circle cx="138" cy="108" r="2" fill="#50e4ff" />
            <circle cx="75" cy="130" r="2" fill="#50e4ff" />
            <circle cx="125" cy="130" r="2" fill="#50e4ff" />
          </svg>

          {/* Glowing Clock integration inside the brain centre */}
          <div className="absolute w-20 h-20 rounded-full border border-blue-500/30 flex items-center justify-center bg-[#070c14]/90 shadow-[0_0_15px_rgba(30,144,255,0.15)]">
            <svg className="w-16 h-16 text-cyan-400 stroke-cyan-400" viewBox="0 0 100 100">
              {/* Clock face circle */}
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="1.5" className="opacity-25" />
              <circle cx="50" cy="50" r="3" fill="#50e4ff" />
              
              {/* Tick Marks */}
              <line x1="50" y1="12" x2="50" y2="18" strokeWidth="1.5" />
              <line x1="50" y1="88" x2="50" y2="82" strokeWidth="1.5" />
              <line x1="12" y1="50" x2="18" y2="50" strokeWidth="1.5" />
              <line x1="88" y1="50" x2="82" y2="50" strokeWidth="1.5" />

              {/* Dynamic Hands */}
              <g transform={`rotate(${clockDegrees} 50 50)`}>
                <line x1="50" y1="50" x2="50" y2="22" strokeWidth="2" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${clockDegrees * 12} 50 50)`}>
                <line x1="50" y1="50" x2="72" y2="50" strokeWidth="1" strokeLinecap="round" className="stroke-pink-500" />
              </g>
            </svg>
          </div>
        </div>
      )}
      </div>

      {notification && (
        <div className={`mb-6 p-3 rounded-xl border font-mono text-xs flex items-center justify-between gap-2 animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400 animate-pulse' 
            : 'bg-rose-950/40 border-rose-500/20 text-rose-400'
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-bold">[{notification.type === 'success' ? 'СТАТУС: ОК' : 'СТАТУС: СБОЙ'}]</span>
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-white text-xs px-2">×</button>
        </div>
      )}

      {/* 2. Structured Three-Column Cards Grid matching standard design mock */}
      <div className={`grid gap-5 mb-6 ${activeView === "split" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
        
        {/* Card Column 1: Участник */}
        <div className={`bg-[#0c1322] border border-[#142037] rounded-xl p-5 flex flex-col justify-between shadow-lg relative ${activeView === "split" ? "min-h-[220px]" : "min-h-[300px]"}`}>
          <div>
            <h3 className="text-xs font-bold font-mono text-[#5d7290] tracking-wider uppercase mb-5">
              Участник
            </h3>

            {/* Field item 1: ID */}
            <div className="mb-4">
              <label className="block text-[11px] text-[#7e8fad] font-mono mb-1.5 uppercase tracking-wide">
                ID участника
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="w-full bg-[#070c14] border border-[#1a263e] text-white hover:border-[#1e6bf3]/50 focus:border-[#1e6bf3] transition-all px-4 py-2.5 rounded-lg text-sm focus:outline-none font-mono pr-10"
                  placeholder="Пример: SUB-032"
                />
                <User className="absolute right-3.5 top-3.5 w-4 h-4 text-[#5d7290]" />
              </div>
            </div>

            {/* Field item 2: Возраст */}
            <div className="mb-4">
              <label className="block text-[11px] text-[#7e8fad] font-mono mb-1.5 uppercase tracking-wide">
                Возраст
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-[#070c14] border border-[#1a263e] text-white hover:border-[#1e6bf3]/50 focus:border-[#1e6bf3] transition-all px-4 py-2.5 rounded-lg text-sm focus:outline-none font-mono"
                placeholder="25"
              />
            </div>

            {/* Field item 3: Комментарий */}
            <div>
              <label className="block text-[11px] text-[#7e8fad] font-mono mb-1.5 uppercase tracking-wide">
                Комментарий (необязательно)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full bg-[#070c14] border border-[#1a263e] text-white hover:border-[#1e6bf3]/50 focus:border-[#1e6bf3] transition-all px-4 py-2.5 rounded-lg text-sm focus:outline-none font-sans placeholder-slate-600 resize-none"
                placeholder="Введите комментарий..."
              />
            </div>
          </div>
        </div>

        {/* Card Column 2: Режим */}
        <div className={`bg-[#0c1322] border border-[#142037] rounded-xl p-5 flex flex-col justify-between shadow-lg relative ${activeView === "split" ? "min-h-[200px]" : "min-h-[300px]"}`}>
          <div>
            <h3 className="text-xs font-bold font-mono text-[#5d7290] tracking-wider uppercase mb-5">
              Режим
            </h3>

            <div className="flex flex-col gap-4">
              {/* Button Selection 1: Тренировка */}
              <button
                type="button"
                onClick={() => setIsTrainingSelection(true)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-3 select-none ${
                  isTrainingSelection
                    ? "bg-[#111e38] border-[#1e6bf3] shadow-[0_0_15px_rgba(30,144,255,0.1)] text-white"
                    : "bg-[#070c14] border-[#1a263e] text-[#7e8fad] hover:bg-[#070c14]/50 hover:border-[#1e6bf3]/40"
                }`}
              >
                <div className={`p-2 rounded-lg mt-0.5 ${isTrainingSelection ? "bg-[#1e6bf3] text-white" : "bg-[#1a263e] text-[#5d7290]"}`}>
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-sm block">Тренировка</span>
                  <span className="text-[11px] text-[#7e8fad] mt-1.5 block leading-relaxed">
                    Обучение с подробной обратной связью
                  </span>
                </div>
              </button>

              {/* Button Selection 2: Основной эксперимент */}
              <button
                type="button"
                onClick={() => setIsTrainingSelection(false)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-3 select-none ${
                  !isTrainingSelection
                    ? "bg-[#111e38] border-[#1e6bf3] shadow-[0_0_15px_rgba(30,144,255,0.1)] text-white"
                    : "bg-[#070c14] border-[#1a263e] text-[#7e8fad] hover:bg-[#070c14]/50 hover:border-[#1e6bf3]/40"
                }`}
              >
                <div className={`p-2 rounded-lg mt-0.5 ${!isTrainingSelection ? "bg-[#1e6bf3] text-white" : "bg-[#1a263e] text-[#5d7290]"}`}>
                  <Target className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-sm block">Основной эксперимент</span>
                  <span className="text-[11px] text-[#7e8fad] mt-1.5 block leading-relaxed">
                    Основная сессия без обучения
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Card Column 3: Блок / Условие */}
        <div className={`bg-[#0c1322] border border-[#142037] rounded-xl p-5 flex flex-col justify-between shadow-lg relative ${activeView === "split" ? "min-h-[220px]" : "min-h-[300px]"}`}>
          <div>
            <h3 className="text-xs font-bold font-mono text-[#5d7290] tracking-wider uppercase mb-5">
              Блок / Условие
            </h3>

            <div className="flex flex-col gap-3">
              {[
                {
                  id: ExperimentalMode.REACTION_VISIBLE,
                  title: "Реакция на движение",
                  desc: "Перехват видимого шара на целевой отметке"
                },
                {
                  id: ExperimentalMode.TTC,
                  title: "Оценка времени до столкновения (TTC)",
                  desc: "Определение момента контакта за скрытым экраном"
                },
                {
                  id: ExperimentalMode.INTERVAL_REPRODUCTION,
                  title: "Отмеривание времени движения",
                  desc: "Запуск и воспроизведение длительности траектории"
                },
                {
                  id: ExperimentalMode.DURATION_REPRODUCTION,
                  title: "Воспроизведение длительности стимула",
                  desc: "Оценка и повтор длительности свечения круга"
                },
                {
                  id: ExperimentalMode.MIXED,
                  title: "Смешанный дизайн исследования",
                  desc: "Рандомизированная череда всех режимов внутри блоков"
                },
              ].map((opt) => {
                const isSelected = currentMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCurrentMode(opt.id || ExperimentalMode.TTC)}
                    className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-[#111e38]/35 group flex items-start gap-4 transition-all cursor-pointer select-none"
                  >
                    {/* Custom Radio Button Dot exactly like mockup design */}
                    <div className="mt-1 shrink-0 relative flex items-center justify-center">
                      <div className={`w-4 h-4 rounded-full border transition-all ${
                        isSelected 
                          ? "border-[#1e6bf3] bg-transparent shadow-[0_0_8px_rgba(30,144,255,0.4)]" 
                          : "border-[#33466a] group-hover:border-slate-500 bg-transparent"
                      }`} />
                      {isSelected && (
                        <div className="absolute w-2 h-2 rounded-full bg-[#1e6bf3]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-medium block leading-tight transition-all ${isSelected ? "text-white font-bold" : "text-[#7e8fad] group-hover:text-slate-200"}`}>
                        {opt.title}
                      </span>
                      <span className="text-[10px] text-[#5d7290] mt-1 block truncate">
                        {opt.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Outer Footer Signature Actions Panel */}
      <div className={`flex border-t border-[#142037] pt-4 ${
        activeView === "split" 
          ? "flex-row justify-between items-center gap-3" 
          : "flex-col sm:flex-row justify-between items-center gap-4 pt-6"
      }`}>
        {/* Settings modal trigger in bottom left */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className={`text-xs text-[#7e8fad] hover:text-white border border-[#1a263e] hover:border-[#1e6bf3]/50 bg-[#0c1322] hover:bg-[#111e38]/50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
            activeView === "split" ? "px-3 py-2.5" : "px-4 py-2"
          }`}
        >
          <Settings className="w-4 h-4 text-[#5d7290]" />
          Настройки
        </button>

        {/* Documentation / PDF trigger button */}
        <button
          type="button"
          onClick={() => setIsDocsOpen(true)}
          className={`text-xs text-[#7e8fad] hover:text-white border border-[#1a263e] hover:border-emerald-500/50 bg-[#0c1322] hover:bg-emerald-950/20 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
            activeView === "split" ? "px-3 py-2.5" : "px-4 py-2"
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Руководство & PDF
        </button>

        {/* Start button in bottom right */}
        <button
          type="button"
          onClick={handleLaunch}
          className={`bg-[#1e6bf3] hover:bg-[#1554d4] active:scale-95 text-white font-semibold rounded-xl shadow-[0_5px_15px_rgba(30,144,255,0.2)] hover:shadow-[0_5px_20px_rgba(30,144,255,0.35)] flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans select-none border border-blue-400/20 ${
            activeView === "split" ? "px-5 py-2.5 text-xs flex-1" : "px-10 py-3 text-sm w-full sm:w-auto"
          }`}
        >
          Начать эксперимент
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* 4. Elegant Settings Calibration Dialog Overlay Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0c1322] border border-[#1a263e] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Title */}
            <div className="p-6 border-b border-[#1a263e] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-[#1e6bf3]">
                <Sliders className="w-5 h-5" />
                <h2 className="text-base font-bold font-display text-white">Параметры и Телеметрия Комплекса</h2>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-[#5d7290] hover:text-white text-lg px-2 py-1 bg-slate-800/10 hover:bg-slate-800 rounded transition-all cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Section 1: Blocks & Training Count Calibration */}
              <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-4">
                <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-widest block">
                  ⚙️ Калибровка временных блоков и тренировок
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center text-xs text-[#7e8fad] mb-2 font-mono">
                      <span>КОЛИЧЕСТВО БЛОКОВ</span>
                      <span className="font-bold text-white bg-[#111e38] px-2 py-0.5 border border-blue-500/15 rounded">
                        {blocksInput} {blocksInput === 1 ? 'блок' : (blocksInput < 5 ? 'блока' : 'блоков')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={blocksInput}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBlocksInput(val);
                        setConfig({ blocks: val });
                      }}
                      className="w-full accent-[#1e6bf3]"
                    />
                    <span className="text-[10px] text-[#5d7290] font-mono mt-1 block">
                      Рекомендуется: 5 блоков (по 10 проб).
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs text-[#7e8fad] mb-2 font-mono">
                      <span>ТРЕНИРОВОЧНЫЕ ПРОБЫ</span>
                      <span className="font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 border border-amber-500/20 rounded">
                        {trainingTrialsInput} {trainingTrialsInput === 1 ? 'проба' : (trainingTrialsInput < 5 ? 'пробы' : 'проб')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={trainingTrialsInput}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTrainingTrialsInput(val);
                        setConfig({ trainingTrialsCount: val });
                      }}
                      className="w-full accent-amber-500"
                    />
                    <span className="text-[10px] text-[#5d7290] font-mono mt-1 block">
                      Количество калибровочных проб перед началом основных блоков.
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Speeds and Durations arrays */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Speeds list */}
                <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-3">
                  <label className="block text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-widest">
                    🏎️ Калибровка Скоростей (пикс/с)
                  </label>
                  <p className="text-[10px] text-[#5d7290] leading-none mb-2">Активные пресеты скоростей:</p>
                  <div className="flex gap-2 flex-wrap">
                    {[300, 500].map((s) => {
                      const active = speedsOption.includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => handleToggleSpeed(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all border cursor-pointer select-none ${
                            active
                              ? "bg-[#1e6bf3]/15 border-[#1e6bf3] text-white"
                              : "bg-[#0c1322] border-[#1a263e] text-[#5d7290] hover:text-[#7e8fad]"
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 text-[#1e6bf3]" />}
                          {s} px/s
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Test intervals durations (Ti) */}
                <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-3">
                  <label className="block text-[10px] font-bold font-mono text-pink-400 uppercase tracking-widest">
                    ⏱️ Калибровка Интервалов Ti (мс)
                  </label>
                  <p className="text-[10px] text-[#5d7290] leading-none mb-2">Активные сигналы удержания:</p>
                  <div className="flex gap-2 flex-wrap">
                    {[800, 1700, 3100].map((d) => {
                      const active = durationsOption.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => handleToggleDuration(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all border cursor-pointer select-none ${
                            active
                              ? "bg-pink-500/15 border-pink-500 text-white"
                              : "bg-[#0c1322] border-[#1a263e] text-[#5d7290] hover:text-[#7e8fad]"
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 text-pink-400" />}
                          {(d / 1000).toFixed(1)}с ({d}мс)
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 3: EEG Hardware sync */}
              <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Cpu className="w-4 h-4 animate-spin-slow" />
                    <span className="text-[10px] font-bold font-mono uppercase tracking-widest">
                      ⚡ Аппаратная Синхронизация Событий ЭЭГ
                    </span>
                  </div>
                  <button
                    onClick={() => setEegOn(!eegOn)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-all relative cursor-pointer ${eegOn ? "bg-emerald-600" : "bg-slate-700"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${eegOn ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {eegOn && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { id: "LSL" as EEGInterface, title: "LabStreamingLayer (LSL)", desc: "Маркерный поток 'TimeLab-Marker'" },
                      { id: "Serial" as EEGInterface, title: "Последовательный TTL COM", desc: "Слайсинг по порту D-Sub COM3" },
                    ].map((item) => {
                      const sel = selectedInterface === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedInterface(item.id)}
                          className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                            sel
                              ? "bg-[#10b981]/15 border-[#10b981] text-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.05)]"
                              : "bg-[#0c1322] border-[#1a263e] text-[#5d7290] hover:text-[#7e8fad]"
                          }`}
                        >
                          <span className="text-xs font-bold block">{item.title}</span>
                          <span className="text-[10px] text-[#5d7290] leading-none mt-1.5 block">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 4: Seed Simulated DB / Clear records */}
              <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-bold font-mono text-yellow-400 uppercase tracking-widest block">
                  ⚙️ Симуляция базы данных и Сброс
                </span>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleLoadSimulated}
                    className="flex-1 py-2.5 px-4 bg-[#111e38] hover:bg-[#1a2c50] text-[#1e6bf3] hover:text-white text-xs font-mono font-bold tracking-wide uppercase border border-indigo-500/20 hover:border-blue-500/40 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Заполнить симулированными данными (50 проб)
                  </button>

                  <button
                    onClick={handleClearDatabase}
                    className="py-2.5 px-4 bg-slate-800/10 hover:bg-rose-950/20 border border-[#1a263e] hover:border-rose-500/40 text-gray-400 hover:text-rose-400 text-xs font-mono rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Удалить все данные из базы данных сессии"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Сбросить БД
                  </button>
                </div>
                <p className="text-[10px] text-[#5d7290] font-mono leading-none mt-1">
                  Текущий размер базы данных: {trials.length} записей исследований.
                </p>
              </div>

              {/* Section 5: JSON configuration */}
              <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <FileCode className="w-4 h-4" />
                  <span className="text-[10px] font-bold font-mono uppercase tracking-widest">
                    ⚙️ Прямая Конфигурация в формате JSON
                  </span>
                </div>
                
                <textarea
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  rows={6}
                  className="w-full bg-[#0c1322] border border-[#1a263e] text-[#10b981] font-mono text-[11px] p-3 rounded-lg focus:outline-none focus:border-[#1e6bf3]"
                  placeholder="JSON-структура параметров"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setConfigText(JSON.stringify(config, null, 2));
                      triggerNotification("success", "Параметры сброшены к текущим значениям.");
                    }}
                    className="px-3 py-1.5 bg-slate-800/30 hover:bg-slate-800 text-xs font-mono text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
                  >
                    Перечитать
                  </button>
                  <button
                    onClick={handleApplyJSONConfig}
                    className="px-4 py-1.5 bg-[#1e6bf3] hover:bg-[#1554d4] text-xs font-mono font-bold text-white rounded-lg transition-all cursor-pointer"
                  >
                    Применить JSON
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#070c14] border-t border-[#1a263e] text-center shrink-0">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full sm:w-auto px-6 py-2 bg-[#1e6bf3] hover:bg-[#1554d4] text-white text-xs font-bold uppercase rounded-lg transition-all cursor-pointer"
              >
                Сохранить и Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Comprehensive Documentation & PDF Generator Dialog Modal */}
      {isDocsOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in text-[#c9d1d9]">
          <div className="w-full max-w-4xl bg-[#0c1322] border border-[#1a263e] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-[#1a263e] flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <BookOpen className="w-5 h-5 animate-pulse" />
                  <h2 className="text-base font-bold font-display text-white">Интерактивное руководство пользователя</h2>
                </div>
                <p className="text-[11px] text-[#5d7290] font-mono mt-0.5 uppercase tracking-wider">Комплекс TimeLab — прецизионная оценка восприятия времени</p>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start">
                <button
                  type="button"
                  onClick={handlePrintToPDF}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-900/10"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Экспорт в PDF / Печать
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocsOpen(false)}
                  className="text-[#5d7290] hover:text-white text-lg px-2.5 py-1 bg-slate-800/20 hover:bg-slate-800 rounded transition-all cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Central Section: Sidebar + Scrollable Container */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              
              {/* Left tabbed navigation */}
              <div className="w-full md:w-60 bg-[#070c14] border-r border-[#1a263e] p-4 flex flex-col gap-1.5 shrink-0 select-none overflow-y-auto">
                <div className="text-[10px] font-bold font-mono text-[#5d7290] uppercase tracking-wider mb-2 pl-2">
                  РАЗДЕЛЫ СПРАВКИ
                </div>
                {[
                  { id: "intro", title: "🧭 Суть и Режимы", desc: "Концепция эксперимента" },
                  { id: "subject", title: "👥 Испытуемому", desc: "Практический сценарий" },
                  { id: "operator", title: "🛠️ Оператору", desc: "Калибровка и контроль" },
                  { id: "eeg", title: "⚡ ЭЭГ-Маркеры", desc: "Коды синхронизации" },
                  { id: "metrics", title: "📈 Научные метрики", desc: "Показатели Вебера, CV" },
                ].map((tab) => {
                  const active = docsTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDocsTab(tab.id as any)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        active
                          ? "bg-[#1e6bf3]/15 border-[#1e6bf3] text-white font-semibold"
                          : "bg-transparent border-transparent text-[#7e8fad] hover:bg-[#111e38]/35 hover:text-white"
                      }`}
                    >
                      <span className="text-xs">{tab.title}</span>
                      <span className="text-[10px] text-[#5d7290] font-normal leading-none block">{tab.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right content page container */}
              <div className="flex-1 p-6 overflow-y-auto bg-[#0c1322] space-y-4 text-sm leading-relaxed" id="docs-content-container">
                
                {docsTab === "intro" && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-white text-base font-bold font-display flex items-center gap-2 border-b border-[#142037] pb-2">
                      🧭 1. Архитектура и суть эксперимента
                    </h3>
                    <p className="text-[#a0aec0]">
                      Научно-клинический комплекс <strong>TimeLab</strong> исследует способность человеческого мозга прецизионно дискретизировать, оценивать и масштабировать интервалы времени в микро-диапазоне. Принципиальной особенностью системы является совмещение поведенческих (моторных) методологий с аппаратной фиксацией ЭЭГ-маркеров событий.
                    </p>
                    <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold font-mono text-cyan-400 block font-sans">Четыре активных режима стимуляции:</span>
                      <ul className="list-disc pl-4 space-y-2 text-xs text-[#a0aec0]">
                        <li>
                          <strong className="text-white">Реакция на динамическое движение (REACTION_VISIBLE)</strong>: Оценка моторной реакции в условиях непрерывного визуального контроля траектории.
                        </li>
                        <li>
                          <strong className="text-white">Пространственно-временная экстраполяция (TTC / Time-To-Collision)</strong>: Оценка упреждающего тайминга при входе стимула в зону окклюзии (абсолютного маскирования стимула). Задача – удержать мысленный локус объекта.
                        </li>
                        <li>
                          <strong className="text-white">Отмеривание интервала (INTERVAL_REPRODUCTION)</strong>: Оценка воспроизведения заданной временной длительности без визуальных динамических объектов посредством удержания.
                        </li>
                        <li>
                          <strong className="text-white">Воспроизведение статической длительности (DURATION_REPRODUCTION)</strong>: Прямое когнитивное воспроизведение интервала статического стимула.
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {docsTab === "subject" && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-white text-base font-bold font-display flex items-center gap-2 border-b border-[#142037] pb-2">
                      👥 2. Инструкция для испытуемого (Респондента)
                    </h3>
                    <p className="text-[#a0aec0]">
                      Ваша задача — сформировать стабильную, точную и уверенную тактику отмеривания стимулов. Постарайтесь дышать глубоко и ровно, во избежание мышечного дрожания, влияющего на реакцию.
                    </p>
                    <div className="bg-[#070c14] border border-[#142037] rounded-xl p-4 space-y-3 font-sans">
                      <span className="text-xs font-bold text-emerald-400 block font-sans">Алгоритм выполнения пробы:</span>
                      <ol className="list-decimal pl-4 space-y-2 text-xs text-[#a0aec0]">
                        <li>
                          <strong className="text-white">Подготовительный этап</strong>: Ознакомьтесь на стартовом синем экране с требуемыми параметрами (заданная скорость движения и время удержания в миллисекундах). Нажмите <strong>ПРОБЕЛ</strong> для старта.
                        </li>
                        <li>
                          <strong className="text-white">Активная стимуляция</strong>: Синяя сфера начинает запуск к мишени. В условиях TTC она скроется за черным полем. Экстраполируйте ее движение.
                        </li>
                        <li>
                          <strong className="text-white">Моторный отклик</strong>: Нажмите клавишу <strong>ПРОБЕЛ</strong> ровно в гипотетический момент, когда сфера пересечет вертикальную белую линию.
                        </li>
                        <li>
                          <strong className="text-white">Оценка уверенности (Confidence Rating)</strong>: Сразу после ответа укажите субъективную уверенность в попадании от 1 до 5 звезд. Кликните мышкой на соответствующую звезду.
                        </li>
                        <li>
                          <strong className="text-white">Обратная связь (Feedback)</strong>: Система покажет величину вашей реальной ошибки рассогласования в миллисекундах. Знак <code className="text-rose-400">(-)</code> означает опережение, знак <code className="text-yellow-400">(+)</code> — опоздание. Нажмите <strong>ПРОБЕЛ</strong> для перехода дальше.
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {docsTab === "operator" && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-white text-base font-bold font-display flex items-center gap-2 border-b border-[#142037] pb-2">
                      🛠️ 3. Руководство для Оператора (Исследователя)
                    </h3>
                    <p className="text-[#a0aec0]">
                      Оператор управляет параметрами экспериментальной сессии, контролирует качество телеметрии и осуществляет экспорт очищенных баз данных.
                    </p>
                    <div className="space-y-2 text-xs text-[#a0aec0]">
                      <div className="p-3 bg-[#070c14] rounded-lg border border-[#142037]">
                        <strong className="text-white block mb-0.5 font-sans">📐 Настройки и профилирование:</strong>
                        Введите уникальный буквенно-цифровой идентификатор респондента в панели «Участник», укажите возраст испытуемого и сохраните служебные комментарии. Эти метаданные автоматически присоединятся к итоговому CSV-дампу.
                      </div>
                      <div className="p-3 bg-[#070c14] rounded-lg border border-[#142037]">
                        <strong className="text-white block mb-0.5 font-sans">🎮 Контроль режимов видов экрана:</strong>
                        Используйте режим <strong className="text-white">«Разделенный экран»</strong> для одновременного наблюдения за сессией и осциллограммой ЭЭГ. Переводите систему в <strong className="text-white">«Экран испытуемого»</strong> для скрытия технических данных во время прохождения реальных тестов.
                      </div>
                      <div className="p-3 bg-[#070c14] rounded-lg border border-[#142037]">
                        <strong className="text-white block mb-0.5 font-sans">💾 Экспорт базы:</strong>
                        По завершении всех блоков нажмите кнопку <strong className="text-white">«Скачать CSV-отчет»</strong> на панели оператора или на финальном экране для получения готового Excel-совместимого дампа со всеми метриками.
                      </div>
                    </div>
                  </div>
                )}

                {docsTab === "eeg" && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-white text-base font-bold font-display flex items-center gap-2 border-b border-[#142037] pb-2">
                      ⚡ 4. Спецификация кодов синхронизации ЭЭГ-маркеров
                    </h3>
                    <p className="text-[#a0aec0]">
                      Для прецизионной синхронизации по протоколам <strong className="text-white">LabStreamingLayer (LSL)</strong> или <strong className="text-white">Serial TTL (COM3)</strong>, комплекс автоматически передает следующие маркеры:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse border border-[#142037]">
                        <thead>
                          <tr className="bg-[#070c14]">
                            <th className="p-2 border border-[#142037] text-white">Когнитивное событие</th>
                            <th className="p-2 border border-[#142037] text-cyan-400 font-mono">Hex Code</th>
                            <th className="p-2 border border-[#142037] text-[#7e8fad]">Физическое описание</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[#142037]">
                            <td className="p-2 font-semibold">Trial Start</td>
                            <td className="p-2 font-mono text-emerald-400">0x01</td>
                            <td className="p-2">Запуск новой экспериментальной попытки (отрисовка холста).</td>
                          </tr>
                          <tr className="border-b border-[#142037]">
                            <td className="p-2 font-semibold">Motion Start</td>
                            <td className="p-2 font-mono text-emerald-400">0x02</td>
                            <td className="p-2">Старт движения физической сферы (или статическая экспозиция).</td>
                          </tr>
                          <tr className="border-b border-[#142037]">
                            <td className="p-2 font-semibold">Occluder Start</td>
                            <td className="p-2 font-mono text-emerald-400">0x03</td>
                            <td className="p-2">Момент захода сферы во внутреннюю зону окклюзии (невидимости).</td>
                          </tr>
                          <tr className="border-b border-[#142037]">
                            <td className="p-2 font-semibold">Stimulus End</td>
                            <td className="p-2 font-mono text-emerald-400">0x04</td>
                            <td className="p-2">Физическое пересечение стимулом зоны мишени (окончание объекта).</td>
                          </tr>
                          <tr className="border-b border-[#142037]">
                            <td className="p-2 font-semibold">Response Keypress</td>
                            <td className="p-2 font-mono text-emerald-400">0x05</td>
                            <td className="p-2">Регистрация нажатия на клавишу ПРОБЕЛ испытуемым.</td>
                          </tr>
                          <tr className="border-b border-[#142037]">
                            <td className="p-2 font-semibold">Feedback Start</td>
                            <td className="p-2 font-mono text-emerald-400">0x06</td>
                            <td className="p-2">Вывод экрана разбора ошибки и уверенности на дисплей.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 bg-indigo-950/20 border border-indigo-900/50 rounded-xl text-xs text-[#a0aec0]">
                      ⚠️ <strong>Возможность отключения:</strong> Если синхронизация ЭЭГ отключена в параметрах, вещание триггеров прекращается, статус меняется на <code className="text-white">disconnected</code>, сигналы в последовательный порт не отправляются, предотвращая искажение логов.
                    </div>
                  </div>
                )}

                {docsTab === "metrics" && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-white text-base font-bold font-display flex items-center gap-2 border-b border-[#142037] pb-2">
                      📈 5. Методология расчета математических метрик
                    </h3>
                    <p className="text-[#a0aec0]">
                      Комплекс вычисляет интегральный профиль сенсомоторных реакций на основе пяти базовых параметров теории восприятия времени:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 bg-[#070c14] border border-[#142037] rounded-xl space-y-1">
                        <strong className="text-cyan-400 font-mono block">ПОСТОЯННОЕ СМЕЩЕНИЕ (Constant Bias):</strong>
                        <p className="text-[#a0aec0] leading-normal font-sans">
                          Среднее арифметическое значение расхождений времени. Отражает склонность респондента торопиться (недолет) или опаздывать с реакцией (перелет).
                        </p>
                      </div>
                      <div className="p-3 bg-[#070c14] border border-[#142037] rounded-xl space-y-1">
                        <strong className="text-pink-400 font-mono block font-sans">ДРОБЬ ВЕБЕРА (Weber Fraction):</strong>
                        <p className="text-[#a0aec0] leading-normal font-sans">
                          Стандартное отклонение времени откликов, поделенное на средний интервал стимулятора. Позволяет сравнивать точность на разных скоростях и длительностях.
                        </p>
                      </div>
                      <div className="p-3 bg-[#070c14] border border-[#142037] rounded-xl space-y-1">
                        <strong className="text-yellow-400 font-mono block">КОЭФФИЦИЕНТ ВАРИАЦИИ (CV):</strong>
                        <p className="text-[#a0aec0] leading-normal font-sans">
                          Мера стабильности и монотонности когнитивных часов. Повышение коэффициента вариации указывает на нарастающее утомление респондента.
                        </p>
                      </div>
                      <div className="p-3 bg-[#070c14] border border-[#142037] rounded-xl space-y-1">
                        <strong className="text-emerald-400 font-mono block font-sans">МЕТАКОГНИТИВНАЯ КАЛИБРОВКА:</strong>
                        <p className="text-[#a0aec0] leading-normal font-sans">
                          Координационная связь между величиной реальной ошибки и уровнем уверенности респондента (1–5 звезд). Позволяет оценить уровень интроспективной осознанности.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#070c14] border-t border-[#1a263e] flex justify-end">
              <button
                type="button"
                onClick={() => setIsDocsOpen(false)}
                className="px-6 py-2 bg-[#1e6bf3] hover:bg-[#1554d4] text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
              >
                Закрыть руководство
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
