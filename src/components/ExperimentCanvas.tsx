/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { ExperimentalMode } from "../types";
import { useLabStore } from "../store";
import { UNIQUE_CURVES } from "../curves";

interface Point {
  x: number;
  y: number;
}

interface Segment {
  p1: Point;
  p2: Point;
  distance: number;
}

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function pointsToSegments(points: Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    segments.push({
      p1,
      p2,
      distance: getDistance(p1, p2)
    });
  }
  return segments;
}

function getTotalDistance(segments: Segment[]): number {
  return segments.reduce((sum, seg) => sum + seg.distance, 0);
}

function findByDistance(segments: Segment[], distance: number) {
  let leftDistance = distance;
  let currSegmentNum = 0;
  let overflow = true;

  for (currSegmentNum = 0; currSegmentNum < segments.length; currSegmentNum++) {
    const currSegment = segments[currSegmentNum];
    if (leftDistance <= currSegment.distance) {
      overflow = false;
      break;
    }
    leftDistance -= currSegment.distance;
  }

  if (overflow) {
    currSegmentNum = segments.length - 1;
    leftDistance = segments[currSegmentNum].distance;
  }

  return { segment: currSegmentNum, position: leftDistance };
}

function getPathPoint(segments: Segment[], distance: number): Point {
  if (segments.length === 0) return { x: 0, y: 0 };
  const pos = findByDistance(segments, distance);
  const curSegment = segments[pos.segment];
  if (curSegment.distance === 0) return curSegment.p1;

  const strideFrac = pos.position / curSegment.distance;
  const sx = curSegment.p2.x - curSegment.p1.x;
  const sy = curSegment.p2.y - curSegment.p1.y;
  return {
    x: curSegment.p1.x + sx * strideFrac,
    y: curSegment.p1.y + sy * strideFrac
  };
}

/**
 * Renders a polyline trajectory (ломаная линия) passing through vertices p1 -> p2 -> ... -> pN.
 * Also renders vertex point nodes at control points along the polyline.
 */
