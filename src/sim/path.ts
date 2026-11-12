import { CONFIG, type GameConfig } from "./config";
import { TILE_OUTSIDE, type CampState, type GameState, type TilePoint } from "./types";

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

export function trackTileSet(state: GameState): Set<string> {
  const keys = new Set<string>();
  for (const feature of state.features) {
    if (feature.kind === "track") keys.add(`${feature.x},${feature.y}`);
  }
  return keys;
}

function campAt(state: GameState, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return TILE_OUTSIDE;
  return state.campIds[idx(x, y, state.width)];
}

function centroid(tiles: TilePoint[]): TilePoint {
  let x = 0;
  let y = 0;
  for (const tile of tiles) x += tile.x, y += tile.y;
  return { x: x / tiles.length, y: y / tiles.length };
}

const campTileKeys = new WeakMap<CampState, { tiles: readonly TilePoint[]; keys: Set<string> }>();

/** Membership follows the current tiles array. A replaced array rebuilds the set. */
function tileInCamp(camp: CampState, x: number, y: number): boolean {
  let cached = campTileKeys.get(camp);
  if (!cached || cached.tiles !== camp.tiles) {
    const keys = new Set<string>();
    for (const tile of camp.tiles) keys.add(`${tile.x},${tile.y}`);
    cached = { tiles: camp.tiles, keys };
    campTileKeys.set(camp, cached);
  }
  return cached.keys.has(`${x},${y}`);
}

/** Nearest camp edge tile toward another point (exit gate). */
export function campGateToward(camp: CampState, toward: TilePoint): TilePoint {
  let best = camp.anchor;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const tile of camp.tiles) {
    const neighbors = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ];
    const isEdge = neighbors.some((n) => !tileInCamp(camp, n.x, n.y));
    if (!isEdge) continue;
    const dx = toward.x - tile.x;
    const dy = toward.y - tile.y;
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}

/** Gate tiles on the shared edge between two camps, when they touch. */
export function campGateBetween(
  from: CampState,
  to: CampState,
): { fromGate: TilePoint; toGate: TilePoint } | null {
  let best: { fromGate: TilePoint; toGate: TilePoint; score: number } | null = null;
  const toCenter = centroid(to.tiles);
  for (const tile of from.tiles) {
    const neighbors = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ];
    for (const n of neighbors) {
      if (!tileInCamp(to, n.x, n.y)) continue;
      const dx = toCenter.x - tile.x;
      const dy = toCenter.y - tile.y;
      const score = dx * dx + dy * dy;
      if (!best || score < best.score) {
        best = { fromGate: tile, toGate: n, score };
      }
    }
  }
  return best ? { fromGate: best.fromGate, toGate: best.toGate } : null;
}

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Official gate edges, both directions. Any other camp-to-camp step is a fence. */
export function gateEdgeSet(state: GameState): Set<string> {
  const edges = new Set<string>();
  for (let i = 0; i < state.camps.length; i += 1) {
    for (let j = i + 1; j < state.camps.length; j += 1) {
      const shared = campGateBetween(state.camps[i], state.camps[j]);
      if (!shared) continue;
      edges.add(`${shared.fromGate.x},${shared.fromGate.y}|${shared.toGate.x},${shared.toGate.y}`);
      edges.add(`${shared.toGate.x},${shared.toGate.y}|${shared.fromGate.x},${shared.fromGate.y}`);
    }
  }
  return edges;
}

function snapToCamp(camp: CampState, point: TilePoint): TilePoint {
  let best = camp.tiles[0] ?? camp.anchor;
  let bestD = Number.POSITIVE_INFINITY;
  for (const tile of camp.tiles) {
    const d = (tile.x - point.x) ** 2 + (tile.y - point.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = tile;
    }
  }
  return { x: best.x, y: best.y };
}

/** A couple of tiles inside the destination, on the gate side, not the far anchor. */
function stepIntoCamp(camp: CampState, gate: TilePoint, steps: number): TilePoint {
  let current = snapToCamp(camp, gate);
  const center = centroid(camp.tiles);
  for (let i = 0; i < steps; i += 1) {
    let best = current;
    let bestD = (current.x - center.x) ** 2 + (current.y - center.y) ** 2;
    for (const [dx, dy] of STEPS) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!tileInCamp(camp, next.x, next.y)) continue;
      const d = (next.x - center.x) ** 2 + (next.y - center.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = next;
      }
    }
    if (best.x === current.x && best.y === current.y) break;
    current = best;
  }
  return current;
}

