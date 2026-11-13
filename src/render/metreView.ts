import Phaser from "phaser";
import type { GameState } from "../sim/types";
import { tileCenter, worldToTile, type IsoLayout } from "./iso";
import { palette } from "./palette";
import { PIXELS_PER_METRE } from "./worldScale";

const CHUNK_M = 48;
const CAMP_FILLS = [palette.grassBrown, palette.grassGold, 0x9a6238, 0x7a542c, 0xa56a32, 0x8a5830];

function corners(
  x: number,
  y: number,
  w: number,
  h: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): Phaser.Math.Vector2[] {
  return [
    tileCenter(x, y, layout, tileW, tileH),
    tileCenter(x + w, y, layout, tileW, tileH),
    tileCenter(x + w, y + h, layout, tileW, tileH),
    tileCenter(x, y + h, layout, tileW, tileH),
  ].map((point) => new Phaser.Math.Vector2(point.x, point.y));
}

/** Flat camp shapes. Used when the camera is too far for grass chunks. */
export function paintCampShapes(
  graphics: Phaser.GameObjects.Graphics,
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  zoom: number,
): void {
  graphics.clear();
  const line = Math.max(1.2, Math.min(48, 1.6 / Math.max(zoom, 0.002)));
  state.camps.forEach((camp, index) => {
    if (!camp.rect) return;
    const poly = corners(camp.rect.x, camp.rect.y, camp.rect.w, camp.rect.h, layout, tileW, tileH);
    graphics.fillStyle(CAMP_FILLS[index % CAMP_FILLS.length], zoom < 0.2 ? 1 : 0.35);
    graphics.fillPoints(poly, true);
    graphics.lineStyle(line, palette.fenceStrong, 0.9);
    graphics.strokePoints(poly, true);
  });
  if (state.road && state.road.length > 1 && zoom < 0.2) {
    graphics.lineStyle(Math.max(1.2, Math.min(24, 1.1 / Math.max(zoom, 0.002))), palette.track, 0.85);
    graphics.beginPath();
    state.road.forEach((point, index) => {
      const at = tileCenter(point.x, point.y, layout, tileW, tileH);
      if (index === 0) graphics.moveTo(at.x, at.y);
      else graphics.lineTo(at.x, at.y);
    });
    graphics.strokePath();
  }
  for (const point of state.farmWaterPoints ?? []) {
    const at = tileCenter(point.trough.x, point.trough.y, layout, tileW, tileH);
    const radius = (zoom < 0.2 ? 12 : 7) / Math.max(zoom, 0.002);
    graphics.fillStyle(palette.water, 0.95);
    graphics.fillCircle(at.x, at.y, radius);
  }
}

/** Two ruts, 1.6 m centre to centre, each about 0.4 m wide. Real width, so it vanishes on the farm map. */
export function paintTwoTrack(
  graphics: Phaser.GameObjects.Graphics,
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): void {
  graphics.clear();
  const road = state.road;
  if (!road || road.length < 2) return;
  const rut = 0.4 * PIXELS_PER_METRE;
  const offsetM = 0.8;
  const stroke = (sign: number) => {
    graphics.lineStyle(Math.max(1, rut * 0.5), sign < 0 ? palette.trackRut : palette.track, 0.9);
    graphics.beginPath();
    road.forEach((point, index) => {
      const next = road[Math.min(road.length - 1, index + 1)];
      const prev = road[Math.max(0, index - 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * offsetM * sign;
      const oy = (dx / len) * offsetM * sign;
      const at = tileCenter(point.x + ox, point.y + oy, layout, tileW, tileH);
      if (index === 0) graphics.moveTo(at.x, at.y);
      else graphics.lineTo(at.x, at.y);
    });
    graphics.strokePath();
  };
  stroke(-1);
  stroke(1);
}

/** Grass diamonds only for the chunks the camera can see. */
export function syncMetreChunks(
  scene: Phaser.Scene,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  chunks: Map<string, Phaser.GameObjects.Graphics>,
  zoom: number,
): void {
  if (zoom < 0.22) {
    chunks.forEach((chunk) => chunk.destroy());
    chunks.clear();
    return;
  }
  const view = scene.cameras.main.worldView;
  const samples = [
    worldToTile(view.x, view.y, layout, tileW, tileH),
    worldToTile(view.right, view.y, layout, tileW, tileH),
    worldToTile(view.x, view.bottom, layout, tileW, tileH),
    worldToTile(view.right, view.bottom, layout, tileW, tileH),
    worldToTile((view.x + view.right) / 2, (view.y + view.bottom) / 2, layout, tileW, tileH),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const sample of samples) {
    minX = Math.min(minX, sample.x);
    minY = Math.min(minY, sample.y);
    maxX = Math.max(maxX, sample.x);
    maxY = Math.max(maxY, sample.y);
  }
  const keep = new Set<string>();
  const x0 = Math.floor(minX / CHUNK_M) - 1;
  const x1 = Math.floor(maxX / CHUNK_M) + 1;
  const y0 = Math.floor(minY / CHUNK_M) - 1;
  const y1 = Math.floor(maxY / CHUNK_M) + 1;
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) {
      if (keep.size >= 16) break;
      const key = `${cx},${cy}`;
      keep.add(key);
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = scene.add.graphics().setDepth(0.35);
        const x = cx * CHUNK_M;
        const y = cy * CHUNK_M;
        const poly = corners(x, y, CHUNK_M, CHUNK_M, layout, tileW, tileH);
        const shade = ((cx * 3 + cy * 5) & 1) === 0 ? 0x6d7a34 : 0x627030;
        chunk.fillStyle(shade, 0.96);
        chunk.fillPoints(poly, true);
        chunks.set(key, chunk);
      }
      chunk.setVisible(true);
    }
  }
  for (const [key, chunk] of chunks) {
    if (keep.has(key)) continue;
    chunk.destroy();
    chunks.delete(key);
  }
}
