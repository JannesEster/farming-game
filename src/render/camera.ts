import { clamp } from "../sim/math";

/** Scroll correction so zoom stays anchored on a screen point. */
export function zoomScrollDelta(
  beforeX: number,
  beforeY: number,
  afterX: number,
  afterY: number,
): { scrollX: number; scrollY: number } {
  return { scrollX: beforeX - afterX, scrollY: beforeY - afterY };
}

export function clampZoom(zoom: number, minZoom: number, maxZoom: number): number {
  return clamp(zoom, minZoom, maxZoom);
}

export function pinchCenter(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function pinchZoom(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
  minZoom: number,
  maxZoom: number,
  minDistance = 8,
): number | null {
  if (startDistance < minDistance) return null;
  return clampZoom(startZoom * (currentDistance / startDistance), minZoom, maxZoom);
}

export type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function boundsFromPoints(
  points: { x: number; y: number }[],
  padPx: number,
): WorldBounds | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    minX: minX - padPx,
    minY: minY - padPx,
    maxX: maxX + padPx,
    maxY: maxY + padPx,
  };
}

export function boundsCenter(bounds: WorldBounds): { x: number; y: number } {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/** Zoom so a world rectangle fills the given fraction of the viewport (0 to 1). */
export function zoomToFrameBounds(
  bounds: WorldBounds,
  viewportW: number,
  viewportH: number,
  fill: number,
): number {
  const worldW = Math.max(1, bounds.maxX - bounds.minX);
  const worldH = Math.max(1, bounds.maxY - bounds.minY);
  const safeFill = clamp(fill, 0.2, 0.95);
  return Math.min((viewportW * safeFill) / worldW, (viewportH * safeFill) / worldH);
}

export const HOMESTEAD_KINDS = new Set(["house", "windmill", "reservoir", "kraal"]);

/** How the opening view frames the homestead yard (world units and viewport fill). */
export const HOMESTEAD_VIEW = {
  worldPadPx: 96,
  viewportFill: 0.5,
  phoneTilePx: 44,
  desktopTilePx: 54,
  desktopMinWidthPx: 900,
};

export function preferredHomesteadZoom(
  bounds: WorldBounds,
  viewportW: number,
  viewportH: number,
  tileWidth: number,
): number {
  const framed = zoomToFrameBounds(bounds, viewportW, viewportH, HOMESTEAD_VIEW.viewportFill);
  const tileTarget =
    viewportW >= HOMESTEAD_VIEW.desktopMinWidthPx
      ? HOMESTEAD_VIEW.desktopTilePx
      : HOMESTEAD_VIEW.phoneTilePx;
  const tileZoom = tileTarget / tileWidth;
  return Math.max(framed, tileZoom);
}

export const PAN_INERTIA = {
  decayPerFrame: 0.9,
  frameMs: 16.667,
  minSpeed: 28,
  maxSpeed: 2400,
  doubleTapMs: 320,
  doubleTapSlopPx: 26,
};

/** Decay pan velocity; returns null when speed is below the cutoff. */
export function applyPanFriction(
  vx: number,
  vy: number,
  deltaMs: number,
  decayPerFrame: number,
  minSpeed: number,
  frameMs = PAN_INERTIA.frameMs,
): { vx: number; vy: number } | null {
  const scale = Math.pow(decayPerFrame, deltaMs / frameMs);
  const nextVx = vx * scale;
  const nextVy = vy * scale;
  if (Math.hypot(nextVx, nextVy) < minSpeed) return null;
  return { vx: nextVx, vy: nextVy };
}
