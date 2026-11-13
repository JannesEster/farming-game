import { CONFIG, type GameConfig } from "./config";
import { pointOnPath } from "./path";
import type { GameState, TilePoint } from "./types";

function pathLengthTiles(path: TilePoint[]): number {
  if (path.length < 2) return 1;
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total || 1;
}

/** Tiles between the last animal in the moving mob and the herder, once the column has room. */
export const HERDER_BEHIND_TILES = 2.5;
/** The moving mob grows to about this length, then more cattle join from the camp. */
export const MOB_LENGTH_TILES = 12;
/** Animals side by side on the open road. A gate narrows the picture to two. */
export const MOB_ABREAST = 6;
/** Gap between neighbours in a rank, in tiles. Six abreast is a bit under four tiles wide. */
export const MOB_LATERAL_TILES = 0.72;

/**
 * Loose mob on the path. The column grows to 12 tiles as the lead walks, and the
 * tail stays on the route already travelled. The herder follows just behind that
 * tail, closing to 2.5 tiles once the column has room, and he keeps moving.
 */
export function columnMetrics(
  path: TilePoint[],
  progress: number,
  count: number,
): {
  total: number;
  spacingTiles: number;
  centerTiles: number;
  rearProgress: number;
  herderProgress: number;
  abreast: number;
  widthTiles: number;
  spanTiles: number;
} {
  const total = pathLengthTiles(path);
  const safe = Math.max(1, count);
  const abreast = safe <= 6 ? Math.min(2, safe) : MOB_ABREAST;
  const spacingTiles = 0.92;
  const centerTiles = progress * total;
  // A path longer than 80 units is in metres. The filed mob is about 45 m, not 12 m.
  const long = total > 80;
  const mobLength = long ? 42 : MOB_LENGTH_TILES;
  const span = Math.min(mobLength, Math.max(0, centerTiles * 0.5));
  const rearTiles = Math.max(0, centerTiles - span);
  // Stay close at the first steps so he keeps walking, then sit 3.5 m behind the tail.
  const gapCap = long ? 3.5 : 3;
  const gap = Math.min(gapCap, (long ? 3.5 : 0.6) + Math.max(0, centerTiles - (long ? 6 : 1.2)) * (long ? 0.4 : 0.28));
  const herderTiles = Math.max(0, rearTiles - gap);
  return {
    total,
    spacingTiles,
    centerTiles,
    rearProgress: total <= 0 ? 0 : rearTiles / total,
    herderProgress: total <= 0 ? 0 : herderTiles / total,
    abreast,
    widthTiles: Math.max(0, abreast - 1) * MOB_LATERAL_TILES,
    spanTiles: span,
  };
}

/** Path progress of the rearmost animal in the filed column. */
export function herdRearPathProgress(state: GameState): number {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return transit?.progress ?? 0;
  return columnMetrics(transit.path, transit.progress, state.herd.headCount).rearProgress;
}

/** Path progress where the herder walks behind the rear of the filed herd. */
export function herderPathProgressBehindTail(state: GameState, _config: GameConfig = CONFIG): number {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return transit?.progress ?? 0;
  return columnMetrics(transit.path, transit.progress, state.herd.headCount).herderProgress;
}

/**
 * Stand the herder on the reverse of the mob's travel heading, behind the rear
 * animal. A bend in the path must not leave him beside or in front of the tail.
 * Once the column has moved, he sits about 3.2 tiles behind that tail.
 */
export function herderStandTile(path: TilePoint[], progress: number, count: number): TilePoint {
  const metrics = columnMetrics(path, progress, count);
  const rear = pointOnPath(path, metrics.rearProgress);
  const look = Math.min(1, metrics.rearProgress + 1.4 / Math.max(metrics.total, 1));
  const ahead = pointOnPath(path, Math.max(look, metrics.rearProgress));
  let dx = ahead.x - rear.x;
  let dy = ahead.y - rear.y;
  let len = Math.hypot(dx, dy);
  if (len < 0.04) {
    const fallback = pointOnPath(path, metrics.herderProgress);
    return { x: fallback.x, y: fallback.y };
  }
  dx /= len;
  dy /= len;
  const long = metrics.total > 80;
  const back = metrics.centerTiles < (long ? 8 : 2.4) ? Math.max(long ? 2 : 0.45, metrics.centerTiles * 0.4) : long ? 3.5 : 3.2;
  return { x: rear.x - dx * back, y: rear.y - dy * back };
}
