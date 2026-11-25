import { TREE_SPACING_M } from "../sim/vegetation";
import {
  BUSH_DENSE_METRES,
  BUSH_SPARSE_METRES,
  CAMELTHORN_LARGE_METRES,
  CAMELTHORN_SMALL_METRES,
  PIXELS_PER_METRE,
  SHEPHERDS_TREE_METRES,
} from "./worldScale";

/**
 * Close zoom keeps the painted sprites. Further out, each trunk is still
 * there, but the mark follows that sprite: a 12 m camelthorn gets a crown,
 * a 6 m tree or a bush gets a smaller, fainter one. The first LOD used one
 * saturated disk the size of the big tree for every trunk, so the open sand
 * read as forest and the homestead disappeared into the crowns.
 *
 * The file lists and the hash match `vegetationPose`, so a mark is the same
 * species as the sprite at that metre.
 */
export const TREE_SPRITE_ZOOM = 0.22;
/** Past this many trees and bushes in view, sprites give way to canopy marks. */
export const TREE_SPRITE_BUDGET = 700;
/** Vector marks stay crisp. Above this count one baked texture is the cheap path. */
export const TREE_DOT_GRAPHICS_MAX = 1800;

/** On the sand, under the road, fences, water, buildings and the herd. */
export const TREE_CANOPY_DEPTH = 0.45;
export const CANOPY_TEXTURE_KEY = "veg-canopy-lod";
export const CANOPY_TEXTURE_MAX_PX = 1280;

const TREE_FILES = [
  "tree-camelthorn-large.png",
  "tree-camelthorn-large-flip.png",
  "tree-camelthorn-small.png",
  "tree-camelthorn-small-flip.png",
  "tree-shepherds.png",
  "tree-shepherds-flip.png",
] as const;

const BUSH_FILES = [
  "bush-thorn-sparse.png",
  "bush-thorn-sparse.png",
  "bush-thorn-sparse-flip.png",
  "bush-thorn-sparse-flip.png",
  "bush-thorn-dense.png",
  "bush-thorn-dense-flip.png",
] as const;

/**
 * Dense core of the painted crown, not the transparent sprite box.
 * A solid disk the full height of a camelthorn covered the sand.
 */
const CROWN_WIDTH_M = {
  large: CAMELTHORN_LARGE_METRES * 0.62,
  small: CAMELTHORN_SMALL_METRES * 0.62,
  shepherd: SHEPHERDS_TREE_METRES * 0.55,
  bushDense: BUSH_DENSE_METRES * 0.85,
  bushSparse: BUSH_SPARSE_METRES * 0.8,
} as const;

/** Flat canopy: the ellipse is wider than it is tall, like the cut-out. */
const CROWN_HEIGHT_OF_WIDTH = 0.58;

const MIN_ZOOM = 0.0002;
/** Below this on-screen width a mark is just a green tint. Big trees can still get a floor. */
const MIN_MARK_SCREEN_PX = 1.15;

export type TreeLodMode = "sprites" | "dots";
export type TreeLodRect = { minX: number; minY: number; maxX: number; maxY: number };
export type VegSpecies = "large" | "small" | "shepherd" | "bushDense" | "bushSparse";

export type CanopyMark = {
  x: number;
  y: number;
  species: VegSpecies;
  /** Ellipse size in world pixels. Zero when the mark would only tint the sand. */
  width: number;
  height: number;
  alpha: number;
  /** Muted olive or grey-green. `shade` is the darker body, `fill` the lit top. */
  shade: number;
  fill: number;
};

const STYLE: Record<VegSpecies, { shade: number; fill: number; alpha: number }> = {
  large: { shade: 0x555e3c, fill: 0x6e7549, alpha: 0.78 },
  small: { shade: 0x515a38, fill: 0x667044, alpha: 0.66 },
  shepherd: { shade: 0x646656, fill: 0x7c7e6a, alpha: 0.62 },
  bushDense: { shade: 0x6e6248, fill: 0x8a7b58, alpha: 0.48 },
  bushSparse: { shade: 0x7a6c50, fill: 0x978664, alpha: 0.36 },
};

export const CANOPY_SHADOW = 0x2a1c10;

