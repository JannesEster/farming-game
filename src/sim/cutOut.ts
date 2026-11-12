import { CONFIG, type GameConfig } from "./config";
import { isDaylightHour } from "./clock";
import { columnMetrics } from "./convoy";
import { baseLivePrice, channelPriceFactor, conditionPriceFactor, sellingCosts } from "./economy";
import { chooseAvailableHerder, herderIsBusy } from "./herding";
import { findAnimal, livingAnimals } from "./animals";
import { pathLengthKm, planHerdPath, pointOnPath } from "./path";
import { STEP3C } from "./step3cConfig";
import { herdInTransit, moveDurationMs, walkGameHours, type TransitSpeed } from "./transit";
import { handlingPenTile, kraalDestinationCampId } from "./yard";
import type { GameState, HerderId, TilePoint } from "./types";
import type { AnimalRecord, CutOutOrder, PersonPresence, SaleChannel, SaleLine } from "./storyTypes";

export type CutOutResult =
  | { ok: true; queued: boolean; message: string }
  | { ok: false; message: string };

function presenceFor(state: GameState, herder: HerderId | null): PersonPresence | null {
  if (!state.story || !herder) return null;
  return herder === "piet" ? (state.story.farmhandPresence ?? null) : (state.story.farmerPresence ?? null);
}

function homeTile(state: GameState, herder: HerderId): TilePoint {
  if (herder === "piet") {
    const house = state.features.find((feature) => feature.kind === "worker_house");
    if (house) return { x: house.x, y: house.y };
  }
  const house = state.features.find((feature) => feature.kind === "house");
  if (house) return { x: house.x, y: house.y };
  return { x: 1, y: 1 };
}

function centroid(animals: AnimalRecord[]): TilePoint {
  if (animals.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const animal of animals) {
    x += animal.tileX;
    y += animal.tileY;
  }
  return { x: x / animals.length, y: y / animals.length };
}

function buildPath(state: GameState, animals: AnimalRecord[], order: Pick<CutOutOrder, "destination">): TilePoint[] {
  const fromCamp = animals[0]?.campId ?? state.herd.campId;
  const start = centroid(animals);
  let path: TilePoint[] = [];
  if (order.destination.kind === "camp") {
    path = planHerdPath(state, fromCamp, order.destination.campId);
  } else {
    const kraalCamp = kraalDestinationCampId(state);
    path = kraalCamp === null ? [] : planHerdPath(state, fromCamp, kraalCamp);
    const kraal = handlingPenTile(state);
    if (kraal) path = [...path, kraal];
  }
  if (path.length === 0) path = [start, start];
  const first = path[0];
  if (Math.hypot(first.x - start.x, first.y - start.y) > 1.2) path = [start, ...path];
  return path;
}

export function cutOutActive(state: GameState): boolean {
  const order = state.story?.cutOut;
  return Boolean(order && order.phase !== "done");
}

export function requestCutOut(
  state: GameState,
  animalIds: string[],
  destination: CutOutOrder["destination"],
  channel: SaleChannel = "auction",
  config: GameConfig = CONFIG,
): CutOutResult {
  if (!state.story) return { ok: false, message: "The herd is not ready." };
  if (cutOutActive(state)) return { ok: false, message: "A cut-out is already on the go." };
  const unique = [...new Set(animalIds)];
  const animals = unique
    .map((id) => findAnimal(state, id))
    .filter((animal): animal is AnimalRecord => Boolean(animal && animal.whereabouts !== "sold"));
  if (animals.length === 0) return { ok: false, message: "Pick the animals first." };
  if (destination.kind === "camp" && !state.camps.some((camp) => camp.id === destination.campId)) {
    return { ok: false, message: "That camp is not on this farm." };
  }
  const order: CutOutOrder = {
    animalIds: animals.map((animal) => animal.id),
    destination,
    channel: destination.kind === "kraal" ? channel : null,
    herder: null,
    phase: "queued",
    path: [],
    progress: 0,
    approachProgress: 0,
    distanceKm: 0,
    walkGameHours: 0,
    hoursApplied: 0,
  };
  state.story.cutOut = order;
  if (!isDaylightHour(state.date.hour)) {
    order.queueReason = "night";
    return { ok: true, queued: true, message: "Queued until morning. Nobody drives cattle in the dark." };
  }
  if (herderIsBusy(state) || herdInTransit(state.herd)) {
    order.queueReason = "no_herder";
    return { ok: true, queued: true, message: "Queued. The herder is still with the other cattle." };
  }
  beginCutOutWalk(state, config);
  const who = order.herder === "piet" ? "Piet is" : "You are";
  return { ok: true, queued: false, message: `${who} walking out to separate them.` };
}

