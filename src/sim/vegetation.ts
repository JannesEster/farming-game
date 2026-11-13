import { PIXELS_PER_METRE } from "../render/worldScale";
import type { GameState, TilePoint } from "./types";

/**
 * On-screen area of one isometric tile, in the cow's metres.
 * A tile is a 64 by 32 diamond. PIXELS_PER_METRE turns that into real ground.
 */
export const TILE_SCREEN_M2 = (64 * 32) / 2 / PIXELS_PER_METRE ** 2;

/**
 * Tree and bush counts on the 132-tile farm in the PR screenshots.
 * That map looks about 500 m across. These counts are the spacing to keep.
 */
export const SCREEN_REFERENCE_TILES = 132 * 132;
export const SCREEN_REFERENCE_TREES = 159;
export const SCREEN_REFERENCE_BUSHES = 501;

const REFERENCE_M2 = SCREEN_REFERENCE_TILES * TILE_SCREEN_M2;
/** Trees per square metre of ground, matching the screenshot spacing. */
export const TREES_PER_M2 = SCREEN_REFERENCE_TREES / REFERENCE_M2;
/** Bushes per square metre of ground, matching the screenshot spacing. */
export const BUSHES_PER_M2 = SCREEN_REFERENCE_BUSHES / REFERENCE_M2;

const TREE_CELL_M = 1 / Math.sqrt(TREES_PER_M2);
const BUSH_CELL_M = 1 / Math.sqrt(BUSHES_PER_M2);
/** Share of tree cells that also grow a partner a few metres away. */
const CLUMP_FRACTION = 0.45;
/** Occupied cells, lowered so the partners do not raise the average density. */
const TREE_KEEP = 1 / (1 + CLUMP_FRACTION);

const TREE_CLEAR_M = 18;
const BUSH_CLEAR_M = 12;
const WATER_CLEAR_M = 16;
const ROAD_CLEAR_M = 8;
const BUILDING_KINDS = new Set([
  "house",
  "shed",
  "windmill",
  "worker_house",
  "kraal",
  "reservoir",
  "solar_pump",
  "holding_pen",
  "race",
  "crush",
  "handling_roof",
  "loading_ramp",
]);

export type VegPoint = { x: number; y: number; scale: number };

type Obstacles = { buildings: TilePoint[]; water: TilePoint[]; road: TilePoint[] };

const obstaclesOf = new WeakMap<GameState, Obstacles>();