export function treeLodMode(zoom: number, spriteCount: number): TreeLodMode {
  const safe = Number.isFinite(zoom) && zoom > 0 ? zoom : 0;
  if (safe >= TREE_SPRITE_ZOOM && spriteCount <= TREE_SPRITE_BUDGET) return "sprites";
  return "dots";
}

function hashIndex(count: number, x: number, y: number): number {
  const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  return Math.floor(n * count) % count;
}

export function treeFileAt(x: number, y: number): string {
  return TREE_FILES[hashIndex(TREE_FILES.length, x, y)];
}

export function bushFileAt(x: number, y: number): string {
  return BUSH_FILES[hashIndex(BUSH_FILES.length, x, y)];
}

export function treeSpeciesAt(x: number, y: number): VegSpecies {
  const file = treeFileAt(x, y);
  if (file.includes("large")) return "large";
  if (file.includes("shepherd")) return "shepherd";
  return "small";
}

export function bushSpeciesAt(x: number, y: number): "bushDense" | "bushSparse" {
  return bushFileAt(x, y).includes("dense") ? "bushDense" : "bushSparse";
}

function safeZoom(zoom: number): number {
  return Math.max(Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM, MIN_ZOOM);
}

/**
 * World-pixel width of one crown. Big trees keep a speck on the whole-farm
 * map. Small trees and bushes are not inflated, or the sand turns green.
 */
export function canopyWidthPx(species: VegSpecies, scale: number, zoom: number): number {
  const jitter = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const natural = CROWN_WIDTH_M[species] * jitter * PIXELS_PER_METRE;
  if (species !== "large") return natural;
  const z = safeZoom(zoom);
  const gap = TREE_SPACING_M * Math.sqrt(3) * PIXELS_PER_METRE * z;
  const floor = Math.min(1.4, Math.max(0.85, gap * 0.36));
  const screen = natural * z;
  if (screen >= floor) return natural;
  return floor / z;
}

export function canopyDrawn(species: VegSpecies, scale: number, zoom: number): boolean {
  const width = canopyWidthPx(species, scale, zoom);
  if (species === "large") return width * safeZoom(zoom) >= 0.85;
  return width * safeZoom(zoom) >= MIN_MARK_SCREEN_PX;
}

function markFor(
  species: VegSpecies,
  x: number,
  y: number,
  scale: number,
  zoom: number,
): CanopyMark {
  const style = STYLE[species];
  const drawn = canopyDrawn(species, scale, zoom);
  const width = drawn ? canopyWidthPx(species, scale, zoom) : 0;
  const screen = width * safeZoom(zoom);
  const alpha = screen > 0 && screen < 2.4 ? style.alpha * 0.62 : style.alpha;
  return {
    x,
    y,
    species,
    width,
    height: width * CROWN_HEIGHT_OF_WIDTH,
    alpha,
    shade: style.shade,
    fill: style.fill,
  };
}

/** One record per tree, at that tree's position. Undrawn marks have width 0. */
export function treeCanopyMarks(
  trees: readonly { x: number; y: number; scale: number }[],
  zoom: number,
): CanopyMark[] {
  return trees.map((tree) => markFor(treeSpeciesAt(tree.x, tree.y), tree.x, tree.y, tree.scale, zoom));
}

export function bushCanopyMarks(
  bushes: readonly { x: number; y: number; scale: number }[],
  zoom: number,
): CanopyMark[] {
  return bushes.map((bush) => markFor(bushSpeciesAt(bush.x, bush.y), bush.x, bush.y, bush.scale, zoom));
}

/** Coarse zoom bucket. A baked texture is rebuilt when the bucket changes. */
export function canopyZoomBand(zoom: number): "near" | "mid" | "wide" | "far" | "tiny" {
  const safe = Number.isFinite(zoom) && zoom > 0 ? zoom : 0;
  if (safe >= 0.12) return "near";
  if (safe >= 0.05) return "mid";
  if (safe >= 0.017) return "wide";
  if (safe >= 0.01) return "far";
  return "tiny";
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

export function canopyCss(colour: number): string {
  return `#${colour.toString(16).padStart(6, "0")}`;
}