export function beginCutOutWalk(state: GameState, config: GameConfig = CONFIG): boolean {
  const order = state.story?.cutOut;
  if (!order || order.phase === "done") return false;
  const herder = chooseAvailableHerder(state);
  if (!herder) return false;
  const animals = order.animalIds
    .map((id) => findAnimal(state, id))
    .filter((animal): animal is AnimalRecord => Boolean(animal));
  if (animals.length === 0) {
    order.phase = "done";
    return false;
  }
  order.herder = herder;
  order.queueReason = undefined;
  order.path = buildPath(state, animals, order);
  order.distanceKm = pathLengthKm(order.path, config);
  order.walkGameHours = walkGameHours(order.distanceKm, config);
  order.progress = 0;
  order.approachProgress = 0;
  order.hoursApplied = 0;
  order.phase = "approach";
  return true;
}

function approachMs(state: GameState, config: GameConfig): number {
  const order = state.story?.cutOut;
  if (!order?.herder) return STEP3C.cutOutApproachBaseMs;
  const from = homeTile(state, order.herder);
  const animals = order.animalIds
    .map((id) => findAnimal(state, id))
    .filter((animal): animal is AnimalRecord => Boolean(animal));
  const meet = animals.length > 0 ? centroid(animals) : from;
  const dist = Math.hypot(meet.x - from.x, meet.y - from.y);
  const km = dist * config.transit.kmPerTile;
  return Math.max(STEP3C.cutOutApproachBaseMs, km * STEP3C.cutOutApproachBaseMs * 3.2);
}

function syncApproach(state: GameState): void {
  const order = state.story?.cutOut;
  if (!order || order.phase !== "approach" || !order.herder) return;
  const presence = presenceFor(state, order.herder);
  if (!presence) return;
  const from = homeTile(state, order.herder);
  const animals = order.animalIds
    .map((id) => findAnimal(state, id))
    .filter((animal): animal is AnimalRecord => Boolean(animal));
  const meet = animals.length > 0 ? centroid(animals) : from;
  const t = order.approachProgress;
  presence.tileX = from.x + (meet.x - from.x) * t;
  presence.tileY = from.y + (meet.y - from.y) * t;
  presence.targetTileX = meet.x;
  presence.targetTileY = meet.y;
  presence.walkProgress = t < 1 ? 0.35 : 1;
  presence.activityLabel = t < 1 ? "Walking out to the cattle" : "Separating the group";
  presence.onHerdingDuty = true;
  presence.atHome = false;
}

/** Herder tile progress along the drive, behind the last animal. Uses convoy spacing. */
export function cutOutHerderProgress(state: GameState): number {
  const order = state.story?.cutOut;
  if (!order || order.path.length < 2) return 0;
  return columnMetrics(order.path, order.progress, Math.max(1, order.animalIds.length)).herderProgress;
}

export function cutOutRearProgress(state: GameState): number {
  const order = state.story?.cutOut;
  if (!order || order.path.length < 2) return 0;
  return columnMetrics(order.path, order.progress, Math.max(1, order.animalIds.length)).rearProgress;
}

function syncDrive(state: GameState): void {
  const order = state.story?.cutOut;
  if (!order || order.phase !== "drive" || !order.herder) return;
  const presence = presenceFor(state, order.herder);
  if (!presence || order.path.length < 2) return;
  const metrics = columnMetrics(order.path, order.progress, Math.max(1, order.animalIds.length));
  const tile = pointOnPath(order.path, metrics.herderProgress);
  presence.tileX = tile.x;
  presence.tileY = tile.y;
  presence.targetTileX = tile.x;
  presence.targetTileY = tile.y;
  presence.walkProgress = 0.45;
  presence.activityLabel = "Driving the cut-out group";
  presence.onHerdingDuty = true;
  presence.atHome = false;
  order.animalIds.forEach((id, index) => {
    const animal = findAnimal(state, id);
    if (!animal) return;
    const rank = order.animalIds.length <= 1 ? 0 : index - (order.animalIds.length - 1) / 2;
    const along = metrics.centerTiles + rank * metrics.spacingTiles;
    const progress = Math.max(0, Math.min(0.999, along / metrics.total));
    const at = pointOnPath(order.path, progress);
    const ahead = pointOnPath(order.path, Math.min(0.999, progress + 0.01));
    animal.tileX = at.x;
    animal.tileY = at.y;
    animal.activity = "walk";
    animal.whereabouts = "cut_out";
    const dx = ahead.x - at.x;
    const dy = ahead.y - at.y;
    animal.facing = octantFromTileDelta(dx, dy);
  });
}

function octantFromTileDelta(dx: number, dy: number): number {
  const sx = dx - dy;
  const sy = (dx + dy) * 0.5;
  if (sx === 0 && sy === 0) return 0;
  const oct = Math.round(Math.atan2(sy, sx) / (Math.PI / 4));
  return ((oct % 8) + 8) % 8;
}