function drawPolyline(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  curvePoints: Point[],
  scaleX: number,
  scaleY: number,
  fromDistance: number = 0,
  toDistance: number = Infinity
) {
  if (segments.length === 0) return;

  const totalDist = getTotalDistance(segments);
  const actualToDist = Math.min(toDistance, totalDist);
  if (fromDistance >= actualToDist) return;

  const startPt = getPathPoint(segments, fromDistance);
  const endPt = getPathPoint(segments, actualToDist);

  const startPos = findByDistance(segments, fromDistance);
  const endPos = findByDistance(segments, actualToDist);

  // 1. Draw connected line segments of the polyline
  ctx.beginPath();
  ctx.moveTo(startPt.x * scaleX, startPt.y * scaleY);

  if (startPos.segment === endPos.segment) {
    ctx.lineTo(endPt.x * scaleX, endPt.y * scaleY);
  } else {
    // Line to end of start segment (p2)
    ctx.lineTo(segments[startPos.segment].p2.x * scaleX, segments[startPos.segment].p2.y * scaleY);

    // Lines to ends of intermediate segments
    for (let i = startPos.segment + 1; i < endPos.segment; i++) {
      ctx.lineTo(segments[i].p2.x * scaleX, segments[i].p2.y * scaleY);
    }

    // Line to final point
    ctx.lineTo(endPt.x * scaleX, endPt.y * scaleY);
  }

  ctx.stroke();

  // 2. Draw vertex node circles at control points that fall within [fromDistance, actualToDist]
  const savedDash = ctx.getLineDash();
  ctx.setLineDash([]); // Ensure control vertex dots are drawn solid
  let accumDist = 0;
  for (let i = 0; i < curvePoints.length; i++) {
    if (i > 0) {
      accumDist += segments[i - 1].distance;
    }
    if (accumDist >= fromDistance - 0.5 && accumDist <= actualToDist + 0.5) {
      const pt = curvePoints[i];
      ctx.beginPath();
      ctx.arc(pt.x * scaleX, pt.y * scaleY, 4.5 * scaleX, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.setLineDash(savedDash);
}

interface ExperimentCanvasProps {
  onTrialComplete: (recordedTimeMs: number) => void;
}

export default function ExperimentCanvas({ onTrialComplete }: ExperimentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Connect to Zustand store
  const currentMode = useLabStore((s) => s.currentMode);
  const activeTrialCondition = useLabStore((s) => s.activeTrialCondition);
  const activeTrialState = useLabStore((s) => s.activeTrialState);
  const activeSpeed = useLabStore((s) => s.activeSpeed);
  const activeDuration = useLabStore((s) => s.activeDuration);
  const activeTrajectoryIndex = useLabStore((s) => s.activeTrajectoryIndex);
  const isPaused = useLabStore((s) => s.isPaused);
  const currentTrial = useLabStore((s) => s.currentTrial);
  const currentBlock = useLabStore((s) => s.currentBlock);
  const isTraining = useLabStore((s) => s.isTraining);
  const trainingTrialIndex = useLabStore((s) => s.trainingTrialIndex);
  const trainingTrialsCount = useLabStore((s) => s.config.trainingTrialsCount || 5);
  const setTrialState = useLabStore((s) => s.setTrialState);
  const logSystemMessage = useLabStore((s) => s.logSystemMessage);

  // Interval Reproduction State Flow (Local to Animation Canvas)
  const [demoActive, setDemoActive] = useState(false);
  const [reproducingActive, setReproducingActive] = useState(false);

  // High precision time keepers (relative to anim starts)
  const stateRef = useRef({
    activeTrialState,
    currentMode,
    activeTrialCondition,
    activeSpeed,
    activeDuration,
    activeTrajectoryIndex: activeTrajectoryIndex ?? 0,
    isPaused,
    currentTrial,
    currentBlock,
    isTraining,
    trainingTrialIndex,
    trainingTrialsCount,
    startTime: 0,
    motionEndTime: 0,
    userPressTime: 0,
    hasResponded: false,
    width: 700,
    height: 400,
    reproActive: false,
    reproStartTime: 0,
    recordedTimePart1: 0,
  });

  // Keep stateRef in sync with external properties
  useEffect(() => {
    stateRef.current.activeTrialState = activeTrialState;
    stateRef.current.currentMode = currentMode;
    stateRef.current.activeTrialCondition = activeTrialCondition;
    stateRef.current.activeSpeed = activeSpeed;
    stateRef.current.activeDuration = activeDuration;
    stateRef.current.activeTrajectoryIndex = activeTrajectoryIndex ?? 0;
    stateRef.current.isPaused = isPaused;
    stateRef.current.currentTrial = currentTrial;
    stateRef.current.currentBlock = currentBlock;
    stateRef.current.isTraining = isTraining;
    stateRef.current.trainingTrialIndex = trainingTrialIndex;
    stateRef.current.trainingTrialsCount = trainingTrialsCount;
  }, [activeTrialState, currentMode, activeTrialCondition, activeSpeed, activeDuration, activeTrajectoryIndex, isPaused, currentTrial, currentBlock, isTraining, trainingTrialIndex, trainingTrialsCount]);

  // Handle canvas size tracking
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Main high-performance Animation Frame Loop
  useEffect(() => {
    let animationId: number;
    let particles: Array<{ x: number; y: number; size: number; alpha: number; speedY: number }> = [];

    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || isPaused) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;
      
      // virtual coordinates: 700w x 400h (to perfectly map curves)
      const scaleX = w / 700;
      const scaleY = h / 400;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw scientific background grid
      ctx.strokeStyle = "rgba(40, 80, 180, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 700; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x * scaleX, 0);
        ctx.lineTo(x * scaleX, h);
        ctx.stroke();
      }
      for (let y = 0; y < 400; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y * scaleY);
        ctx.lineTo(w, y * scaleY);
        ctx.stroke();
      }

      // Outer bounding safe box
      ctx.strokeStyle = "rgba(80, 120, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(5 * scaleX, 5 * scaleY, 690 * scaleX, 390 * scaleY);

      // Mode-specific animations
      const activeState = stateRef.current.activeTrialState;
      const mode = stateRef.current.currentMode;
      const duration = stateRef.current.activeDuration;
      const speedValue = stateRef.current.activeSpeed; // px per second
      const currentTrialVal = stateRef.current.currentTrial;
      const currentBlockVal = stateRef.current.currentBlock;

      // Select active randomized trajectory curve
      const curveIndex = Math.abs(stateRef.current.activeTrajectoryIndex ?? 0) % UNIQUE_CURVES.length;
      const curvePoints = UNIQUE_CURVES[curveIndex];
      const segments = pointsToSegments(curvePoints);
      const totalDistance = getTotalDistance(segments);

      // Render clean, distraction-free stage
      if (mode === ExperimentalMode.REACTION_VISIBLE || mode === ExperimentalMode.TTC) {
        // Path visible distance before occlusion in TTC mode
        // 35% of the polyline is visible before entering occlusion (making the occlusion area large and prominent)
        const visibleFraction = mode === ExperimentalMode.TTC ? 0.35 : 1.0;
        const visibleDistance = visibleFraction * totalDistance;
        const startPt = getPathPoint(segments, 0);
        const targetPt = getPathPoint(segments, totalDistance);

        // 1. Render Start Marker
        ctx.fillStyle = "#3B82F6";
        ctx.fillRect((startPt.x - 3) * scaleX, (startPt.y - 35) * scaleY, 6 * scaleX, 70 * scaleY);
        ctx.font = `bold ${11 * scaleY}px "JetBrains Mono", sans-serif`;
        ctx.fillText("СТАРТ", (startPt.x - 20) * scaleX, (startPt.y - 42) * scaleY);

        if (mode === ExperimentalMode.TTC) {
          // 2. Draw OPEN / VISIBLE portion of trajectory (solid line & solid vertex nodes)
          ctx.strokeStyle = "#3B82F6";
          ctx.fillStyle = "#60A5FA";
          ctx.lineWidth = 3.2;
          drawPolyline(ctx, segments, curvePoints, scaleX, scaleY, 0, visibleDistance);

          // 3. Render LARGE OCCLUSION SCREEN PANEL (Экран окклюзии)
          // Compute bounding box covering the occluded section
          const occludedPoints: Point[] = [];
          for (let d = visibleDistance; d <= totalDistance; d += 4) {
            occludedPoints.push(getPathPoint(segments, d));
          }
          occludedPoints.push(targetPt);

          const xs = occludedPoints.map(p => p.x);
          const ys = occludedPoints.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const occluderX = Math.max(6, minX - 35);
          const occluderY = Math.max(8, minY - 45);
          const occluderWidth = Math.min(692 - occluderX, (maxX - minX) + 65);
          const occluderHeight = Math.min(386 - occluderY, (maxY - minY) + 85);

          // Dark slate background for occlusion screen barrier
          ctx.fillStyle = "rgba(11, 19, 36, 0.95)";
          ctx.fillRect(occluderX * scaleX, occluderY * scaleY, occluderWidth * scaleX, occluderHeight * scaleY);

          // Glowing blue-cyan frame
          ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
          ctx.lineWidth = 2;
          ctx.strokeRect(occluderX * scaleX, occluderY * scaleY, occluderWidth * scaleX, occluderHeight * scaleY);

          // Header title bar on top of the occluder
          ctx.fillStyle = "rgba(30, 58, 138, 0.6)";
          ctx.fillRect(occluderX * scaleX, occluderY * scaleY, occluderWidth * scaleX, 22 * scaleY);
          ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(occluderX * scaleX, occluderY * scaleY, occluderWidth * scaleX, 22 * scaleY);

          ctx.fillStyle = "#93C5FD";
          ctx.font = `bold ${10 * scaleY}px "JetBrains Mono", sans-serif`;
          ctx.fillText("ЭКРАН ОККЛЮЗИИ (ЗОНА СКРЫТИЯ)", (occluderX + 10) * scaleX, (occluderY + 15) * scaleY);

          // Entrance boundary gate indicator at visibleDistance
          const occludeEntryPt = getPathPoint(segments, visibleDistance);
          ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(occludeEntryPt.x * scaleX, (occludeEntryPt.y - 25) * scaleY);
          ctx.lineTo(occludeEntryPt.x * scaleX, (occludeEntryPt.y + 25) * scaleY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#FBBF24";
          ctx.font = `bold ${9 * scaleY}px "JetBrains Mono", sans-serif`;
          ctx.fillText("ВХОД", (occludeEntryPt.x - 14) * scaleX, (occludeEntryPt.y - 30) * scaleY);

          // 4. Draw trajectory BEHIND occlusion: dashed line, intermediate reference dots, and vertex points
          ctx.strokeStyle = "rgba(147, 197, 253, 0.7)";
          ctx.fillStyle = "#38BDF8";
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 6]);
          drawPolyline(ctx, segments, curvePoints, scaleX, scaleY, visibleDistance, totalDistance);
          ctx.setLineDash([]);

          // Intermediate guide dots along the dashed path behind occlusion
          const occludedLength = totalDistance - visibleDistance;
          const stepDist = 35; // Step every ~35px along occluded track
          const numSteps = Math.max(3, Math.floor(occludedLength / stepDist));
          for (let s = 1; s <= numSteps; s++) {
            const d = visibleDistance + s * (occludedLength / (numSteps + 1));
            const pt = getPathPoint(segments, d);
            ctx.fillStyle = "rgba(147, 197, 253, 0.85)";
            ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
            ctx.lineWidth = 1.5 * scaleX;
            ctx.beginPath();
            ctx.arc(pt.x * scaleX, pt.y * scaleY, 3.5 * scaleX, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          // Highlighted vertex points inside the occluded area
          let accumDist = 0;
          for (let i = 0; i < curvePoints.length; i++) {
            if (i > 0) accumDist += segments[i - 1].distance;
            if (accumDist >= visibleDistance - 0.5 && accumDist <= totalDistance - 10) {
              const pt = curvePoints[i];
              // Outer bright cyan marker dot
              ctx.fillStyle = "#38BDF8";
              ctx.strokeStyle = "#FFFFFF";
              ctx.lineWidth = 1.5 * scaleX;
              ctx.beginPath();
              ctx.arc(pt.x * scaleX, pt.y * scaleY, 5 * scaleX, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Inner white center
              ctx.fillStyle = "#FFFFFF";
              ctx.beginPath();
              ctx.arc(pt.x * scaleX, pt.y * scaleY, 2 * scaleX, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          // Mode 1: REACTION_VISIBLE - draw full solid trajectory
          ctx.strokeStyle = "#3B82F6";
          ctx.fillStyle = "#60A5FA";
          ctx.lineWidth = 3.2;
          drawPolyline(ctx, segments, curvePoints, scaleX, scaleY, 0, totalDistance);
        }

        // 5. Render Target Point (Целевая точка / Финиш)
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(targetPt.x * scaleX, targetPt.y * scaleY, 14 * scaleX, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.5 * scaleX;
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(targetPt.x * scaleX, targetPt.y * scaleY, 5 * scaleX, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
        ctx.lineWidth = 2 * scaleX;
        ctx.beginPath();
        ctx.moveTo((targetPt.x - 22) * scaleX, targetPt.y * scaleY);
        ctx.lineTo((targetPt.x + 22) * scaleX, targetPt.y * scaleY);
        ctx.moveTo(targetPt.x * scaleX, (targetPt.y - 22) * scaleY);
        ctx.lineTo(targetPt.x * scaleX, (targetPt.y + 22) * scaleY);
        ctx.stroke();

        ctx.fillStyle = "#F87171";
        ctx.font = `bold ${12 * scaleY}px "JetBrains Mono", sans-serif`;
        ctx.fillText("ЦЕЛЬ", (targetPt.x - 18) * scaleX, (targetPt.y - 26) * scaleY);

        // 6. Motion execution & stimulus orb rendering
        if (activeState === "motion" || activeState === "occluded" || activeState === "waiting_response") {
          const elapsed = performance.now() - stateRef.current.startTime;
          const totalTime = 600 + duration;
          const elapsedDistance = Math.min(totalDistance, (elapsed / totalTime) * totalDistance);
          const currentPos = getPathPoint(segments, elapsedDistance);

          // Transition to occluded when leaving open path
          if (mode === ExperimentalMode.TTC && elapsedDistance >= visibleDistance && activeState === "motion") {
            setTimeout(() => setTrialState("occluded"), 0);
          }

          // Transition to waiting response when trajectory ends
          if (elapsed >= totalTime) {
            if (activeState === "motion" || activeState === "occluded") {
              stateRef.current.motionEndTime = performance.now();
              setTimeout(() => setTrialState("waiting_response"), 0);
            }
          }

          // Timeout in waiting_response if no key pressed within 10 seconds
          if (activeState === "waiting_response") {
            const waitTime = performance.now() - (stateRef.current.motionEndTime || performance.now());
            if (waitTime > 10000 && !stateRef.current.hasResponded) {
              stateRef.current.hasResponded = true;
              setTimeout(() => onTrialComplete(totalTime + 3000), 0);
            }
          }

          // Render moving stimulus ball ONLY if visible on open path
          const isStimulusVisible = (activeState === "motion" && elapsedDistance <= visibleDistance) || 
                                   (mode === ExperimentalMode.REACTION_VISIBLE);

          if (isStimulusVisible) {
            const grad = ctx.createRadialGradient(
              currentPos.x * scaleX, currentPos.y * scaleY, 2 * scaleX,
              currentPos.x * scaleX, currentPos.y * scaleY, 20 * scaleX
            );
            grad.addColorStop(0, "#FFFFFF");
            grad.addColorStop(0.35, "#3B82F6");
            grad.addColorStop(1, "rgba(59, 130, 246, 0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(currentPos.x * scaleX, currentPos.y * scaleY, 22 * scaleX, 0, Math.PI * 2);
            ctx.fill();

            // Bold high-contrast core
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#93C5FD";
            ctx.lineWidth = 2.5 * scaleX;
            ctx.beginPath();
            ctx.arc(currentPos.x * scaleX, currentPos.y * scaleY, 12 * scaleX, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      else if (mode === ExperimentalMode.INTERVAL_REPRODUCTION) {
        // Mode 3: Reproduce visible movement interval
        // Draw track polyline for Interval Reproduction
        ctx.strokeStyle = "rgba(80, 120, 255, 0.4)";
        ctx.fillStyle = "#3B82F6";
        ctx.lineWidth = 2.5;
        drawPolyline(ctx, segments, curvePoints, scaleX, scaleY, 0, totalDistance);

        // Draw start line marker
        const startPt = getPathPoint(segments, 0);
        ctx.fillStyle = "#3B82F6";
        ctx.fillRect((startPt.x - 2) * scaleX, (startPt.y - 30) * scaleY, 4 * scaleX, 60 * scaleY);
        ctx.font = `${10 * scaleY}px "JetBrains Mono"`;
        ctx.fillText("СТАРТ", (startPt.x - 18) * scaleX, (startPt.y - 40) * scaleY);
        // There is reference phase, and response phase
        const isDemo = activeState === "motion"; 
        const isReprod = activeState === "waiting_response";

        if (isDemo) {
          const elapsed = performance.now() - stateRef.current.startTime;
          const elapsedDistance = Math.min(totalDistance, (elapsed / duration) * totalDistance);
          const currentPos = getPathPoint(segments, elapsedDistance);

          // Auto stop demonstration and transition to waiting response
          if (elapsed >= duration) {
            setTimeout(() => {
              logSystemMessage("Демонстрация целевого интервала завершена. Приготовьтесь повторить длительность (Нажмите ПРОБЕЛ, чтобы начать).");
              setTrialState("waiting_response"); 
            }, 0);
          }

          // Draw target ending marker of training demonstration
          ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
          ctx.setLineDash([3, 3]);
          const targetPt = getPathPoint(segments, totalDistance);
          ctx.beginPath();
          ctx.moveTo(targetPt.x * scaleX, (targetPt.y - 40) * scaleY);
          ctx.lineTo(targetPt.x * scaleX, (targetPt.y + 40) * scaleY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw moving stimulus dot (Purple)
          const grad = ctx.createRadialGradient(
            currentPos.x * scaleX, currentPos.y * scaleY, 1 * scaleX,
            currentPos.x * scaleX, currentPos.y * scaleY, 12 * scaleX
          );
          grad.addColorStop(0, "#FFFFFF");
          grad.addColorStop(0.3, "#C084FC");
          grad.addColorStop(1, "rgba(168, 85, 247, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(currentPos.x * scaleX, currentPos.y * scaleY, 15 * scaleX, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#D8B4FE";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(currentPos.x * scaleX, currentPos.y * scaleY, 8 * scaleX, 0, Math.PI * 2);
          ctx.stroke();

          // Render Label
          ctx.fillStyle = "#D8B4FE";
          ctx.font = `11px "JetBrains Mono"`;
          ctx.fillText("ДЕМОАКТИВНОСТЬ", 290 * scaleX, 50 * scaleY);
        } 
        
        else if (isReprod) {
          if (stateRef.current.reproActive) {
            const elapsedRepro = performance.now() - stateRef.current.reproStartTime;
            const elapsedDistance = Math.min(totalDistance, (elapsedRepro / duration) * totalDistance);
            const currentPos = getPathPoint(segments, elapsedDistance);

            // Draw moving stimulus dot (Blue during user reproduction)
            const grad = ctx.createRadialGradient(
              currentPos.x * scaleX, currentPos.y * scaleY, 1 * scaleX,
              currentPos.x * scaleX, currentPos.y * scaleY, 12 * scaleX
            );
            grad.addColorStop(0, "#FFFFFF");
            grad.addColorStop(0.3, "#3B82F6");
            grad.addColorStop(1, "rgba(59, 130, 246, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(currentPos.x * scaleX, currentPos.y * scaleY, 15 * scaleX, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#93C5FD";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(currentPos.x * scaleX, currentPos.y * scaleY, 8 * scaleX, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "#93C5FD";
            ctx.font = `11px "JetBrains Mono"`;
            ctx.fillText(`ВОСПРОИЗВЕДЕНИЕ ИНТЕРВАЛА... ПРОШЛО: ${elapsedRepro.toFixed(0)} мс (Нажмите ПРОБЕЛ для фиксации)`, 150 * scaleX, 50 * scaleY);

            // Force auto-stop if timeout
            if (elapsedRepro > 6000) {
              stateRef.current.reproActive = false;
              setTimeout(() => onTrialComplete(elapsedRepro), 0);
            }
          } else {
            ctx.fillStyle = "#60A5FA";
            ctx.font = `12px "JetBrains Mono"`;
            ctx.fillText("Нажмите ПРОБЕЛ, чтобы начать воспроизведение интервала", 160 * scaleX, 200 * scaleY);
          }
        }
      }

      else if (mode === ExperimentalMode.DURATION_REPRODUCTION) {
        // Mode 4: Standalone duration pulse demonstration & reproduction
        const isDemo = activeState === "motion";
        const isReprod = activeState === "waiting_response";

        if (isDemo) {
          const elapsed = performance.now() - stateRef.current.startTime;
          
          if (elapsed >= duration) {
            setTimeout(() => {
              logSystemMessage("Базовая презентация завершена. Приготовьтесь воспроизвести длительность (Зажмите ПРОБЕЛ).");
              setTrialState("waiting_response");
            }, 0);
          }

          // Render beautiful green time presentation circle in the middle
          const pulseScale = 1 + 0.12 * Math.sin(performance.now() / 150);
          const grad = ctx.createRadialGradient(
            350 * scaleX, 200 * scaleY, 5 * scaleX,
            350 * scaleX, 200 * scaleY, 60 * pulseScale * scaleX
          );
          grad.addColorStop(0, "#FFFFFF");
          grad.addColorStop(0.4, "rgba(16, 185, 129, 0.45)");
          grad.addColorStop(1, "rgba(16, 185, 129, 0)");
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(350 * scaleX, 200 * scaleY, 65 * pulseScale * scaleX, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#6EE7B7";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(350 * scaleX, 200 * scaleY, 30 * scaleX, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#A7F3D0";
          ctx.font = `12px "JetBrains Mono"`;
          ctx.fillText("ПОКАЗ ЭТАЛОННОЙ ДЛИТЕЛЬНОСТИ АКТИВЕН", 220 * scaleX, 290 * scaleY);
          ctx.fillText(`${elapsed.toFixed(0)} мс / ${duration} мс`, 300 * scaleX, 120 * scaleY);
        }

        else if (isReprod) {
          if (stateRef.current.reproActive) {
            const elapsedRepro = performance.now() - stateRef.current.reproStartTime;

            // Draw user holding pulse circle in golden gold
            const pulseScale = 1 + 0.08 * Math.sin(performance.now() / 100);
            const grad = ctx.createRadialGradient(
              350 * scaleX, 200 * scaleY, 5 * scaleX,
              350 * scaleX, 200 * scaleY, 45 * pulseScale * scaleX
            );
            grad.addColorStop(0, "#FFFFFF");
            grad.addColorStop(0.4, "rgba(245, 158, 11, 0.45)");
            grad.addColorStop(1, "rgba(245, 158, 11, 0)");
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(350 * scaleX, 200 * scaleY, 50 * pulseScale * scaleX, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#FCD34D";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(350 * scaleX, 200 * scaleY, 25 * scaleX, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "#FDE68A";
            ctx.font = `12px "JetBrains Mono"`;
            ctx.fillText("УДЕРЖИВАЙТЕ ПРОБЕЛ ДЛЯ ВОСПРОИЗВЕДЕНИЯ", 220 * scaleX, 290 * scaleY);
            ctx.fillText(`${elapsedRepro.toFixed(0)} мс`, 320 * scaleX, 120 * scaleY);

            if (elapsedRepro > 6000) {
              stateRef.current.reproActive = false;
              setTimeout(() => onTrialComplete(elapsedRepro), 0);
            }
          } else {
            ctx.fillStyle = "#FBBF24";
            ctx.font = `12px "JetBrains Mono"`;
            ctx.fillText("ЗАЖМИТЕ И УДЕРЖИВАЙТЕ ПРОБЕЛ для воспроизведения длительности", 120 * scaleX, 200 * scaleY);
          }
        }
      }

      // Render trial overlay info
      if (activeState === "blank_delay") {
        ctx.fillStyle = "rgba(10, 20, 30, 0.85)";
        ctx.fillRect(0, 0, w, h);
        
        ctx.fillStyle = "#F59E0B";
        ctx.font = `14px "JetBrains Mono"`;
        ctx.fillText("➕ ПАУЗА ПЕРЕД СИГНАЛОМ (ФОКУСИРУЙТЕСЬ)", 180 * scaleX, 200 * scaleY);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [onTrialComplete, isPaused, setTrialState]);


  // Keydown and Keyup input handling targeting spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      
      // Stop space key from scrolling the web frame
      e.preventDefault();

      if (e.repeat) return;

      const activeState = stateRef.current.activeTrialState;
      const mode = stateRef.current.activeTrialCondition;
      const duration = stateRef.current.activeDuration;

      // Handle trial kickoff
      if (activeState === "idle") {
        setTrialState("blank_delay");
        const delay = 200 + Math.random() * 300; // 0.2s - 0.5s delay
        setTimeout(() => {
          setTrialState("motion");
          stateRef.current.startTime = performance.now();
          stateRef.current.hasResponded = false;
          stateRef.current.reproActive = false;
        }, delay);
        return;
      }

      // Intercept active visible motion (Mode 1), target collision (Mode 2), or waiting response
      if (activeState === "motion" || activeState === "occluded" || activeState === "waiting_response") {
        if (mode === ExperimentalMode.REACTION_VISIBLE || mode === ExperimentalMode.TTC) {
          if (stateRef.current.hasResponded) return;
          stateRef.current.hasResponded = true;
          const elapsed = performance.now() - stateRef.current.startTime;
          onTrialComplete(elapsed);
          return;
        }
      }

      // Capture interval reproductions
      if (activeState === "waiting_response") {
        if (mode === ExperimentalMode.INTERVAL_REPRODUCTION) {
          if (!stateRef.current.reproActive) {
            stateRef.current.reproActive = true;
            stateRef.current.reproStartTime = performance.now();
            logSystemMessage("Запущено воспроизведение интервала. Нажмите пробел еще раз для фиксации.");
          } else {
            stateRef.current.reproActive = false;
            const elapsed = performance.now() - stateRef.current.reproStartTime;
            stateRef.current.hasResponded = true;
            onTrialComplete(elapsed);
          }
        } else if (mode === ExperimentalMode.DURATION_REPRODUCTION) {
          if (!stateRef.current.reproActive && !stateRef.current.hasResponded) {
            stateRef.current.reproActive = true;
            stateRef.current.reproStartTime = performance.now();
            logSystemMessage("Начало удержания сигнала...");
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;

      const activeState = stateRef.current.activeTrialState;
      const mode = stateRef.current.activeTrialCondition;

      if (activeState === "waiting_response" && mode === ExperimentalMode.DURATION_REPRODUCTION) {
        if (stateRef.current.reproActive) {
          stateRef.current.reproActive = false;
          stateRef.current.hasResponded = true;
          const elapsedRepro = performance.now() - stateRef.current.reproStartTime;
          onTrialComplete(elapsedRepro);
          logSystemMessage(`Окончание удержания сигнала. Длительность: ${elapsedRepro.toFixed(0)} мс`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onTrialComplete, setTrialState, logSystemMessage]);

  const triggerSpaceBackup = () => {
    const activeState = stateRef.current.activeTrialState;
    const mode = stateRef.current.activeTrialCondition;

    if (activeState === "idle") {
      setTrialState("blank_delay");
      const delay = 200 + Math.random() * 300;
      setTimeout(() => {
        setTrialState("motion");
        stateRef.current.startTime = performance.now();
        stateRef.current.hasResponded = false;
        stateRef.current.reproActive = false;
      }, delay);
    } 
    else if (activeState === "motion" || activeState === "occluded" || activeState === "waiting_response") {
      if (mode === ExperimentalMode.REACTION_VISIBLE || mode === ExperimentalMode.TTC) {
        if (stateRef.current.hasResponded) return;
        stateRef.current.hasResponded = true;
        const elapsed = performance.now() - stateRef.current.startTime;
        onTrialComplete(elapsed);
        return;
      }
      
      if (mode === ExperimentalMode.INTERVAL_REPRODUCTION || mode === ExperimentalMode.DURATION_REPRODUCTION) {
        if (!stateRef.current.reproActive) {
          stateRef.current.reproActive = true;
          stateRef.current.reproStartTime = performance.now();
          logSystemMessage("Клик-старт воспроизведения интервала. Кликните еще раз для фиксации.");
        } else {
          stateRef.current.reproActive = false;
          stateRef.current.hasResponded = true;
          const elapsedRepro = performance.now() - stateRef.current.reproStartTime;
          onTrialComplete(elapsedRepro);
        }
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between">
      {/* Visual Instruction box based on state of current trial */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center px-4 py-2 bg-[#0F1B2D]/90 border border-blue-500/20 rounded shadow-md z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-mono text-gray-400">ЭТАП:</span>
          <span className="text-xs font-bold font-mono text-blue-400 uppercase">{activeTrialState}</span>
        </div>
        
        <div className="text-right">
          <span className="text-xs font-mono text-gray-400 mr-2">УСЛОВИЕ:</span>
          <span className="text-xs font-bold font-mono text-cyan-400">
            Ti = {activeDuration} мс @ V = {activeSpeed} пикс/с
          </span>
        </div>
      </div>

      {/* Main stim canvas wrapper */}
      <div className="w-full h-[320px] bg-[#050B17] rounded-lg overflow-hidden border border-[rgba(80,120,255,0.15)] flex justify-center items-center">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block cursor-pointer" 
          onClick={triggerSpaceBackup}
          title="Нажмите на экран как альтернативу клавише Пробел"
        />
      </div>

      {/* Action Helper UI Panel */}
      <div className="w-full py-4 px-2 flex flex-col items-center gap-2">
        {activeTrialState === "idle" && (
          <div className="text-center animate-pulse">
            <p className="text-sm text-gray-300 font-medium">
              [ Нажмите <span className="px-3 py-1 bg-[#1E293B] border border-blue-500 text-white rounded font-mono font-bold text-xs select-none">ПРОБЕЛ</span> или область экрана для запуска попытки ]
            </p>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              Шар начнет движение после случайной паузы в 200–500 мс
            </p>
          </div>
        )}

        {(activeTrialState === "motion" || activeTrialState === "occluded" || activeTrialState === "waiting_response") && (
          <div className="text-center">
            <button 
              onClick={triggerSpaceBackup}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-500 focus:outline-none text-white text-xs font-bold tracking-wider font-mono uppercase rounded-full shadow-lg border border-rose-400/20 active:scale-95 transition-all select-none"
            >
              {activeTrialCondition === ExperimentalMode.REACTION_VISIBLE && "🎯 НАЖМИТЕ ПРОБЕЛ (ДЕЖУРНАЯ СКВУШ-КНОПКА)"}
              {activeTrialCondition === ExperimentalMode.TTC && "🎯 НАЖМИТЕ ПРОБЕЛ ПРИ СТОЛКНОВЕНИИ"}
              {activeTrialCondition === ExperimentalMode.INTERVAL_REPRODUCTION && "🎯 ПРОБЕЛ ДЛЯ СТАРТА / СТОПА ВОСПРОИЗВЕДЕНИЯ"}
              {activeTrialCondition === ExperimentalMode.DURATION_REPRODUCTION && "🎯 ЗАЖМИТЕ И УДЕРЖИВАЙТЕ ПРОБЕЛ ДЛЯ ВОСПРОИЗВЕДЕНИЯ"}
            </button>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {activeTrialCondition === ExperimentalMode.REACTION_VISIBLE && "Зафиксируйте реакцию немедленно при появлении стимула."}
              {activeTrialCondition === ExperimentalMode.TTC && "Оцените момент времени, когда шар долетит до вертикальной полосы."}
              {activeTrialCondition === ExperimentalMode.INTERVAL_REPRODUCTION && "Нажмите пробел чтобы начать движение шара, и нажмите пробел второй раз в целевой точке."}
              {activeTrialCondition === ExperimentalMode.DURATION_REPRODUCTION && "Удерживайте пробел нажатым ровно такое же время, какое горел зеленый круг."}
            </p>
          </div>
        )}

        {isPaused && (
          <div className="text-center text-yellow-500 font-bold text-sm">
            ⏸️ ЭКСПЕРИМЕНТАЛЬНАЯ СЕССИЯ ПРИОСТАНОВЛЕНА ИССЛЕДОВАТЕЛЕМ
          </div>
        )}
      </div>
    </div>
  );
}
