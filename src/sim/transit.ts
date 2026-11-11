import { clamp } from "./math";
import { CONFIG, type GameConfig } from "./config";
import { pointOnPath, planHerdPath, pathLengthKm } from "./path";
import type { GameState, HerdState, TilePoint } from "./types";

export type TransitSpeed = "pause" | "play" | "fast";

export function herdInTransit(herd: HerdState): boolean {
  return herd.transit !== null && herd.transit.progress < 1;
}

export function moveDurationMs(
  distanceKm: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): number {
  const span = config.transit.maxSpanKm;
  const t = clamp(distanceKm / span, 0, 1);
  if (mode === "fast") {
    return config.transit.fastMsMin + t * (config.transit.fastMsMax - config.transit.fastMsMin);
  }
  return config.transit.playMsMin + t * (config.transit.playMsMax - config.transit.playMsMin);
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
  if (!transit || mode === "pause") return;
  const duration = moveDurationMs(transit.distanceKm, mode, config);
  transit.progress = Math.min(1, transit.progress + deltaMs / duration);
  if (transit.progress >= 1) finishTransit(state);
}

function finishTransit(state: GameState): void {
  const transit = state.herd.transit;
  if (!transit) return;
  const dest = state.camps.find((c) => c.id === transit.toCampId);
  state.herd.campId = transit.toCampId;
  state.herd.daysInCamp = 0;
  state.herd.transit = null;
  if (dest) dest.restDays = 0;
}

export function startHerdMove(state: GameState, toCampId: number, config: GameConfig = CONFIG): void {
  const path = planHerdPath(state, state.herd.campId, toCampId);
  const distanceKm = pathLengthKm(path, config);
  state.herd.transit = {
    toCampId,
    progress: 0,
    distanceKm,
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
