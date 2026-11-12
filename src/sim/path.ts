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

function tileInCamp(camp: CampState, x: number, y: number): boolean {
  return camp.tiles.some((t) => t.x === x && t.y === y);
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

function nearestTrack(_state: GameState, from: TilePoint, tracks: Set<string>): TilePoint | null {
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

function bfsTrackPath(
  state: GameState,
  start: TilePoint,
  goal: TilePoint,
  tracks: Set<string>,
): TilePoint[] | null {
  const key = (p: TilePoint) => `${p.x},${p.y}`;
  const startKey = key(start);
  const goalKey = key(goal);
  if (startKey === goalKey) return [start];
  const queue: TilePoint[] = [start];
  const came = new Map<string, string>();
  came.set(startKey, "");
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const ck = key(current);
    if (ck === goalKey) break;
    for (const [dx, dy] of steps) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = `${nx},${ny}`;
      if (!tracks.has(nk) || came.has(nk)) continue;
      const id = campAt(state, nx, ny);
      if (id >= 0) continue;
      came.set(nk, ck);
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

function legPath(state: GameState, from: CampState, to: CampState): TilePoint[] {
  const shared = campGateBetween(from, to);
  let fromGate: TilePoint;
  let toGate: TilePoint;
  if (shared) {
    fromGate = shared.fromGate;
    toGate = shared.toGate;
  } else {
    const toCenter = centroid(to.tiles);
    const fromCenter = centroid(from.tiles);
    fromGate = campGateToward(from, toCenter);
    toGate = campGateToward(to, fromCenter);
  }

  const tracks = trackTileSet(state);
  const trackStart = nearestTrack(state, fromGate, tracks);
  const trackEnd = nearestTrack(state, toGate, tracks);
  let middle = straightPath(fromGate, toGate).slice(1, -1);
  if (trackStart && trackEnd) {
    const along = bfsTrackPath(state, trackStart, trackEnd, tracks);
    if (along && along.length > 0) {
      middle = [
        ...straightPath(fromGate, trackStart).slice(1),
        ...along.slice(1, -1),
        ...straightPath(trackEnd, toGate).slice(1),
      ];
    }
  }
  return dedupe([from.anchor, fromGate, ...middle, toGate, to.anchor]);
}

export function planHerdPath(state: GameState, fromCampId: number, toCampId: number): TilePoint[] {
  const from = state.camps.find((c) => c.id === fromCampId);
  const to = state.camps.find((c) => c.id === toCampId);
  if (!from || !to) return [];
  if (fromCampId === toCampId) return [from.anchor];

  const route = bfsCampRoute(state, fromCampId, toCampId);
  if (!route || route.length < 2) {
    return legPath(state, from, to);
  }

  let full: TilePoint[] = [];
  for (let i = 0; i < route.length - 1; i += 1) {
    const legFrom = state.camps.find((c) => c.id === route[i]);
    const legTo = state.camps.find((c) => c.id === route[i + 1]);
    if (!legFrom || !legTo) continue;
    const leg = legPath(state, legFrom, legTo);
    if (full.length === 0) full = leg;
    else full = dedupe([...full, ...leg.slice(1)]);
  }
  return full.length > 0 ? full : legPath(state, from, to);
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
