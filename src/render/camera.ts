import { clamp } from "../sim/math";

/** World x of the left edge of the visible view (Phaser 4 scroll model). */
export function visibleWorldLeft(scrollX: number, screenW: number, zoom: number): number {
  const viewW = screenW / zoom;
  return scrollX + screenW / 2 - viewW / 2;
}

/** Scroll in screen space that centres the layout when the zoomed view is larger than the map. */
export function centreScrollWhenViewExceedsLayout(
  layoutSize: number,
  screenSize: number,
): number {
  return layoutSize / 2 - screenSize / 2;
}

/**
 * Phaser 4: world at screen centre is scroll + screenSize / 2. Clamp scroll so the map stays on screen.
 */
export const CAMERA_CLEAR_MARGIN_PX = 8;

export type ViewInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function worldXAtScreenX(scrollX: number, screenW: number, zoom: number, screenX: number): number {
  const viewW = screenW / zoom;
  return scrollX + screenW / 2 - viewW / 2 + screenX / zoom;
}

export function worldYAtScreenY(scrollY: number, screenH: number, zoom: number, screenY: number): number {
  const viewH = screenH / zoom;
  return scrollY + screenH / 2 - viewH / 2 + screenY / zoom;
}

export function scrollXForWorldAtScreenX(
  worldX: number,
  screenW: number,
  zoom: number,
  screenX: number,
): number {
  const viewW = screenW / zoom;
  return worldX - screenW / 2 + viewW / 2 - screenX / zoom;
}

export function scrollYForWorldAtScreenY(
  worldY: number,
  screenH: number,
  zoom: number,
  screenY: number,
): number {
  const viewH = screenH / zoom;
  return worldY - screenH / 2 + viewH / 2 - screenY / zoom;
}

export type LayoutTip = "north" | "south" | "east" | "west";

/** Scroll that places a map edge on the inner edge of the clear viewport band. */
export function scrollToLayoutTip(
  tip: LayoutTip,
  layoutW: number,
  layoutH: number,
  screenW: number,
  screenH: number,
  zoom: number,
  insets: ViewInsets,
  margin = CAMERA_CLEAR_MARGIN_PX,
): { scrollX: number; scrollY: number } {
  const top = insets.top + margin;
  const bottom = insets.bottom + margin;
  const left = insets.left + margin;
  const right = insets.right + margin;
  let scrollX = scrollXForWorldAtScreenX(layoutW / 2, screenW, zoom, left + (screenW - left - right) / 2);
  let scrollY = scrollYForWorldAtScreenY(layoutH / 2, screenH, zoom, top + (screenH - top - bottom) / 2);
  if (tip === "north") scrollY = scrollYForWorldAtScreenY(0, screenH, zoom, top);
  if (tip === "south") scrollY = scrollYForWorldAtScreenY(layoutH, screenH, zoom, screenH - bottom);
  if (tip === "west") scrollX = scrollXForWorldAtScreenX(0, screenW, zoom, left);
  if (tip === "east") scrollX = scrollXForWorldAtScreenX(layoutW, screenW, zoom, screenW - right);
  return clampCameraScrollWithInsets(
    scrollX,
    scrollY,
    layoutW,
    layoutH,
    screenW,
    screenH,
    zoom,
    insets,
    margin,
  );
}

/**
 * Clamps pan so map tips can reach the clear map band (below the top bar, above bottom chrome).
 */
export function clampCameraScrollWithInsets(
  scrollX: number,
  scrollY: number,
  layoutW: number,
  layoutH: number,
  screenW: number,
  screenH: number,
  zoom: number,
  insets: ViewInsets,
  margin = CAMERA_CLEAR_MARGIN_PX,
): { scrollX: number; scrollY: number } {
  const top = insets.top + margin;
  const bottom = insets.bottom + margin;
  const left = insets.left + margin;
  const right = insets.right + margin;
  const contentW = Math.max(1, screenW - left - right);
  const contentH = Math.max(1, screenH - top - bottom);
  const bandViewW = contentW / zoom;
  const bandViewH = contentH / zoom;

  let sx = scrollX;
  let sy = scrollY;

  if (bandViewW >= layoutW) {
    sx = scrollXForWorldAtScreenX(layoutW / 2, screenW, zoom, left + contentW / 2);
  } else {
    const north = scrollXForWorldAtScreenX(0, screenW, zoom, left);
    const south = scrollXForWorldAtScreenX(layoutW, screenW, zoom, screenW - right);
    const minX = Math.min(north, south);
    const maxX = Math.max(north, south);
    sx = clamp(scrollX, minX, maxX);
  }

  if (bandViewH >= layoutH) {
    sy = scrollYForWorldAtScreenY(layoutH / 2, screenH, zoom, top + contentH / 2);
  } else {
    const north = scrollYForWorldAtScreenY(0, screenH, zoom, top);
    const south = scrollYForWorldAtScreenY(layoutH, screenH, zoom, screenH - bottom);
    const minY = Math.min(north, south);
    const maxY = Math.max(north, south);
    sy = clamp(scrollY, minY, maxY);
  }

  return { scrollX: sx, scrollY: sy };
}