const WATER_STRUCTURE_KINDS = new Set(["windmill", "trough", "reservoir", "solar_pump"]);
/**
 * The herd path stays this far from a water point, in tiles.
 * Assumption: 1.6 tiles is about 3.5 m at the travel step, a few tiles around
 * the windmill legs and the round tank. Tighter camps fall back to the direct
 * gate walk so a water point cannot force a fence crossing.
 */
export const WATER_STRUCTURE_CLEAR_TILES = 1.6;

/** Tiles the herd should not use. Radius 0 blocks only the structure tile itself. */
export function waterStructureBlock(state: GameState, radius = WATER_STRUCTURE_CLEAR_TILES): Set<string> {
  const blocked = new Set<string>();
  if (radius <= 0) {
    for (const feature of state.features) {
      if (!WATER_STRUCTURE_KINDS.has(feature.kind)) continue;
      blocked.add(`${feature.x},${feature.y}`);
    }
    return blocked;
  }
  const reach = Math.ceil(radius);
  const limit = radius * radius;
  for (const feature of state.features) {
    if (!WATER_STRUCTURE_KINDS.has(feature.kind)) continue;
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        if (dx * dx + dy * dy > limit) continue;
        blocked.add(`${feature.x + dx},${feature.y + dy}`);
      }
    }
  }
  return blocked;
}

function nearestClearTile(camp: CampState, point: TilePoint, blocked: Set<string>): TilePoint {
  const start = snapToCamp(camp, point);
  const key = (tile: TilePoint) => `${tile.x},${tile.y}`;
  if (!blocked.has(key(start))) return start;
  const allowed = new Set(camp.tiles.map((tile) => key(tile)));
  const queue = [start];
  const seen = new Set<string>([key(start)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [dx, dy] of STEPS) {
      const next = { x: current.x + dx, y: current.y + dy };
      const id = key(next);
      if (!allowed.has(id) || seen.has(id)) continue;
      if (!blocked.has(id)) return next;
      seen.add(id);
      queue.push(next);
    }
  }
  return start;
}

/** Shortest walk that stays inside one camp and steps around water structures. */
function routeInsideCamp(
  camp: CampState,
  from: TilePoint,
  to: TilePoint,
  blocked: Set<string> = new Set(),
  pinStart = false,
): TilePoint[] {
  const goal = snapToCamp(camp, to);
  const snappedStart = snapToCamp(camp, from);
  const start =
    pinStart || !blocked.has(`${snappedStart.x},${snappedStart.y}`)
      ? snappedStart
      : nearestClearTile(camp, from, blocked);
  const key = (point: TilePoint) => `${point.x},${point.y}`;
  const avoid = new Set(blocked);
  avoid.delete(key(goal));
  avoid.delete(key(start));
  const line = straightPath(start, goal);
  const lineFits = line.every((point) => tileInCamp(camp, point.x, point.y) && !avoid.has(key(point)));
  if (lineFits) return line;
  const allowed = new Set(camp.tiles.map((tile) => key(tile)));
  const queue = [start];
  const came = new Map<string, string>();
  came.set(key(start), "");
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) break;
    for (const [dx, dy] of STEPS) {
      const next = { x: current.x + dx, y: current.y + dy };
      const id = key(next);
      if (!allowed.has(id) || came.has(id) || avoid.has(id)) continue;
      came.set(id, key(current));
      queue.push(next);
    }
  }
  if (!came.has(key(goal))) {
    if (blocked.size > 0) return routeInsideCamp(camp, from, to, new Set(), pinStart);
    const open = straightPath(start, goal);
    if (open.every((point) => tileInCamp(camp, point.x, point.y))) return open;
    return [start, goal];
  }
  const path: TilePoint[] = [];
  let cursor: string | undefined = key(goal);
  while (cursor && cursor.length > 0) {
    const [x, y] = cursor.split(",").map(Number);
    path.push({ x, y });
    cursor = came.get(cursor);
  }
  path.reverse();
  return path;
}

class CostHeap {
  private data: { i: number; d: number }[] = [];

  get size(): number {
    return this.data.length;
  }

  push(i: number, d: number): void {
    this.data.push({ i, d });
    let n = this.data.length - 1;
    while (n > 0) {
      const parent = (n - 1) >> 1;
      if (this.data[parent].d <= this.data[n].d) break;
      const swap = this.data[parent];
      this.data[parent] = this.data[n];
      this.data[n] = swap;
      n = parent;
    }
  }

