import type { Feature } from "../sim/types";
import { SPRITE_KEYS } from "./sprites";
import { BAKKIE_LENGTH_METRES, COTTAGE_WIDTH_METRES, FARMHOUSE_WIDTH_METRES, SHED_WIDTH_METRES, uniformScale } from "./worldScale";

export type HomesteadSpritePlacement = {
  key: string;
  tileX: number;
  tileY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  originX: number;
  originY: number;
};

function scaleToMetres(nativeWidth: number, metres: number): number {
  return uniformScale(nativeWidth, metres);
}

export const HOMESTEAD_FEATURE_KINDS = new Set([
  "house",
  "windmill",
  "reservoir",
  "kraal",
  "shed",
  "trough",
  "track",
]);

function push(
  list: HomesteadSpritePlacement[],
  key: string,
  tileX: number,
  tileY: number,
  nativeW: number,
  metres: number,
  originY: number,
  offsetX = 0,
  offsetY = 0,
): void {
  list.push({
    key,
    tileX,
    tileY,
    offsetX,
    offsetY,
    scale: scaleToMetres(nativeW, metres),
    originX: 0.5,
    originY,
  });
}

/** Place yard buildings on their sim feature tiles (offer-specific layout). */
export function homesteadSpritePlacementsFromFeatures(features: Feature[]): HomesteadSpritePlacement[] {
  const byKind = (kind: Feature["kind"]) => features.find((f) => f.kind === kind);
  const house = byKind("house");
  const shed = byKind("shed");
  const list: HomesteadSpritePlacement[] = [];

  if (house) push(list, SPRITE_KEYS.farmhouse, house.x, house.y, 512, FARMHOUSE_WIDTH_METRES, 0.91);
  if (house) push(list, SPRITE_KEYS.bakkie, house.x + 2, house.y, 320, BAKKIE_LENGTH_METRES, 0.9, 0, 4);
  if (shed) push(list, SPRITE_KEYS.shed, shed.x, shed.y, 512, SHED_WIDTH_METRES, 0.89, 4, 2);
  return list;
}

/** Small corrugated worker cottages just outside the yard (roughly half the main house). */
export function workerCottagePlacements(features: Feature[]): HomesteadSpritePlacement[] {
  const cottages = features.filter((f) => f.kind === "worker_house");
  const main = features.find((f) => f.kind === "house");
  const list: HomesteadSpritePlacement[] = [];
  for (const cottage of cottages) {
    let offsetX = 0;
    let offsetY = 2;
    if (main) {
      const dx = main.x - cottage.x;
      const dy = main.y - cottage.y;
      const len = Math.hypot(dx, dy) || 1;
      offsetX = (dx / len) * 3;
      offsetY = (dy / len) * 3;
    }
    push(
      list,
      SPRITE_KEYS.workerHouse,
      cottage.x,
      cottage.y,
      128,
      COTTAGE_WIDTH_METRES,
      0.92,
      offsetX,
      offsetY,
    );
  }
  return list;
}
