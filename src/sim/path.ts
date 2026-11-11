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

function assemblePath(
  from: CampState,
  to: CampState,
  fromGate: TilePoint,
  toGate: TilePoint,
  middle: TilePoint[],
): TilePoint[] {
  return dedupe([from.anchor, fromGate, ...middle, toGate, to.anchor]);
}

export function planHerdPath(state: GameState, fromCampId: number, toCampId: number): TilePoint[] {
  const from = state.camps.find((c) => c.id === fromCampId);
  const to = state.camps.find((c) => c.id === toCampId);
  if (!from || !to) return [];

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

  const directMiddle = straightPath(fromGate, toGate);
  const directPath = assemblePath(from, to, fromGate, toGate, directMiddle.slice(1, -1));

  const tracks = trackTileSet(state);
  const trackStart = nearestTrack(state, fromGate, tracks);
  const trackEnd = nearestTrack(state, toGate, tracks);
  let trackPath = directPath;
  if (trackStart && trackEnd) {
    const along = bfsTrackPath(state, trackStart, trackEnd, tracks);
    if (along && along.length > 0) {
      trackPath = assemblePath(from, to, fromGate, toGate, [
        ...straightPath(fromGate, trackStart).slice(1),
        ...along.slice(1, -1),
        ...straightPath(trackEnd, toGate).slice(1),
      ]);
    }
  }

  const directKm = pathLengthKm(directPath);
  const trackKm = pathLengthKm(trackPath);
  if (directKm <= trackKm) return directPath;
  return trackPath;
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
