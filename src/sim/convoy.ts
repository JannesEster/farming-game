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

/** Tiles between the last animal in the moving mob and the herder. */
const HERDER_BEHIND_TILES = 2.5;
/** The moving mob stays about this long, then more cattle join from the sides. */
const MOB_LENGTH_TILES = 12;

/** Loose mob on the path. The herder stays 2 to 3 tiles behind the rear of that mob. */
export function columnMetrics(
  path: TilePoint[],
  progress: number,
  count: number,
): { total: number; spacingTiles: number; centerTiles: number; rearProgress: number; herderProgress: number } {
  const total = pathLengthTiles(path);
  const safe = Math.max(1, count);
  const abreast = safe <= 6 ? 2 : 8;
  const spacingTiles = 1.2;
  const centerTiles = progress * total;
  const started = Math.min(safe, Math.max(1, Math.ceil(centerTiles / spacingTiles)));
  const movingRanks = Math.max(1, Math.ceil(started / abreast));
  const span = Math.min(MOB_LENGTH_TILES, Math.max(0, (movingRanks - 1) * spacingTiles), centerTiles);
  const rearTiles = Math.max(0, centerTiles - span);
  const herderTiles = Math.max(0, rearTiles - HERDER_BEHIND_TILES);
  return {
    total,
    spacingTiles,
    centerTiles,
    rearProgress: total <= 0 ? 0 : rearTiles / total,
    herderProgress: total <= 0 ? 0 : herderTiles / total,
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
