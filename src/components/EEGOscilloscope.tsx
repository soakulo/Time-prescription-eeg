/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { useLabStore } from "../store";

export default function EEGOscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { eegEnabled, eegInterface, eegStatus, eegMarkers } = useLabStore();
  
  const [filterType, setFilterType] = useState<"none" | "bandpass" | "notch">("bandpass");
  const [gain, setGain] = useState<number>(1.0);
  const [liveStreamSpeed, setLiveStreamSpeed] = useState<number>(2); // px/frame

  // Keep a buffer of past waveforms
  const eegDataRef = useRef<Array<{
    cz: number;
    pz: number;
    o1: number;
    o2: number;
    marker?: string;
    markerText?: string;
  }>>([]);

  // Local timing counters
  const indexRef = useRef(0);

  useEffect(() => {
    // Populate raw template waveforms on start
    const points = 400;
    const initialBuffer = [];
    for (let i = 0; i < points; i++) {
      initialBuffer.push({
        cz: 0,
        pz: 0,
        o1: 0,
        o2: 0,
      });
    }
    eegDataRef.current = initialBuffer;
  }, []);

  // Update loop for generating and shifting waveforms at 60 FPS
  useEffect(() => {
    let animId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      indexRef.current += 1;
      const step = indexRef.current;

      // Ensure canvas keeps its responsive bounding resolution
      const w = canvas.width;
      const h = canvas.height;

      // 1. Generate next simulated EEG signal data point
      // Standard EEG is a superposition of:
      // - Alpha rhythm (~10Hz): parietal/occipital
      // - Beta rhythm (~20Hz): motor/cortex Cz
      // - High frequency muscle noise and baseline wander
      const timeSec = step / 60;

      // Alpha base wave
      const alpha = Math.sin(timeSec * 2 * Math.PI * 10) * 15;
      // Beta base wave
      const beta = Math.sin(timeSec * 2 * Math.PI * 18) * 8;
      // Delta components (slow baseline shift)
      const delta = Math.sin(timeSec * 2 * Math.PI * 0.4) * 6;

      // Simulated noise
      const noise = (Math.random() - 0.5) * 4;

      // Channel-specific signal mixing
      let czRaw = beta + delta * 0.7 + noise * 1.5;
      let pzRaw = alpha * 0.8 + beta * 0.4 + delta + noise;
      let o1Raw = alpha * 1.3 + delta * 1.2 + noise * 1.2;
      let o2Raw = alpha * 1.25 + delta * 1.1 + noise * 1.15;

      // High-pass filter emulation (centers signals at 0)
      if (filterType === "bandpass") {
        // Suppress slow drift delta
        czRaw -= delta * 0.65;
        pzRaw -= delta * 0.9;
        o1Raw -= delta * 1.1;
        o2Raw -= delta * 1.0;
      }
      if (filterType === "notch") {
        // simulate standard filtering
        czRaw *= 0.85;
        pzRaw *= 0.85;
      }

      // 2. Check for newly arriving event triggers from Zustand store to annotate onto the stream
      let newMarker: string | undefined;
      let newMarkerText: string | undefined;

      const latestMarker = eegMarkers[0];
      if (latestMarker && (performance.now() - latestMarker.timestamp) < 20) {
        // If marker arrived in the last 20ms, imprint onto current sample
        newMarker = latestMarker.markerCode;
        newMarkerText = latestMarker.event;
      }

      // Add to running history array
      eegDataRef.current.push({
        cz: czRaw * gain,
        pz: pzRaw * gain,
        o1: o1Raw * gain,
        o2: o2Raw * gain,
        marker: newMarker,
        markerText: newMarkerText,
      });

      // Keep fixed sample size
      if (eegDataRef.current.length > 500) {
        eegDataRef.current.shift();
      }

      // 3. Plot channels
      ctx.clearRect(0, 0, w, h);

      // Oscilloscope Dark Grid
      ctx.strokeStyle = "rgba(40, 80, 180, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw active status indicator
      ctx.fillStyle = eegStatus === "streaming" ? "#22C55E" : eegStatus === "ready" ? "#3B82F6" : "#6B7280";
      ctx.beginPath();
      ctx.arc(w - 20, 20, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(156, 163, 175, 0.6)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      const eegStatusRu = eegStatus === "streaming" ? "ТРАНСЛЯЦИЯ" : eegStatus === "ready" ? "ГОТОВ" : "ОТКЛЮЧЕНО";
      ctx.fillText(`СТАТУС: ${eegStatusRu} (${eegInterface})`, w - 32, 23);

      if (eegStatus === "disconnected") {
        ctx.fillStyle = "rgba(220, 38, 38, 0.4)";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ТЕЛЕМЕТРИЯ ЭЭГ-ОБОРУДОВАНИЯ ОФФЛАЙН", w / 2, h / 2);
        animId = requestAnimationFrame(render);
        return;
      }

      // Define channel row offsets
      const channelConfigs = [
        { name: "ЭЭГ Cz (Моторная кора)", dataKey: "cz", color: "#60A5FA", offset: h * 0.2 },
        { name: "ЭЭГ Pz (Восприятие интервала)", dataKey: "pz", color: "#34D399", offset: h * 0.42 },
        { name: "ЭЭГ O1 (Зрительная кора Л)", dataKey: "o1", color: "#FB7185", offset: h * 0.65 },
        { name: "ЭЭГ O2 (Зрительная кора П)", dataKey: "o2", color: "#FBBF24", offset: h * 0.88 },
      ];

      // Draw zero-reference lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      channelConfigs.forEach((cc) => {
        ctx.beginPath();
        ctx.moveTo(0, cc.offset);
        ctx.lineTo(w, cc.offset);
        ctx.stroke();
      });

      const buffer = eegDataRef.current;
      const len = buffer.length;

      // Draw Signal Trace Curves
      channelConfigs.forEach((cc) => {
        ctx.strokeStyle = cc.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();

        for (let i = 0; i < len; i++) {
          // X goes backward from right edge
          const x = w - (len - i) * liveStreamSpeed;
          if (x < 0) continue;

          // Retrieve voltage value
          const val = (buffer[i] as any)[cc.dataKey] || 0;
          const y = cc.offset - val;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Feed text tag
        ctx.fillStyle = "rgba(156, 163, 175, 0.7)";
        ctx.font = "9px monospace";
        ctx.textAlign = "left";
        ctx.fillText(cc.name, 10, cc.offset - 15);
      });

      // 4. Draw marker vertical trigger bars
      ctx.textAlign = "center";
      for (let i = 0; i < len; i++) {
        const item = buffer[i];
        if (item && item.marker) {
          const x = w - (len - i) * liveStreamSpeed;
          if (x < 0) continue;

          // Draw neon guide wire vertical slice
          ctx.strokeStyle = "rgba(244, 63, 94, 0.75)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 10);
          ctx.lineTo(x, h - 10);
          ctx.stroke();
          ctx.setLineDash([]);

          // Byte label tag bubble
          ctx.fillStyle = "#F43F5E";
          ctx.fillRect(x - 22, 10, 44, 15);
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 9px monospace";
          ctx.fillText(item.marker, x, 21);

          // Subtext info
          ctx.fillStyle = "rgba(244, 63, 94, 0.85)";
          ctx.font = "8px monospace";
          ctx.fillText(item.markerText || "", x, h - 15);
        }
      }

      ctx.textAlign = "left"; // reset alignment

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [eegStatus, eegInterface, eegMarkers, filterType, gain, liveStreamSpeed]);

  return (
    <div className="w-full bg-[#0d1424] border border-[#1a263e] rounded-xl p-4">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
          <h3 className="text-xs font-bold font-mono tracking-wider text-indigo-300 uppercase">
            ⚡ Монитор активности мозга LSL/Serial (Эпоха 128 Гц)
          </h3>
        </div>

        {/* Oscilloscope filtering knobs */}
        <div className="flex items-center gap-2 text-[10px] font-mono select-none">
          <span className="text-gray-500">ФИЛЬТР:</span>
          <button
            onClick={() => setFilterType("none")}
            className={`px-2 py-0.5 rounded-lg leading-none transition-all cursor-pointer ${filterType === "none" ? "bg-[#1e6bf3] text-white font-bold" : "bg-[#070c14] border border-[#1a263e] hover:bg-slate-800 text-[#7e8fad]"}`}
          >
            СЫРОЙ
          </button>
          <button
            onClick={() => setFilterType("bandpass")}
            className={`px-2 py-0.5 rounded-lg leading-none transition-all cursor-pointer ${filterType === "bandpass" ? "bg-[#1e6bf3] text-white font-bold" : "bg-[#070c14] border border-[#1a263e] hover:bg-slate-800 text-[#7e8fad]"}`}
          >
            0.5-45 Гц ПФ
          </button>
          <button
            onClick={() => setFilterType("notch")}
            className={`px-2 py-0.5 rounded-lg leading-none transition-all cursor-pointer ${filterType === "notch" ? "bg-[#1e6bf3] text-white font-bold" : "bg-[#070c14] border border-[#1a263e] hover:bg-slate-800 text-[#7e8fad]"}`}
          >
            50 Гц РЕЖЕКТ.
          </button>

          <span className="text-gray-500 ml-2">УСИЛЕНИЕ (V):</span>
          <button
            onClick={() => setGain((g) => Math.max(0.5, g - 0.25))}
            className="px-2 py-0.5 bg-[#070c14] border border-[#1a263e] hover:bg-slate-800 rounded-lg text-center text-gray-300 cursor-pointer"
          >
            -
          </button>
          <span className="w-8 text-center font-bold text-gray-300">{gain.toFixed(2)}x</span>
          <button
            onClick={() => setGain((g) => Math.min(2.5, g + 0.25))}
            className="px-2 py-0.5 bg-[#070c14] border border-[#1a263e] hover:bg-slate-800 rounded-lg text-center text-gray-300 cursor-pointer"
          >
            +
          </button>
        </div>
      </div>

      <div className="bg-[#070c14] border border-[#1a263e] rounded-xl relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={220}
          className="w-full h-[220px] block"
          title="Интерактивный график многоканального осциллографа ЭЭГ"
        />
        
        {/* Real-time statistics annotations overlay */}
        <div className="absolute bottom-2 right-2 flex gap-4 text-[9px] font-mono text-gray-400 bg-[#070c14]/85 backdrop-blur px-2.5 py-1 rounded-lg border border-[#1a263e]/60">
          <span>SPS: 250 Гц</span>
          <span>ТРИГГЕРЫ: LSL_TX_OK</span>
        </div>
      </div>

      <div className="flex justify-between items-center text-[9px] font-mono text-[#5d7290] mt-2 select-none">
        <span>Шапочка электродов: DB-25 PIN Активное экранирование</span>
        <span>Формат вывода: IEEE-754 Числа одинарной точности (Float)</span>
      </div>
    </div>
  );
}