function mix(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function unit(seed: number, i: number, j: number, salt: number): number {
  return mix(Math.imul(seed + salt * 0x9e3779b1, 0x85ebca6b) ^ Math.imul(i, 0xc2b2ae35) ^ Math.imul(j, 0x27d4eb2f)) / 4294967296;
}

function obstacles(state: GameState): Obstacles {
  const cached = obstaclesOf.get(state);
  if (cached) return cached;
  const buildings: TilePoint[] = [];
  for (const feature of state.features) {
    if (BUILDING_KINDS.has(feature.kind)) buildings.push({ x: feature.x, y: feature.y });
  }
  const water = (state.farmWaterPoints ?? []).map((point) => ({ x: point.trough.x, y: point.trough.y }));
  const value = { buildings, water, road: state.road ?? [] };
  obstaclesOf.set(state, value);
  return value;
}

function nearPoints(x: number, y: number, points: TilePoint[], gap: number): boolean {
  const gap2 = gap * gap;
  for (const point of points) {
    const dx = point.x - x;
    const dy = point.y - y;
    if (dx * dx + dy * dy < gap2) return true;
  }
  return false;
}

function nearRoad(x: number, y: number, road: TilePoint[], gap: number): boolean {
  for (let i = 1; i < road.length; i += 1) {
    const a = road[i - 1];
    const b = road[i];
    if (x < Math.min(a.x, b.x) - gap || x > Math.max(a.x, b.x) + gap) continue;
    if (y < Math.min(a.y, b.y) - gap || y > Math.max(a.y, b.y) + gap) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    const px = a.x + dx * t - x;
    const py = a.y + dy * t - y;
    if (px * px + py * py < gap * gap) return true;
  }
  return false;
}

function blocked(x: number, y: number, width: number, height: number, obstacles: Obstacles, clear: number): boolean {
  if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return true;
  if (nearPoints(x, y, obstacles.buildings, clear)) return true;
  if (nearPoints(x, y, obstacles.water, WATER_CLEAR_M)) return true;
  if (nearRoad(x, y, obstacles.road, ROAD_CLEAR_M)) return true;
  return false;
}

function cellPoint(
  seed: number,
  i: number,
  j: number,
  cell: number,
  margin: number,
  salt: number,
): { x: number; y: number; scale: number } {
  const span = Math.max(0.4, cell - margin * 2);
  const x = i * cell + margin + unit(seed, i, j, salt) * span;
  const y = j * cell + margin + unit(seed, i, j, salt + 1) * span;
  const scale = 0.85 + unit(seed, i, j, salt + 2) * 0.3;
  return { x, y, scale };
}

/**
 * Trees whose feet fall in the metre rectangle. Generated from the farm seed,
 * so the million-point veld is not stored on the save.
 */
export function treesInRect(state: GameState, x0: number, y0: number, x1: number, y1: number): VegPoint[] {
  const width = state.width;
  const height = state.height;
  const blocks = obstacles(state);
  const out: VegPoint[] = [];
  const reach = 12;
  const i0 = Math.floor((Math.min(x0, x1) - reach) / TREE_CELL_M);
  const i1 = Math.floor((Math.max(x0, x1) + reach) / TREE_CELL_M);
  const j0 = Math.floor((Math.min(y0, y1) - reach) / TREE_CELL_M);
  const j1 = Math.floor((Math.max(y0, y1) + reach) / TREE_CELL_M);
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const inside = (point: VegPoint) => point.x >= minX && point.x < maxX && point.y >= minY && point.y < maxY;
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      if (unit(state.seed, i, j, 1) >= TREE_KEEP) continue;
      const tree = cellPoint(state.seed, i, j, TREE_CELL_M, 4, 4);
      if (!blocked(tree.x, tree.y, width, height, blocks, TREE_CLEAR_M) && inside(tree)) out.push(tree);
      if (unit(state.seed, i, j, 2) >= CLUMP_FRACTION) continue;
      const angle = unit(state.seed, i, j, 6) * Math.PI * 2;
      const dist = 4.5 + unit(state.seed, i, j, 7) * 6.5;
      const partner = {
        x: tree.x + Math.cos(angle) * dist,
        y: tree.y + Math.sin(angle) * dist,
        scale: 0.85 + unit(state.seed, i, j, 8) * 0.3,
      };
      if (!blocked(partner.x, partner.y, width, height, blocks, TREE_CLEAR_M) && inside(partner)) out.push(partner);
    }
  }
  return out;
}

/** Bushes in the metre rectangle. Same on-screen spacing as the screenshot farm. */
export function bushesInRect(state: GameState, x0: number, y0: number, x1: number, y1: number): VegPoint[] {
  const width = state.width;
  const height = state.height;
  const blocks = obstacles(state);
  const out: VegPoint[] = [];
  const i0 = Math.floor(Math.min(x0, x1) / BUSH_CELL_M);
  const i1 = Math.floor(Math.max(x0, x1) / BUSH_CELL_M);
  const j0 = Math.floor(Math.min(y0, y1) / BUSH_CELL_M);
  const j1 = Math.floor(Math.max(y0, y1) / BUSH_CELL_M);
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const bush = cellPoint(state.seed, i, j, BUSH_CELL_M, 1.6, 20);
      if (bush.x < minX || bush.x >= maxX || bush.y < minY || bush.y >= maxY) continue;
      if (blocked(bush.x, bush.y, width, height, blocks, BUSH_CLEAR_M)) continue;
      out.push(bush);
    }
  }
  return out;
}

/** How many trees a start-zoom screen should hold, from the screenshot spacing. */
export function referenceTreesForArea(areaM2: number): number {
  return TREES_PER_M2 * areaM2;
}
