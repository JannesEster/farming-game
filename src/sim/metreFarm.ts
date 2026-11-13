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

/**
 * Trees on the farm before the area was tripled: 162 trees on 3,300 ha.
 * Every property uses this density, so the veld stays open once distances are real.
 */
export const TREES_PER_HECTARE = 162 / 3300;
/** Bushes per tree. Assumption, so the veld stays sparse. */
export const BUSHES_PER_TREE = 0.45;
const TREE_GAP_M = 70;
const BUSH_GAP_M = 40;
const BUILDING_CLEAR_M = 18;
const WATER_CLEAR_M = 16;
const ROAD_CLEAR_M = 8;

export function farmSideMetres(hectares: number): number {
  return Math.max(1, Math.round(Math.sqrt(hectares * 10000)));
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

function spread(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  let extra = total - base * parts;
  return Array.from({ length: parts }, () => {
    const add = extra > 0 ? 1 : 0;
    extra -= add;
    return base + add;
  });
}

function rectAspect(w: number, h: number): number {
  const short = Math.min(w, h);
  if (short <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(w, h) / short;
}

/** Square-ish rectangles that tile `side` by `side` without gaps or overlaps. */
export function metreCampRects(count: number, side: number): CampRect[] {
  const cell = Math.sqrt((side * side) / Math.max(1, count));
  const guess = Math.max(1, Math.min(count, Math.round(side / cell)));
  let bestCounts: number[] | null = null;
  let bestAspect = Number.POSITIVE_INFINITY;
  let transpose = false;
  for (let rows = Math.max(1, guess - 3); rows <= Math.min(count, guess + 3); rows += 1) {
    const base = Math.floor(count / rows);
    const extra = count - base * rows;
    const counts = Array.from({ length: rows }, (_, index) => base + (index < extra ? 1 : 0));
    if (counts.some((cols) => cols < 1)) continue;
    const rowHeights = spread(side, rows);
    let worst = 1;
    for (let row = 0; row < rows; row += 1) worst = Math.max(worst, rectAspect(side / counts[row], rowHeights[row]));
    if (worst < bestAspect) {
      bestAspect = worst;
      bestCounts = counts;
      transpose = false;
    }
    const colWidths = spread(side, rows);
    let worstAcross = 1;
    for (let col = 0; col < rows; col += 1) worstAcross = Math.max(worstAcross, rectAspect(colWidths[col], side / counts[col]));
    if (worstAcross < bestAspect) {
      bestAspect = worstAcross;
      bestCounts = counts;
      transpose = true;
    }
  }
  const counts = bestCounts ?? [count];
  const rects: CampRect[] = [];
  if (!transpose) {
    const rowHeights = spread(side, counts.length);
    let y = 0;
    for (let row = 0; row < counts.length; row += 1) {
      const widths = spread(side, counts[row]);
      let x = 0;
      for (const w of widths) {
        rects.push({ x, y, w, h: rowHeights[row] });
        x += w;
      }
      y += rowHeights[row];
    }
    return rects;
  }
  const colWidths = spread(side, counts.length);
  let x = 0;
  for (let col = 0; col < counts.length; col += 1) {
    const heights = spread(side, counts[col]);
    let y = 0;
    for (const h of heights) {
      rects.push({ x, y, w: colWidths[col], h });
      y += h;
    }
    x += colWidths[col];
  }
  return rects;
}

function inside(rect: CampRect, point: TilePoint, inset = 2): TilePoint {
  return {
    x: Math.round(clamp(point.x, rect.x + inset, rect.x + rect.w - inset - 1)),
    y: Math.round(clamp(point.y, rect.y + inset, rect.y + rect.h - inset - 1)),
  };
}

type Bucket = Map<string, TilePoint[]>;

function bucketAdd(buckets: Bucket, point: TilePoint, cell: number): void {
  const key = `${Math.floor(point.x / cell)},${Math.floor(point.y / cell)}`;
  const list = buckets.get(key);
  if (list) list.push(point);
  else buckets.set(key, [point]);
}

function bucketNear(buckets: Bucket, x: number, y: number, gap: number, cell: number): boolean {
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  const gap2 = gap * gap;
  for (let iy = cy - 1; iy <= cy + 1; iy += 1) {
    for (let ix = cx - 1; ix <= cx + 1; ix += 1) {
      const list = buckets.get(`${ix},${iy}`);
      if (!list) continue;
      for (const point of list) {
        if ((point.x - x) ** 2 + (point.y - y) ** 2 < gap2) return true;
      }
    }
  }
  return false;
}

function pointSegmentDistance(x: number, y: number, a: TilePoint, b: TilePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}

function nearPolyline(x: number, y: number, line: TilePoint[], gap: number): boolean {
  for (let i = 1; i < line.length; i += 1) {
    if (pointSegmentDistance(x, y, line[i - 1], line[i]) < gap) return true;
  }
  return false;
}

function nearAny(x: number, y: number, points: TilePoint[], gap: number): boolean {
  const gap2 = gap * gap;
  return points.some((point) => (point.x - x) ** 2 + (point.y - y) ** 2 < gap2);
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

export function buildMetreFarm(rng: Rng, config: GameConfig = CONFIG): GameState {
  const side = farmSideMetres(config.farm.hectares);
  const span = config.map.campCountMax - config.map.campCountMin;
  const campCount = config.map.campCountMin + Math.floor(rng.next() * (span + 1));
  const rects = metreCampRects(campCount, side);
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
  let hostDist = Number.POSITIVE_INFINITY;
  for (const camp of camps) {
    const dist = (camp.anchor.x - side / 2) ** 2 + (camp.anchor.y - side / 2) ** 2;
    if (dist < hostDist) {
      hostDist = dist;
      host = camp;
    }
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

  const roadX = house.x + 18;
  const yardY = house.y + 4;
  const ramp = { x: roadX + 1, y: yardY };
  features.push(
    { kind: "loading_ramp", x: ramp.x, y: ramp.y, scale: 1 },
    { kind: "holding_pen", x: roadX + 6, y: yardY, scale: 1 },
    { kind: "holding_pen", x: roadX + 6, y: yardY + 12, scale: 1 },
    { kind: "holding_pen", x: roadX + 6, y: yardY + 24, scale: 1.2 },
    { kind: "crush", x: roadX + 10, y: yardY + 8, scale: 1 },
    { kind: "race", x: roadX + 8, y: yardY + 4, scale: 1 },
    { kind: "handling_roof", x: roadX + 10, y: yardY + 8, scale: 1 },
  );

  let gatePoint = { x: house.x, y: rect.y + 1 };
  for (const other of camps) {
    if (other.id === host.id || !other.rect) continue;
    const gate = metreSharedGate(rect, other.rect);
    if (!gate) continue;
    if (gate.from.y < house.y && Math.abs(gate.from.y - (rect.y + rect.h)) > Math.abs(gate.from.y - rect.y)) {
      gatePoint = gate.from;
      break;
    }
  }
  const roadEnd = { x: roadX, y: yardY };
  const road = polyline(gatePoint, roadEnd, 200);
  if (road.length === 0 || road[road.length - 1].x !== roadEnd.x || road[road.length - 1].y !== roadEnd.y) {
    road.push(roadEnd);
  }
  for (let i = 0; i <= 24; i += 1) road.push({ x: roadX - i, y: yardY });
  for (const point of road) features.push({ kind: "track", x: point.x, y: point.y, scale: 1 });

  const corners = new Map<string, { x: number; y: number; camps: number[] }>();
  for (const camp of camps) {
    const r = camp.rect!;
    for (const [x, y] of [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ] as const) {
      const key = `${x},${y}`;
      const found = corners.get(key);
      if (found) found.camps.push(camp.id);
      else corners.set(key, { x, y, camps: [camp.id] });
    }
  }
  const shared = [...corners.values()].filter((corner) => corner.camps.length >= 2);
  shared.sort((a, b) => {
    const hostA = a.camps.includes(host.id) ? 0 : 1;
    const hostB = b.camps.includes(host.id) ? 0 : 1;
    return hostA - hostB || b.camps.length - a.camps.length || a.y - b.y || a.x - b.x;
  });
  const waterPoints: FarmWaterPoint[] = [];
  const buildings = features.filter((feature) => feature.kind !== "track");
  for (const corner of shared) {
    if (waterPoints.length >= camps.length - 1) break;
    if (waterPoints.some((point) => Math.hypot(point.tile.x - corner.x, point.tile.y - corner.y) < 400)) continue;
    if (nearAny(corner.x, corner.y, buildings, 30)) continue;
    const id = `water-${waterPoints.length + 1}`;
    waterPoints.push({
      id,
      tile: { x: corner.x, y: corner.y },
      trough: { x: corner.x, y: corner.y },
      pump: waterPoints.length % 2 === 0 ? "windmill" : "solar",
      reservoir: waterPoints.length % 3 === 0,
      servedCampIds: [...corner.camps],
      lick: false,
    });
    features.push({ kind: "trough", x: corner.x, y: corner.y, scale: 1 });
  }
  const watered = (id: number) => waterPoints.some((point) => point.servedCampIds.includes(id));
  if (camps.every((camp) => watered(camp.id)) && waterPoints.length > 0) {
    const dry = camps.find((camp) => camp.id !== host.id);
    if (dry) {
      for (const point of waterPoints) {
        if (!point.servedCampIds.includes(dry.id)) continue;
        point.servedCampIds = point.servedCampIds.filter((id) => id !== dry.id);
        if (point.servedCampIds.length < 2) {
          const extra = camps.find((camp) => camp.id !== dry.id && !point.servedCampIds.includes(camp.id));
          if (extra) point.servedCampIds.push(extra.id);
        }
      }
    }
  }

  const start = inside(rect, { x: house.x + 6, y: house.y + 28 }, 8);
  host.anchor = start;
  if (!host.tiles.some((tile) => tile.x === start.x && tile.y === start.y)) host.tiles.push(start);
  const hostWater = waterPoints.find((point) => point.servedCampIds.includes(host.id));
  if (hostWater && !host.tiles.some((tile) => tile.x === hostWater.trough.x && tile.y === hostWater.trough.y)) {
    host.tiles.push({ x: hostWater.trough.x, y: hostWater.trough.y });
  }

  const buildingPoints = buildings.map((feature) => ({ x: feature.x, y: feature.y }));
  const waterClears = waterPoints.map((point) => point.trough);
  const treeTarget = Math.max(1, Math.round(config.farm.hectares * TREES_PER_HECTARE));
  const trees: TilePoint[] = [];
  const treeBuckets: Bucket = new Map();
  let guard = 0;
  while (trees.length < treeTarget && guard < treeTarget * 80) {
    guard += 1;
    const x = Math.floor(rng.next() * side);
    const y = Math.floor(rng.next() * side);
    if (nearAny(x, y, buildingPoints, BUILDING_CLEAR_M)) continue;
    if (nearAny(x, y, waterClears, WATER_CLEAR_M)) continue;
    if (nearPolyline(x, y, road, ROAD_CLEAR_M)) continue;
    if (bucketNear(treeBuckets, x, y, TREE_GAP_M, TREE_GAP_M)) continue;
    const point = { x, y };
    trees.push(point);
    bucketAdd(treeBuckets, point, TREE_GAP_M);
    features.push({ kind: "tree", x, y, scale: lerp(config.map.treeScaleMin, config.map.treeScaleMax, rng.next()) });
    if (rng.next() < 0.18 && trees.length < treeTarget) {
      const clump = { x: x + Math.round((rng.next() - 0.5) * 28), y: y + Math.round((rng.next() - 0.5) * 28) };
      if (
        clump.x > 0 &&
        clump.y > 0 &&
        clump.x < side &&
        clump.y < side &&
        !nearAny(clump.x, clump.y, buildingPoints, BUILDING_CLEAR_M) &&
        !nearAny(clump.x, clump.y, waterClears, WATER_CLEAR_M) &&
        !bucketNear(treeBuckets, clump.x, clump.y, 12, TREE_GAP_M)
      ) {
        trees.push(clump);
        bucketAdd(treeBuckets, clump, TREE_GAP_M);
        features.push({
          kind: "tree",
          x: clump.x,
          y: clump.y,
          scale: lerp(config.map.treeScaleMin, config.map.treeScaleMax, rng.next()),
        });
      }
    }
  }
  const bushTarget = Math.round(trees.length * BUSHES_PER_TREE);
  const bushBuckets: Bucket = new Map();
  guard = 0;
  let bushes = 0;
  while (bushes < bushTarget && guard < bushTarget * 60) {
    guard += 1;
    const x = Math.floor(rng.next() * side);
    const y = Math.floor(rng.next() * side);
    if (nearAny(x, y, buildingPoints, 12)) continue;
    if (nearAny(x, y, waterClears, WATER_CLEAR_M)) continue;
    if (bucketNear(bushBuckets, x, y, BUSH_GAP_M, BUSH_GAP_M)) continue;
    if (bucketNear(treeBuckets, x, y, 8, TREE_GAP_M)) continue;
    bucketAdd(bushBuckets, { x, y }, BUSH_GAP_M);
    features.push({ kind: "bush", x, y, scale: lerp(config.map.bushScaleMin, config.map.bushScaleMax, rng.next()) });
    bushes += 1;
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
    width: side,
    height: side,
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
