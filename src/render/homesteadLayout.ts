import { CONFIG } from "../sim/config";
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

/** Spread homestead props across yard tiles with 1–2 tile footprints (no overlap). */
export function homesteadSpritePlacements(): HomesteadSpritePlacement[] {
  const yard = CONFIG.map.yard;
  return [
    {
      key: SPRITE_KEYS.farmhouse,
      tileX: yard.house.x,
      tileY: yard.house.y,
      offsetX: 0,
      offsetY: 0,
      scale: scaleToFootprint(512, 2.05),
      originX: 0.5,
      originY: 0.91,
    },
    {
      key: SPRITE_KEYS.bakkie,
      tileX: yard.house.x + 2,
      tileY: yard.house.y,
      offsetX: 0,
      offsetY: 4,
      scale: scaleToFootprint(320, 1.05),
      originX: 0.5,
      originY: 0.9,
    },
    {
      key: SPRITE_KEYS.shed,
      tileX: yard.shed.x,
      tileY: yard.shed.y,
      offsetX: 6,
      offsetY: 2,
      scale: scaleToFootprint(512, 1.28),
      originX: 0.5,
      originY: 0.89,
    },
    {
      key: SPRITE_KEYS.windmill,
      tileX: yard.windmill.x,
      tileY: yard.windmill.y,
      offsetX: -4,
      offsetY: -2,
      scale: scaleToFootprint(512, 1.22),
      originX: 0.48,
      originY: 0.94,
    },
    {
      key: SPRITE_KEYS.trough,
      tileX: yard.reservoir.x,
      tileY: yard.reservoir.y,
      offsetX: 0,
      offsetY: 6,
      scale: scaleToFootprint(256, 0.82),
      originX: 0.5,
      originY: 0.88,
    },
    {
      key: SPRITE_KEYS.kraal,
      tileX: yard.kraal.x,
      tileY: yard.kraal.y,
      offsetX: 0,
      offsetY: 0,
      scale: scaleToFootprint(512, 1.48),
      originX: 0.5,
      originY: 0.84,
    },
  ];
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
