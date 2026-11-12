import { isDaylightHour } from "./clock";
import { CONFIG, type GameConfig } from "./config";
import { findCamp } from "./simulation";
import { farmerDisplayName } from "./playerName";
import { STEP3A } from "./step3aConfig";
import { mainHouseTile, workerHouseForFarmhand } from "./housing";
import { herdInTransit, tickTransitRealtime, walkGameHours, type TransitSpeed } from "./transit";
import { herderPathProgressBehindTail } from "./convoy";
import { pointOnPath, planHerdPath, pathLengthKm } from "./path";
import type { GameState, HerdTransit, TilePoint } from "./types";
import type { PersonPresence } from "./storyTypes";
import type { HerderId } from "./types";

function ensureTransitFields(transit: HerdTransit): void {
  if (!transit.phase) transit.phase = "drive";
  if (!transit.herder) transit.herder = "farmer";
  if (transit.approachProgress === undefined) transit.approachProgress = transit.phase === "approach" ? 0 : 1;
}

export function activeHerder(state: GameState): HerderId | null {
  const transit = state.herd.transit;
  if (transit && transit.phase) {
    ensureTransitFields(transit);
    return transit.herder ?? null;
  }
  return null;
}

export function herderIsBusy(state: GameState): HerderId | null {
  const t = state.herd.transit;
  if (!t) return null;
  ensureTransitFields(t);
  if (t.phase === "approach" || t.progress < 1) return t.herder ?? null;
  return null;
}

function pietCanHerde(state: GameState): boolean {
  const story = state.story;
  if (!story?.farmhand.hired) return false;
  if (!isDaylightHour(state.date.hour)) return false;
  if (herderIsBusy(state)) return false;
  return (story.workGrid?.move_herd_help ?? 0) > 0;
}

function pickHerder(state: GameState): HerderId | null {
  if (herderIsBusy(state)) return null;
  if (pietCanHerde(state) && (state.story?.workGrid?.move_herd_help ?? 0) >= 3) return "piet";
  return "farmer";
}

export function tryDispatchHerdQueue(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story?.herdMoveQueue) return;
  if (!isDaylightHour(state.date.hour)) return;
  if (herdInTransit(state.herd) || state.herd.transit) return;
  const q = story.herdMoveQueue;
  beginHerdMove(state, q.toCampId, config);
  if (state.herd.transit) story.herdMoveQueue = null;
}

export function beginHerdMove(state: GameState, toCampId: number, config: GameConfig = CONFIG): boolean {
  if (state.herd.transit) return false;
  const herder = pickHerder(state) ?? (pietCanHerde(state) ? "piet" : null);
  if (!herder) return false;
  const path = planHerdPath(state, state.herd.campId, toCampId);
  const distanceKm = pathLengthKm(path, config);
  state.herd.transit = {
    toCampId,
    progress: 0,
    distanceKm,
    walkGameHours: walkGameHours(distanceKm, config),
    hoursApplied: 0,
    path,
    phase: "approach",
    herder,
    approachProgress: 0,
  };
  return true;
}

export type MoveHerdResult =
  | { ok: true; campName: string; queued?: boolean; queueReason?: string }
  | { ok: false; reason: "same" | "missing" | "moving" };

export function requestHerdMove(state: GameState, campId: number, config: GameConfig = CONFIG): MoveHerdResult {
  if (herderIsBusy(state) || (state.herd.transit && state.herd.transit.phase === "approach")) {
    return { ok: false, reason: "moving" };
  }
  const camp = findCamp(state, campId);
  if (!camp) return { ok: false, reason: "missing" };
  if (camp.id === state.herd.campId && !herdInTransit(state.herd)) return { ok: false, reason: "same" };
  if (!state.story) return { ok: false, reason: "missing" };

  if (!isDaylightHour(state.date.hour)) {
    state.story.herdMoveQueue = { toCampId: camp.id, reason: "night", campName: camp.name };
    return { ok: true, campName: camp.name, queued: true, queueReason: "night" };
  }

  if (beginHerdMove(state, camp.id, config)) {
    return { ok: true, campName: camp.name };
  }

  state.story.herdMoveQueue = { toCampId: camp.id, reason: "no_herder", campName: camp.name };
  return { ok: true, campName: camp.name, queued: true, queueReason: "no_herder" };
}

export function approachDurationMs(state: GameState, config: GameConfig = CONFIG): number {
  const transit = state.herd.transit;
  if (!transit) return STEP3A.approachBaseMs;
  const from =
    transit.herder === "piet" && state.story?.farmhandPresence
      ? { x: state.story.farmhandPresence.tileX, y: state.story.farmhandPresence.tileY }
      : state.story?.farmerPresence
        ? { x: state.story.farmerPresence.tileX, y: state.story.farmerPresence.tileY }
        : mainHouseTile(state);
  const herdTile = findCamp(state, state.herd.campId)?.anchor ?? from;
  const dist = Math.hypot(herdTile.x - from.x, herdTile.y - from.y);
  const km = dist * config.transit.kmPerTile;
  return Math.max(STEP3A.approachBaseMs, km * STEP3A.approachBaseMs * 4);
}

