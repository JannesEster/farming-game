import { moveCampAnimals } from "./animals";
import { addHours } from "./calendar";
import { clamp } from "./math";
import { CONFIG, type GameConfig } from "./config";
import { pointOnPath, planHerdPath, pathLengthKm } from "./path";
import type { GameState, HerdState, TilePoint } from "./types";

export type TransitSpeed = "pause" | "x1" | "x2" | "x3";

function transitSpeedMult(mode: TransitSpeed): number {
  if (mode === "pause") return 0;
  if (mode === "x3") return 3;
  if (mode === "x2") return 2;
  return 1;
}

export function herdInTransit(herd: HerdState): boolean {
  const transit = herd.transit;
  if (!transit) return false;
  if (transit.phase === "approach") return false;
  return transit.progress < 1;
}

export function herdMoveActive(herd: HerdState): boolean {
  const transit = herd.transit;
  if (!transit) return false;
  if (transit.phase === "approach") return (transit.approachProgress ?? 0) < 1;
  return transit.progress < 1;
}

export function walkGameHours(distanceKm: number, config: GameConfig = CONFIG): number {
  const speed = config.transit.walkSpeedKmH;
  return Math.max(0.25, distanceKm / speed);
}

export function moveDurationMs(
  distanceKm: number,
  _mode: TransitSpeed = "x1",
  config: GameConfig = CONFIG,
): number {
  const span = config.transit.maxSpanKm;
  const t = clamp(distanceKm / span, 0, 1);
  const play = config.transit.playMsMin + t * (config.transit.playMsMax - config.transit.playMsMin);
  return play;
}

function applyWalkHours(state: GameState, transit: NonNullable<HerdState["transit"]>): void {
  const target = transit.progress * transit.walkGameHours;
  const delta = target - transit.hoursApplied;
  if (delta <= 0.001) return;
  state.date = addHours(state.date, delta);
  transit.hoursApplied = target;
}

/**
 * The only place herd walk progress advances. Real time by speed mode; pause does nothing.
 */
export function tickTransitRealtime(
  state: GameState,
  deltaMs: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase === "approach" || mode === "pause") return;
  const mult = transitSpeedMult(mode);
  if (mult <= 0) return;
  const duration = moveDurationMs(transit.distanceKm, "x1", config);
  transit.progress = Math.min(1, transit.progress + (deltaMs * mult) / duration);
  applyWalkHours(state, transit);
  if (transit.progress >= 1) finishTransit(state);
}

function finishTransit(state: GameState): void {
  const transit = state.herd.transit;
  if (!transit) return;
  const remainder = transit.walkGameHours - transit.hoursApplied;
  if (remainder > 0.001) {
    state.date = addHours(state.date, remainder);
    transit.hoursApplied = transit.walkGameHours;
  }
  const dest = state.camps.find((c) => c.id === transit.toCampId);
  const fromCampId = state.herd.campId;
  state.herd.campId = transit.toCampId;
  moveCampAnimals(state, fromCampId, transit.toCampId);
  state.herd.daysInCamp = 0;
  state.herd.transit = null;
  if (dest) dest.restDays = 0;
  const story = state.story;
  if (story?.farmerPresence?.onHerdingDuty) story.farmerPresence.onHerdingDuty = false;
  if (story?.farmhandPresence?.onHerdingDuty) story.farmhandPresence.onHerdingDuty = false;
}

export function startHerdMove(state: GameState, toCampId: number, config: GameConfig = CONFIG): void {
  const path = planHerdPath(state, state.herd.campId, toCampId);
  const distanceKm = pathLengthKm(path, config);
  state.herd.transit = {
    toCampId,
    progress: 0,
    distanceKm,
    walkGameHours: walkGameHours(distanceKm, config),
    hoursApplied: 0,
    path,
  };
}

export function herdWorldTile(state: GameState): TilePoint {
  const transit = state.herd.transit;
  if (!transit || transit.path.length === 0) {
    const camp = state.camps.find((c) => c.id === state.herd.campId);
    return camp?.anchor ?? { x: 0, y: 0 };
  }
  return pointOnPath(transit.path, transit.progress);
}

export function pathTangent(state: GameState): { x: number; y: number } {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return { x: 1, y: 0 };
  const p = Math.min(0.99, Math.max(0.01, transit.progress));
  const a = pointOnPath(transit.path, p - 0.01);
  const b = pointOnPath(transit.path, p + 0.01);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
