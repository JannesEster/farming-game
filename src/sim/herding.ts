import { isDaylightHour } from "./clock";
import { CONFIG, type GameConfig } from "./config";
import { findCamp } from "./simulation";
import { farmerDisplayName } from "./playerName";
import { STEP3A } from "./step3aConfig";
import { mainHouseTile, workerHouseForFarmhand } from "./housing";
import {
  fractionalRanchHour,
  gameHoursElapsed,
  herdInTransit,
  tickTransitRealtime,
  walkGameHours,
  type TransitSpeed,
} from "./transit";
import { columnMetrics, herderPathProgressBehindTail, herderStandTile } from "./convoy";
import { pointCampId, usesMetreCoords } from "./metreFarm";
import { pathLengthKm, planHerdPath, planPersonPath, pointOnPath, WATER_STRUCTURE_CLEAR_TILES } from "./path";
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

/** Farmer, or Piet when he is hired to help move stock. Null at night or when a drive is already on. */
export function chooseAvailableHerder(state: GameState): HerderId | null {
  if (!isDaylightHour(state.date.hour)) return null;
  if (herderIsBusy(state)) return null;
  if (pietCanHerde(state) && (state.story?.workGrid?.move_herd_help ?? 0) >= 3) return "piet";
  return "farmer";
}

function pickHerder(state: GameState): HerderId | null {
  return chooseAvailableHerder(state);
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

function approachKmEstimate(state: GameState, herder: HerderId, herdTile: TilePoint, config: GameConfig): number {
  const presence = presenceForHerder(state, herder);
  const from = presence ? { x: presence.tileX, y: presence.tileY } : mainHouseTile(state);
  return Math.hypot(herdTile.x - from.x, herdTile.y - from.y) * config.transit.kmPerTile * 1.25;
}

/** True when the walk out plus the drive would still be going at 18:00. */
export function moveFitsBeforeDusk(
  state: GameState,
  driveKm: number,
  approachKm: number,
  config: GameConfig = CONFIG,
): boolean {
  const hours = approachKm / config.transit.herderWalkKmH + driveKm / config.transit.cattleWalkKmH;
  return fractionalRanchHour(state, config) + hours < 18;
}

export function beginHerdMove(state: GameState, toCampId: number, config: GameConfig = CONFIG): boolean {
  if (state.herd.transit) return false;
  const herder = pickHerder(state) ?? (pietCanHerde(state) ? "piet" : null);
  if (!herder) return false;
  const path = planHerdPath(state, state.herd.campId, toCampId);
  const distanceKm = pathLengthKm(path, config);
  const herdTile = path[0] ?? findCamp(state, state.herd.campId)?.anchor ?? mainHouseTile(state);
  const approachKm = approachKmEstimate(state, herder, herdTile, config);
  if (!moveFitsBeforeDusk(state, distanceKm, approachKm, config)) return false;
  if (state.story?.returnWalk) state.story.returnWalk = null;
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
  ensureApproachPath(state);
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

  const preview = planHerdPath(state, state.herd.campId, camp.id);
  const driveKm = pathLengthKm(preview, config);
  const herder = pickHerder(state) ?? "farmer";
  const approachKm = approachKmEstimate(state, herder, preview[0] ?? camp.anchor, config);
  if (!moveFitsBeforeDusk(state, driveKm, approachKm, config)) {
    state.story.herdMoveQueue = { toCampId: camp.id, reason: "night", campName: camp.name };
    return { ok: true, campName: camp.name, queued: true, queueReason: "night" };
  }

  if (beginHerdMove(state, camp.id, config)) {
    return { ok: true, campName: camp.name };
  }

  state.story.herdMoveQueue = { toCampId: camp.id, reason: "no_herder", campName: camp.name };
  return { ok: true, campName: camp.name, queued: true, queueReason: "no_herder" };
}

function ensureApproachPath(state: GameState, config: GameConfig = CONFIG): void {
  const transit = state.herd.transit;
  if (!transit || transit.approachPath) return;
  const presence = presenceForHerder(state, transit.herder);
  const from = presence
    ? { x: presence.tileX, y: presence.tileY }
    : transit.herder === "piet"
      ? workerHouseForFarmhand(state) ?? mainHouseTile(state)
      : mainHouseTile(state);
  const behind = herderPathProgressBehindTail(state, config);
  const meet = transit.path.length > 0 ? pointOnPath(transit.path, behind) : from;
  const allow = campsTouched(state, from, meet);
  let path = planPersonPath(state, from, meet, undefined, allow);
  if (Math.hypot(path[0].x - from.x, path[0].y - from.y) > 0.05) path = [from, ...path];
  transit.approachPath = path;
  transit.approachKm = Math.max(pathLengthKm(path, config), 0.01);
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
  ensureApproachPath(state, config);
  const hours = gameHoursElapsed(state.date.hour, deltaMs, mode, config.transit.driveClockFactor, config);
  const km = hours * config.transit.herderWalkKmH;
  const distance = transit.approachKm ?? 0.01;
  const walked = (transit.approachProgress ?? 0) * distance + km;
  transit.approachProgress = Math.min(1, walked / distance);
  syncHerderToApproach(state);
  if (transit.approachProgress >= 1) {
    transit.phase = "drive";
    transit.progress = 0;
    transit.hoursApplied = 0;
  }
}

export function tickReturnWalk(state: GameState, deltaMs: number, mode: TransitSpeed, config: GameConfig = CONFIG): void {
  const walk = state.story?.returnWalk;
  if (!walk || mode === "pause") return;
  const hours = gameHoursElapsed(state.date.hour, deltaMs, mode, config.transit.driveClockFactor, config);
  const km = hours * config.transit.herderWalkKmH;
  walk.progress = Math.min(1, walk.progress + km / Math.max(walk.distanceKm, 0.01));
  const presence = presenceForHerder(state, walk.who);
  const tile = pointOnPath(walk.path, walk.progress);
  if (presence) {
    const moved = stepPerson(presence, tile);
    presence.targetTileX = tile.x;
    presence.targetTileY = tile.y;
    presence.walkProgress = walk.progress < 1 && moved ? 0.4 : 1;
    presence.activityLabel = walk.progress < 1 ? "Walking home" : "At the main house";
    presence.onHerdingDuty = walk.progress < 1;
    presence.atHome = walk.progress >= 1;
  }
  if (walk.progress >= 1 && state.story) state.story.returnWalk = null;
}

export function tickHerdingRealtime(
  state: GameState,
  deltaMs: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): void {
  tryDispatchHerdQueue(state, config);
  const transit = state.herd.transit;
  if (!transit) {
    tickReturnWalk(state, deltaMs, mode, config);
    return;
  }
  ensureTransitFields(transit);
  if (transit.phase === "approach") {
    tickHerdApproach(state, deltaMs, mode, config);
    return;
  }
  tickTransitRealtime(state, deltaMs, mode, config);
  if (state.herd.transit) syncHerderOnDrive(state);
  else if (state.story) state.story.herdMoveQueue = null;
}

export function syncHerderToApproach(state: GameState): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase !== "approach") return;
  const presence = presenceForHerder(state, transit.herder);
  if (!presence) return;
  ensureApproachPath(state);
  const path = transit.approachPath ?? [];
  const t = transit.approachProgress ?? 0;
  const tile = path.length > 0 ? pointOnPath(path, t) : { x: presence.tileX, y: presence.tileY };
  const moved = stepPerson(presence, tile);
  const end = path[path.length - 1] ?? tile;
  presence.targetTileX = end.x;
  presence.targetTileY = end.y;
  presence.walkProgress = t < 1 && moved ? 0.4 : 1;
  presence.activityLabel = t < 1 ? "Walking to the herd" : "Opening the herd";
  presence.onHerdingDuty = true;
  presence.atHome = false;
}