  pop(): { i: number; d: number } | undefined {
    const top = this.data[0];
    const last = this.data.pop();
    if (!last || this.data.length === 0) return top;
    this.data[0] = last;
    let n = 0;
    for (;;) {
      const left = n * 2 + 1;
      const right = left + 1;
      let smallest = n;
      if (left < this.data.length && this.data[left].d < this.data[smallest].d) smallest = left;
      if (right < this.data.length && this.data[right].d < this.data[smallest].d) smallest = right;
      if (smallest === n) break;
      const swap = this.data[n];
      this.data[n] = this.data[smallest];
      this.data[smallest] = swap;
      n = smallest;
    }
    return top;
  }
}

/**
 * Walk the tile grid. Camp interiors and tracks are fine. A fence costs a lot
 * unless the step is the shared gate between those two camps.
 */
export function planPersonPath(
  state: GameState,
  from: TilePoint,
  to: TilePoint,
  gates = gateEdgeSet(state),
  allowCamps?: ReadonlySet<number>,
): TilePoint[] {
  const width = state.width;
  const height = state.height;
  const tracks = trackTileSet(state);
  const start = snapWalkable(state, from);
  const goal = snapWalkable(state, to);
  if (!start || !goal) return dedupe([from, to]);
  if (start.x === goal.x && start.y === goal.y) return [start];
  const index = (x: number, y: number) => y * width + x;
  const dist = new Float64Array(width * height);
  dist.fill(Number.POSITIVE_INFINITY);
  const prev = new Int32Array(width * height);
  prev.fill(-1);
  const startI = index(start.x, start.y);
  const goalI = index(goal.x, goal.y);
  dist[startI] = 0;
  const heap = new CostHeap();
  heap.push(startI, 0);
  while (heap.size > 0) {
    const item = heap.pop();
    if (!item || item.d !== dist[item.i]) continue;
    if (item.i === goalI) break;
    const x = item.i % width;
    const y = (item.i / width) | 0;
    const here = campAt(state, x, y);
    for (const [dx, dy] of [
      ...STEPS,
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as Array<[number, number]>) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const there = campAt(state, nx, ny);
      const onTrack = tracks.has(`${nx},${ny}`);
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal) {
        const sameCamp = here >= 0 && here === there;
        const bothTracks = tracks.has(`${x},${y}`) && onTrack;
        if (!sameCamp && !bothTracks) continue;
      }
      if (there === TILE_OUTSIDE && !onTrack) continue;
      const allowed =
        !allowCamps ||
        there < 0 ||
        onTrack ||
        allowCamps.has(there) ||
        (nx === goal.x && ny === goal.y) ||
        (nx === start.x && ny === start.y);
      if (!allowed) continue;
      const fromTrack = tracks.has(`${x},${y}`);
      let cost = onTrack ? 0.7 : 1;
      if (
        here >= 0 &&
        there >= 0 &&
        here !== there &&
        !onTrack &&
        !fromTrack &&
        !gates.has(`${x},${y}|${nx},${ny}`)
      ) {
        cost = 400;
      }
      const nextI = index(nx, ny);
      const next = item.d + cost;
      if (next < dist[nextI]) {
        dist[nextI] = next;
        prev[nextI] = item.i;
        heap.push(nextI, next);
      }
    }
  }
  if (prev[goalI] < 0 && startI !== goalI) return dedupe([start, goal]);
  const path: TilePoint[] = [];
  let cursor = goalI;
  const guard = width * height;
  let steps = 0;
  while (cursor >= 0 && steps < guard) {
    path.push({ x: cursor % width, y: (cursor / width) | 0 });
    if (cursor === startI) break;
    cursor = prev[cursor];
    steps += 1;
  }
  path.reverse();
  return path;
}

function snapWalkable(state: GameState, point: TilePoint): TilePoint | null {
  const x0 = Math.round(point.x);
  const y0 = Math.round(point.y);
  let best: TilePoint | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (let radius = 0; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = x0 + dx;
        const y = y0 + dy;
        if (campAt(state, x, y) === TILE_OUTSIDE) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best && radius === 0) return best;
  }
  return best;
}

/** Steps that change camp and are not the official gate. */
export function fenceCrossingsOffGate(state: GameState, path: TilePoint[], gates = gateEdgeSet(state)): number {
  const tracks = trackTileSet(state);
  let bad = 0;
  for (let i = 1; i < path.length; i += 1) {
    const line = straightPath(path[i - 1], path[i]);
    for (let s = 1; s < line.length; s += 1) {
      const a = line[s - 1];
      const b = line[s];
      const here = campAt(state, a.x, a.y);
      const there = campAt(state, b.x, b.y);
      const onRoad = tracks.has(`${a.x},${a.y}`) || tracks.has(`${b.x},${b.y}`);
      if (!onRoad && here >= 0 && there >= 0 && here !== there && !gates.has(`${a.x},${a.y}|${b.x},${b.y}`)) bad += 1;
    }
  }
  return bad;
}

