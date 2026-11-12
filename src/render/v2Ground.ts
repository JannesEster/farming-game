import Phaser from "phaser";
import { isRainyMonth } from "../sim/calendar";
import { CONFIG } from "../sim/config";
import { grazeableFraction } from "../sim/pasture";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type GameState } from "../sim/types";
import type { IsoLayout } from "./iso";

/** One seamless tile covers this many ground tiles, so the pattern does not restart per diamond. */
export const GROUND_REPEAT_TILES = 4;

export const V2_GROUND_KEYS = {
  dry: "v2-tile-kalahari-sand-dry-grass",
  green: "v2-tile-grass-after-rain",
  bare: "v2-tile-overgrazed-bare",
  road: "v2-tile-dirt-road",
  pen: "v2-tile-pen-dirt",
} as const;

type Source = CanvasImageSource & { width: number; height: number };

export function v2GroundReady(textures: Phaser.Textures.TextureManager): boolean {
  return textures.exists(V2_GROUND_KEYS.dry) && textures.exists(V2_GROUND_KEYS.road);
}

function sourceOf(scene: Phaser.Scene, key: string): Source | null {
  if (!scene.textures.exists(key)) return null;
  const image = scene.textures.get(key).getSourceImage() as Source;
  if (!image || !image.width) return null;
  return image;
}

/**
 * Map seamless top-down pixels onto the isometric ground.
 * Canvas pixel (0, 0) is world (originWorldX, originWorldY).
 */
export function applyGroundTransform(
  ctx: CanvasRenderingContext2D,
  image: Source,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  originWorldX: number,
  originWorldY: number,
): void {
  const span = image.width / GROUND_REPEAT_TILES;
  const a = tileW / (2 * span);
  const b = tileH / (2 * span);
  ctx.setTransform(a, b, -a, b, layout.originX - originWorldX, layout.originY - originWorldY);
}

function fillPattern(
  ctx: CanvasRenderingContext2D,
  image: Source,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  originWorldX: number,
  originWorldY: number,
  alpha: number,
): void {
  const pattern = ctx.createPattern(image, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  applyGroundTransform(ctx, image, layout, tileW, tileH, originWorldX, originWorldY);
  ctx.fillStyle = pattern;
  ctx.fillRect(-20000, -20000, 40000, 40000);
  ctx.restore();
}

type TileStamp = { x: number; y: number; topX: number; topY: number };

function grassOverlay(state: GameState, x: number, y: number, track: Set<string>): { key: string; alpha: number } | null {
  if (track.has(`${x},${y}`)) return { key: V2_GROUND_KEYS.road, alpha: 1 };
  const id = state.campIds[y * state.width + x];
  if (id === TILE_OUTSIDE) return null;
  if (id === TILE_HOMESTEAD) return { key: V2_GROUND_KEYS.pen, alpha: 0.38 };
  const camp = state.camps.find((item) => item.id === id);
  if (!camp) return null;
  const cover = grazeableFraction(camp);
  const rainy = isRainyMonth(state.date.month, CONFIG);
  if (cover < 0.32) return { key: V2_GROUND_KEYS.bare, alpha: Math.min(0.9, 0.5 + (0.32 - cover) * 1.3) };
  if (rainy) return { key: V2_GROUND_KEYS.green, alpha: Math.min(0.88, 0.28 + cover * 0.55) };
  return null;
}

function addDiamond(ctx: CanvasRenderingContext2D, topX: number, topY: number, tileW: number, tileH: number): void {
  const cx = topX;
  const cy = topY + tileH / 2;
  const grow = 1.08;
  const points = [
    { x: topX, y: topY },
    { x: topX + tileW / 2, y: topY + tileH / 2 },
    { x: topX, y: topY + tileH },
    { x: topX - tileW / 2, y: topY + tileH / 2 },
  ];
  points.forEach((point, index) => {
    const px = cx + (point.x - cx) * grow;
    const py = cy + (point.y - cy) * grow;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

/** Project the five seamless tiles across a terrain chunk. Same texture continues through each camp. */
export function projectV2GroundChunk(
  scene: Phaser.Scene,
  state: GameState,
  layout: IsoLayout,
  cx: number,
  cy: number,
  track: Set<string>,
  minX: number,
  minY: number,
  w: number,
  h: number,
): Phaser.GameObjects.Image | null {
  const dry = sourceOf(scene, V2_GROUND_KEYS.dry);
  if (!dry) return null;
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, w);
  canvas.height = Math.max(2, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const originWorldX = minX;
  const originWorldY = minY;
  fillPattern(ctx, dry, layout, tileW, tileH, originWorldX, originWorldY, 1);

  const chunk = CONFIG.view.terrainChunkTiles;
  const startX = cx * chunk;
  const startY = cy * chunk;
  const groups = new Map<string, { key: string; alpha: number; tiles: TileStamp[] }>();
  for (let dy = 0; dy < chunk; dy += 1) {
    for (let dx = 0; dx < chunk; dx += 1) {
      const x = startX + dx;
      const y = startY + dy;
      if (x >= state.width || y >= state.height) continue;
      const overlay = grassOverlay(state, x, y, track);
      if (!overlay) continue;
      const bucket = `${overlay.key}:${overlay.alpha.toFixed(2)}`;
      const group = groups.get(bucket) ?? { key: overlay.key, alpha: overlay.alpha, tiles: [] };
      const topX = layout.originX + (x - y) * (tileW / 2) - originWorldX;
      const topY = layout.originY + (x + y) * (tileH / 2) - originWorldY;
      group.tiles.push({ x, y, topX, topY });
      groups.set(bucket, group);
    }
  }
  for (const group of groups.values()) {
    const image = sourceOf(scene, group.key);
    if (!image) continue;
    ctx.save();
    ctx.beginPath();
    for (const tile of group.tiles) addDiamond(ctx, tile.topX, tile.topY, tileW, tileH);
    ctx.clip();
    fillPattern(ctx, image, layout, tileW, tileH, originWorldX, originWorldY, group.alpha);
    ctx.restore();
  }

  const key = `v2-ground-chunk-${cx}-${cy}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return scene.add.image(originWorldX, originWorldY, key).setOrigin(0, 0).setDepth(0);
}

/** Pen dirt as one masked fill per pen, not a stretched diamond. */
export function renderPenFloor(
  scene: Phaser.Scene,
  layout: IsoLayout,
  polygons: { x: number; y: number }[][],
  id = "yard",
): Phaser.GameObjects.Image | null {
  const image = sourceOf(scene, V2_GROUND_KEYS.pen);
  if (!image || polygons.length === 0) return null;
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const polygon of polygons) {
    for (const point of polygon) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  const pad = 8;
  minX -= pad;
  minY -= pad;
  const w = Math.ceil(maxX - minX + pad * 2);
  const h = Math.ceil(maxY - minY + pad * 2);
  if (w < 2 || h < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.beginPath();
  for (const polygon of polygons) {
    polygon.forEach((point, index) => {
      const x = point.x - minX;
      const y = point.y - minY;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.clip();
  fillPattern(ctx, image, layout, tileW, tileH, minX, minY, 1);
  const key = `v2-pen-floor-${id}-${Math.round(minX)}-${Math.round(minY)}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return scene.add.image(minX, minY, key).setOrigin(0, 0).setDepth(0.4);
}
