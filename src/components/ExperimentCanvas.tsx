/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from "react";
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
      distance: getDistance(p1, p2),
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
    currSegmentNum = Math.max(0, segments.length - 1);
    leftDistance = segments.length > 0 ? segments[currSegmentNum].distance : 0;
  }

  return { segment: currSegmentNum, position: leftDistance };
}

function getPathPoint(segments: Segment[], distance: number): Point {
  if (segments.length === 0) return { x: 0, y: 0 };
  const pos = findByDistance(segments, distance);
  const curSegment = segments[pos.segment];
  if (!curSegment || curSegment.distance === 0) return curSegment ? curSegment.p1 : { x: 0, y: 0 };

  const strideFrac = pos.position / curSegment.distance;
  const sx = curSegment.p2.x - curSegment.p1.x;
  const sy = curSegment.p2.y - curSegment.p1.y;
  return {
    x: curSegment.p1.x + sx * strideFrac,
    y: curSegment.p1.y + sy * strideFrac,
  };
}

/**
 * Draws a polyline segment within distance range.
 */
function drawPolyline(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  curvePoints: Point[],
  toCanvasX: (x: number) => number,
  toCanvasY: (y: number) => number,
  toCanvasSize: (s: number) => number,
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

  ctx.beginPath();
  ctx.moveTo(toCanvasX(startPt.x), toCanvasY(startPt.y));

  if (startPos.segment === endPos.segment) {
    ctx.lineTo(toCanvasX(endPt.x), toCanvasY(endPt.y));
  } else {
    ctx.lineTo(toCanvasX(segments[startPos.segment].p2.x), toCanvasY(segments[startPos.segment].p2.y));
    for (let i = startPos.segment + 1; i < endPos.segment; i++) {
      ctx.lineTo(toCanvasX(segments[i].p2.x), toCanvasY(segments[i].p2.y));
    }
    ctx.lineTo(toCanvasX(endPt.x), toCanvasY(endPt.y));
  }
  ctx.stroke();

  // Draw vertices along this segment
  const savedDash = ctx.getLineDash();
  ctx.setLineDash([]);
  let accumDist = 0;
  for (let i = 0; i < curvePoints.length; i++) {
    if (i > 0) {
      accumDist += segments[i - 1].distance;
    }
    if (accumDist >= fromDistance - 1 && accumDist <= actualToDist + 1) {
      const pt = curvePoints[i];
      ctx.beginPath();
      ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), toCanvasSize(4), 0, Math.PI * 2);
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

  // Zustand State
  const currentMode = useLabStore((s) => s.currentMode);
  const activeTrialCondition = useLabStore((s) => s.activeTrialCondition);
  const activeTrialState = useLabStore((s) => s.activeTrialState);
  const activeSpeed = useLabStore((s) => s.activeSpeed);
  const activeDuration = useLabStore((s) => s.activeDuration);
  const activeTrajectoryIndex = useLabStore((s) => s.activeTrajectoryIndex);
  const isPaused = useLabStore((s) => s.isPaused);
  const setTrialState = useLabStore((s) => s.setTrialState);
  const logSystemMessage = useLabStore((s) => s.logSystemMessage);

  // Holding state for UI button
  const [isHoldingState, setIsHoldingState] = useState(false);

  // Mutable reference for 60fps / 120fps render loop
  const stateRef = useRef({
    activeTrialState,
    currentMode,
    activeTrialCondition,
    activeSpeed,
    activeDuration,
    activeTrajectoryIndex: activeTrajectoryIndex ?? 0,
    isPaused,
    startTime: 0,
    userPressTime: 0,
    hasResponded: false,
    reproActive: false,
    reproStartTime: 0,
    // Condition 4: Hold Space Duration
    isHoldingSpace: false,
    holdStartTime: 0,
    lastRecordedTime: 0,
    frozenPos: null as Point | null,
  });

  // Sync state with React state changes
  useEffect(() => {
    stateRef.current.activeTrialState = activeTrialState;
    stateRef.current.currentMode = currentMode;
    stateRef.current.activeTrialCondition = activeTrialCondition;
    stateRef.current.activeSpeed = activeSpeed;
    stateRef.current.activeDuration = activeDuration;
    stateRef.current.activeTrajectoryIndex = activeTrajectoryIndex ?? 0;
    stateRef.current.isPaused = isPaused;
  }, [activeTrialState, currentMode, activeTrialCondition, activeSpeed, activeDuration, activeTrajectoryIndex, isPaused]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      if (stateRef.current.isPaused) {
        animationId = requestAnimationFrame(render);
        return;
      }

      // Handle High DPI and dynamic resizing without distortion
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;

      // Virtual Coordinate System (700 x 400)
      const virtualW = 700;
      const virtualH = 400;
      const uniformScale = Math.min(w / virtualW, h / virtualH);
      const offsetX = (w - virtualW * uniformScale) / 2;
      const offsetY = (h - virtualH * uniformScale) / 2;

      const toCanvasX = (x: number) => offsetX + x * uniformScale;
      const toCanvasY = (y: number) => offsetY + y * uniformScale;
      const toCanvasSize = (s: number) => s * uniformScale;

      ctx.clearRect(0, 0, w, h);

      // 1. Scientific coordinate grid
      ctx.strokeStyle = "rgba(40, 80, 180, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= 700; x += 50) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x), toCanvasY(0));
        ctx.lineTo(toCanvasX(x), toCanvasY(400));
        ctx.stroke();
      }
      for (let y = 0; y <= 400; y += 50) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(0), toCanvasY(y));
        ctx.lineTo(toCanvasX(700), toCanvasY(y));
        ctx.stroke();
      }

      // 2. Safe border
      ctx.strokeStyle = "rgba(80, 120, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(toCanvasX(5), toCanvasY(5), toCanvasSize(690), toCanvasSize(390));

      // Active state and condition
      const activeState = stateRef.current.activeTrialState;
      const condition = stateRef.current.activeTrialCondition;
      const duration = stateRef.current.activeDuration; // Ti (800, 1700, 3100 ms)
      const curveIndex = Math.abs(stateRef.current.activeTrajectoryIndex ?? 0) % UNIQUE_CURVES.length;
      const curvePoints = UNIQUE_CURVES[curveIndex];
      const segments = pointsToSegments(curvePoints);
      const totalDistance = getTotalDistance(segments);

      // =========================================================================
      // CONDITION 1: REACTION_VISIBLE (5.2.1 Реакция на движение с вылетом за цель)
      // =========================================================================
      if (condition === ExperimentalMode.REACTION_VISIBLE) {
        // Target arrival time: 600ms input segment + Ti
        const targetTimeMs = 600 + duration;
        // Overshoot extension time: ball continues past target for 900ms
        const overshootTimeMs = 900;
        const totalMotionTimeMs = targetTimeMs + overshootTimeMs;

        // Target point is placed at fraction: targetTimeMs / totalMotionTimeMs
        const targetDistance = (targetTimeMs / totalMotionTimeMs) * totalDistance;
        const startPt = getPathPoint(segments, 0);
        const targetPt = getPathPoint(segments, targetDistance);
        const finishPt = getPathPoint(segments, totalDistance);

        // Start marker
        ctx.fillStyle = "#3B82F6";
        ctx.fillRect(toCanvasX(startPt.x - 3), toCanvasY(startPt.y - 25), toCanvasSize(6), toCanvasSize(50));
        ctx.font = `bold ${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
        ctx.fillText("СТАРТ", toCanvasX(startPt.x - 18), toCanvasY(startPt.y - 32));

        // 1. Draw Full Polyline Trajectory (pre-target and post-target overshoot)
        ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
        ctx.fillStyle = "#3B82F6";
        ctx.lineWidth = toCanvasSize(3.2);
        drawPolyline(ctx, segments, curvePoints, toCanvasX, toCanvasY, toCanvasSize, 0, totalDistance);

        // Highlight main target segment with solid blue
        ctx.strokeStyle = "#3B82F6";
        drawPolyline(ctx, segments, curvePoints, toCanvasX, toCanvasY, toCanvasSize, 0, targetDistance);

        // Highlight overshoot segment with subtle dashed/amber warning line
        ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
        ctx.setLineDash([4, 4]);
        drawPolyline(ctx, segments, curvePoints, toCanvasX, toCanvasY, toCanvasSize, targetDistance, totalDistance);
        ctx.setLineDash([]);

        // Target Marker (Red Crosshair + Bullseye) at targetDistance
        ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
        ctx.beginPath();
        ctx.arc(toCanvasX(targetPt.x), toCanvasY(targetPt.y), toCanvasSize(18), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(toCanvasX(targetPt.x), toCanvasY(targetPt.y), toCanvasSize(10), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = toCanvasSize(2);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(toCanvasX(targetPt.x), toCanvasY(targetPt.y), toCanvasSize(3.5), 0, Math.PI * 2);
        ctx.fill();

        // Crosshairs
        ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
        ctx.lineWidth = toCanvasSize(1.5);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(targetPt.x - 20), toCanvasY(targetPt.y));
        ctx.lineTo(toCanvasX(targetPt.x + 20), toCanvasY(targetPt.y));
        ctx.moveTo(toCanvasX(targetPt.x), toCanvasY(targetPt.y - 20));
        ctx.lineTo(toCanvasX(targetPt.x), toCanvasY(targetPt.y + 20));
        ctx.stroke();

        // Target text
        ctx.fillStyle = "#F87171";
        ctx.font = `bold ${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
        ctx.fillText("ЦЕЛЬ", toCanvasX(targetPt.x - 14), toCanvasY(targetPt.y - 24));

        // Motion physics
        if (activeState === "motion" || activeState === "waiting_response") {
          const elapsed = performance.now() - stateRef.current.startTime;
          const elapsedFraction = Math.min(1.0, elapsed / totalMotionTimeMs);
          const currentDistance = elapsedFraction * totalDistance;
          const currentPos = stateRef.current.frozenPos || getPathPoint(segments, currentDistance);

          // Render moving ball
          const grad = ctx.createRadialGradient(
            toCanvasX(currentPos.x),
            toCanvasY(currentPos.y),
            toCanvasSize(1),
            toCanvasX(currentPos.x),
            toCanvasY(currentPos.y),
            toCanvasSize(18)
          );
          grad.addColorStop(0, "#FFFFFF");
          grad.addColorStop(0.35, "#3B82F6");
          grad.addColorStop(1, "rgba(59, 130, 246, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(toCanvasX(currentPos.x), toCanvasY(currentPos.y), toCanvasSize(20), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#93C5FD";
          ctx.lineWidth = toCanvasSize(2.5);
          ctx.beginPath();
          ctx.arc(toCanvasX(currentPos.x), toCanvasY(currentPos.y), toCanvasSize(11), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // If reached end of overshoot without press, automatically finish
          if (elapsed >= totalMotionTimeMs && !stateRef.current.hasResponded) {
            stateRef.current.hasResponded = true;
            setTimeout(() => onTrialComplete(totalMotionTimeMs), 0);
          }
        }
      }

      // =========================================================================
      // CONDITION 2: TTC (5.2.2 Оценка времени до столкновения через экран окклюзии)
      // =========================================================================
      else if (condition === ExperimentalMode.TTC) {
        const targetTimeMs = 600 + duration;
        const visibleFraction = 600 / targetTimeMs;
        const visibleDistance = visibleFraction * totalDistance;

        const startPt = getPathPoint(segments, 0);
        const targetPt = getPathPoint(segments, totalDistance);

        // Start marker
        ctx.fillStyle = "#3B82F6";
        ctx.fillRect(toCanvasX(startPt.x - 3), toCanvasY(startPt.y - 25), toCanvasSize(6), toCanvasSize(50));
        ctx.font = `bold ${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
        ctx.fillText("СТАРТ", toCanvasX(startPt.x - 18), toCanvasY(startPt.y - 32));

        // Visible trajectory section
        ctx.strokeStyle = "#3B82F6";
        ctx.fillStyle = "#60A5FA";
        ctx.lineWidth = toCanvasSize(3.2);
        drawPolyline(ctx, segments, curvePoints, toCanvasX, toCanvasY, toCanvasSize, 0, visibleDistance);

        // Bounding box of occluded zone in virtual coordinates
        const occludedPoints: Point[] = [];
        for (let d = visibleDistance; d <= totalDistance; d += 6) {
          occludedPoints.push(getPathPoint(segments, d));
        }
        occludedPoints.push(targetPt);

        const xs = occludedPoints.map((p) => p.x);
        const ys = occludedPoints.map((p) => p.y);
        const minX = Math.max(10, Math.min(...xs) - 30);
        const maxX = Math.min(690, Math.max(...xs) + 30);
        const minY = Math.max(10, Math.min(...ys) - 35);
        const maxY = Math.min(390, Math.max(...ys) + 35);

        const boxW = maxX - minX;
        const boxH = maxY - minY;

        // Draw Occlusion Screen
        ctx.fillStyle = "rgba(11, 19, 43, 0.95)";
        ctx.fillRect(toCanvasX(minX), toCanvasY(minY), toCanvasSize(boxW), toCanvasSize(boxH));

        ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
        ctx.lineWidth = toCanvasSize(1.5);
        ctx.strokeRect(toCanvasX(minX), toCanvasY(minY), toCanvasSize(boxW), toCanvasSize(boxH));

        // Occlusion Header Bar
        ctx.fillStyle = "rgba(30, 58, 138, 0.7)";
        ctx.fillRect(toCanvasX(minX), toCanvasY(minY), toCanvasSize(boxW), toCanvasSize(22));
        ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
        ctx.lineWidth = toCanvasSize(1);
        ctx.strokeRect(toCanvasX(minX), toCanvasY(minY), toCanvasSize(boxW), toCanvasSize(22));

        ctx.fillStyle = "#93C5FD";
        ctx.font = `bold ${Math.round(toCanvasSize(10))}px "JetBrains Mono", monospace`;
        ctx.fillText("ЗОНА ОККЛЮЗИИ (СКРЫТОЕ ДВИЖЕНИЕ)", toCanvasX(minX + 10), toCanvasY(minY + 15));

        // Entry barrier
        const occludeEntryPt = getPathPoint(segments, visibleDistance);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.lineWidth = toCanvasSize(2);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(occludeEntryPt.x), toCanvasY(occludeEntryPt.y - 20));
        ctx.lineTo(toCanvasX(occludeEntryPt.x), toCanvasY(occludeEntryPt.y + 20));
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#FBBF24";
        ctx.font = `bold ${Math.round(toCanvasSize(9))}px "JetBrains Mono", monospace`;
        ctx.fillText("ВХОД", toCanvasX(occludeEntryPt.x - 12), toCanvasY(occludeEntryPt.y - 25));

        // Dashed trajectory path inside occluder
        ctx.strokeStyle = "rgba(147, 197, 253, 0.75)";
        ctx.fillStyle = "#38BDF8";
        ctx.lineWidth = toCanvasSize(2.2);
        ctx.setLineDash([6, 6]);
        drawPolyline(ctx, segments, curvePoints, toCanvasX, toCanvasY, toCanvasSize, visibleDistance, totalDistance);
        ctx.setLineDash([]);

        // Intermediate guide dots
        const occludedLength = totalDistance - visibleDistance;
        const numSteps = Math.max(3, Math.floor(occludedLength / 35));
        for (let s = 1; s <= numSteps; s++) {
          const d = visibleDistance + s * (occludedLength / (numSteps + 1));
          const pt = getPathPoint(segments, d);
          ctx.fillStyle = "rgba(147, 197, 253, 0.85)";
          ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
          ctx.lineWidth = toCanvasSize(1.5);
          ctx.beginPath();
          ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), toCanvasSize(3.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Target Finish Point
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(toCanvasX(targetPt.x), toCanvasY(targetPt.y), toCanvasSize(12), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = toCanvasSize(2);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(toCanvasX(targetPt.x), toCanvasY(targetPt.y), toCanvasSize(4), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
        ctx.lineWidth = toCanvasSize(1.5);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(targetPt.x - 18), toCanvasY(targetPt.y));
        ctx.lineTo(toCanvasX(targetPt.x + 18), toCanvasY(targetPt.y));
        ctx.moveTo(toCanvasX(targetPt.x), toCanvasY(targetPt.y - 18));
        ctx.lineTo(toCanvasX(targetPt.x), toCanvasY(targetPt.y + 18));
        ctx.stroke();

        ctx.fillStyle = "#F87171";
        ctx.font = `bold ${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
        ctx.fillText("ЦЕЛЬ", toCanvasX(targetPt.x - 14), toCanvasY(targetPt.y - 22));

        // Motion physics
        if (activeState === "motion" || activeState === "occluded" || activeState === "waiting_response") {
          const elapsed = performance.now() - stateRef.current.startTime;
          const currentDistance = Math.min(totalDistance, (elapsed / targetTimeMs) * totalDistance);
          const currentPos = getPathPoint(segments, currentDistance);

          if (currentDistance >= visibleDistance && activeState === "motion") {
            setTimeout(() => setTrialState("occluded"), 0);
          }

          if (elapsed >= targetTimeMs && (activeState === "motion" || activeState === "occluded")) {
            setTimeout(() => setTrialState("waiting_response"), 0);
          }

          // Ball is ONLY visible before reaching occlusion entry
          if (activeState === "motion" && currentDistance <= visibleDistance) {
            const grad = ctx.createRadialGradient(
              toCanvasX(currentPos.x),
              toCanvasY(currentPos.y),
              toCanvasSize(1),
              toCanvasX(currentPos.x),
              toCanvasY(currentPos.y),
              toCanvasSize(18)
            );
            grad.addColorStop(0, "#FFFFFF");
            grad.addColorStop(0.35, "#3B82F6");
            grad.addColorStop(1, "rgba(59, 130, 246, 0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(toCanvasX(currentPos.x), toCanvasY(currentPos.y), toCanvasSize(20), 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#93C5FD";
            ctx.lineWidth = toCanvasSize(2.5);
            ctx.beginPath();
            ctx.arc(toCanvasX(currentPos.x), toCanvasY(currentPos.y), toCanvasSize(11), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          // Auto-timeout if user doesn't press space within +1800ms
          if (elapsed >= targetTimeMs + 1800 && !stateRef.current.hasResponded) {
            stateRef.current.hasResponded = true;
            setTimeout(() => onTrialComplete(targetTimeMs + 1800), 0);
          }
        }
      }

      // =========================================================================
      // CONDITION 3: INTERVAL_REPRODUCTION (5.2.3 Отмеривание времени движения)
      // =========================================================================
      else if (condition === ExperimentalMode.INTERVAL_REPRODUCTION) {
        if (activeState === "motion") {
          // Part 1: Visible trajectory demonstration
          ctx.strokeStyle = "rgba(80, 120, 255, 0.4)";
          ctx.fillStyle = "#3B82F6";
          ctx.lineWidth = toCanvasSize(2.5);
          drawPolyline(ctx, segments, curvePoints, toCanvasX, toCanvasY, toCanvasSize, 0, totalDistance);

          const startPt = getPathPoint(segments, 0);
          ctx.fillStyle = "#3B82F6";
          ctx.fillRect(toCanvasX(startPt.x - 2), toCanvasY(startPt.y - 25), toCanvasSize(4), toCanvasSize(50));
          ctx.font = `bold ${Math.round(toCanvasSize(10))}px "JetBrains Mono", monospace`;
          ctx.fillText("СТАРТ", toCanvasX(startPt.x - 16), toCanvasY(startPt.y - 32));

          const targetPt = getPathPoint(segments, totalDistance);
          ctx.fillStyle = "#A855F7";
          ctx.beginPath();
          ctx.arc(toCanvasX(targetPt.x), toCanvasY(targetPt.y), toCanvasSize(10), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = toCanvasSize(2);
          ctx.stroke();
          ctx.fillText("ФИНИШ", toCanvasX(targetPt.x - 18), toCanvasY(targetPt.y - 18));

          const elapsed = performance.now() - stateRef.current.startTime;
          const currentDistance = Math.min(totalDistance, (elapsed / duration) * totalDistance);
          const currentPos = getPathPoint(segments, currentDistance);

          // Moving sphere
          const grad = ctx.createRadialGradient(
            toCanvasX(currentPos.x),
            toCanvasY(currentPos.y),
            toCanvasSize(1),
            toCanvasX(currentPos.x),
            toCanvasY(currentPos.y),
            toCanvasSize(16)
          );
          grad.addColorStop(0, "#FFFFFF");
          grad.addColorStop(0.35, "#8B5CF6");
          grad.addColorStop(1, "rgba(139, 92, 246, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(toCanvasX(currentPos.x), toCanvasY(currentPos.y), toCanvasSize(18), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#C4B5FD";
          ctx.lineWidth = toCanvasSize(2.5);
          ctx.beginPath();
          ctx.arc(toCanvasX(currentPos.x), toCanvasY(currentPos.y), toCanvasSize(10), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Title
          ctx.fillStyle = "#C4B5FD";
          ctx.font = `bold ${Math.round(toCanvasSize(12))}px "JetBrains Mono", monospace`;
          ctx.fillText(`ЧАСТЬ 1: НАБЛЮДЕНИЕ ИНТЕРВАЛА (Ti = ${duration} мс)`, toCanvasX(140), toCanvasY(40));

          if (elapsed >= duration) {
            setTimeout(() => {
              logSystemMessage("Эталон показан. Нажмите ПРОБЕЛ для старта отсчета, затем повторно ПРОБЕЛ для фиксации.");
              setTrialState("waiting_response");
            }, 0);
          }
        } else if (activeState === "waiting_response") {
          // Part 2: Centered Black Ball
          const centerX = toCanvasX(350);
          const centerY = toCanvasY(200);
          const ballRadius = toCanvasSize(24);

          ctx.fillStyle = "#93C5FD";
          ctx.font = `bold ${Math.round(toCanvasSize(13))}px "JetBrains Mono", monospace`;
          ctx.fillText("ЧАСТЬ 2: ВОСПРОИЗВЕДЕНИЕ ИНТЕРВАЛА", toCanvasX(210), toCanvasY(50));

          if (stateRef.current.reproActive) {
            const elapsedRepro = performance.now() - stateRef.current.reproStartTime;

            const pulse = 1 + 0.08 * Math.sin(performance.now() / 120);
            ctx.strokeStyle = "#38BDF8";
            ctx.lineWidth = toCanvasSize(3);
            ctx.beginPath();
            ctx.arc(centerX, centerY, (ballRadius + toCanvasSize(10)) * pulse, 0, Math.PI * 2);
            ctx.stroke();

            // Black ball with white border
            ctx.fillStyle = "#0A0F1D";
            ctx.beginPath();
            ctx.arc(centerX, centerY, ballRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = toCanvasSize(3);
            ctx.stroke();

            ctx.fillStyle = "#38BDF8";
            ctx.font = `bold ${Math.round(toCanvasSize(14))}px "JetBrains Mono", monospace`;
            ctx.fillText(
              `ИДЁТ ОТСЧЁТ: ${(elapsedRepro / 1000).toFixed(2)} с (${elapsedRepro.toFixed(0)} мс)`,
              toCanvasX(200),
              toCanvasY(320)
            );
            ctx.fillStyle = "#94A3B8";
            ctx.font = `${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
            ctx.fillText("[ Нажмите ПРОБЕЛ для фиксации окончания интервала ]", toCanvasX(150), toCanvasY(350));

            if (elapsedRepro > 8000) {
              stateRef.current.reproActive = false;
              setTimeout(() => onTrialComplete(elapsedRepro), 0);
            }
          } else {
            // Idle Black Ball waiting for start
            ctx.fillStyle = "#0A0F1D";
            ctx.beginPath();
            ctx.arc(centerX, centerY, ballRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = toCanvasSize(3);
            ctx.stroke();

            ctx.fillStyle = "#60A5FA";
            ctx.font = `bold ${Math.round(toCanvasSize(12))}px "JetBrains Mono", monospace`;
            ctx.fillText(
              "Нажмите ПРОБЕЛ для старта отсчета, затем повторно ПРОБЕЛ для фиксации",
              toCanvasX(100),
              toCanvasY(320)
            );
          }
        }
      }

      // =========================================================================
      // CONDITION 4: DURATION_REPRODUCTION (5.2.4 Воспроизведение длительности свечения фигуры)
      // Phase 1: Glowing luminous figure shown for Ti (800, 1700, 3100 ms)
      // Phase 2: Hold Spacebar / Button for the same duration, release when done
      // =========================================================================
      else if (condition === ExperimentalMode.DURATION_REPRODUCTION) {
        const centerX = toCanvasX(350);
        const centerY = toCanvasY(200);

        if (activeState === "motion") {
          const elapsed = performance.now() - stateRef.current.startTime;

          // Single Glowing Radiant Figure
          const orbRadius = toCanvasSize(28);
          const pulse = 1 + 0.05 * Math.sin(performance.now() / 150);

          // Outer aura glow
          const grad = ctx.createRadialGradient(
            centerX,
            centerY,
            toCanvasSize(2),
            centerX,
            centerY,
            orbRadius * 2.2 * pulse
          );
          grad.addColorStop(0, "rgba(255, 255, 255, 1)");
          grad.addColorStop(0.25, "rgba(16, 185, 129, 0.95)");
          grad.addColorStop(0.6, "rgba(5, 150, 105, 0.4)");
          grad.addColorStop(1, "rgba(16, 185, 129, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbRadius * 2.2 * pulse, 0, Math.PI * 2);
          ctx.fill();

          // Inner solid glowing circle
          ctx.fillStyle = "#10B981";
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#A7F3D0";
          ctx.lineWidth = toCanvasSize(3);
          ctx.stroke();

          // Center bright core
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbRadius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          // Title & Presentation timer
          ctx.fillStyle = "#6EE7B7";
          ctx.font = `bold ${Math.round(toCanvasSize(13))}px "JetBrains Mono", monospace`;
          ctx.fillText(`ЭТАЛОН СВЕЧЕНИЯ ФИГУРЫ (Ti = ${duration} мс)`, toCanvasX(170), toCanvasY(50));
          ctx.fillStyle = "#A7F3D0";
          ctx.font = `${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
          ctx.fillText(`Запоминайте время свечения фигуры...`, toCanvasX(210), toCanvasY(320));

          if (elapsed >= duration) {
            setTimeout(() => {
              logSystemMessage("Эталон завершен. Зажмите и удерживайте ПРОБЕЛ на такую же длительность, затем отпустите.");
              setTrialState("waiting_response");
            }, 0);
          }
        } else if (activeState === "waiting_response") {
          const orbRadius = toCanvasSize(28);

          ctx.fillStyle = "#FBBF24";
          ctx.font = `bold ${Math.round(toCanvasSize(13))}px "JetBrains Mono", monospace`;
          ctx.fillText("ВОСПРОИЗВЕДЕНИЕ ДЛИТЕЛЬНОСТИ", toCanvasX(210), toCanvasY(50));

          if (stateRef.current.isHoldingSpace) {
            // Actively being held down
            const elapsedHold = performance.now() - stateRef.current.holdStartTime;
            const pulse = 1 + 0.08 * Math.sin(performance.now() / 100);

            // Active golden radiant glow
            const grad = ctx.createRadialGradient(
              centerX,
              centerY,
              toCanvasSize(2),
              centerX,
              centerY,
              orbRadius * 2.2 * pulse
            );
            grad.addColorStop(0, "rgba(255, 255, 255, 1)");
            grad.addColorStop(0.3, "rgba(245, 158, 11, 0.95)");
            grad.addColorStop(0.7, "rgba(217, 119, 6, 0.4)");
            grad.addColorStop(1, "rgba(245, 158, 11, 0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, orbRadius * 2.2 * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#F59E0B";
            ctx.beginPath();
            ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "#FEF3C7";
            ctx.lineWidth = toCanvasSize(3);
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(centerX, centerY, orbRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Active elapsed counter
            ctx.fillStyle = "#FBBF24";
            ctx.font = `bold ${Math.round(toCanvasSize(14))}px "JetBrains Mono", monospace`;
            ctx.fillText(
              `УДЕРЖАНИЕ: ${(elapsedHold / 1000).toFixed(2)} с (${elapsedHold.toFixed(0)} мс)`,
              toCanvasX(200),
              toCanvasY(320)
            );
            ctx.fillStyle = "#94A3B8";
            ctx.font = `${Math.round(toCanvasSize(11))}px "JetBrains Mono", monospace`;
            ctx.fillText("[ Отпустите ПРОБЕЛ для завершения ]", toCanvasX(200), toCanvasY(350));

            // Safety limit
            if (elapsedHold > 8000) {
              stateRef.current.isHoldingSpace = false;
              setIsHoldingState(false);
              setTimeout(() => onTrialComplete(elapsedHold), 0);
            }
          } else {
            // Resting state waiting for user to hold space
            ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
            ctx.beginPath();
            ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
            ctx.lineWidth = toCanvasSize(2.5);
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = "#FDE68A";
            ctx.font = `bold ${Math.round(toCanvasSize(12))}px "JetBrains Mono", monospace`;
            ctx.fillText(
              "Зажмите и УДЕРЖИВАЙТЕ ПРОБЕЛ на такую же длительность, затем отпустите",
              toCanvasX(60),
              toCanvasY(320)
            );
          }
        }
      }

      // Blank delay screen
      if (activeState === "blank_delay") {
        ctx.fillStyle = "rgba(10, 20, 30, 0.85)";
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "#F59E0B";
        ctx.font = `bold ${Math.round(toCanvasSize(13))}px "JetBrains Mono", monospace`;
        ctx.fillText("➕ ПАУЗА ПЕРЕД СИГНАЛОМ (ФОКУСИРУЙТЕСЬ)", toCanvasX(170), toCanvasY(200));
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [onTrialComplete, isPaused, setTrialState, logSystemMessage]);

  // Start trial handler
  const startTrial = useCallback(() => {
    setTrialState("blank_delay");
    stateRef.current.frozenPos = null;
    stateRef.current.hasResponded = false;
    stateRef.current.reproActive = false;
    stateRef.current.isHoldingSpace = false;
    setIsHoldingState(false);

    const delay = 200 + Math.random() * 300;
    setTimeout(() => {
      setTrialState("motion");
      stateRef.current.startTime = performance.now();
    }, delay);
  }, [setTrialState]);

  // Handle Space Down / Hold Start
  const handleKeyDownAction = useCallback(() => {
    const activeState = stateRef.current.activeTrialState;
    const condition = stateRef.current.activeTrialCondition;

    // 1. Kick off trial from idle
    if (activeState === "idle") {
      startTrial();
      return;
    }

    // 2. Space action for REACTION_VISIBLE & TTC (Single instantaneous click / press)
    if (activeState === "motion" || activeState === "occluded" || activeState === "waiting_response") {
      if (condition === ExperimentalMode.REACTION_VISIBLE || condition === ExperimentalMode.TTC) {
        if (stateRef.current.hasResponded) return;
        stateRef.current.hasResponded = true;
        const elapsed = performance.now() - stateRef.current.startTime;

        // Calculate frozen position on curve
        const duration = stateRef.current.activeDuration;
        const curveIndex = Math.abs(stateRef.current.activeTrajectoryIndex ?? 0) % UNIQUE_CURVES.length;
        const segments = pointsToSegments(UNIQUE_CURVES[curveIndex]);
        const totalDistance = getTotalDistance(segments);

        if (condition === ExperimentalMode.REACTION_VISIBLE) {
          const totalMotionTimeMs = 600 + duration + 900;
          const currentDistance = Math.min(totalDistance, (elapsed / totalMotionTimeMs) * totalDistance);
          stateRef.current.frozenPos = getPathPoint(segments, currentDistance);
        }

        onTrialComplete(elapsed);
        return;
      }
    }

    // 3. Space action for INTERVAL_REPRODUCTION (1st press = start, 2nd press = stop)
    if (activeState === "waiting_response" && condition === ExperimentalMode.INTERVAL_REPRODUCTION) {
      if (!stateRef.current.reproActive) {
        stateRef.current.reproActive = true;
        stateRef.current.reproStartTime = performance.now();
        logSystemMessage("Отсчет интервала запущен. Нажмите ПРОБЕЛ для фиксации окончания.");
      } else {
        stateRef.current.reproActive = false;
        stateRef.current.hasResponded = true;
        const elapsed = performance.now() - stateRef.current.reproStartTime;
        logSystemMessage(`Интервал зафиксирован: ${elapsed.toFixed(0)} мс`);
        onTrialComplete(elapsed);
      }
      return;
    }

    // 4. Space action for DURATION_REPRODUCTION (Hold down space)
    if (activeState === "waiting_response" && condition === ExperimentalMode.DURATION_REPRODUCTION) {
      if (!stateRef.current.isHoldingSpace) {
        stateRef.current.isHoldingSpace = true;
        stateRef.current.holdStartTime = performance.now();
        setIsHoldingState(true);
      }
    }
  }, [startTrial, onTrialComplete, logSystemMessage]);

  // Handle Space Up / Hold Release (Condition 4)
  const handleKeyUpAction = useCallback(() => {
    const activeState = stateRef.current.activeTrialState;
    const condition = stateRef.current.activeTrialCondition;

    if (activeState === "waiting_response" && condition === ExperimentalMode.DURATION_REPRODUCTION) {
      if (stateRef.current.isHoldingSpace) {
        stateRef.current.isHoldingSpace = false;
        setIsHoldingState(false);
        const holdDuration = performance.now() - stateRef.current.holdStartTime;
        stateRef.current.hasResponded = true;
        logSystemMessage(`Длительность удержания: ${holdDuration.toFixed(0)} мс`);
        onTrialComplete(holdDuration);
      }
    }
  }, [onTrialComplete, logSystemMessage]);

  // Global Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return;
      handleKeyDownAction();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      e.preventDefault();
      handleKeyUpAction();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDownAction, handleKeyUpAction]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between">
      {/* Top Banner */}
      <div className="w-full flex justify-between items-center px-4 py-2 bg-[#0F1B2D]/90 border border-blue-500/20 rounded-t-lg shadow-md z-10 backdrop-blur-md mb-2">
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

      {/* Main Canvas Stage */}
      <div
        className="w-full h-[320px] sm:h-[350px] bg-[#050B17] rounded-lg overflow-hidden border border-[rgba(80,120,255,0.15)] flex justify-center items-center relative select-none"
        onMouseDown={handleKeyDownAction}
        onMouseUp={handleKeyUpAction}
        onTouchStart={handleKeyDownAction}
        onTouchEnd={handleKeyUpAction}
      >
        <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />
      </div>

      {/* Helper Interaction Controls */}
      <div className="w-full py-3 px-2 flex flex-col items-center gap-2">
        {activeTrialState === "idle" && (
          <button
            onClick={startTrial}
            className="w-full max-w-md py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-mono font-bold text-xs rounded-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse"
          >
            <span>[ НАЖМИТЕ ПРОБЕЛ ИЛИ ЗДЕСЬ ДЛЯ ЗАПУСКА ПРОБЫ ]</span>
          </button>
        )}

        {(activeTrialState === "motion" || activeTrialState === "occluded") && (
          <div className="text-center">
            {activeTrialCondition === ExperimentalMode.REACTION_VISIBLE && (
              <p className="text-sm text-blue-300 font-medium">
                Поймайте шар в целевой точке нажатием <span className="px-2 py-0.5 bg-blue-900/60 border border-blue-400 text-white rounded font-mono text-xs">ПРОБЕЛ</span> (шар продолжает движение дальше цели)
              </p>
            )}
            {activeTrialCondition === ExperimentalMode.TTC && (
              <p className="text-sm text-amber-300 font-medium">
                Оцените момент столкновения с целью и нажмите <span className="px-2 py-0.5 bg-amber-900/60 border border-amber-400 text-white rounded font-mono text-xs">ПРОБЕЛ</span>
              </p>
            )}
            {activeTrialCondition === ExperimentalMode.INTERVAL_REPRODUCTION && (
              <p className="text-sm text-purple-300 font-medium">
                Запоминайте интервал движения стимула по траектории...
              </p>
            )}
            {activeTrialCondition === ExperimentalMode.DURATION_REPRODUCTION && (
              <p className="text-sm text-emerald-300 font-medium">
                Запоминайте длительность свечения фигуры...
              </p>
            )}
          </div>
        )}

        {activeTrialState === "waiting_response" && (
          <div className="w-full max-w-md flex flex-col items-center gap-2">
            {activeTrialCondition === ExperimentalMode.DURATION_REPRODUCTION ? (
              <button
                onMouseDown={handleKeyDownAction}
                onMouseUp={handleKeyUpAction}
                onTouchStart={handleKeyDownAction}
                onTouchEnd={handleKeyUpAction}
                className={`w-full py-3 px-4 font-mono font-bold text-xs rounded-lg border transition-all select-none cursor-pointer ${
                  isHoldingState
                    ? "bg-amber-600 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[0.99]"
                    : "bg-[#111e38] border-amber-500/40 text-amber-300 hover:border-amber-400"
                }`}
              >
                {isHoldingState
                  ? "● УДЕРЖИВАЕТСЯ... ОТПУСТИТЕ ДЛЯ ЗАВЕРШЕНИЯ"
                  : "ЗАЖМИТЕ И УДЕРЖИВАЙТЕ ПРОБЕЛ (ИЛИ ЭТУ КНОПКУ) НА ТАКУЮ ЖЕ ДЛИТЕЛЬНОСТЬ"}
              </button>
            ) : activeTrialCondition === ExperimentalMode.INTERVAL_REPRODUCTION ? (
              <button
                onClick={handleKeyDownAction}
                className="w-full py-2.5 px-4 bg-[#111e38] border border-blue-500/40 hover:border-blue-400 text-cyan-300 font-mono font-bold text-xs rounded-lg shadow-md transition-all cursor-pointer"
              >
                {stateRef.current.reproActive
                  ? "ОТСЧЕТ ИДЕТ... НАЖМИТЕ ПРОБЕЛ ДЛЯ ФИКСАЦИИ"
                  : "НАЖМИТЕ ПРОБЕЛ ДЛЯ СТАРТА ОТСЧЕТА"}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