function linesFor(state: GameState, animals: AnimalRecord[], channel: SaleChannel): SaleLine[] {
  const groups = new Map<AnimalRecord["stockClass"], AnimalRecord[]>();
  for (const animal of animals) {
    const list = groups.get(animal.stockClass) ?? [];
    list.push(animal);
    groups.set(animal.stockClass, list);
  }
  const lines: SaleLine[] = [];
  for (const [stockClass, group] of groups) {
    const base = baseLivePrice(stockClass, CONFIG, state);
    const weight = group.reduce((sum, animal) => sum + animal.weightKg, 0) / group.length;
    const condition = group.reduce((sum, animal) => sum + animal.condition, 0) / group.length;
    const factor = conditionPriceFactor(condition) * channelPriceFactor(channel);
    const gross = base.baseNadPerKgLive * weight * factor * group.length;
    const costs = sellingCosts(gross, channel, group.length);
    lines.push({
      stockClass,
      count: group.length,
      channel,
      pricePerKgLive: base.baseNadPerKgLive * factor,
      totalNad: Math.max(0, gross - costs),
    });
  }
  return lines;
}

function linesReady(state: GameState, animals: AnimalRecord[], order: CutOutOrder): boolean {
  const story = state.story;
  if (!story || animals.length === 0) return false;
  const channel = order.channel ?? "auction";
  const lines = linesFor(state, animals, channel);
  if (!lines[0]) return false;
  story.saleConvoy = {
    stockClass: lines[0].stockClass,
    count: animals.length,
    channel,
    quoted: lines[0],
    lines,
    animalIds: animals.map((animal) => animal.id),
    phase: "kraal",
    phaseProgress: 0,
    paid: false,
    herder: order.herder ?? "farmer",
    toCampId: kraalDestinationCampId(state) ?? state.herd.campId,
    driveStarted: true,
  };
  return true;
}

function finishDrive(state: GameState): void {
  const story = state.story;
  const order = story?.cutOut;
  if (!story || !order) return;
  const animals = order.animalIds
    .map((id) => findAnimal(state, id))
    .filter((animal): animal is AnimalRecord => Boolean(animal));
  if (order.destination.kind === "camp") {
    const destId = order.destination.campId;
    const anchor = state.camps.find((item) => item.id === destId)?.anchor;
    for (const animal of animals) {
      animal.whereabouts = "in_camp";
      animal.split = true;
      animal.campId = destId;
      animal.activity = "graze";
      if (anchor) {
        animal.tileX = anchor.x;
        animal.tileY = anchor.y;
      }
    }
  } else if (linesReady(state, animals, order)) {
    const kraal = handlingPenTile(state);
    for (const animal of animals) {
      animal.activity = "idle";
      if (kraal) {
        animal.tileX = kraal.x;
        animal.tileY = kraal.y;
      }
    }
  }
  const presence = presenceFor(state, order.herder);
  if (presence) {
    presence.onHerdingDuty = false;
    presence.activityLabel = "Back from the cattle";
    presence.walkProgress = 1;
  }
  order.phase = "done";
  order.progress = 1;
}

export function tickCutOutRealtime(
  state: GameState,
  deltaMs: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): void {
  const order = state.story?.cutOut;
  if (!order || order.phase === "done") return;
  if (!isDaylightHour(state.date.hour)) return;
  if (order.phase === "queued") {
    if (herderIsBusy(state) || herdInTransit(state.herd)) return;
    if (!beginCutOutWalk(state, config)) return;
  }
  if (mode === "pause") return;
  const mult = mode === "x3" ? 3 : mode === "x2" ? 2 : 1;
  if (order.phase === "approach") {
    order.approachProgress = Math.min(1, order.approachProgress + (deltaMs * mult) / approachMs(state, config));
    syncApproach(state);
  if (order.approachProgress >= 1) {
      order.phase = "drive";
      order.progress = 0;
      for (const id of order.animalIds) {
        const animal = findAnimal(state, id);
        if (animal) animal.whereabouts = "cut_out";
      }
    }
    return;
  }
  const duration = moveDurationMs(order.distanceKm, "x1", config);
  order.progress = Math.min(1, order.progress + (deltaMs * mult) / Math.max(1, duration));
  syncDrive(state);
  if (order.progress >= 1) finishDrive(state);
}

export function selectedOr(state: GameState, ids: string[]): string[] {
  if (ids.length > 0) return ids;
  return state.story?.selectedAnimalIds ?? [];
}

export function escapedAnimalIds(state: GameState): string[] {
  return livingAnimals(state)
    .filter((animal) => animal.whereabouts === "escaped" || animal.whereabouts === "neighbour")
    .map((animal) => animal.id);
}
