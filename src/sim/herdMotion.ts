import { CAMP_GATE_METRES, COW_LENGTH_METRES } from "../render/worldScale";
import { HERD_MOTION_TUNING } from "./config";
import { CONFIG, type GameConfig } from "./config";
import { grassCellKey, localGrass } from "./grassCells";
import { pointCampId, usesMetreCoords } from "./metreFarm";
import { campGrazingGoal } from "./path";
import { treesInRect } from "./vegetation";
import type { AnimalRecord } from "./storyTypes";
import type { CampState, GameState, TilePoint } from "./types";

/**
 * Per cow motion for the metre farm.
 *
 * Each animal keeps its own metres, heading, and mode. Positions are not a
 * function of list index, so a sale, a birth, or a cut out does not make the
 * others jump.
 *
 * herd.campId changes when the lead cow enters the destination camp, so the
 * label and the camera follow the lead. Camp rest and grazing days start
 * later, in finishTransit, once the last cow has crossed and the lead has
 * reached the end of the path.
 *
 * Agents are not saved. A fresh load seeds them near the grazing centre, or
 * along the path when a drive was already in progress.
 */

export type HerdMode = "graze" | "walk" | "stand" | "drink" | "follow";

export type HerdAgent = {
  id: string;
  x: number;
  y: number;
  heading: number;
  mode: HerdMode;
  targetX: number;
  targetY: number;
  timer: number;
  drinkUrge: number;
  /** Seconds of game time before this cow joins a drive. */
  delayLeft: number;
  /** Metres along the drive path this cow has been allowed to reach. */
  pathCursor: number;
  lagM: number;
  lane: number;
  crossedDest: boolean;
  grazeHeadDown: boolean;
  switches: number;
  /** Walking to a trough, then drinking. */
  drinkPhase: "none" | "to" | "at";
  stride: number;
};

export type HerdView = { minX: number; minY: number; maxX: number; maxY: number };

type PathSample = { x: number; y: number; tx: number; ty: number };

type PathGate = {
  dist: number;
  x: number;
  y: number;
  fromCamp: number;
  toCamp: number;
};

type PathGeom = {
  length: number;
  legs: number[];
};

type Runtime = {
  agents: Map<string, HerdAgent>;
  wear: Map<string, number>;
  driveToken: string | null;
  originCampId: number | null;
  gates: PathGate[];
  geom: PathGeom | null;
  view: HerdView | null;
  shadeTrees: { campId: number; points: { x: number; y: number }[] } | null;
};

const runtimes = new WeakMap<GameState, Runtime>();

function emptyRuntime(): Runtime {
  return {
    agents: new Map(),
    wear: new Map(),
    driveToken: null,
    originCampId: null,
    gates: [],
    geom: null,
    view: null,
    shadeTrees: null,
  };
}

function runtimeOf(state: GameState): Runtime {
  let runtime = runtimes.get(state);
  if (!runtime) {
    runtime = emptyRuntime();
    runtimes.set(state, runtime);
  }
  return runtime;
}

function mix(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
}

function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function unit(seed: number, a: number, b: number, c: number): number {
  return mix(seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 3, 0x85ebca6b) ^ Math.imul(c + 7, 0xc2b2ae35)) / 4294967296;
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function herdMembers(state: GameState): AnimalRecord[] {
  return (state.story?.animals ?? []).filter((animal) => animal.whereabouts === "in_camp" && !animal.split);
}

function campById(state: GameState, id: number): CampState | undefined {
  return state.camps.find((camp) => camp.id === id);
}

function kmhToMps(kmh: number): number {
  return (kmh * 1000) / 3600;
}

function cattleMps(config: GameConfig = CONFIG): number {
  return kmhToMps(config.transit.cattleWalkKmH);
}

function measurePath(path: TilePoint[]): PathGeom {
  const legs: number[] = [];
  let length = 0;
  for (let i = 1; i < path.length; i += 1) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    legs.push(len);
    length += len;
  }
  return { length, legs };
}

function samplePath(path: TilePoint[], geom: PathGeom, dist: number): PathSample {
  if (path.length === 0) return { x: 0, y: 0, tx: 1, ty: 0 };
  if (path.length === 1 || geom.length <= 0) return { x: path[0].x, y: path[0].y, tx: 1, ty: 0 };
  const target = clamp(dist, 0, geom.length);
  let left = target;
  for (let i = 0; i < geom.legs.length; i += 1) {
    const leg = geom.legs[i];
    const a = path[i];
    const b = path[i + 1];
    const len = leg || 1;
    if (left <= leg || i === geom.legs.length - 1) {
      const t = leg <= 0 ? 0 : clamp(left / len, 0, 1);
      const tx = (b.x - a.x) / len;
      const ty = (b.y - a.y) / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx, ty };
    }
    left -= leg;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y, tx: 1, ty: 0 };
}

function projectPath(path: TilePoint[], geom: PathGeom, x: number, y: number): number {
  if (path.length < 2 || geom.length <= 0) return 0;
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  let travelled = 0;
  for (let i = 0; i < geom.legs.length; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 <= 0 ? 0 : clamp(((x - a.x) * dx + (y - a.y) * dy) / len2, 0, 1);
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = travelled + Math.sqrt(len2) * t;
    }
    travelled += geom.legs[i];
  }
  return best;
}

function gatesOnPath(state: GameState, path: TilePoint[], geom: PathGeom): PathGate[] {
  const gates: PathGate[] = [];
  let travelled = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const len = geom.legs[i - 1] ?? 0;
    const fromCamp = pointCampId(state, a.x, a.y);
    const toCamp = pointCampId(state, b.x, b.y);
    if (fromCamp >= 0 && toCamp >= 0 && fromCamp !== toCamp && len < 6) {
      gates.push({
        dist: travelled + len * 0.5,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        fromCamp,
        toCamp,
      });
    }
    travelled += len;
  }
  return gates;
}