export function tickHerdApproach(
  state: GameState,
  deltaMs: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase !== "approach") return;
  if (mode === "pause") return;
  const mult = mode === "x3" ? 3 : mode === "x2" ? 2 : 1;
  const duration = approachDurationMs(state, config);
  transit.approachProgress = Math.min(1, (transit.approachProgress ?? 0) + (deltaMs * mult) / duration);
  syncHerderToApproach(state);
  if (transit.approachProgress >= 1) {
    transit.phase = "drive";
    transit.progress = 0;
    transit.hoursApplied = 0;
  }
}

export function tickHerdingRealtime(
  state: GameState,
  deltaMs: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): void {
  tryDispatchHerdQueue(state, config);
  if (!isDaylightHour(state.date.hour)) return;
  const transit = state.herd.transit;
  if (!transit) return;
  ensureTransitFields(transit);
  if (transit.phase === "approach") {
    tickHerdApproach(state, deltaMs, mode, config);
    return;
  }
  tickTransitRealtime(state, deltaMs, mode, config);
  syncHerderOnDrive(state);
  if (!state.herd.transit) {
    state.story && (state.story.herdMoveQueue = null);
  }
}

export function syncHerderToApproach(state: GameState): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase !== "approach") return;
  const presence = presenceForHerder(state, transit.herder);
  if (!presence) return;
  const from =
    transit.herder === "piet"
      ? workerHouseForFarmhand(state) ?? mainHouseTile(state)
      : mainHouseTile(state);
  const herdTile = findCamp(state, state.herd.campId)?.anchor ?? from;
  const t = transit.approachProgress ?? 0;
  presence.tileX = from.x + (herdTile.x - from.x) * t;
  presence.tileY = from.y + (herdTile.y - from.y) * t;
  presence.targetTileX = herdTile.x;
  presence.targetTileY = herdTile.y;
  presence.walkProgress = t < 1 ? 0.4 : 1;
  presence.activityLabel = t < 1 ? "Walking to the herd" : "Opening the herd";
  presence.onHerdingDuty = true;
}

export function syncHerderOnDrive(state: GameState, config: GameConfig = CONFIG): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase !== "drive") return;
  const presence = presenceForHerder(state, transit.herder);
  if (!presence || transit.path.length < 2) return;
  const trail = herderPathProgressBehindTail(state, config);
  const tile = pointOnPath(transit.path, trail);
  presence.tileX = tile.x;
  presence.tileY = tile.y;
  presence.targetTileX = tile.x;
  presence.targetTileY = tile.y;
  presence.walkProgress = 0.5;
  presence.activityLabel = `Driving herd (${Math.round(transit.progress * 100)}%)`;
  presence.onHerdingDuty = true;
}

function presenceForHerder(state: GameState, id: HerderId | undefined): PersonPresence | null {
  if (!id) return null;
  if (id === "farmer") return state.story?.farmerPresence ?? null;
  return state.story?.farmhandPresence ?? null;
}

export function herderWorldTile(state: GameState): TilePoint | null {
  const id = activeHerder(state) ?? herderIsBusy(state);
  if (!id) return null;
  const p = presenceForHerder(state, id);
  if (!p) return null;
  return { x: p.tileX, y: p.tileY };
}

export function herdMoveStatusLine(state: GameState): string {
  const story = state.story;
  const q = story?.herdMoveQueue;
  if (q) {
    const who =
      q.reason === "night"
        ? "Move waits for morning"
        : "No herder free. Move queued";
    return `${who} (${q.campName ?? "camp"})`;
  }
  const transit = state.herd.transit;
  if (!transit) return "";
  ensureTransitFields(transit);
  const name = transit.herder === "piet" ? STEP3A.farmhandName : farmerDisplayName(state);
  if (transit.phase === "approach") {
    const pct = Math.round((transit.approachProgress ?? 0) * 100);
    return `${name} walking to herd (${pct}%)`;
  }
  const pct = Math.round(transit.progress * 100);
  return `${name} driving herd (${pct}%)`;
}

export function herdMoveInProgress(state: GameState): boolean {
  return Boolean(state.herd.transit || state.story?.herdMoveQueue);
}

export function defaultFarmerPresence(state: GameState): PersonPresence {
  const home = mainHouseTile(state);
  return {
    tileX: home.x,
    tileY: home.y,
    targetTileX: home.x,
    targetTileY: home.y,
    activeJob: null,
    activityLabel: "At the main house",
    walkProgress: 1,
    onHerdingDuty: false,
    atHome: true,
  };
}
