import Phaser from "phaser";
import type { GameState } from "../sim/types";
import { tileCenter, type IsoLayout } from "./iso";
import { palette } from "./palette";
import { ensureMetreSandTexture } from "./v2Ground";
import { PIXELS_PER_METRE } from "./worldScale";

/** Muted Kalahari earth. Only the far farm map uses flat camp fills. */
const CAMP_FILLS = [0x8d4e2a, 0x7a4524, 0x9a5a32, 0x6e3e22, 0xa06838, 0x84502c];
const SAND_NAME = "metre-sand";

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

/**
 * World rectangle the camera is showing right now.
 * `worldView` lags a frame behind `scroll` and `zoom`, so a capture that
 * moves the camera and then draws fences would otherwise use the previous shot.
 */
export function liveCameraView(scene: Phaser.Scene): { x: number; y: number; right: number; bottom: number; width: number; height: number } {
  const camera = scene.cameras.main;
  const zoom = Math.max(camera.zoom, 0.000001);
  const width = camera.width / zoom;
  const height = camera.height / zoom;
  // Phaser 4: the world point at the screen centre is scroll + screenSize / 2.
  const x = camera.scrollX + camera.width / 2 - width / 2;
  const y = camera.scrollY + camera.height / 2 - height / 2;
  return { x, y, right: x + width, bottom: y + height, width, height };
}

/** True only for the whole-farm map. A single camp still gets the sand texture. */
export function farmMapView(scene: Phaser.Scene): boolean {
  const camera = scene.cameras.main;
  const widthM = camera.width / (Math.max(camera.zoom, 0.000001) * PIXELS_PER_METRE);
  return widthM > 4500;
}

/** Flat camp shapes. Only the far farm map. Close and mid views use the sand texture. */
export function paintCampShapes(
  graphics: Phaser.GameObjects.Graphics,
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  zoom: number,
  far = zoom < 0.05,
): void {
  graphics.clear();
  if (!far) return;
  const line = Math.max(1.2, Math.min(48, 1.6 / Math.max(zoom, 0.002)));
  state.camps.forEach((camp, index) => {
    if (!camp.rect) return;
    const poly = corners(camp.rect.x, camp.rect.y, camp.rect.w, camp.rect.h, layout, tileW, tileH);
    graphics.fillStyle(CAMP_FILLS[index % CAMP_FILLS.length], 1);
    graphics.fillPoints(poly, true);
    graphics.lineStyle(line, 0x5c4030, 0.85);
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

/** Kalahari sand under the close and mid camera. Hidden on the farm map. */
export function syncMetreChunks(
  scene: Phaser.Scene,
  layout: IsoLayout,
  _tileW: number,
  _tileH: number,
  chunks: Map<string, Phaser.GameObjects.Graphics>,
  zoom: number,
): void {
  chunks.forEach((chunk) => chunk.destroy());
  chunks.clear();
  const existing = scene.children.getByName(SAND_NAME);
  const sand = existing instanceof Phaser.GameObjects.TileSprite ? existing : null;
  if (farmMapView(scene) || zoom < 0.02) {
    sand?.setVisible(false);
    return;
  }
  const key = ensureMetreSandTexture(scene, layout);
  if (!key) return;
  const view = liveCameraView(scene);
  const pad = 8;
  const width = Math.max(8, view.width + pad * 2);
  const height = Math.max(8, view.height + pad * 2);
  const sprite =
    sand ??
    scene.add.tileSprite(0, 0, 64, 64, key).setOrigin(0, 0).setDepth(0.15).setName(SAND_NAME);
  sprite.setTexture(key);
  sprite.setPosition(view.x - pad, view.y - pad);
  sprite.setSize(width, height);
  sprite.tilePositionX = view.x - pad;
  sprite.tilePositionY = view.y - pad;
  sprite.setVisible(true);
}
