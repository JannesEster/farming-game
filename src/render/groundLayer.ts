import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import type { GameState } from "../sim/types";
import { tileTop, type IsoLayout } from "./iso";
import { groundTexture, paintedGroundStamps, terrainVariant } from "./colour";
import { groundTextureKey } from "./art";
import { PAINTED_TILE_NATIVE_W } from "./sprites";

import type { PaintedGroundStamp } from "./colour";

export type GroundBakeTarget =
  | { mode: "painted"; stamps: PaintedGroundStamp[] }
  | { mode: "procedural"; key: string; tint: number };

export function groundBakeTarget(
  state: GameState,
  x: number,
  y: number,
  track: Set<string>,
  painted: boolean,
): GroundBakeTarget {
  if (painted) {
    return { mode: "painted", stamps: paintedGroundStamps(state, x, y, track) };
  }
  const kind = groundTexture(state, x, y, track);
  const variant = terrainVariant(x, y, kind);
  return {
    mode: "procedural",
    key: groundTextureKey(kind, variant),
    tint: 0xffffff,
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
  const backdrop = scene.add.graphics();
  backdrop.fillStyle(0x3b2a1e, 1);
  backdrop.fillRect(0, 0, w, h);
  rt.draw(backdrop, 0, 0);
  backdrop.destroy();

  for (const stamp of stamps) {
    const localX = stamp.x - minX + pad;
    const localY = stamp.y - minY + pad;
    const { target } = stamp;
    if (target.mode === "painted") {
      const scale = (tileW + 10) / PAINTED_TILE_NATIVE_W;
      for (const layer of target.stamps) {
        if (!scene.textures.exists(layer.key)) continue;
        rt.stamp(layer.key, undefined, localX, localY, {
          originX: 0.5,
          originY: 0,
          scale,
          angle: (layer.rotation * 180) / Math.PI,
          alpha: layer.alpha,
          tint: layer.tint,
        });
      }
    } else {
      rt.draw(target.key, localX, localY);
    }
  }
  rt.render();

  return { rt, x: minX - pad, y: minY - pad, w, h };
}
