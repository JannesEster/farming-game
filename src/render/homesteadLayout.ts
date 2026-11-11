import { CONFIG } from "../sim/config";
import type { Feature } from "../sim/types";
import { SPRITE_KEYS } from "./sprites";

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

function scaleToFootprint(nativeWidth: number, tileSpans: number): number {
  return (CONFIG.view.tileWidth * tileSpans) / nativeWidth;
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
  span: number,
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
    scale: scaleToFootprint(nativeW, span),
    originX: 0.5,
    originY,
  });
}

/** Place yard buildings on their sim feature tiles (offer-specific layout). */
export function homesteadSpritePlacementsFromFeatures(features: Feature[]): HomesteadSpritePlacement[] {
  const byKind = (kind: Feature["kind"]) => features.find((f) => f.kind === kind);
  const house = byKind("house");
  const windmill = byKind("windmill");
  const shed = byKind("shed");
  const kraal = byKind("kraal");
  const reservoir = byKind("reservoir");
  const list: HomesteadSpritePlacement[] = [];

  if (house) push(list, SPRITE_KEYS.farmhouse, house.x, house.y, 512, 2.05, 0.91);
  if (house) push(list, SPRITE_KEYS.bakkie, house.x + 2, house.y, 320, 1.05, 0.9, 0, 4);
  if (shed) push(list, SPRITE_KEYS.shed, shed.x, shed.y, 512, 1.28, 0.89, 4, 2);
  if (windmill) push(list, SPRITE_KEYS.windmill, windmill.x, windmill.y, 512, 1.2, 0.94, -2, -2);
  if (reservoir) push(list, SPRITE_KEYS.trough, reservoir.x, reservoir.y, 256, 0.78, 0.88, 0, 4);
  if (kraal) push(list, SPRITE_KEYS.kraal, kraal.x, kraal.y, 512, 1.45, 0.84);

  const trough = byKind("trough");
  if (trough && trough.x !== reservoir?.x) {
    push(list, SPRITE_KEYS.trough, trough.x, trough.y, 256, 0.75, 0.88);
  }
  return list;
}
