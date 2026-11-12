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

function convoySpacing(state: GameState): { total: number; spacingTiles: number; centerTiles: number } {
  const transit = state.herd.transit!;
  const total = pathLengthTiles(transit.path);
  const count = Math.max(1, state.herd.headCount);
  const spacingTiles = Math.min(0.42, (total * 0.92) / Math.max(1, count - 1));
  const centerTiles = transit.progress * total;
  return { total, spacingTiles, centerTiles };
}

/** Path progress of the rearmost animal in the filed column. */
export function herdRearPathProgress(state: GameState): number {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return transit?.progress ?? 0;
  const { total, spacingTiles, centerTiles } = convoySpacing(state);
  const count = Math.max(1, state.herd.headCount);
  const rearTiles = centerTiles - ((count - 1) / 2) * spacingTiles;
  return Math.max(0, rearTiles) / total;
}

/** Path progress where the herder walks behind the rear of the filed herd. */
export function herderPathProgressBehindTail(state: GameState, _config: GameConfig = CONFIG): number {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return transit?.progress ?? 0;
  const { total, spacingTiles, centerTiles } = convoySpacing(state);
  const count = Math.max(1, state.herd.headCount);
  const rearTiles = centerTiles - ((count - 1) / 2) * spacingTiles;
  const herderTiles = Math.max(0, rearTiles - 0.6);
  return herderTiles / total;
}
