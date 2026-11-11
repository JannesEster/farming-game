import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import type { GameState } from "../sim/types";
import { tileTop, type IsoLayout } from "./iso";
import {
  groundTexture,
  paintedTileAlpha,
  paintedTileKey,
  paintedTileRotation,
  paintedTileTint,
  terrainVariant,
} from "./colour";
import { groundTextureKey } from "./art";
import { PAINTED_TILE_NATIVE_W } from "./sprites";

export type GroundBakeTarget =
  | { mode: "painted"; key: string; alpha: number; rotation: number; tint: number }
  | { mode: "procedural"; key: string; tint: number };

export function groundBakeTarget(
  state: GameState,
  x: number,
  y: number,
  track: Set<string>,
  painted: boolean,
): GroundBakeTarget {
  if (painted) {
    return {
      mode: "painted",
      key: paintedTileKey(state, x, y, track),
      alpha: paintedTileAlpha(state, x, y, track),
      rotation: paintedTileRotation(x, y),
      tint: paintedTileTint(state, x, y, track),
    };
  }
  const kind = groundTexture(state, x, y, track);
  const variant = terrainVariant(x, y, kind);
  return {
    mode: "procedural",
    key: groundTextureKey(kind, variant),
    tint: kind === "grass" ? paintedTileTint(state, x, y, track) : 0xffffff,
  };
}

export function bakeTerrainChunk(
  scene: Phaser.Scene,
  state: GameState,
  layout: IsoLayout,
  cx: number,
  cy: number,
  track: Set<string>,
  painted: boolean,
): { rt: Phaser.GameObjects.RenderTexture; x: number; y: number; w: number; h: number } {
  const chunk = CONFIG.view.terrainChunkTiles;
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  const size = chunk;
  const startX = cx * size;
  const startY = cy * size;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const stamps: { x: number; y: number; target: GroundBakeTarget }[] = [];

  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      const x = startX + dx;
      const y = startY + dy;
      if (x >= state.width || y >= state.height) continue;
      const top = tileTop(x, y, layout, tileW, tileH);
      minX = Math.min(minX, top.x - tileW);
      maxX = Math.max(maxX, top.x + tileW);
      minY = Math.min(minY, top.y - tileH);
      maxY = Math.max(maxY, top.y + tileH * 2);
      stamps.push({ x: top.x, y: top.y, target: groundBakeTarget(state, x, y, track, painted) });
    }
  }

  const pad = 4;
  const w = Math.ceil(maxX - minX + pad * 2);
  const h = Math.ceil(maxY - minY + pad * 2);
  const rt = scene.add.renderTexture(minX - pad, minY - pad, w, h).setOrigin(0, 0).setDepth(0);

  const scratch: Phaser.GameObjects.Image[] = [];
  for (const stamp of stamps) {
    const localX = stamp.x - minX + pad;
    const localY = stamp.y - minY + pad;
    const { target } = stamp;
  if (!scene.textures.exists(target.key)) continue;

    const img = scene.add.image(localX, localY, target.key);
    if (target.mode === "painted") {
      const scale = (tileW + 10) / PAINTED_TILE_NATIVE_W;
      img.setOrigin(0.5, 0);
      img.setScale(scale);
      img.setRotation(target.rotation);
      img.setAlpha(target.alpha);
      if (target.tint !== 0xffffff) {
        img.setTint(target.tint);
        img.setTintMode(Phaser.TintModes.MULTIPLY);
      }
    } else {
      img.setOrigin(0.5, 0);
      img.setDisplaySize(tileW + 6, tileH + 4);
      if (target.tint !== 0xffffff) {
        img.setTint(target.tint);
        img.setTintMode(Phaser.TintModes.FILL);
      }
    }
    rt.draw(img, localX, localY);
    scratch.push(img);
  }
  scratch.forEach((img) => img.destroy());

  return { rt, x: minX - pad, y: minY - pad, w, h };
}
