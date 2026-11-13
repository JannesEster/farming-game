import { CONFIG, type GameConfig } from "./config";
import { clamp, lerp } from "./math";
import { dailyDemandKg, effectiveGrazingHectares, residualDmKgPerHa } from "./pasture";
import { ensureAnimals } from "./animals";
import { createStoryState, initStoryPeople } from "./story";
import type { Rng } from "./rng";
import {
  TILE_OUTSIDE,
  type CampRect,
  type CampState,
  type Feature,
  type GameState,
  type TilePoint,
} from "./types";
import type { FarmWaterPoint } from "./storyTypes";

export function farmSideMetres(hectares: number): number {
  return Math.max(1, Math.round(Math.sqrt(hectares * 10000)));
}

/** About 5.7 km by 5.7 km at 3,300 ha. The side is the square root of the listed area. */
export function farmOutlineMetres(hectares: number): { width: number; height: number } {
  const side = Math.max(1, Math.round(Math.sqrt(Math.max(1, hectares) * 10000)));
  return { width: side, height: side };
}

/**
 * 8, 9, or 10 camps. A short mix of the seed, not a row count.
 * Seed 3300 is 9. The Omaheke map seeds used by the picker land on the other two.
 */
export function campCountForSeed(seed: number): 8 | 9 | 10 {
  const text = `${Math.abs(Math.trunc(seed))}:1`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  const pick = hash % 3;
  if (pick === 0) return 9;
  if (pick === 1) return 10;
  return 8;
}

export function usesMetreCoords(state: {
  camps: { rect?: CampRect }[];
  campIds: readonly number[];
  width: number;
  height: number;
}): boolean {
  if (state.camps.some((camp) => camp.rect)) return true;
  return state.width > 400 && state.campIds.length !== state.width * state.height;
}

export function pointCampId(state: GameState, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return TILE_OUTSIDE;
  for (const camp of state.camps) {
    const rect = camp.rect;
    if (!rect) continue;
    if (x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h) return camp.id;
  }
  if (state.camps.some((camp) => camp.rect)) return TILE_OUTSIDE;
  const index = Math.round(y) * state.width + Math.round(x);
  const id = state.campIds[index];
  return id === undefined ? TILE_OUTSIDE : id;
}

