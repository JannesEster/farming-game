import Phaser from "phaser";
import { isRainyMonth } from "../sim/calendar";
import { CONFIG } from "../sim/config";
import { grazeableFraction } from "../sim/pasture";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type GameState } from "../sim/types";
import type { IsoLayout } from "./iso";
import { tileCenter } from "./iso";
import { PIXELS_PER_METRE } from "./worldScale";

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

function tuftHash(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 19.17) * 43758.5453;
  return n - Math.floor(n);
}

/** Dry grass tufts baked into the ground so the veld is not bare sand. */
function paintGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, salt: number): void {
  const roll = tuftHash(x, y, salt);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((roll - 0.5) * 0.6);
  ctx.lineCap = "round";
  ctx.lineWidth = 1.6;
  const blades = 3 + Math.floor(roll * 3);
  for (let i = 0; i < blades; i += 1) {
    const lean = (i - (blades - 1) / 2) * 0.38;
    const len = 11 + ((Math.floor(roll * 17) + i * 5) % 9);
    const green = (i + salt) % 2 === 0;
    ctx.strokeStyle = green ? "rgba(96, 112, 54, 0.72)" : "rgba(154, 128, 64, 0.8)";
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.quadraticCurveTo(Math.sin(lean) * len * 0.45, -len * 0.45, Math.sin(lean) * len * 0.7, -len);
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

  for (let dy = 0; dy < chunk; dy += 1) {
    for (let dx = 0; dx < chunk; dx += 1) {
      const x = startX + dx;
      const y = startY + dy;
      if (x >= state.width || y >= state.height || track.has(`${x},${y}`)) continue;
      const id = state.campIds[y * state.width + x];
      if (id === TILE_HOMESTEAD) continue;
      const roll = tuftHash(x, y, 1);
      if (roll < 0.42) continue;
      const topX = layout.originX + (x - y) * (tileW / 2) - originWorldX;
      const topY = layout.originY + (x + y) * (tileH / 2) - originWorldY;
      paintGrassTuft(ctx, topX, topY + tileH * 0.55, 1);
      if (tuftHash(x, y, 2) > 0.45) {
        paintGrassTuft(ctx, topX + (tuftHash(x, y, 3) - 0.5) * tileW * 0.35, topY + tileH * 0.35, 2);
      }
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

const ROAD_NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

type RoadPoint = { x: number; y: number };

function smoothChain(points: RoadPoint[]): RoadPoint[] {
  let current = points;
  for (let pass = 0; pass < 2; pass += 1) {
    if (current.length < 3) break;
    const next: RoadPoint[] = [current[0]];
    for (let i = 0; i < current.length - 1; i += 1) {
      const a = current[i];
      const b = current[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function offsetChain(points: RoadPoint[], distance: number): RoadPoint[] {
  return points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    return { x: point.x + -ty * distance, y: point.y + tx * distance };
  });
}

function pointAlong(points: RoadPoint[], lengths: number[], distance: number): RoadPoint {
  const total = lengths[lengths.length - 1] ?? 0;
  const dist = Math.max(0, Math.min(total, distance));
  let index = 1;
  while (index < lengths.length - 1 && lengths[index] < dist) index += 1;
  const start = lengths[index - 1] ?? 0;
  const span = (lengths[index] ?? start) - start || 1;
  const t = (dist - start) / span;
  const a = points[index - 1] ?? points[0];
  const b = points[index] ?? a;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Pale dust, a step lighter than Kalahari sand (about rgb 194, 106, 37).
 * Close enough to stay a dirt track, light enough to read at a few hundred metres.
 */
const RUT_RGB = [220, 162, 96] as const;
const FAR_LINE_RGB = [230, 180, 118] as const;
const RUT_WIDTH_METRES = 0.4;
const RUT_CENTRE_METRES = 1.6;
/** When each rut would be thinner than this on screen, draw one soft line instead. */
const RUT_MIN_SCREEN_PX = 2;
/** Far-zoom line, a little over the 2 px minimum so it stays readable after antialiasing. */
const FAR_LINE_SCREEN_PX = 2.6;

export function roadDrawMode(zoom: number): "tracks" | "line" {
  const safe = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return RUT_WIDTH_METRES * PIXELS_PER_METRE * safe < RUT_MIN_SCREEN_PX ? "line" : "tracks";
}

/** Stable paint bucket. Track mode ignores zoom; the far line rebuilds when zoom changes. */
export function roadPaintKey(zoom: number): string {
  if (roadDrawMode(zoom) === "tracks") return "tracks";
  const bucket = Math.max(0.05, Math.round(zoom * 40) / 40);
  return `line:${bucket.toFixed(3)}`;
}

function paintZoom(zoom: number): number {
  if (roadDrawMode(zoom) === "tracks") return Math.max(zoom, 0.05);
  return Math.max(0.05, Math.round(zoom * 40) / 40);
}

function strokeFaded(
  ctx: CanvasRenderingContext2D,
  points: RoadPoint[],
  width: number,
  alpha: number,
  blur: number,
  fadeStart: boolean,
  fadeEnd: boolean,
  fadePx: number,
  rgb: readonly [number, number, number] = RUT_RGB,
): void {
  if (points.length < 2) return;
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1] ?? 0;
  if (total < 1) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.shadowBlur = blur;
  const step = Math.max(5, width * 0.7);
  for (let dist = 0; dist < total; dist += step) {
    const a = pointAlong(points, lengths, dist);
    const b = pointAlong(points, lengths, Math.min(total, dist + step + 0.8));
    let fade = 1;
    if (fadeStart) fade = Math.min(fade, dist / fadePx);
    if (fadeEnd) fade = Math.min(fade, (total - dist) / fadePx);
    fade = Math.max(0, Math.min(1, fade));
    const paint = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(alpha * fade).toFixed(3)})`;
    ctx.strokeStyle = paint;
    ctx.shadowColor = paint;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * One ground decal for the farm road: a narrow two-track, plus a soft gravel
 * apron where the truck turns. Drawn once in world space so chunk edges cannot cut it.
 * Each rut is 0.4 m wide and the ruts are 1.6 m centre to centre. The grass between
 * them is unpainted ground. Ends of the track fade over about 3.5 m.
 * When a rut would be under 2 screen pixels, the pair becomes one soft pale line
 * at least 2 px wide so the road stays readable when the camera is far out.
 */
export function renderFarmRoad(
  scene: Phaser.Scene,
  state: GameState,
  layout: IsoLayout,
  cameraZoom = 1,
): Phaser.GameObjects.Image | null {
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  const scaleOf = new Map<string, number>();
  for (const feature of state.features) {
    if (feature.kind !== "track") continue;
    const key = `${feature.x},${feature.y}`;
    scaleOf.set(key, Math.max(scaleOf.get(key) ?? 1, feature.scale || 1));
  }
  if (scaleOf.size === 0) return null;

  const spineKeys = [...scaleOf.entries()].filter(([, scale]) => scale < 2 || scale >= 3).map(([key]) => key);
  const spine = new Set(spineKeys);
  const neighbours = (key: string): string[] => {
    const [x, y] = key.split(",").map(Number);
    const found: string[] = [];
    for (const [dx, dy] of ROAD_NEIGHBOURS) {
      const next = `${x + dx},${y + dy}`;
      if (spine.has(next)) found.push(next);
    }
    return found;
  };
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const used = new Set<string>();
  const chains: string[][] = [];
  const walk = (start: string, first: string): string[] => {
    const chain = [start];
    let prev = start;
    let current = first;
    used.add(edgeKey(start, first));
    while (current) {
      chain.push(current);
      const next = neighbours(current).find((item) => item !== prev && !used.has(edgeKey(current, item)));
      if (!next) break;
      used.add(edgeKey(current, next));
      prev = current;
      current = next;
    }
    return chain;
  };
  const starts = spineKeys.filter((key) => neighbours(key).length !== 2);
  const seeds = starts.length > 0 ? starts : spineKeys.slice(0, 1);
  for (const start of seeds) {
    for (const next of neighbours(start)) {
      if (used.has(edgeKey(start, next))) continue;
      const chain = walk(start, next);
      if (chain.length >= 2) chains.push(chain);
    }
  }
  for (const key of spineKeys) {
    for (const next of neighbours(key)) {
      if (used.has(edgeKey(key, next))) continue;
      const chain = walk(key, next);
      if (chain.length >= 2) chains.push(chain);
    }
  }

  const worldOf = (key: string): RoadPoint => {
    const [x, y] = key.split(",").map(Number);
    return tileCenter(x, y, layout, tileW, tileH);
  };
  const polylines = chains.map((chain) => smoothChain(chain.map(worldOf)));
  const apron = [...scaleOf.entries()].filter(([, scale]) => scale >= 2).map(([key]) => worldOf(key));
  const samples = [...polylines.flat(), ...apron];
  if (samples.length === 0) return null;

  const zoom = paintZoom(cameraZoom);
  const far = roadDrawMode(cameraZoom) === "line";
  const rutWidth = RUT_WIDTH_METRES * PIXELS_PER_METRE;
  const rutOffset = (RUT_CENTRE_METRES / 2) * PIXELS_PER_METRE;
  const fadePx = 3.5 * PIXELS_PER_METRE;
  const lineWorld = FAR_LINE_SCREEN_PX / zoom;
  const pad = Math.ceil((far ? lineWorld * 0.5 + 8 : rutOffset * 2 + rutWidth) + fadePx * 0.35);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of samples) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  minX -= pad;
  minY -= pad;
  const width = Math.ceil(maxX - minX + pad);
  const height = Math.ceil(maxY - minY + pad);
  if (width < 2 || height < 2 || width > 8192 || height > 8192) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const local = (points: RoadPoint[]) => points.map((point) => ({ x: point.x - minX, y: point.y - minY }));

  const apronRadius = Math.hypot(tileW / 2, tileH / 2) * 1.15;
  for (const point of apron) {
    const x = point.x - minX;
    const y = point.y - minY;
    const paint = ctx.createRadialGradient(x, y, apronRadius * 0.15, x, y, apronRadius);
    paint.addColorStop(0, "rgba(210, 150, 78, 0.36)");
    paint.addColorStop(0.55, "rgba(200, 140, 70, 0.16)");
    paint.addColorStop(1, "rgba(200, 140, 70, 0)");
    ctx.fillStyle = paint;
    ctx.beginPath();
    ctx.arc(x, y, apronRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  const degree = new Map<string, number>();
  for (const key of spineKeys) degree.set(key, neighbours(key).length);
  for (let chainIndex = 0; chainIndex < polylines.length; chainIndex += 1) {
    const line = polylines[chainIndex];
    const keys = chains[chainIndex];
    const fadeStart = (degree.get(keys[0]) ?? 0) <= 1;
    const fadeEnd = (degree.get(keys[keys.length - 1]) ?? 0) <= 1;
    if (far) {
      const centre = local(line);
      const core = Math.max(lineWorld, RUT_MIN_SCREEN_PX / zoom);
      strokeFaded(ctx, centre, core + FAR_LINE_SCREEN_PX / zoom, 0.36, 1.2, fadeStart, fadeEnd, fadePx, FAR_LINE_RGB);
      strokeFaded(ctx, centre, core, 0.82, 0, fadeStart, fadeEnd, fadePx, FAR_LINE_RGB);
    } else {
      const shifted = [-rutOffset, rutOffset].map((distance) => local(offsetChain(line, distance)));
      for (const rut of shifted) {
        strokeFaded(ctx, rut, rutWidth + 2, 0.32, 0.8, fadeStart, fadeEnd, fadePx, RUT_RGB);
        strokeFaded(ctx, rut, rutWidth, 0.7, 0, fadeStart, fadeEnd, fadePx, RUT_RGB);
      }
    }
  }

  const key = "v2-farm-road";
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  const image = scene.add.image(minX, minY, key).setOrigin(0, 0).setDepth(0.2);
  image.setData("roadPaintKey", roadPaintKey(cameraZoom));
  return image;
}

/** Repaint the road when the camera crosses the far-zoom line, or the line width changes. */
export function syncFarmRoadLod(
  scene: Phaser.Scene,
  current: Phaser.GameObjects.Image | undefined,
  state: GameState,
  layout: IsoLayout,
  cameraZoom: number,
): Phaser.GameObjects.Image | undefined {
  const key = roadPaintKey(cameraZoom);
  if (current?.active && current.getData("roadPaintKey") === key) return current;
  current?.destroy();
  return renderFarmRoad(scene, state, layout, cameraZoom) ?? undefined;
}
