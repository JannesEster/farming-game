import { TILE_HOMESTEAD, type GameState } from "../sim/types";
import { tileCenter, tileTop, type IsoLayout } from "./iso";

export type WorldRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Scroll correction so zoom stays anchored on a screen point. */
export function zoomScrollDelta(
  beforeX: number,
  beforeY: number,
  afterX: number,
  afterY: number,
): { scrollX: number; scrollY: number } {
  return { scrollX: beforeX - afterX, scrollY: beforeY - afterY };
}

const BUILDING_KINDS = new Set(["house", "windmill", "reservoir", "kraal", "trough"]);

/** World bounds that include the homestead yard, key water points, and the herd anchor. */
export function homesteadFrameBounds(
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  herdWorldX: number,
  herdWorldY: number,
  padPx: number,
): WorldRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (state.campIds[y * state.width + x] !== TILE_HOMESTEAD) continue;
      const top = tileTop(x, y, layout, tileW, tileH);
      include(top.x - tileW / 2, top.y);
      include(top.x + tileW / 2, top.y);
      include(top.x, top.y + tileH);
    }
  }

  for (const feature of state.features) {
    if (!BUILDING_KINDS.has(feature.kind)) continue;
    const center = tileCenter(feature.x, feature.y, layout, tileW, tileH);
    const lift = feature.kind === "windmill" ? tileH * 4 : tileH * 2.5;
    include(center.x - tileW * 0.6, center.y - lift);
    include(center.x + tileW * 0.6, center.y + tileH * 0.4);
  }

  include(herdWorldX - tileW * 2, herdWorldY - tileH * 3);
  include(herdWorldX + tileW * 2, herdWorldY + tileH * 2);

  if (!Number.isFinite(minX)) {
    minX = herdWorldX - tileW;
    maxX = herdWorldX + tileW;
    minY = herdWorldY - tileH;
    maxY = herdWorldY + tileH;
  }

  return {
    minX: minX - padPx,
    minY: minY - padPx,
    maxX: maxX + padPx,
    maxY: maxY + padPx,
  };
}

export function rectCenter(rect: WorldRect): { x: number; y: number } {
  return { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
}

/** Zoom so a world rectangle fits in the viewport (screen pixels). */
export function zoomToFitRect(
  viewWidthPx: number,
  viewHeightPx: number,
  rect: WorldRect,
  margin: number,
): number {
  const w = Math.max(1, rect.maxX - rect.minX);
  const h = Math.max(1, rect.maxY - rect.minY);
  const zx = (viewWidthPx * margin) / w;
  const zy = (viewHeightPx * margin) / h;
  return Math.min(zx, zy);
}

export function clampScroll(
  scrollX: number,
  scrollY: number,
  zoom: number,
  viewWidthPx: number,
  viewHeightPx: number,
  layoutWidth: number,
  layoutHeight: number,
): { scrollX: number; scrollY: number } {
  const viewW = viewWidthPx / zoom;
  const viewH = viewHeightPx / zoom;
  let x = scrollX;
  let y = scrollY;
  if (viewW >= layoutWidth) x = (layoutWidth - viewW) / 2;
  else x = clamp(x, 0, layoutWidth - viewW);
  if (viewH >= layoutHeight) y = (layoutHeight - viewH) / 2;
  else y = clamp(y, 0, layoutHeight - viewH);
  return { scrollX: x, scrollY: y };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Scale multiplier so a sprite stays at least minScreenPx wide on screen when zoomed out. */
export function legibilityScale(
  zoom: number,
  minScreenPx: number,
  baseWorldPx: number,
  baseScale = 1,
  maxScale = 2.8,
): number {
  const screen = baseWorldPx * baseScale * zoom;
  if (screen >= minScreenPx || zoom <= 0) return baseScale;
  return clamp(minScreenPx / (baseWorldPx * zoom), baseScale, maxScale);
}

/** One step of inertial pan; velocities are in world units per millisecond. */
export function panInertiaStep(
  scrollX: number,
  scrollY: number,
  velX: number,
  velY: number,
  deltaMs: number,
  frictionPerFrame: number,
  stopSpeed: number,
  frameMs = 16,
): { scrollX: number; scrollY: number; velX: number; velY: number } {
  if (velX === 0 && velY === 0) {
    return { scrollX, scrollY, velX, velY };
  }
  const nextScrollX = scrollX + velX * deltaMs;
  const nextScrollY = scrollY + velY * deltaMs;
  const decay = Math.pow(frictionPerFrame, deltaMs / frameMs);
  let nextVelX = velX * decay;
  let nextVelY = velY * decay;
  if (Math.hypot(nextVelX, nextVelY) < stopSpeed) {
    nextVelX = 0;
    nextVelY = 0;
  }
  return {
    scrollX: nextScrollX,
    scrollY: nextScrollY,
    velX: nextVelX,
    velY: nextVelY,
  };
}

/** Release velocity from the last drag sample (world units per ms). */
export function panReleaseVelocity(
  dragDxScreen: number,
  dragDyScreen: number,
  zoom: number,
  elapsedMs: number,
): { velX: number; velY: number } {
  const dt = Math.max(8, elapsedMs);
  return {
    velX: (-dragDxScreen / zoom) / dt,
    velY: (-dragDyScreen / zoom) / dt,
  };
}
