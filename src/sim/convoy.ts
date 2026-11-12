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

/** Spacing for a filed column. The herder stays 0.6 tiles behind the last animal. */
export function columnMetrics(
  path: TilePoint[],
  progress: number,
  count: number,
): { total: number; spacingTiles: number; centerTiles: number; rearProgress: number; herderProgress: number } {
  const total = pathLengthTiles(path);
  const safe = Math.max(1, count);
  const spacingTiles = Math.min(0.42, (total * 0.92) / Math.max(1, safe - 1));
  const centerTiles = progress * total;
  const rearTiles = centerTiles - ((safe - 1) / 2) * spacingTiles;
  const herderTiles = Math.max(0, rearTiles - 0.6);
  return {
    total,
    spacingTiles,
    centerTiles,
    rearProgress: total <= 0 ? 0 : Math.max(0, rearTiles) / total,
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