function rectInset(camp: CampState, want: number): number {
  const rect = camp.rect;
  if (!rect) return 0;
  return Math.max(0.4, Math.min(want, rect.w * 0.5 - 1, rect.h * 0.5 - 1));
}

function clampToCamp(camp: CampState, x: number, y: number, inset: number): { x: number; y: number } {
  const rect = camp.rect;
  if (!rect) return { x, y };
  const pad = rectInset(camp, inset);
  return {
    x: clamp(x, rect.x + pad, rect.x + rect.w - pad),
    y: clamp(y, rect.y + pad, rect.y + rect.h - pad),
  };
}

function insideCamp(camp: CampState, x: number, y: number, inset: number): boolean {
  const rect = camp.rect;
  if (!rect) return true;
  const pad = rectInset(camp, inset);
  return x >= rect.x + pad - 0.05 && y >= rect.y + pad - 0.05 && x <= rect.x + rect.w - pad + 0.05 && y <= rect.y + rect.h - pad + 0.05;
}

function homeCamp(state: GameState, animal: AnimalRecord): CampState | undefined {
  return campById(state, animal.campId) ?? campById(state, state.herd.campId) ?? state.camps[0];
}

function seedRest(state: GameState, animal: AnimalRecord, taken: { x: number; y: number }[]): { x: number; y: number } {
  const transit = state.herd.transit;
  const onDrive = Boolean(transit && transit.phase !== "approach" && transit.phase !== "night");
  let camp = homeCamp(state, animal);
  // At rest the herd camp is where these cows stand. A caller that only
  // retargets herd.campId still gets a mob in that camp on the first seed.
  if (!onDrive && animal.whereabouts === "in_camp" && !animal.split) {
    animal.campId = state.herd.campId;
    camp = campById(state, state.herd.campId) ?? camp;
  }
  const centre = camp ? campGrazingGoal(state, camp) : { x: 0, y: 0 };
  const gap = COW_LENGTH_METRES * HERD_MOTION_TUNING.minGapFractionOfBody;
  const idn = idHash(animal.id);
  let best = { x: centre.x, y: centre.y };
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const ang = unit(state.seed, idn, attempt, 1) * Math.PI * 2;
    const rad = 4 + unit(state.seed, idn, attempt, 2) * HERD_MOTION_TUNING.restRadiusM;
    let x = centre.x + Math.cos(ang) * rad;
    let y = centre.y + Math.sin(ang) * rad;
    if (camp) {
      const clamped = clampToCamp(camp, x, y, HERD_MOTION_TUNING.fenceInsetM);
      x = clamped.x;
      y = clamped.y;
    }
    best = { x, y };
    const clear = taken.every((point) => (point.x - x) ** 2 + (point.y - y) ** 2 >= gap * gap);
    if (clear) break;
  }
  return best;
}

function onPathAlready(state: GameState): boolean {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return false;
  if (transit.phase === "approach") return false;
  return transit.progress > 0.001;
}

function placeOnPath(state: GameState, runtime: Runtime, animal: AnimalRecord): { x: number; y: number; cursor: number; lag: number; lane: number } {
  const transit = state.herd.transit!;
  const geom = runtime.geom ?? measurePath(transit.path);
  const idn = idHash(animal.id);
  const lag = unit(state.seed, idn, 4, 1) * HERD_MOTION_TUNING.maxLagM;
  const lane = (unit(state.seed, idn, 5, 2) - 0.5) * 2 * HERD_MOTION_TUNING.openLaneHalfM;
  const along = clamp(transit.progress * geom.length - lag, 0, geom.length);
  const sample = samplePath(transit.path, geom, along);
  let x = sample.x - sample.ty * lane;
  let y = sample.y + sample.tx * lane;
  const campId = pointCampId(state, x, y);
  const camp = campById(state, campId >= 0 ? campId : state.herd.campId);
  if (camp?.rect) {
    const clamped = clampToCamp(camp, x, y, 0.8);
    x = clamped.x;
    y = clamped.y;
  }
  return { x, y, cursor: along, lag, lane };
}

function makeAgent(state: GameState, runtime: Runtime, animal: AnimalRecord, onPath: boolean, taken: { x: number; y: number }[]): HerdAgent {
  const idn = idHash(animal.id);
  const roll = unit(state.seed, idn, 3, 8);
  const mode: HerdMode = roll < 0.5 ? "graze" : roll < 0.78 ? "stand" : "walk";
  const timer =
    mode === "graze"
      ? lerp(HERD_MOTION_TUNING.grazeBoutMinS, HERD_MOTION_TUNING.grazeBoutMaxS, unit(state.seed, idn, 6, 1))
      : mode === "stand"
        ? lerp(HERD_MOTION_TUNING.standMinS, HERD_MOTION_TUNING.standMaxS, unit(state.seed, idn, 6, 2))
        : lerp(HERD_MOTION_TUNING.walkMinS, HERD_MOTION_TUNING.walkMaxS, unit(state.seed, idn, 6, 3));
  const placed = onPath ? placeOnPath(state, runtime, animal) : { ...seedRest(state, animal, taken), cursor: 0, lag: 0, lane: 0 };
  taken.push({ x: placed.x, y: placed.y });
  const heading = unit(state.seed, idn, 7, 4) * Math.PI * 2;
  const agent: HerdAgent = {
    id: animal.id,
    x: placed.x,
    y: placed.y,
    heading,
    mode,
    targetX: placed.x,
    targetY: placed.y,
    timer,
    drinkUrge: unit(state.seed, idn, 9, 5),
    delayLeft: 0,
    pathCursor: placed.cursor,
    lagM: placed.lag,
    lane: placed.lane,
    crossedDest: false,
    grazeHeadDown: mode === "graze",
    switches: 1,
    drinkPhase: "none",
    stride: idn % HERD_MOTION_TUNING.offscreenStride,
  };
  animal.tileX = agent.x;
  animal.tileY = agent.y;
  return agent;
}