export function clampCameraScroll(
  scrollX: number,
  scrollY: number,
  layoutW: number,
  layoutH: number,
  screenW: number,
  screenH: number,
  zoom: number,
): { scrollX: number; scrollY: number } {
  const viewW = screenW / zoom;
  const viewH = screenH / zoom;
  let sx = scrollX;
  let sy = scrollY;
  if (viewW >= layoutW) {
    sx = centreScrollWhenViewExceedsLayout(layoutW, screenW);
  } else {
    const minX = viewW / 2 - screenW / 2;
    const maxX = layoutW - viewW / 2 - screenW / 2;
    sx = clamp(scrollX, minX, maxX);
  }
  if (viewH >= layoutH) {
    sy = centreScrollWhenViewExceedsLayout(layoutH, screenH);
  } else {
    const minY = viewH / 2 - screenH / 2;
    const maxY = layoutH - viewH / 2 - screenH / 2;
    sy = clamp(scrollY, minY, maxY);
  }
  return { scrollX: sx, scrollY: sy };
}

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

export function mergeViewBounds(a: WorldBounds, b: WorldBounds, padPx = 0): WorldBounds {
  return {
    minX: Math.min(a.minX, b.minX) - padPx,
    minY: Math.min(a.minY, b.minY) - padPx,
    maxX: Math.max(a.maxX, b.maxX) + padPx,
    maxY: Math.max(a.maxY, b.maxY) + padPx,
  };
}

export function openingFrameBounds(
  homestead: WorldBounds,
  herdX: number,
  herdY: number,
  padPx: number,
): WorldBounds {
  const herdPad = padPx * 2.2;
  const herdBox: WorldBounds = {
    minX: herdX - herdPad,
    minY: herdY - herdPad,
    maxX: herdX + herdPad,
    maxY: herdY + herdPad,
  };
  return mergeViewBounds(homestead, herdBox, padPx);
}

/**
 * Zoom and scroll that fit a world rectangle inside the clear band
 * (below the top bar, above the sheet and minimap).
 */
export function frameWorldRectInClearBand(
  bounds: WorldBounds,
  screenW: number,
  screenH: number,
  insets: ViewInsets,
  minZoom: number,
  maxZoom: number,
  margin = CAMERA_CLEAR_MARGIN_PX,
): { zoom: number; scrollX: number; scrollY: number } {
  const top = insets.top + margin;
  const bottom = insets.bottom + margin;
  const left = insets.left + margin;
  const right = insets.right + margin;
  const contentW = Math.max(1, screenW - left - right);
  const contentH = Math.max(1, screenH - top - bottom);
  const worldW = Math.max(1, bounds.maxX - bounds.minX);
  const worldH = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clamp(Math.min(contentW / worldW, contentH / worldH), minZoom, maxZoom);
  const screenCx = left + contentW / 2;
  const screenCy = top + contentH / 2;
  return {
    zoom,
    scrollX: scrollXForWorldAtScreenX((bounds.minX + bounds.maxX) / 2, screenW, zoom, screenCx),
    scrollY: scrollYForWorldAtScreenY((bounds.minY + bounds.maxY) / 2, screenH, zoom, screenCy),
  };
}

