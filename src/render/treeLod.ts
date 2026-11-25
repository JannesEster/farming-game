import { TREE_SPACING_M } from "../sim/vegetation";
import { BUSH_DENSE_METRES, CAMELTHORN_LARGE_METRES, PIXELS_PER_METRE } from "./worldScale";

/**
 * Close zoom keeps the painted camelthorns. Further out, every tree is still
 * drawn, as a canopy mark at the same metre position. The old path deleted
 * the veld below zoom 0.02 and, above that, drew a 2.4px speck instead of
 * the 12 m crown, so the woodland vanished into the sand.
 */
export const TREE_SPRITE_ZOOM = 0.22;
/** Past this many trees and bushes in view, sprites give way to canopy marks. */
export const TREE_SPRITE_BUDGET = 700;
/** Vector circles are crisp. Above this count a baked texture is the cheap path. */
export const TREE_DOT_GRAPHICS_MAX = 1800;

/** Crown width of the large camelthorn. The close sprite is this tall. */
export const TREE_CANOPY_METRES = CAMELTHORN_LARGE_METRES;
/** Dark green that still reads on Kalahari sand (#c4682c). */
export const TREE_CANOPY_COLOUR = 0x1f5c32;
export const TREE_CANOPY_CSS = "#1f5c32";
/** Above the sand and the two-track, under buildings and cattle. */
export const TREE_CANOPY_DEPTH = 5;
export const CANOPY_TEXTURE_KEY = "veg-canopy-lod";
/** Bushes stay the old tan speck. They are not drawn on the whole-farm map. */
export const BUSH_DOT_COLOUR = 0x6a5a32;
export const BUSH_DOT_CSS = "#6a5a32";

/** Below this on-screen crown, a mark disappears into the sand. */
const TREE_DOT_MIN_SCREEN_PX = 1.75;
/** Stay under this share of the gap so neighbouring crowns do not merge. */
const TREE_DOT_GAP_FRACTION = 0.7;
const MIN_ZOOM = 0.0002;

export type TreeLodMode = "sprites" | "dots";

export type TreeLodRect = { minX: number; minY: number; maxX: number; maxY: number };

export type CanopyMark = { x: number; y: number; radius: number };

export function treeLodMode(zoom: number, spriteCount: number): TreeLodMode {
  const safe = Number.isFinite(zoom) && zoom > 0 ? zoom : 0;
  if (safe >= TREE_SPRITE_ZOOM && spriteCount <= TREE_SPRITE_BUDGET) return "sprites";
  return "dots";
}

/** On-screen crown diameter. Real metres while that is readable, then a small mark. */
export function treeCanopyScreenPx(zoom: number): number {
  const safe = Math.max(Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM, MIN_ZOOM);
  const canopy = TREE_CANOPY_METRES * PIXELS_PER_METRE * safe;
  const spacing = TREE_SPACING_M * PIXELS_PER_METRE * safe;
  const limit = Math.max(1.15, spacing * TREE_DOT_GAP_FRACTION);
  return Math.min(Math.max(canopy, TREE_DOT_MIN_SCREEN_PX), limit);
}

/** World-pixel radius of one canopy mark. Positions stay in metres. */
export function treeCanopyRadiusPx(zoom: number): number {
  const safe = Math.max(Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM, MIN_ZOOM);
  return treeCanopyScreenPx(zoom) / safe / 2;
}

/** A 2.2 m bush, in world pixels. Bushes already drop out below zoom 0.1. */
export function bushCanopyRadiusPx(): number {
  return (BUSH_DENSE_METRES * PIXELS_PER_METRE) / 2;
}

export function treeCanopyRadiusStable(previous: number, next: number): boolean {
  if (!(previous > 0) || !(next > 0)) return false;
  return Math.abs(next - previous) / previous < 0.15;
}

/**
 * One mark per tree. Zoom does not thin the list: a far view shows the same
 * trunks as the close view, only cheaper.
 */
export function treeCanopyMarks(trees: readonly { x: number; y: number }[], zoom: number): CanopyMark[] {
  const radius = treeCanopyRadiusPx(zoom);
  return trees.map((tree) => ({ x: tree.x, y: tree.y, radius }));
}

/** Coarse zoom bucket. A baked texture is rebuilt when the bucket changes. */
export function canopyZoomBand(zoom: number): "near" | "mid" | "wide" | "far" {
  const safe = Number.isFinite(zoom) && zoom > 0 ? zoom : 0;
  if (safe >= 0.12) return "near";
  if (safe >= 0.05) return "mid";
  if (safe >= 0.02) return "wide";
  return "far";
}

export function padTreeLodRect(rect: TreeLodRect, fraction = 0.42): TreeLodRect {
  const width = Math.max(0, rect.maxX - rect.minX);
  const height = Math.max(0, rect.maxY - rect.minY);
  const padX = width * fraction;
  const padY = height * fraction;
  return {
    minX: rect.minX - padX,
    minY: rect.minY - padY,
    maxX: rect.maxX + padX,
    maxY: rect.maxY + padY,
  };
}

export function clampTreeLodRect(rect: TreeLodRect, width: number, height: number, margin = 64): TreeLodRect {
  return {
    minX: Math.max(-margin, rect.minX),
    minY: Math.max(-margin, rect.minY),
    maxX: Math.min(width + margin, rect.maxX),
    maxY: Math.min(height + margin, rect.maxY),
  };
}

/** True when the camera rect sits inside an already drawn canopy rect. */
export function treeLodRectCovers(cover: TreeLodRect, view: TreeLodRect): boolean {
  return view.minX >= cover.minX - 1 && view.minY >= cover.minY - 1 && view.maxX <= cover.maxX + 1 && view.maxY <= cover.maxY + 1;
}

export const CANOPY_TEXTURE_MAX_PX = 1280;

/** Fit a world-pixel rectangle into one texture. `scale` is texture pixels per world pixel. */
export function canopyTextureSize(
  worldW: number,
  worldH: number,
  maxPx = CANOPY_TEXTURE_MAX_PX,
): { width: number; height: number; scale: number } {
  const w = Math.max(1, worldW);
  const h = Math.max(1, worldH);
  const scale = Math.min(1, maxPx / Math.max(w, h));
  return {
    width: Math.max(2, Math.ceil(w * scale)),
    height: Math.max(2, Math.ceil(h * scale)),
    scale,
  };
}
