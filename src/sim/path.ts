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

/** Edge tile on a camp that faces toward another point (gate). */
export function campGateToward(camp: CampState, toward: TilePoint): TilePoint {
  let best = camp.anchor;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const tile of camp.tiles) {
    const neighbors = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ];
    const isEdge = neighbors.some((n) => !camp.tiles.some((t) => t.x === n.x && t.y === n.y));
    if (!isEdge) continue;
    const dx = toward.x - tile.x;
    const dy = toward.y - tile.y;
    const score = dx * dx + dy * dy;
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
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

export function planHerdPath(state: GameState, fromCampId: number, toCampId: number): TilePoint[] {
  const from = state.camps.find((c) => c.id === fromCampId);
  const to = state.camps.find((c) => c.id === toCampId);
  if (!from || !to) return [];
  const tracks = trackTileSet(state);
  const toCenter = centroid(to.tiles);
  const fromCenter = centroid(from.tiles);
  const fromGate = campGateToward(from, toCenter);
  const toGate = campGateToward(to, fromCenter);
  const path: TilePoint[] = [from.anchor, fromGate];
  const trackStart = nearestTrack(state, fromGate, tracks);
  const trackEnd = nearestTrack(state, toGate, tracks);
  if (trackStart && trackEnd) {
    const along = bfsTrackPath(state, trackStart, trackEnd, tracks);
    if (along && along.length > 0) path.push(...along);
    else path.push(...straightPath(fromGate, toGate));
  } else {
    path.push(...straightPath(fromGate, toGate));
  }
  path.push(toGate, to.anchor);
  return dedupe(path);
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
  const total = path.length - 1;
  const scaled = progress * total;
  const index = Math.floor(scaled);
  const t = scaled - index;
  const a = path[index];
  const b = path[Math.min(index + 1, path.length - 1)];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}