export function boundsCenter(bounds: WorldBounds): { x: number; y: number } {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/** World rectangle visible inside HUD insets (Phaser 4 scroll coordinates). */
export function visibleContentBounds(
  scrollX: number,
  scrollY: number,
  screenW: number,
  screenH: number,
  zoom: number,
  insets: ViewInsets,
  margin = CAMERA_CLEAR_MARGIN_PX,
): WorldBounds {
  const top = insets.top + margin;
  const bottom = insets.bottom + margin;
  const left = insets.left + margin;
  const right = insets.right + margin;
  return {
    minX: worldXAtScreenX(scrollX, screenW, zoom, left),
    minY: worldYAtScreenY(scrollY, screenH, zoom, top),
    maxX: worldXAtScreenX(scrollX, screenW, zoom, screenW - right),
    maxY: worldYAtScreenY(scrollY, screenH, zoom, screenH - bottom),
  };
}

export function boundsContainsPoint(
  bounds: WorldBounds,
  x: number,
  y: number,
  marginPx = 0,
): boolean {
  return (
    x >= bounds.minX - marginPx &&
    x <= bounds.maxX + marginPx &&
    y >= bounds.minY - marginPx &&
    y <= bounds.maxY + marginPx
  );
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

/** Pads the homestead framing box in world pixels from tile size. */
export function homesteadBoundsPad(tileWidth: number, tileHeight: number): number {
  return Math.max(tileWidth, tileHeight) * 1.75;
}

export type ZoomTargets = {
  viewportFill: number;
  phoneTilePx: number;
  desktopTilePx: number;
  desktopMinWidthPx: number;
};

export const DEFAULT_HOMESTEAD_VIEW: ZoomTargets = {
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
  targets: ZoomTargets = DEFAULT_HOMESTEAD_VIEW,
): number {
  const framed = zoomToFrameBounds(bounds, viewportW, viewportH, targets.viewportFill);
  const tileTarget =
    viewportW >= targets.desktopMinWidthPx ? targets.desktopTilePx : targets.phoneTilePx;
  const tileZoom = tileTarget / tileWidth;
  return Math.max(framed, tileZoom);
}

/** Zoom level where one camp is readable after a minimap jump (uses viewport width only). */
export function readableCampZoom(
  viewportW: number,
  tileWidth: number,
  targets: Pick<ZoomTargets, "phoneTilePx" | "desktopTilePx" | "desktopMinWidthPx">,
): number {
  const tileTarget = viewportW >= targets.desktopMinWidthPx ? targets.desktopTilePx : targets.phoneTilePx;
  return tileTarget / tileWidth;
}

export type ZoomLimitsInput = {
  layoutWidth: number;
  layoutHeight: number;
  mapWidth: number;
  mapHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  tileWidth: number;
  tileHeight: number;
  fitMargin: number;
  maxTilePx: number;
  /** Rough cap on tiles that should fit on screen at the widest pinch-out (non-chunked maps). */
  maxOnScreenTiles: number;
  /** When set, terrain chunks cull off-screen tiles so pinch-out can go wider. */
  terrainChunkTiles?: number;
  campCount?: number;
  minCampsVisibleAtMinZoom?: number;
};

/** Widest pinch-out that still frames several camps (not the entire ranch). */
export function minZoomForCampOverview(
  fullMapZoom: number,
  campCount: number,
  minCampsVisible = 4,
): number {
  const camps = Math.max(1, campCount);
  const visible = Math.min(Math.max(1, minCampsVisible), camps);
  const span = Math.sqrt(visible / camps);
  return fullMapZoom * span * 0.95;
}

/** Minimum zoom so the viewport does not expose more tiles than the render budget. */
export function minZoomForTileBudget(
  viewportW: number,
  viewportH: number,
  tileWidth: number,
  tileHeight: number,
  maxOnScreenTiles: number,
): number {
  const tileArea = Math.max(1, tileWidth * tileHeight);
  const viewArea = viewportW * viewportH;
  const safeTiles = Math.max(64, maxOnScreenTiles);
  return Math.sqrt(viewArea / (safeTiles * tileArea));
}

/** Fit-zoom that shows the whole world bounds inside the viewport. */
export function fullMapZoom(
  layoutWidth: number,
  layoutHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  fitMargin: number,
): number {
  return Math.min(viewportWidth / layoutWidth, viewportHeight / layoutHeight) * fitMargin;
}

/**
 * Min and max zoom from layout and viewport size. Chunked maps use camp overview
 * instead of a tight tile budget; small non-chunked maps can still fit entirely.
 */
export function computeZoomLimits(input: ZoomLimitsInput): { minZoom: number; maxZoom: number } {
  const fullMap = fullMapZoom(
    input.layoutWidth,
    input.layoutHeight,
    input.viewportWidth,
    input.viewportHeight,
    input.fitMargin,
  );
  const fullMin = fullMap * 0.92;
  const chunked = (input.terrainChunkTiles ?? 0) > 0;
  const mapTiles = input.mapWidth * input.mapHeight;
  let minZoom: number;
  if (chunked) {
    minZoom = fullMin;
  } else {
    const tileBudget = limitsTileBudget(
      input.mapWidth,
      input.mapHeight,
      input.viewportWidth,
      input.viewportHeight,
    );
    const cullFloor = minZoomForTileBudget(
      input.viewportWidth,
      input.viewportHeight,
      input.tileWidth,
      input.tileHeight,
      Math.min(tileBudget, input.maxOnScreenTiles),
    );
    minZoom = tileBudget >= mapTiles ? fullMin : Math.max(cullFloor, fullMin);
  }
  const maxZoom = Math.max(minZoom, input.maxTilePx / input.tileWidth);
  return { minZoom, maxZoom };
}

/** Default on-screen tile budget for pinch-out on phones and desktops. */
export function maxOnScreenTileBudget(viewportW: number, viewportH: number): number {
  const area = viewportW * viewportH;
  if (area < 260000) return 720;
  if (area < 640000) return 960;
  return 1280;
}

/** Tile budget for min zoom: small maps may show everything; large maps use the viewport cap. */
export function limitsTileBudget(
  mapWidth: number,
  mapHeight: number,
  viewportW: number,
  viewportH: number,
): number {
  const mapTiles = mapWidth * mapHeight;
  const cap = maxOnScreenTileBudget(viewportW, viewportH);
  if (mapTiles <= cap * 1.35) return mapTiles;
  return cap;
}

export function minimapTileFromNormalized(
  nx: number,
  ny: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } {
  const x = clamp(Math.floor(nx * mapWidth), 0, mapWidth - 1);
  const y = clamp(Math.floor(ny * mapHeight), 0, mapHeight - 1);
  return { x, y };
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