/** Create missing agents. Existing cows keep the metres they already have. */
export function ensureHerdAgents(state: GameState): Runtime {
  const runtime = runtimeOf(state);
  if (!usesMetreCoords(state)) return runtime;
  const members = herdMembers(state).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const live = new Set(members.map((animal) => animal.id));
  for (const id of runtime.agents.keys()) {
    if (!live.has(id)) runtime.agents.delete(id);
  }
  const fresh = runtime.agents.size === 0;
  const onPath = fresh && onPathAlready(state);
  if (onPath && state.herd.transit) {
    runtime.geom = measurePath(state.herd.transit.path);
    runtime.gates = gatesOnPath(state, state.herd.transit.path, runtime.geom);
    runtime.originCampId = state.herd.campId;
    runtime.driveToken = driveToken(state, runtime);
  }
  const taken: { x: number; y: number }[] = [];
  for (const agent of runtime.agents.values()) taken.push({ x: agent.x, y: agent.y });
  for (const animal of members) {
    if (runtime.agents.has(animal.id)) continue;
    runtime.agents.set(animal.id, makeAgent(state, runtime, animal, onPath, taken));
  }
  return runtime;
}

/** Drop runtime positions so the next read seeds the herd camp again. Capture only. */
export function resetHerdMotion(state: GameState): void {
  runtimes.delete(state);
}

export function herdAgent(state: GameState, id: string): HerdAgent | undefined {
  return ensureHerdAgents(state).agents.get(id);
}

export function herdAgentList(state: GameState): HerdAgent[] {
  const runtime = ensureHerdAgents(state);
  return herdMembers(state)
    .map((animal) => runtime.agents.get(animal.id))
    .filter((agent): agent is HerdAgent => Boolean(agent))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function herdCentroid(state: GameState): TilePoint | null {
  if (!usesMetreCoords(state)) return null;
  const agents = herdAgentList(state);
  if (agents.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const agent of agents) {
    x += agent.x;
    y += agent.y;
  }
  return { x: x / agents.length, y: y / agents.length };
}

/** Stand the herder a few metres behind the rearmost cow, facing along the path. */
export function herderStandBehindCows(state: GameState): (TilePoint & { tx: number; ty: number }) | null {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2 || transit.phase === "approach") return null;
  const runtime = ensureHerdAgents(state);
  const geom = runtime.geom ?? measurePath(transit.path);
  let tail: HerdAgent | null = null;
  for (const animal of herdMembers(state)) {
    const agent = runtime.agents.get(animal.id);
    if (!agent) continue;
    if (!tail || agent.pathCursor < tail.pathCursor) tail = agent;
  }
  if (!tail) return null;
  const sample = samplePath(transit.path, geom, tail.pathCursor);
  const back = 4;
  return { x: tail.x - sample.tx * back, y: tail.y - sample.ty * back, tx: sample.tx, ty: sample.ty };
}

export function setHerdMotionView(state: GameState, view: HerdView | null): void {
  runtimeOf(state).view = view;
}

export function setDrinkUrge(state: GameState, animalId: string, urge: number): void {
  const agent = herdAgent(state, animalId);
  if (!agent) return;
  agent.drinkUrge = urge;
  agent.drinkPhase = "none";
  if (urge >= 1) agent.timer = 0;
}

/** Wear one side of a camp down so a drift test has somewhere better to walk. */
export function stripGrassHalf(state: GameState, campId: number, side: "lowX" | "highX"): void {
  const runtime = ensureHerdAgents(state);
  const camp = campById(state, campId);
  if (!camp?.rect) return;
  const cell = HERD_MOTION_TUNING.grassCellM;
  const mid = grassCellCoordOf(camp.rect.x + camp.rect.w / 2, cell);
  for (let x = camp.rect.x; x < camp.rect.x + camp.rect.w; x += cell) {
    for (let y = camp.rect.y; y < camp.rect.y + camp.rect.h; y += cell) {
      const cx = grassCellCoordOf(x, cell);
      const low = cx < mid;
      if (side === "lowX" ? low : !low) runtime.wear.set(`${campId}:${cx}:${grassCellCoordOf(y, cell)}`, 1);
    }
  }
}

function grassCellCoordOf(metres: number, cell: number): number {
  return Math.floor(metres / cell);
}

function inView(runtime: Runtime, agent: HerdAgent): boolean {
  const view = runtime.view;
  if (!view) return true;
  const margin = HERD_MOTION_TUNING.viewMarginM;
  return (
    agent.x >= view.minX - margin &&
    agent.x <= view.maxX + margin &&
    agent.y >= view.minY - margin &&
    agent.y <= view.maxY + margin
  );
}

type Grid = Map<string, HerdAgent[]>;