function straightPath(from: TilePoint, to: TilePoint): TilePoint[] {
  const points: TilePoint[] = [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({
      x: Math.round(from.x + dx * t),
      y: Math.round(from.y + dy * t),
    });
  }
  return dedupe(points);
}

function dedupe(points: TilePoint[]): TilePoint[] {
  const out: TilePoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

/** Adjacent camps share a fence gate. */
export function campAdjacencyGraph(state: GameState): Map<number, number[]> {
  const graph = new Map<number, number[]>();
  for (const camp of state.camps) graph.set(camp.id, []);
  for (let i = 0; i < state.camps.length; i += 1) {
    for (let j = i + 1; j < state.camps.length; j += 1) {
      const a = state.camps[i];
      const b = state.camps[j];
      if (!campGateBetween(a, b)) continue;
      graph.get(a.id)?.push(b.id);
      graph.get(b.id)?.push(a.id);
    }
  }
  return graph;
}

export function bfsCampRoute(state: GameState, fromCampId: number, toCampId: number): number[] | null {
  if (fromCampId === toCampId) return [fromCampId];
  const graph = campAdjacencyGraph(state);
  const queue = [fromCampId];
  const came = new Map<number, number | null>();
  came.set(fromCampId, null);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toCampId) break;
    for (const next of graph.get(current) ?? []) {
      if (came.has(next)) continue;
      came.set(next, current);
      queue.push(next);
    }
  }
  if (!came.has(toCampId)) return null;
  const route: number[] = [];
  let cursor: number | null = toCampId;
  while (cursor !== null) {
    route.push(cursor);
    cursor = came.get(cursor) ?? null;
  }
  route.reverse();
  return route;
}

function nearestTrack(from: TilePoint, tracks: Set<string>): TilePoint | null {
  let best: TilePoint | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const key of tracks) {
    const [sx, sy] = key.split(",").map(Number);
    const d = (sx - from.x) ** 2 + (sy - from.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: sx, y: sy };
    }
  }
  return best;
}

/** Road tiles that are not inside a camp, so the herd does not cross another camp's grass. */
function bfsTrackPath(state: GameState, start: TilePoint, goal: TilePoint, tracks: Set<string>): TilePoint[] | null {
  const key = (p: TilePoint) => `${p.x},${p.y}`;
  const startKey = key(start);
  const goalKey = key(goal);
  if (startKey === goalKey) return [start];
  const queue: TilePoint[] = [start];
  const came = new Map<string, string>();
  came.set(startKey, "");
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (key(current) === goalKey) break;
    for (const [dx, dy] of STEPS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = `${nx},${ny}`;
      if (!tracks.has(nk) || came.has(nk)) continue;
      if (campAt(state, nx, ny) >= 0) continue;
      came.set(nk, key(current));
      queue.push({ x: nx, y: ny });
    }
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as Array<[number, number]>) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = `${nx},${ny}`;
      if (!tracks.has(nk) || came.has(nk) || !tracks.has(key(current))) continue;
      if (campAt(state, nx, ny) >= 0) continue;
      came.set(nk, key(current));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!came.has(goalKey)) return null;
  const path: TilePoint[] = [];
  let cursor: string | undefined = goalKey;
  while (cursor && cursor.length > 0) {
    const [x, y] = cursor.split(",").map(Number);
    path.push({ x, y });
    cursor = came.get(cursor);
  }
  path.reverse();
  return path;
}

/** Camps that do not share a gate meet via the farm track, not through another herd. */
function trackLeg(state: GameState, from: CampState, to: CampState, blocked: Set<string>): TilePoint[] {
  const tracks = trackTileSet(state);
  const fromGate = campGateToward(from, centroid(to.tiles));
  const toGate = campGateToward(to, centroid(from.tiles));
  const trackStart = nearestTrack(fromGate, tracks);
  const trackEnd = nearestTrack(toGate, tracks);
  let middle: TilePoint[] = [];
  if (trackStart && trackEnd) {
    const along = bfsTrackPath(state, trackStart, trackEnd, tracks);
    if (along && along.length > 0) {
      middle = [
        ...straightPath(fromGate, trackStart).slice(1),
        ...along,
        ...straightPath(trackEnd, toGate).slice(0, -1),
      ];
    }
  }
  if (middle.length === 0) middle = straightPath(fromGate, toGate).slice(1, -1);
  const start = snapToCamp(from, from.anchor);
  const end = stepIntoCamp(to, toGate, 2);
  return dedupe([
    ...routeInsideCamp(from, start, fromGate, blocked, false),
    ...middle,
    ...routeInsideCamp(to, toGate, end, blocked, true),
  ]);
}