/** Shared edge between two rectangles, with a 1 m step that is the gate. */
export function metreSharedGate(
  a: CampRect,
  b: CampRect,
): { from: TilePoint; to: TilePoint } | null {
  const vertical = Math.abs(a.x + a.w - b.x) < 0.5 || Math.abs(b.x + b.w - a.x) < 0.5;
  const horizontal = Math.abs(a.y + a.h - b.y) < 0.5 || Math.abs(b.y + b.h - a.y) < 0.5;
  if (vertical && !horizontal) {
    const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (overlap < 4) return null;
    const mid = Math.round((Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2);
    const boundary = Math.abs(a.x + a.w - b.x) < 0.5 ? Math.round(a.x + a.w) : Math.round(b.x + b.w);
    const aOnLeft = a.x <= b.x;
    const from = aOnLeft ? { x: boundary - 1, y: mid } : { x: boundary, y: mid };
    const to = aOnLeft ? { x: boundary, y: mid } : { x: boundary - 1, y: mid };
    return { from, to };
  }
  if (horizontal && !vertical) {
    const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (overlap < 4) return null;
    const mid = Math.round((Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2);
    const boundary = Math.abs(a.y + a.h - b.y) < 0.5 ? Math.round(a.y + a.h) : Math.round(b.y + b.h);
    const aAbove = a.y <= b.y;
    const from = aAbove ? { x: mid, y: boundary - 1 } : { x: mid, y: boundary };
    const to = aAbove ? { x: mid, y: boundary } : { x: mid, y: boundary - 1 };
    return { from, to };
  }
  return null;
}

type BandFractions = { y0: number; y1: number; xs: number[] };

/**
 * Three bands. Cuts do not line up, so the fences are not a noughts-and-crosses grid.
 * Fractions are the 20 km by 14.85 km plan. Smaller camps sit in the south, nearer the house.
 */
const CAMP_BANDS: Record<8 | 9 | 10, BandFractions[]> = {
  9: [
    { y0: 0, y1: 6400 / 14850, xs: [0, 8500 / 20000, 1] },
    { y0: 6400 / 14850, y1: 10800 / 14850, xs: [0, 4200 / 20000, 11500 / 20000, 1] },
    { y0: 10800 / 14850, y1: 1, xs: [0, 3600 / 20000, 7000 / 20000, 12500 / 20000, 1] },
  ],
  8: [
    { y0: 0, y1: 6400 / 14850, xs: [0, 8500 / 20000, 1] },
    { y0: 6400 / 14850, y1: 10800 / 14850, xs: [0, 4200 / 20000, 11500 / 20000, 1] },
    { y0: 10800 / 14850, y1: 1, xs: [0, 7000 / 20000, 12500 / 20000, 1] },
  ],
  10: [
    { y0: 0, y1: 6400 / 14850, xs: [0, 8500 / 20000, 0.7, 1] },
    { y0: 6400 / 14850, y1: 10800 / 14850, xs: [0, 4200 / 20000, 11500 / 20000, 1] },
    { y0: 10800 / 14850, y1: 1, xs: [0, 3600 / 20000, 7000 / 20000, 12500 / 20000, 1] },
  ],
};

function snapEdges(fractions: number[], total: number): number[] {
  const edges = fractions.map((fraction, index) =>
    index === 0 ? 0 : index === fractions.length - 1 ? total : Math.round(fraction * total),
  );
  for (let i = 1; i < edges.length; i += 1) {
    if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
  }
  edges[edges.length - 1] = total;
  return edges;
}

/** Mixed squares and rectangles. Straight axis-aligned fences. No gaps. */
export function metreCampRects(count: number, width: number, height = width): CampRect[] {
  const plan = count === 8 || count === 10 || count === 9 ? CAMP_BANDS[count] : CAMP_BANDS[9];
  const yEdges = snapEdges(
    plan.map((band) => band.y0).concat(1),
    height,
  );
  const rects: CampRect[] = [];
  for (let row = 0; row < plan.length; row += 1) {
    const y = yEdges[row];
    const h = yEdges[row + 1] - y;
    const xEdges = snapEdges(plan[row].xs, width);
    for (let col = 0; col < xEdges.length - 1; col += 1) {
      rects.push({ x: xEdges[col], y, w: xEdges[col + 1] - xEdges[col], h });
    }
  }
  return rects;
}

function inside(rect: CampRect, point: TilePoint, inset = 2): TilePoint {
  return {
    x: Math.round(clamp(point.x, rect.x + inset, rect.x + rect.w - inset - 1)),
    y: Math.round(clamp(point.y, rect.y + inset, rect.y + rect.h - inset - 1)),
  };
}

function polyline(from: TilePoint, to: TilePoint, step: number): TilePoint[] {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.max(1, Math.round(dist / step));
  const points: TilePoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    points.push({
      x: Math.round(from.x + (to.x - from.x) * t),
      y: Math.round(from.y + (to.y - from.y) * t),
    });
  }
  return points;
}

/** One trough on a shared fence for every camp. A trough can water the camp on each side. */
function placeSharedWater(camps: CampState[]): FarmWaterPoint[] {
  const edges: { a: number; b: number; x: number; y: number }[] = [];
  for (let i = 0; i < camps.length; i += 1) {
    for (let j = i + 1; j < camps.length; j += 1) {
      const left = camps[i].rect;
      const right = camps[j].rect;
      if (!left || !right) continue;
      const gate = metreSharedGate(left, right);
      if (!gate) continue;
      const vertical = Math.abs(left.x + left.w - right.x) < 0.5 || Math.abs(right.x + right.w - left.x) < 0.5;
      const overlap = vertical
        ? Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y)
        : Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
      const shift = Math.min(90, Math.max(8, overlap / 4));
      const x = vertical ? gate.from.x : Math.round(gate.from.x + shift);
      const y = vertical ? Math.round(gate.from.y + shift) : gate.from.y;
      edges.push({ a: camps[i].id, b: camps[j].id, x, y });
    }
  }
  const served = new Set<number>();
  const points: FarmWaterPoint[] = [];
  const remaining = edges.slice();
  while (served.size < camps.length && remaining.length > 0) {
    const index = remaining.findIndex((edge) => !served.has(edge.a) || !served.has(edge.b));
    if (index < 0) break;
    const edge = remaining.splice(index, 1)[0];
    served.add(edge.a);
    served.add(edge.b);
    points.push({
      id: `water-${points.length + 1}`,
      tile: { x: edge.x, y: edge.y },
      trough: { x: edge.x, y: edge.y },
      pump: points.length % 2 === 0 ? "windmill" : "solar",
      reservoir: points.length % 3 === 0,
      servedCampIds: [edge.a, edge.b],
      lick: false,
    });
  }
  return points;
}

