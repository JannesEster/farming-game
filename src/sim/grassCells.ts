import { HERD_MOTION_TUNING } from "./config";
import { grazeableFraction } from "./pasture";
import type { CampState } from "./types";

/** Coarse grass for drawing the mob onward. Not the camp dry-matter budget. */

function mix(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
}

export function grassCellCoord(metres: number, cell = HERD_MOTION_TUNING.grassCellM): number {
  return Math.floor(metres / cell);
}

export function grassCellKey(campId: number, x: number, y: number, cell = HERD_MOTION_TUNING.grassCellM): string {
  return `${campId}:${grassCellCoord(x, cell)}:${grassCellCoord(y, cell)}`;
}

/** Deterministic 0..1 noise for one cell. */
export function grassNoise(seed: number, campId: number, x: number, y: number, cell = HERD_MOTION_TUNING.grassCellM): number {
  const cx = grassCellCoord(x, cell);
  const cy = grassCellCoord(y, cell);
  return mix(seed ^ Math.imul(campId + 1, 0x9e3779b1) ^ Math.imul(cx, 0x85ebca6b) ^ Math.imul(cy, 0xc2b2ae35)) / 4294967296;
}

/**
 * Local grass the mob can see. Hash noise times the camp grazeable fraction,
 * then worn down where animals have been feeding. A stripped camp stays poor
 * in every cell because the fraction is already low.
 */
export function localGrass(
  seed: number,
  camp: CampState,
  x: number,
  y: number,
  wear: ReadonlyMap<string, number>,
): number {
  const fraction = grazeableFraction(camp);
  if (fraction <= 0) return 0;
  const noise = 0.28 + 0.72 * grassNoise(seed, camp.id, x, y);
  const worn = wear.get(grassCellKey(camp.id, x, y)) ?? 0;
  return Math.max(0, noise * fraction * (1 - Math.min(1, worn)));
}