function buildGrid(agents: HerdAgent[], cell: number): Grid {
  const grid: Grid = new Map();
  for (const agent of agents) {
    const key = `${Math.floor(agent.x / cell)}:${Math.floor(agent.y / cell)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(agent);
    else grid.set(key, [agent]);
  }
  return grid;
}

function nearby(grid: Grid, x: number, y: number, cell: number): HerdAgent[] {
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  const found: HerdAgent[] = [];
  for (let iy = cy - 1; iy <= cy + 1; iy += 1) {
    for (let ix = cx - 1; ix <= cx + 1; ix += 1) {
      const bucket = grid.get(`${ix}:${iy}`);
      if (bucket) found.push(...bucket);
    }
  }
  return found;
}

function separation(agent: HerdAgent, grid: Grid, cell: number, gap: number): { x: number; y: number } {
  let px = 0;
  let py = 0;
  for (const other of nearby(grid, agent.x, agent.y, cell)) {
    if (other.id === agent.id) continue;
    let dx = agent.x - other.x;
    let dy = agent.y - other.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.04) {
      const nudge = unit(idHash(agent.id), idHash(other.id), 1, 2);
      dx = Math.cos(nudge * Math.PI * 2);
      dy = Math.sin(nudge * Math.PI * 2);
      dist = 0.04;
    }
    if (dist >= gap) continue;
    const push = (gap - dist) / gap;
    px += (dx / dist) * push;
    py += (dy / dist) * push;
  }
  return { x: px, y: py };
}

function troughsFor(state: GameState, campId: number): TilePoint[] {
  const points: TilePoint[] = [];
  for (const water of state.farmWaterPoints ?? []) {
    if (!water.servedCampIds.includes(campId)) continue;
    points.push(water.trough);
  }
  return points;
}

function nearestTrough(state: GameState, campId: number, x: number, y: number): TilePoint | null {
  const points = troughsFor(state, campId);
  let best: TilePoint | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const dist = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = point;
    }
  }
  return best;
}

function waterAppeal(dist: number): number {
  if (!Number.isFinite(dist)) return 0;
  const bare = HERD_MOTION_TUNING.bareWaterM;
  if (dist < bare) return 0.2 * (dist / bare);
  return 1 / (1 + (dist - bare) / 380);
}

function shadeBonus(state: GameState, runtime: Runtime, camp: CampState, x: number, y: number): number {
  if (HERD_MOTION_TUNING.shadeWeight <= 0) return 0;
  const hour = ((state.date.hour % 24) + 24) % 24;
  if (hour < HERD_MOTION_TUNING.shadeHourStart || hour >= HERD_MOTION_TUNING.shadeHourEnd) return 0;
  if (!camp.rect) return 0;
  if (!runtime.shadeTrees || runtime.shadeTrees.campId !== camp.id) {
    const rect = camp.rect;
    runtime.shadeTrees = {
      campId: camp.id,
      points: treesInRect(state, rect.x, rect.y, rect.x + rect.w, rect.y + rect.h),
    };
  }
  let best = Number.POSITIVE_INFINITY;
  for (const tree of runtime.shadeTrees.points) {
    const dist = (tree.x - x) ** 2 + (tree.y - y) ** 2;
    if (dist < best) best = dist;
  }
  return Math.sqrt(best) <= HERD_MOTION_TUNING.shadeTreeM ? 1 : 0;
}

function pickSpot(
  state: GameState,
  runtime: Runtime,
  animal: AnimalRecord,
  agent: HerdAgent,
  centre: TilePoint,
  grid: Grid,
): { x: number; y: number } {
  const camp = homeCamp(state, animal);
  if (!camp) return { x: agent.x, y: agent.y };
  const idn = idHash(animal.id);
  const spots: { x: number; y: number; score: number }[] = [];
  const cell = COW_LENGTH_METRES * 2;
  for (let i = 0; i < HERD_MOTION_TUNING.candidateCount; i += 1) {
    const ang = unit(state.seed, idn, agent.switches, i + 11) * Math.PI * 2;
    const rad = lerp(
      HERD_MOTION_TUNING.candidateMinM,
      HERD_MOTION_TUNING.candidateMaxM,
      unit(state.seed, idn, agent.switches, i + 19),
    );
    let x = agent.x + Math.cos(ang) * rad;
    let y = agent.y + Math.sin(ang) * rad;
    const clamped = clampToCamp(camp, x, y, HERD_MOTION_TUNING.fenceInsetM);
    x = clamped.x;
    y = clamped.y;
    if (!insideCamp(camp, x, y, HERD_MOTION_TUNING.fenceInsetM)) continue;
    const grass = localGrass(state.seed, camp, x, y, runtime.wear);
    const trough = nearestTrough(state, camp.id, x, y);
    const water = trough ? waterAppeal(Math.hypot(trough.x - x, trough.y - y)) : 0;
    const fromCentre = Math.hypot(x - centre.x, y - centre.y);
    let nearest = 30;
    for (const other of nearby(grid, x, y, cell)) {
      if (other.id === agent.id) continue;
      nearest = Math.min(nearest, Math.hypot(other.x - x, other.y - y));
    }
    const score =
      HERD_MOTION_TUNING.grassWeight * grass +
      HERD_MOTION_TUNING.waterWeight * water -
      HERD_MOTION_TUNING.centreWeight * (fromCentre / 180) +
      HERD_MOTION_TUNING.crowdWeight * clamp(nearest / 16, 0, 1) +
      HERD_MOTION_TUNING.shadeWeight * shadeBonus(state, runtime, camp, x, y);
    spots.push({ x, y, score });
  }
  if (spots.length === 0) return { x: agent.x, y: agent.y };
  let total = 0;
  const weights = spots.map((spot) => {
    const weight = Math.max(0.08, spot.score + 0.35);
    total += weight;
    return weight;
  });
  let pick = unit(state.seed, idn, agent.switches, 27) * total;
  for (let i = 0; i < spots.length; i += 1) {
    pick -= weights[i];
    if (pick <= 0) return spots[i];
  }
  return spots[spots.length - 1];
}

function adultIds(members: AnimalRecord[]): AnimalRecord[] {
  return members.filter((animal) => animal.stockClass !== "calf").sort((a, b) => (a.id < b.id ? -1 : 1));
}

function damFor(calf: AnimalRecord, adults: AnimalRecord[]): AnimalRecord | null {
  if (adults.length === 0) return null;
  return adults[idHash(calf.id) % adults.length];
}

function chooseMode(state: GameState, runtime: Runtime, animal: AnimalRecord, agent: HerdAgent, centre: TilePoint, grid: Grid): void {
  agent.switches += 1;
  const idn = idHash(animal.id);
  const roll = unit(state.seed, idn, agent.switches, 4);
  const camp = homeCamp(state, animal);
  if (agent.drinkUrge >= 1 && camp && roll < 0.9) {
    const trough = nearestTrough(state, camp.id, agent.x, agent.y);
    if (trough && troughsFor(state, camp.id).length > 0) {
      agent.mode = "walk";
      agent.drinkPhase = "to";
      agent.targetX = trough.x;
      agent.targetY = trough.y;
      agent.timer = 8 * 3600;
      agent.grazeHeadDown = false;
      return;
    }
  }
  agent.drinkPhase = "none";
  if (roll < 0.48) {
    agent.mode = "graze";
    const spot = pickSpot(state, runtime, animal, agent, centre, grid);
    agent.targetX = spot.x;
    agent.targetY = spot.y;
    agent.timer = lerp(HERD_MOTION_TUNING.grazeBoutMinS, HERD_MOTION_TUNING.grazeBoutMaxS, unit(state.seed, idn, agent.switches, 5));
  } else if (roll < 0.72) {
    agent.mode = "stand";
    agent.timer = lerp(HERD_MOTION_TUNING.standMinS, HERD_MOTION_TUNING.standMaxS, unit(state.seed, idn, agent.switches, 6));
  } else {
    agent.mode = "walk";
    const spot = pickSpot(state, runtime, animal, agent, centre, grid);
    agent.targetX = spot.x;
    agent.targetY = spot.y;
    agent.timer = lerp(HERD_MOTION_TUNING.walkMinS, HERD_MOTION_TUNING.walkMaxS, unit(state.seed, idn, agent.switches, 7));
  }
  agent.grazeHeadDown = agent.mode === "graze";
}

function applyMove(agent: HerdAgent, dx: number, dy: number, maxStep: number): void {
  const dist = Math.hypot(dx, dy);
  if (dist <= 1e-6 || maxStep <= 0) return;
  const scale = dist > maxStep ? maxStep / dist : 1;
  const stepX = dx * scale;
  const stepY = dy * scale;
  agent.x += stepX;
  agent.y += stepY;
  if (Math.hypot(stepX, stepY) > 0.02) agent.heading = Math.atan2(stepY, stepX);
}

function pullTogether(agent: HerdAgent, centre: TilePoint, maxStep: number): { x: number; y: number } {
  const dx = centre.x - agent.x;
  const dy = centre.y - agent.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= HERD_MOTION_TUNING.cohesionStartM || dist < 0.01) return { x: 0, y: 0 };
  const pull = Math.min(maxStep * HERD_MOTION_TUNING.cohesionPull, dist - HERD_MOTION_TUNING.cohesionStartM);
  return { x: (dx / dist) * pull, y: (dy / dist) * pull };
}

function wearGrass(runtime: Runtime, camp: CampState, agent: HerdAgent, dt: number): void {
  if (agent.mode !== "graze") return;
  const key = grassCellKey(camp.id, agent.x, agent.y);
  const prev = runtime.wear.get(key) ?? 0;
  runtime.wear.set(key, Math.min(0.9, prev + HERD_MOTION_TUNING.grassWearPerHour * (dt / 3600)));
}

function stepGraze(state: GameState, runtime: Runtime, dt: number, config: GameConfig): void {
  const members = herdMembers(state).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const agents: HerdAgent[] = [];
  for (const animal of members) {
    const agent = runtime.agents.get(animal.id);
    if (agent) agents.push(agent);
  }
  if (agents.length === 0) return;
  const cell = COW_LENGTH_METRES * 2;
  const grid = buildGrid(agents, cell);
  let cx = 0;
  let cy = 0;
  for (const agent of agents) {
    cx += agent.x;
    cy += agent.y;
  }
  const centre = { x: cx / agents.length, y: cy / agents.length };
  const adults = adultIds(members);
  const gap = COW_LENGTH_METRES * HERD_MOTION_TUNING.minGapFractionOfBody;
  const grazeSpeed = kmhToMps(config.transit.grazeWalkKmH);
  const walkSpeed = kmhToMps(HERD_MOTION_TUNING.spotWalkKmH);
  const drinkInterval = HERD_MOTION_TUNING.drinkIntervalGameHours * 3600;

  for (const animal of members) {
    const agent = runtime.agents.get(animal.id);
    if (!agent) continue;
    const seen = inView(runtime, agent);
    agent.stride = (agent.stride + 1) % HERD_MOTION_TUNING.offscreenStride;
    const full = seen || agent.stride === 0;
    agent.drinkUrge = Math.min(2.5, agent.drinkUrge + dt / drinkInterval);
    if (full) agent.timer -= dt;

    const camp = homeCamp(state, animal);
    if (animal.stockClass === "calf") {
      const damAnimal = damFor(animal, adults);
      const dam = damAnimal ? runtime.agents.get(damAnimal.id) : undefined;
      if (dam && Math.hypot(dam.x - agent.x, dam.y - agent.y) > HERD_MOTION_TUNING.calfGapM) {
        const side = unit(state.seed, idHash(animal.id), 2, 3) * Math.PI * 2;
        agent.targetX = dam.x + Math.cos(side) * HERD_MOTION_TUNING.calfGapM * 0.75;
        agent.targetY = dam.y + Math.sin(side) * HERD_MOTION_TUNING.calfGapM * 0.75;
        agent.mode = "follow";
        agent.grazeHeadDown = false;
      }
    }

    if (full && agent.drinkPhase === "to") {
      const trough = camp ? nearestTrough(state, camp.id, agent.x, agent.y) : null;
      if (!trough || !camp || !troughsFor(state, camp.id).some((point) => point.x === trough.x && point.y === trough.y)) {
        agent.drinkPhase = "none";
        agent.drinkUrge = 0.2;
      } else if (Math.hypot(trough.x - agent.x, trough.y - agent.y) <= HERD_MOTION_TUNING.troughReachM) {
        agent.mode = "drink";
        agent.drinkPhase = "at";
        agent.timer = HERD_MOTION_TUNING.drinkSeconds;
        agent.grazeHeadDown = false;
        agent.targetX = agent.x;
        agent.targetY = agent.y;
      } else {
        agent.targetX = trough.x;
        agent.targetY = trough.y;
        agent.mode = "walk";
      }
    } else if (full && agent.drinkPhase === "at") {
      if (agent.timer <= 0) {
        agent.drinkUrge = 0;
        agent.drinkPhase = "none";
        agent.mode = "walk";
        const spot = pickSpot(state, runtime, animal, agent, centre, grid);
        agent.targetX = spot.x;
        agent.targetY = spot.y;
        agent.timer = lerp(HERD_MOTION_TUNING.walkMinS, HERD_MOTION_TUNING.walkMaxS, unit(state.seed, idHash(animal.id), agent.switches, 8));
      }
    } else if (full && agent.timer <= 0 && animal.stockClass !== "calf") {
      chooseMode(state, runtime, animal, agent, centre, grid);
    }

    const speed =
      agent.mode === "walk" || agent.mode === "follow"
        ? walkSpeed
        : agent.mode === "graze"
          ? grazeSpeed
          : 0;
    const maxStep = Math.max(speed, grazeSpeed) * dt;
    let dx = 0;
    let dy = 0;
    if (speed > 0) {
      dx = agent.targetX - agent.x;
      dy = agent.targetY - agent.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx = (dx / dist) * speed * dt;
      dy = (dy / dist) * speed * dt;
    }
    if (full) {
      const push = separation(agent, grid, cell, animal.stockClass === "calf" ? gap * 0.55 : gap);
      dx += push.x * maxStep;
      dy += push.y * maxStep;
      if (animal.stockClass !== "calf") {
        const pull = pullTogether(agent, centre, maxStep);
        dx += pull.x;
        dy += pull.y;
      }
    }
    applyMove(agent, dx, dy, maxStep);
    if (camp?.rect) {
      const clamped = clampToCamp(camp, agent.x, agent.y, HERD_MOTION_TUNING.fenceInsetM);
      agent.x = clamped.x;
      agent.y = clamped.y;
      if (full) wearGrass(runtime, camp, agent, dt);
    }
    animal.tileX = agent.x;
    animal.tileY = agent.y;
    animal.activity = agent.mode === "walk" || agent.mode === "follow" ? "walk" : "graze";
    agent.grazeHeadDown = agent.mode === "graze";
  }
}

function driveToken(state: GameState, runtime: Runtime): string | null {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return null;
  const origin = runtime.originCampId ?? state.herd.campId;
  const last = transit.path[transit.path.length - 1];
  return `${origin}:${transit.toCampId}:${transit.path.length}:${Math.round(transit.path[0].x)}:${Math.round(last.x)}`;
}

function beginDrive(state: GameState, runtime: Runtime): void {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return;
  const token = driveToken(state, runtime);
  if (!token) return;
  if (runtime.driveToken === token && runtime.geom) return;
  runtime.originCampId = runtime.originCampId ?? state.herd.campId;
  runtime.driveToken = driveToken(state, runtime);
  runtime.geom = measurePath(transit.path);
  runtime.gates = gatesOnPath(state, transit.path, runtime.geom);
  const speed = cattleMps();
  for (const animal of herdMembers(state)) {
    const agent = runtime.agents.get(animal.id);
    if (!agent) continue;
    const idn = idHash(animal.id);
    agent.lagM = unit(state.seed, idn, 4, 1) * HERD_MOTION_TUNING.maxLagM;
    agent.lane = (unit(state.seed, idn, 5, 2) - 0.5) * 2 * HERD_MOTION_TUNING.openLaneHalfM;
    agent.delayLeft = speed > 0 ? agent.lagM / speed : 0;
    agent.pathCursor = projectPath(transit.path, runtime.geom, agent.x, agent.y);
    agent.crossedDest = pointCampId(state, agent.x, agent.y) === transit.toCampId;
    agent.drinkPhase = "none";
    agent.mode = agent.delayLeft > 0 ? "stand" : "follow";
    agent.grazeHeadDown = false;
  }
}

function segmentNear(x0: number, y0: number, x1: number, y1: number, gx: number, gy: number, limit: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 <= 0 ? 0 : clamp(((gx - x0) * dx + (gy - y0) * dy) / len2, 0, 1);
  const px = x0 + dx * t;
  const py = y0 + dy * t;
  return Math.hypot(px - gx, py - gy) <= limit;
}

function laneAt(agent: HerdAgent, gates: PathGate[]): number {
  let squeeze = 0;
  for (const gate of gates) {
    const along = Math.abs(agent.pathCursor - gate.dist);
    if (along < 36) squeeze = Math.max(squeeze, (36 - along) / 36);
  }
  const open = agent.lane;
  const tight = clamp(agent.lane, -HERD_MOTION_TUNING.gateLaneHalfM, HERD_MOTION_TUNING.gateLaneHalfM);
  return open * (1 - squeeze) + tight * squeeze;
}

/** Cows further back stay a body gap behind the pair in front, so the gate is a file. */
function fileLimit(agents: HerdAgent[]): Map<string, number> {
  const ordered = agents.filter((agent) => agent.delayLeft <= 0).sort((a, b) => b.pathCursor - a.pathCursor);
  const limit = new Map<string, number>();
  const abreast = HERD_MOTION_TUNING.gatePassCount;
  const gap = COW_LENGTH_METRES * HERD_MOTION_TUNING.minGapFractionOfBody;
  for (let i = abreast; i < ordered.length; i += 1) {
    const blocker = ordered[i - abreast];
    limit.set(ordered[i].id, blocker.pathCursor - gap);
  }
  return limit;
}

function commitDriveStep(state: GameState, animal: AnimalRecord, agent: HerdAgent, nx: number, ny: number, gates: PathGate[]): void {
  const here = pointCampId(state, agent.x, agent.y);
  const there = pointCampId(state, nx, ny);
  const hereCamp = here >= 0 ? campById(state, here) : undefined;
  // A deep inset plus a short sim step can pin a cow just inside the wire,
  // so the next step never reaches the gate line. Grazing uses the real inset.
  const driveInset = 0.05;
  if (there === here && hereCamp?.rect) {
    const clamped = clampToCamp(hereCamp, nx, ny, driveInset);
    agent.x = clamped.x;
    agent.y = clamped.y;
    return;
  }
  // Half the 3.6 m opening, plus half a body, so a cow in the gap is allowed through.
  const limit = CAMP_GATE_METRES / 2 + COW_LENGTH_METRES / 2;
  const gate = gates.find(
    (item) =>
      (item.fromCamp === here || item.toCamp === here) &&
      (item.toCamp === there || item.fromCamp === there) &&
      segmentNear(agent.x, agent.y, nx, ny, item.x, item.y, limit),
  );
  if (gate && there >= 0) {
    agent.x = nx;
    agent.y = ny;
    animal.campId = there;
    const dest = state.herd.transit?.toCampId;
    if (there === dest) agent.crossedDest = true;
    return;
  }
  if (hereCamp?.rect) {
    let sx = there === here ? nx : agent.x;
    let sy = there === here ? ny : agent.y;
    if (there !== here) {
      const upcoming = gates.find((item) => item.fromCamp === here || item.toCamp === here);
      if (upcoming) {
        const budget = Math.hypot(nx - agent.x, ny - agent.y);
        const dx = upcoming.x - agent.x;
        const dy = upcoming.y - agent.y;
        const dist = Math.hypot(dx, dy) || 1;
        const scale = Math.min(1, budget / dist);
        sx = agent.x + dx * scale;
        sy = agent.y + dy * scale;
      }
    }
    const clamped = clampToCamp(hereCamp, sx, sy, driveInset);
    agent.x = clamped.x;
    agent.y = clamped.y;
  }
}

function stepDrive(state: GameState, runtime: Runtime, dt: number, leadDist: number, config: GameConfig): void {
  const transit = state.herd.transit;
  if (!transit || !runtime.geom) return;
  beginDrive(state, runtime);
  const geom = runtime.geom;
  if (!geom) return;
  const members = herdMembers(state);
  const speed = cattleMps(config);
  const maxStep = speed * dt;
  const cell = COW_LENGTH_METRES * 2;
  const agents: HerdAgent[] = [];
  for (const animal of members) {
    const agent = runtime.agents.get(animal.id);
    if (agent) agents.push(agent);
  }
  const grid = buildGrid(agents, cell);
  const behind = fileLimit(agents);
  let front: HerdAgent | null = null;

  for (const animal of members) {
    const agent = runtime.agents.get(animal.id);
    if (!agent) continue;
    if (agent.delayLeft > 0) {
      agent.delayLeft = Math.max(0, agent.delayLeft - dt);
      agent.mode = "stand";
      agent.grazeHeadDown = false;
      animal.activity = "graze";
      if (!front || agent.pathCursor > front.pathCursor) front = agent;
      continue;
    }
    // Cursor is where the cow actually is, not where the clock says the lead is.
    // Looking ahead only while the cow is already on the path stops a far cow
    // from cutting a fence to reach a point on the other side of the gate.
    const achieved = projectPath(transit.path, geom, agent.x, agent.y);
    agent.pathCursor = achieved;
    const here = samplePath(transit.path, geom, achieved);
    const onPath = Math.hypot(here.x - agent.x, here.y - agent.y) < 8;
    let targetCursor = achieved;
    let hugCentre = false;
    if (onPath) {
      const desired = Math.min(geom.length, Math.max(achieved, leadDist - agent.lagM));
      targetCursor = Math.min(desired, achieved + Math.max(10, maxStep));
      const capped = behind.get(agent.id);
      const filing = runtime.gates.some((gate) => Math.abs(achieved - gate.dist) < HERD_MOTION_TUNING.gateQueueM + 24);
      if (capped !== undefined && filing) targetCursor = Math.min(targetCursor, Math.max(achieved, capped));
    }
    for (const gate of runtime.gates) {
      if (achieved >= gate.dist + 1) continue;
      if (Math.abs(achieved - gate.dist) > 18 && targetCursor > gate.dist - 1.2) {
        targetCursor = gate.dist - 1.2;
      }
      // Walk to the centre of the opening before stepping through. A side lane
      // aimed past the wire leaves the cow pinned on the fence.
      const offGate = Math.hypot(agent.x - gate.x, agent.y - gate.y);
      if (offGate > HERD_MOTION_TUNING.gateLaneHalfM + 0.35 && achieved < gate.dist + 0.4) {
        targetCursor = Math.min(targetCursor, gate.dist - 1.2);
        hugCentre = true;
      }
      // A long look-ahead past the gate cuts the corner and misses the opening.
      const standing = pointCampId(state, agent.x, agent.y);
      if (standing === gate.fromCamp && targetCursor > gate.dist + 2) {
        targetCursor = gate.dist + 2;
      }
    }
    agent.mode = targetCursor > achieved + 0.05 ? "follow" : "stand";
    const sample = samplePath(transit.path, geom, targetCursor);
    const lane = hugCentre ? 0 : laneAt(agent, runtime.gates);
    const gx = sample.x - sample.ty * lane;
    const gy = sample.y + sample.tx * lane;
    let dx = gx - agent.x;
    let dy = gy - agent.y;
    const beforeX = agent.x;
    const beforeY = agent.y;
    const nearGate = runtime.gates.some(
      (gate) => Math.abs(agent.pathCursor - gate.dist) < HERD_MOTION_TUNING.gateQueueM + 24,
    );
    const minGap = COW_LENGTH_METRES * HERD_MOTION_TUNING.minGapFractionOfBody;
    const push = separation(agent, grid, cell, minGap);
    let waitBehind = false;
    if (nearGate) {
      for (const other of agents) {
        if (other.id === agent.id) continue;
        if (other.pathCursor <= agent.pathCursor + 0.35) continue;
        if (Math.hypot(agent.x - other.x, agent.y - other.y) >= minGap) continue;
        waitBehind = true;
        break;
      }
    }
    if (waitBehind) {
      // Inside the gap of a cow further up the path. Wait, and only step apart.
      dx = push.x * maxStep;
      dy = push.y * maxStep;
    } else {
      dx += push.x * maxStep * 0.45;
      dy += push.y * maxStep * 0.45;
    }
    const dist = Math.hypot(dx, dy);
    const scale = dist > maxStep && dist > 0 ? maxStep / dist : 1;
    const nx = agent.x + dx * scale;
    const ny = agent.y + dy * scale;
    commitDriveStep(state, animal, agent, nx, ny, runtime.gates);
    if (Math.hypot(agent.x - beforeX, agent.y - beforeY) > 0.02) {
      agent.heading = Math.atan2(agent.y - beforeY, agent.x - beforeX);
    }
    agent.grazeHeadDown = false;
    animal.tileX = agent.x;
    animal.tileY = agent.y;
    animal.activity = agent.mode === "follow" ? "walk" : "graze";
    if (pointCampId(state, agent.x, agent.y) === transit.toCampId) agent.crossedDest = true;
    if (!front || agent.pathCursor > front.pathCursor) front = agent;
  }

  if (front && pointCampId(state, front.x, front.y) === transit.toCampId) {
    state.herd.campId = transit.toCampId;
  }
}

/**
 * Advance every cow by a slice of game time. Large slices are split into
 * fixed steps so a slow frame and a fast frame land on the same decision.
 * Pause passes 0 and nothing moves.
 */
export function advanceHerdMotion(
  state: GameState,
  gameSeconds: number,
  kind: "graze" | "drive" | "hold",
  config: GameConfig = CONFIG,
  stepSeconds: number = HERD_MOTION_TUNING.simStepGameS,
): void {
  if (!usesMetreCoords(state)) return;
  const runtime = ensureHerdAgents(state);
  if (kind === "hold" || gameSeconds <= 0) return;
  const transit = state.herd.transit;
  const driving = kind === "drive" && Boolean(transit && transit.phase !== "approach" && transit.phase !== "night");
  if (driving && transit) beginDrive(state, runtime);
  const step = Math.max(0.05, stepSeconds);
  let left = gameSeconds;
  let lead = driving && transit && runtime.geom ? transit.progress * runtime.geom.length : 0;
  const speed = cattleMps(config);
  let guard = 0;
  while (left > 1e-5 && guard < 200000) {
    const dt = Math.min(step, left);
    if (driving && transit && runtime.geom) {
      lead = Math.min(runtime.geom.length, lead + speed * dt);
      stepDrive(state, runtime, dt, lead, config);
    } else {
      stepGraze(state, runtime, dt, config);
    }
    left -= dt;
    guard += 1;
  }
}

/** True once the lead is at the end of the path and every herd cow has crossed. */
export function herdDriveReadyToFinish(state: GameState): boolean {
  const transit = state.herd.transit;
  if (!transit) return false;
  const runtime = runtimes.get(state);
  if (!runtime?.geom) return false;
  const dest = transit.toCampId;
  const members = herdMembers(state);
  if (members.length === 0) return true;
  let front = 0;
  for (const animal of members) {
    const agent = runtime.agents.get(animal.id);
    if (!agent) return false;
    const camp = pointCampId(state, agent.x, agent.y);
    if (camp !== dest) return false;
    if (agent.pathCursor > front) front = agent.pathCursor;
  }
  return front >= Math.max(0, runtime.geom.length - 14);
}

/** Drop the drive and graze from wherever each cow is already standing. */
export function releaseHerdToGraze(state: GameState): void {
  const runtime = runtimes.get(state);
  if (!runtime) return;
  for (const animal of herdMembers(state)) {
    const agent = runtime.agents.get(animal.id);
    if (!agent) continue;
    const idn = idHash(animal.id);
    const ang = unit(state.seed, idn, agent.switches + 3, 12) * Math.PI * 2;
    const rad = 3 + unit(state.seed, idn, agent.switches + 4, 13) * 9;
    const camp = homeCamp(state, animal);
    let x = agent.x + Math.cos(ang) * rad;
    let y = agent.y + Math.sin(ang) * rad;
    if (camp?.rect) {
      const clamped = clampToCamp(camp, x, y, HERD_MOTION_TUNING.fenceInsetM);
      x = clamped.x;
      y = clamped.y;
    }
    agent.mode = "graze";
    agent.grazeHeadDown = true;
    agent.drinkPhase = "none";
    agent.delayLeft = 0;
    agent.targetX = x;
    agent.targetY = y;
    agent.timer = lerp(
      HERD_MOTION_TUNING.grazeBoutMinS,
      HERD_MOTION_TUNING.grazeBoutMaxS,
      unit(state.seed, idn, agent.switches + 5, 14),
    );
    agent.switches += 1;
    animal.activity = "graze";
  }
  runtime.driveToken = null;
  runtime.geom = null;
  runtime.gates = [];
  runtime.originCampId = null;
}