export function buildMetreFarm(rng: Rng, config: GameConfig = CONFIG, seed = config.worldSeed): GameState {
  const outline = farmOutlineMetres(config.farm.hectares);
  const campCount = campCountForSeed(seed);
  const rects = metreCampRects(campCount, outline.width, outline.height);
  const camps: CampState[] = rects.map((rect, id) => {
    const openness = rng.next();
    const peak = clamp(
      config.pasture.peakDmKgPerHa * lerp(config.pasture.bushyPeakFraction, 1, openness),
      config.pasture.forageDmKgPerHaMin,
      config.pasture.forageDmKgPerHaMax,
    );
    const cover = lerp(config.pasture.startingCoverMin, config.pasture.startingCoverMax, rng.next());
    const anchor = inside(rect, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, 20);
    return {
      id,
      name: `Camp ${id + 1}`,
      hectares: (rect.w * rect.h) / 10000,
      peakDmKgPerHa: peak,
      standingDmKgPerHa: peak * cover,
      soilMoistureMm: 0,
      restDays: 0,
      tiles: [anchor],
      anchor,
      rect,
    };
  });

  let host = camps[0];
  for (const camp of camps) {
    const best = host.rect!;
    const rect = camp.rect!;
    const bestSouth = best.y + best.h;
    const south = rect.y + rect.h;
    if (south > bestSouth + 1) host = camp;
    else if (Math.abs(south - bestSouth) <= 1 && rect.x < best.x) host = camp;
  }
  const rect = host.rect!;
  const house = inside(rect, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, 40);
  const features: Feature[] = [
    { kind: "house", x: house.x, y: house.y, scale: 1 },
    { kind: "worker_house", x: house.x + 14, y: house.y - 6, scale: 1 },
    { kind: "worker_house", x: house.x + 12, y: house.y + 10, scale: 1 },
    { kind: "shed", x: house.x - 12, y: house.y + 6, scale: 1 },
    { kind: "windmill", x: house.x + 10, y: house.y - 8, scale: 1 },
    { kind: "reservoir", x: house.x + 14, y: house.y + 2, scale: 1 },
    { kind: "lick_feeder", x: house.x + 4, y: house.y + 12, scale: 0.85 },
  ];

  // Handling yard sits out in the camp, a few hundred metres from the house,
  // beside the two-track. The road runs from the homestead, past the yard, to the boundary.
  const roadX = Math.round(house.x + 26);
  const boundaryY = rect.y + rect.h - 4;
  const yardY = Math.round(Math.min(house.y + 320, boundaryY - 50));
  const ramp = { x: roadX - 1, y: yardY };
  features.push(
    { kind: "loading_ramp", x: ramp.x, y: ramp.y, scale: 1 },
    { kind: "holding_pen", x: roadX - 18, y: yardY - 10, scale: 1 },
    { kind: "holding_pen", x: roadX - 18, y: yardY + 8, scale: 1 },
    { kind: "holding_pen", x: roadX - 32, y: yardY - 1, scale: 1.2 },
    { kind: "crush", x: roadX - 8, y: yardY + 1, scale: 1 },
    { kind: "race", x: roadX - 12, y: yardY, scale: 1 },
    { kind: "handling_roof", x: roadX - 8, y: yardY + 1, scale: 1 },
  );

  const roadStart = { x: roadX, y: Math.round(house.y + 12) };
  const road = polyline({ x: house.x + 16, y: house.y + 8 }, roadStart, 8);
  for (const point of polyline(roadStart, { x: roadX, y: boundaryY }, 1)) {
    const last = road[road.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) road.push(point);
  }
  road.push({ x: ramp.x + 1, y: ramp.y });
  for (const point of road) features.push({ kind: "track", x: point.x, y: point.y, scale: 1 });

  const waterPoints = placeSharedWater(camps);
  for (const point of waterPoints) {
    features.push({ kind: "trough", x: point.trough.x, y: point.trough.y, scale: 1 });
  }

  const start = inside(rect, { x: house.x - 18, y: house.y - 80 }, 24);
  host.anchor = start;
  if (!host.tiles.some((tile) => tile.x === start.x && tile.y === start.y)) host.tiles.push(start);
  const hostWater = waterPoints.find((point) => point.servedCampIds.includes(host.id));
  if (hostWater && !host.tiles.some((tile) => tile.x === hostWater.trough.x && tile.y === hostWater.trough.y)) {
    host.tiles.push({ x: hostWater.trough.x, y: hostWater.trough.y });
  }

  const demand = dailyDemandKg(
    {
      name: config.herd.name,
      headCount: config.herd.headCount,
      averageLiveweightKg: config.herd.averageLiveweightKg,
      condition: config.herd.startingCondition,
      campId: host.id,
      daysInCamp: config.herd.startingDaysInCamp,
      transit: null,
    },
    config,
  );
  const grazeHa = effectiveGrazingHectares(host.hectares, config);
  const floor = residualDmKgPerHa(host.peakDmKgPerHa, config);
  if (demand > 0 && grazeHa > 0) {
    const needed = floor + (config.pasture.openingMinGrassDays * demand) / grazeHa;
    host.standingDmKgPerHa = Math.min(host.peakDmKgPerHa, Math.max(host.standingDmKgPerHa, needed));
  }

  const state: GameState = {
    seed: 0,
    rngState: rng.getState(),
    clock: {
      settings: {
        dayLengthSeconds: config.time.dayLengthSecondsDefault as 180 | 240 | 300,
        daysPerMonth: config.calendar.daysPerMonthDefault,
        catchUpCapMs: config.time.catchUpCapMs,
      },
      bankMs: 0,
      speed: 1,
    },
    notifications: { log: [], letters: [], alerts: [], lastFiredDayKey: {} },
    date: {
      year: config.calendar.startYear,
      month: config.calendar.startMonth,
      day: config.calendar.startDay,
      hour: config.calendar.startHour,
    },
    seasonRainMm: 0,
    todayRainMm: 0,
    cashNad: config.economy.startingCashNad,
    width: outline.width,
    height: outline.height,
    campIds: [],
    camps,
    herd: {
      name: config.herd.name,
      headCount: config.herd.headCount,
      averageLiveweightKg: config.herd.averageLiveweightKg,
      condition: config.herd.startingCondition,
      campId: host.id,
      daysInCamp: config.herd.startingDaysInCamp,
      transit: null,
    },
    features,
    road,
    farmWaterPoints: waterPoints,
    story: createStoryState(config.herd.headCount, config),
    stateVersion: 9,
  };
  initStoryPeople(state, config);
  ensureAnimals(state, config);
  return state;
}
