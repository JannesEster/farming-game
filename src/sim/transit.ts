import { CONFIG, type GameConfig } from "./config";
import { pointOnPath, planHerdPath, pathLengthKm } from "./path";
import type { GameState, HerdState, TilePoint } from "./types";

export function herdInTransit(herd: HerdState): boolean {
  return herd.transit !== null && herd.transit.progress < 1;
}

export function normalizeHerd(herd: HerdState): HerdState {
  if (!herd.transit) return herd;
  return herd;
}

export function ensureHerdTransit(herd: HerdState): HerdState {
  if (herd.transit !== undefined) return herd;
  return { ...herd, transit: null };
}

export function moveDurationDays(distanceKm: number, config: GameConfig = CONFIG): number {
  const km = Math.max(config.transit.minDistanceKm, distanceKm);
  return Math.max(config.transit.minMoveDays, km / config.transit.walkKmPerGameDay);
}

export function advanceTransit(state: GameState, gameDays: number, config: GameConfig = CONFIG): void {
  const transit = state.herd.transit;
  if (!transit) return;
  const duration = moveDurationDays(transit.distanceKm, config);
  transit.progress = Math.min(1, transit.progress + gameDays / duration);
  if (transit.progress >= 1) finishTransit(state, config);
}

function finishTransit(state: GameState, _config: GameConfig): void {
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

export function transitProgressLabel(herd: HerdState, campName: string): string | null {
  if (!herdInTransit(herd)) return null;
  const pct = Math.round(herd.transit!.progress * 100);
  return `On the way to ${campName} (${pct}%)`;
}
