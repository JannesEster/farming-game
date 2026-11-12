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
  pixelScale = 1,
): void {
  const span = image.width / GROUND_REPEAT_TILES;
  const a = (tileW / (2 * span)) * pixelScale;
  const b = (tileH / (2 * span)) * pixelScale;
  ctx.setTransform(
    a,
    b,
    -a,
    b,
    (layout.originX - originWorldX) * pixelScale,
    (layout.originY - originWorldY) * pixelScale,
  );
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
  pixelScale = 1,
): void {
  const pattern = ctx.createPattern(image, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  applyGroundTransform(ctx, image, layout, tileW, tileH, originWorldX, originWorldY, pixelScale);
  ctx.fillStyle = pattern;
  ctx.fillRect(-80000, -80000, 160000, 160000);
  ctx.restore();
}

/**
 * One seamless dry-grass cell. A tile sprite of this fills any gap the chunks leave,
 * including the margin around the map when the camera is zoomed out.
 * The cell is exactly one axis-aligned repeat of the iso projection (256×128).
 */
export function ensureV2GroundFillTexture(scene: Phaser.Scene, layout: IsoLayout): string | null {
  const dry = sourceOf(scene, V2_GROUND_KEYS.dry);
  if (!dry) return null;
  const key = "v2-ground-fill";
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  fillPattern(ctx, dry, layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight, 0, 0, 1, 1);
  scene.textures.addCanvas(key, canvas);
  return key;
}

type TileStamp = { x: number; y: number; topX: number; topY: number };

function grassOverlay(state: GameState, x: number, y: number, track: Set<string>): { key: string; alpha: number } | null {
  if (track.has(`${x},${y}`)) return null;
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

const ROAD_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
] as const;

function roadScreenDir(
  track: Set<string>,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  let best = { x: tileW / 2, y: tileH / 2 };
  let bestScore = -1;
  for (const [dx, dy] of ROAD_DIRS) {
    if (!track.has(`${x + dx},${y + dy}`)) continue;
    const straight = track.has(`${x + dx * 2},${y + dy * 2}`) || track.has(`${x - dx},${y - dy}`) ? 2 : 1;
    if (straight <= bestScore) continue;
    bestScore = straight;
    best = { x: (dx - dy) * (tileW / 2), y: (dx + dy) * (tileH / 2) };
  }
  return best;
}

/**
 * Two wheel ruts on the farm road. Scale 1 is the two-track through the grass.
 * Scale 2 is the gravel turning pad. Scale 3 is the pad's centre line, ruts included.
 */
function paintTwoTrack(
  ctx: CanvasRenderingContext2D,
  topX: number,
  topY: number,
  tileW: number,
  tileH: number,
  dir: { x: number; y: number },
  scale: number,
): void {
  ctx.save();
  ctx.beginPath();
  addDiamond(ctx, topX, topY, tileW, tileH);
  ctx.clip();
  const cx = topX;
  const cy = topY + tileH / 2;
  const apron = scale >= 2;
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const px = -uy;
  const py = ux;
  const half = tileW * (apron ? 0.18 : 0.14);
  const along = Math.hypot(tileW / 2, tileH / 2) * 1.35;
  if (apron) {
    ctx.fillStyle = "rgba(214, 188, 142, 0.94)";
    ctx.fillRect(cx - tileW, cy - tileH, tileW * 2, tileH * 2);
  } else {
    ctx.strokeStyle = "rgba(176, 128, 74, 0.85)";
    ctx.lineWidth = half * 1.35;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(cx - ux * along, cy - uy * along);
    ctx.lineTo(cx + ux * along, cy + uy * along);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(36, 18, 8, 0.95)";
  ctx.lineWidth = apron ? 7 : 5.5;
  ctx.lineCap = "butt";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx - ux * along + px * half * side, cy - uy * along + py * half * side);
    ctx.lineTo(cx + ux * along + px * half * side, cy + uy * along + py * half * side);
    ctx.stroke();
  }
  ctx.restore();
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

  const trackScale = new Map<string, number>();
  for (const feature of state.features) {
    if (feature.kind !== "track") continue;
    const key = `${feature.x},${feature.y}`;
    trackScale.set(key, Math.max(trackScale.get(key) ?? 1, feature.scale || 1));
  }
  for (let dy = 0; dy < chunk; dy += 1) {
    for (let dx = 0; dx < chunk; dx += 1) {
      const x = startX + dx;
      const y = startY + dy;
      if (!track.has(`${x},${y}`)) continue;
      const topX = layout.originX + (x - y) * (tileW / 2) - originWorldX;
      const topY = layout.originY + (x + y) * (tileH / 2) - originWorldY;
      paintTwoTrack(ctx, topX, topY, tileW, tileH, roadScreenDir(track, x, y, tileW, tileH), trackScale.get(`${x},${y}`) ?? 1);
    }
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
