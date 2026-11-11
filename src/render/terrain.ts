import Phaser from "phaser";
import { CONFIG } from "../sim/config";

export function chunkCoordsForTile(x: number, y: number): { cx: number; cy: number } {
  const size = CONFIG.view.terrainChunkTiles;
  return { cx: Math.floor(x / size), cy: Math.floor(y / size) };
}

export function chunkWorldBounds(
  cx: number,
  cy: number,
  originX: number,
  originY: number,
  tileW: number,
  tileH: number,
): Phaser.Geom.Rectangle {
  const size = CONFIG.view.terrainChunkTiles;
  const w = size * tileW;
  const h = size * tileH;
  return new Phaser.Geom.Rectangle(originX + cx * w * 0.5, originY + cy * h, w, h);
}

export function boundsVisible(
  camera: Phaser.Cameras.Scene2D.Camera,
  bounds: Phaser.Geom.Rectangle,
  pad: number,
): boolean {
  const view = camera.worldView;
  const expanded = new Phaser.Geom.Rectangle(
    bounds.x - pad,
    bounds.y - pad,
    bounds.width + pad * 2,
    bounds.height + pad * 2,
  );
  return Phaser.Geom.Rectangle.Overlaps(view, expanded);
}