/** Neighbours go through the shared gate. The walk stays inside each camp except for that one step. */
function neighbourLeg(
  from: CampState,
  to: CampState,
  shared: { fromGate: TilePoint; toGate: TilePoint },
  blocked: Set<string>,
): TilePoint[] {
  const start = snapToCamp(from, from.anchor);
  const end = stepIntoCamp(to, shared.toGate, 2);
  return dedupe([
    ...routeInsideCamp(from, start, shared.fromGate, blocked, false),
    ...routeInsideCamp(to, shared.toGate, end, blocked, true),
  ]);
}

function pathHitsStructure(state: GameState, path: TilePoint[], gates: Set<string>): boolean {
  for (const tile of path) {
    if (gates.has(`${tile.x},${tile.y}`)) continue;
    for (const feature of state.features) {
      if (!WATER_STRUCTURE_KINDS.has(feature.kind)) continue;
      if (tile.x === feature.x && tile.y === feature.y) return true;
    }
  }
  return false;
}

function buildHerdPath(state: GameState, from: CampState, to: CampState, blocked: Set<string>): TilePoint[] {
  const shared = campGateBetween(from, to);
  if (shared) return neighbourLeg(from, to, shared, blocked);
  return trackLeg(state, from, to, blocked);
}

export function planHerdPath(state: GameState, fromCampId: number, toCampId: number): TilePoint[] {
  const from = state.camps.find((c) => c.id === fromCampId);
  const to = state.camps.find((c) => c.id === toCampId);
  if (!from || !to) return [];
  if (fromCampId === toCampId) return [snapToCamp(from, from.anchor)];

  const shared = campGateBetween(from, to);
  const gates = new Set<string>();
  if (shared) {
    gates.add(`${shared.fromGate.x},${shared.fromGate.y}`);
    gates.add(`${shared.toGate.x},${shared.toGate.y}`);
  }
  const plain = buildHerdPath(state, from, to, new Set());
  for (const radius of [4.2, WATER_STRUCTURE_CLEAR_TILES, 1, 0]) {
    const avoided = buildHerdPath(state, from, to, waterStructureBlock(state, radius));
    if (fenceCrossingsOffGate(state, avoided) > 0) continue;
    if (pathHitsStructure(state, avoided, gates)) continue;
    return avoided;
  }
  return plain;
}

export function pathLengthKm(path: TilePoint[], config: GameConfig = CONFIG): number {
  if (path.length < 2) return 0;
  let tiles = 0;
  for (let i = 1; i < path.length; i += 1) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    tiles += Math.sqrt(dx * dx + dy * dy);
  }
  return tiles * config.transit.kmPerTile;
}

export function pointOnPath(path: TilePoint[], progress: number): TilePoint {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length >= 2 && progress < 0) {
    let totalLen = 0;
    for (let i = 1; i < path.length; i += 1) {
      totalLen += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    const back = -progress * (totalLen || 1);
    const dx = path[0].x - path[1].x;
    const dy = path[0].y - path[1].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: path[0].x + (dx / len) * back, y: path[0].y + (dy / len) * back };
  }
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  let totalLen = 0;
  const legs: number[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    legs.push(len);
    totalLen += len;
  }
  if (totalLen === 0) return path[0];
  let remaining = progress * totalLen;
  for (let i = 0; i < legs.length; i += 1) {
    if (remaining <= legs[i]) {
      const t = legs[i] === 0 ? 0 : remaining / legs[i];
      const a = path[i];
      const b = path[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= legs[i];
  }
  return path[path.length - 1];
}

/** True when this fence edge should show a gate between two camps. */
export function fenceGateBetweenCamps(
  state: GameState,
  campA: number,
  campB: number,
): { a: TilePoint; b: TilePoint } | null {
  if (campA < 0 || campB < 0) return null;
  const from = state.camps.find((c) => c.id === campA);
  const to = state.camps.find((c) => c.id === campB);
  if (!from || !to) return null;
  const shared = campGateBetween(from, to);
  if (!shared) return null;
  return { a: shared.fromGate, b: shared.toGate };
}