function standClearsWater(state: GameState, tile: TilePoint): boolean {
  const limit = WATER_STRUCTURE_CLEAR_TILES * WATER_STRUCTURE_CLEAR_TILES;
  for (const feature of state.features) {
    if (feature.kind !== "windmill" && feature.kind !== "trough" && feature.kind !== "reservoir" && feature.kind !== "solar_pump") {
      continue;
    }
    const dx = tile.x - feature.x;
    const dy = tile.y - feature.y;
    if (dx * dx + dy * dy < limit) return false;
  }
  return true;
}

function standOnRoute(state: GameState, transit: HerdTransit, tile: TilePoint): boolean {
  const x = Math.round(tile.x);
  const y = Math.round(tile.y);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  const id = usesMetreCoords(state) ? pointCampId(state, x, y) : state.campIds[y * state.width + x];
  if (id === state.herd.campId || id === transit.toCampId) return true;
  return transit.path.some((step) => Math.max(Math.abs(step.x - x), Math.abs(step.y - y)) <= 1);
}

export function syncHerderOnDrive(state: GameState, _config: GameConfig = CONFIG): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase !== "drive") return;
  const presence = presenceForHerder(state, transit.herder);
  if (!presence || transit.path.length < 2) return;
  const metrics = columnMetrics(transit.path, transit.progress, state.herd.headCount);
  let tile = herderStandTile(transit.path, transit.progress, state.herd.headCount);
  if (!standOnRoute(state, transit, tile) || !standClearsWater(state, tile)) {
    tile = pointOnPath(transit.path, metrics.herderProgress);
  }
  const moved = stepPerson(presence, tile);
  presence.targetTileX = tile.x;
  presence.targetTileY = tile.y;
  presence.walkProgress = moved ? 0.4 : 1;
  presence.activityLabel = `Driving herd (${Math.round(transit.progress * 100)}%)`;
  presence.onHerdingDuty = true;
  presence.atHome = false;
}

/** One frame of walking. Never leaps across a tile. */
function stepPerson(presence: PersonPresence, tile: TilePoint): boolean {
  const dx = tile.x - presence.tileX;
  const dy = tile.y - presence.tileY;
  const dist = Math.hypot(dx, dy);
  const cap = 0.45;
  if (dist <= cap) {
    presence.tileX = tile.x;
    presence.tileY = tile.y;
  } else {
    presence.tileX += (dx / dist) * cap;
    presence.tileY += (dy / dist) * cap;
  }
  return dist > 0.04;
}

function campsTouched(state: GameState, from: TilePoint, to: TilePoint): Set<number> {
  const allow = new Set<number>();
  const add = (point: TilePoint) => {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    const id = usesMetreCoords(state) ? pointCampId(state, x, y) : state.campIds[y * state.width + x];
    if (id >= 0) allow.add(id);
  };
  add(from);
  add(to);
  return allow;
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
