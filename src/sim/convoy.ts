import { CONFIG, type GameConfig } from "./config";
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
 * Loose mob on the path. The moving column is up to 12 tiles long from the first
 * step (the tail can still be in the source camp), and the herder stays 2.5 tiles
 * behind that tail, so he walks the whole drive instead of standing at the gate.
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
  const spacingTiles = 1.15;
  const centerTiles = progress * total;
  const ranks = Math.max(1, Math.ceil(safe / abreast));
  const span = Math.min(MOB_LENGTH_TILES, Math.max(0, (ranks - 1) * spacingTiles));
  const rearTiles = centerTiles - span;
  const herderTiles = rearTiles - HERDER_BEHIND_TILES;
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
