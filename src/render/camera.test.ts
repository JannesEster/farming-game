import { describe, expect, it } from "vitest";
import {
  applyPanFriction,
  boundsCenter,
  boundsFromPoints,
  centreScrollWhenViewExceedsLayout,
  CAMERA_CLEAR_MARGIN_PX,
  clampCameraScroll,
  clampCameraScrollWithInsets,
  clampZoom,
  computeZoomLimits,
  fullMapZoom,
  homesteadBoundsPad,
  minimapTileFromNormalized,
  pinchCenter,
  pinchZoom,
  preferredHomesteadZoom,
  scrollToLayoutTip,
  visibleWorldLeft,
  worldXAtScreenX,
  worldYAtScreenY,
  zoomScrollDelta,
  zoomToFrameBounds,
  type LayoutTip,
} from "./camera";
import { isoLayout } from "./iso";

const TILE_W = 64;
const TILE_H = 32;
const PAD = 24;

describe("clampCameraScroll", () => {
  it("centres the ranch on screen when the zoomed view exceeds the layout", () => {
    const layoutW = 5200;
    const screenW = 390;
    const zoom = 0.073;
    const result = clampCameraScroll(0, 0, layoutW, 1200, screenW, 844, zoom);
    expect(result.scrollX).toBeCloseTo(centreScrollWhenViewExceedsLayout(layoutW, screenW), 5);
    const left = visibleWorldLeft(result.scrollX, screenW, zoom);
    const viewW = screenW / zoom;
    expect(left).toBeLessThanOrEqual(0);
    expect(left + viewW).toBeGreaterThanOrEqual(layoutW);
  });

  it("clamps scroll when the view is smaller than the layout", () => {
    const screenW = 390;
    const zoom = 0.53;
    const viewW = screenW / zoom;
    const minX = viewW / 2 - screenW / 2;
    const maxX = 2400 - viewW / 2 - screenW / 2;
    const result = clampCameraScroll(9999, 9999, 2400, 1200, screenW, 844, zoom);
    expect(result.scrollX).toBeCloseTo(maxX, 5);
    expect(visibleWorldLeft(result.scrollX, screenW, zoom)).toBeGreaterThanOrEqual(0);
    expect(visibleWorldLeft(result.scrollX, screenW, zoom) + viewW).toBeLessThanOrEqual(2400);
    expect(minX).toBeLessThan(maxX);
  });
});

describe("zoom scroll correction", () => {
  it("keeps the world point under the pointer when zoom changes", () => {
    const before = { x: 120, y: 88 };
    const after = { x: 140, y: 72 };
    const delta = zoomScrollDelta(before.x, before.y, after.x, after.y);
    expect(delta.scrollX).toBe(before.x - after.x);
    expect(delta.scrollY).toBe(before.y - after.y);
  });
});

describe("clampZoom", () => {
  it("clamps below minimum", () => {
    expect(clampZoom(0.1, 0.25, 2)).toBe(0.25);
  });

  it("clamps above maximum", () => {
    expect(clampZoom(3, 0.25, 2)).toBe(2);
  });

  it("passes through in range", () => {
    expect(clampZoom(0.9, 0.25, 2)).toBe(0.9);
  });
});

describe("pinchCenter", () => {
  it("returns the midpoint between two touch points", () => {
    expect(pinchCenter({ x: 0, y: 0 }, { x: 100, y: 200 })).toEqual({ x: 50, y: 100 });
  });
});

describe("pinchZoom", () => {
  it("scales zoom with pinch distance", () => {
    expect(pinchZoom(1, 100, 150, 0.2, 2)).toBeCloseTo(1.5, 5);
  });

  it("clamps pinch zoom to limits", () => {
    expect(pinchZoom(1, 100, 400, 0.2, 1.2)).toBe(1.2);
  });

  it("returns null when the starting pinch span is too small", () => {
    expect(pinchZoom(1, 4, 40, 0.2, 2)).toBeNull();
  });
});

describe("zoomToFrameBounds", () => {
  it("chooses the tighter axis when framing a rectangle", () => {
    const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    const zoom = zoomToFrameBounds(bounds, 400, 400, 0.5);
    expect(zoom).toBeCloseTo(1, 5);
  });
});

describe("homestead framing", () => {
  it("builds padded bounds from feature points", () => {
    const bounds = boundsFromPoints(
      [
        { x: 100, y: 100 },
        { x: 200, y: 150 },
      ],
      10,
    );
    expect(bounds).toEqual({ minX: 90, minY: 90, maxX: 210, maxY: 160 });
    expect(boundsCenter(bounds!)).toEqual({ x: 150, y: 125 });
  });

  it("scales homestead padding with tile size", () => {
    expect(homesteadBoundsPad(64, 32)).toBe(64 * 1.75);
  });

  it("prefers at least phone tile zoom on a narrow viewport", () => {
    const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const zoom = preferredHomesteadZoom(bounds, 390, 844, 64, {
      viewportFill: 0.5,
      phoneTilePx: 44,
      desktopTilePx: 54,
      desktopMinWidthPx: 900,
    });
    expect(zoom).toBeGreaterThanOrEqual(44 / 64);
  });
});

describe("zoom limits for map size", () => {
  const viewport = { w: 390, h: 844 };
  const fitMargin = 0.92;

  it("allows full-map zoom on a small layout", () => {
    const small = isoLayout(34, 34, TILE_W, TILE_H, PAD);
    const full = fullMapZoom(small.width, small.height, viewport.w, viewport.h, fitMargin);
    const limits = computeZoomLimits({
      layoutWidth: small.width,
      layoutHeight: small.height,
      mapWidth: 34,
      mapHeight: 34,
      viewportWidth: viewport.w,
      viewportHeight: viewport.h,
      tileWidth: TILE_W,
      tileHeight: TILE_H,
      fitMargin,
      maxTilePx: 96,
      maxOnScreenTiles: 900,
    });
    expect(limits.minZoom).toBeCloseTo(full * 0.92, 4);
  });

  it("pins minimum zoom to whole-ranch fit on the chunked 76 by 76 ranch", () => {
    const ranch = isoLayout(76, 76, TILE_W, TILE_H, PAD);
    const full = fullMapZoom(ranch.width, ranch.height, viewport.w, viewport.h, fitMargin);
    const limits = computeZoomLimits({
      layoutWidth: ranch.width,
      layoutHeight: ranch.height,
      mapWidth: 76,
      mapHeight: 76,
      viewportWidth: viewport.w,
      viewportHeight: viewport.h,
      tileWidth: TILE_W,
      tileHeight: TILE_H,
      fitMargin,
      maxTilePx: 96,
      maxOnScreenTiles: 900,
      terrainChunkTiles: 16,
      campCount: 14,
    });
    expect(limits.minZoom).toBeCloseTo(full * 0.92, 4);
    const scroll = clampCameraScroll(0, 0, ranch.width, ranch.height, viewport.w, viewport.h, limits.minZoom);
    const left = visibleWorldLeft(scroll.scrollX, viewport.w, limits.minZoom);
    const viewW = viewport.w / limits.minZoom;
    expect(left).toBeLessThanOrEqual(0);
    expect(left + viewW).toBeGreaterThanOrEqual(ranch.width);
  });
});

describe("minimap tile pick", () => {
  it("maps normalised coordinates using live map width and height", () => {
    expect(minimapTileFromNormalized(0.5, 0.5, 80, 60)).toEqual({ x: 40, y: 30 });
    expect(minimapTileFromNormalized(1.2, -0.1, 80, 60)).toEqual({ x: 79, y: 0 });
  });
});

describe("clampCameraScrollWithInsets", () => {
  const ranch = isoLayout(76, 76, TILE_W, TILE_H, PAD);
  const limits = computeZoomLimits({
    layoutWidth: ranch.width,
    layoutHeight: ranch.height,
    mapWidth: 76,
    mapHeight: 76,
    viewportWidth: 390,
    viewportHeight: 844,
    tileWidth: TILE_W,
    tileHeight: TILE_H,
    fitMargin: 0.92,
    maxTilePx: 96,
    maxOnScreenTiles: 900,
    terrainChunkTiles: 16,
    campCount: 14,
  });
  const phoneInsets = { top: 52, bottom: 102, left: 14, right: 14 };

  const assertTip = (
    tip: LayoutTip,
    screenW: number,
    screenH: number,
    zoom: number,
    insets: typeof phoneInsets,
  ) => {
    const margin = CAMERA_CLEAR_MARGIN_PX;
    const top = insets.top + margin;
    const bottom = insets.bottom + margin;
    const contentH = screenH - top - bottom;
    const contentW = screenW - insets.left - insets.right - 2 * margin;
    const bandH = contentH / zoom;
    const bandW = contentW / zoom;
    const next = scrollToLayoutTip(tip, ranch.width, ranch.height, screenW, screenH, zoom, insets);
    const bottomY = screenH - bottom;
    const left = insets.left + margin;
    const rightX = screenW - insets.right - margin;
    const eps = 2;
    const fitsY = bandH >= ranch.height;
    const fitsX = bandW >= ranch.width;
    if (fitsY) {
      const midY = top + contentH / 2;
      expect(worldYAtScreenY(next.scrollY, screenH, zoom, midY)).toBeCloseTo(ranch.height / 2, eps);
    } else if (tip === "north") {
      expect(worldYAtScreenY(next.scrollY, screenH, zoom, top)).toBeCloseTo(0, eps);
    } else if (tip === "south") {
      expect(worldYAtScreenY(next.scrollY, screenH, zoom, bottomY)).toBeCloseTo(ranch.height, eps);
    }
    if (fitsX) {
      const midX = left + contentW / 2;
      expect(worldXAtScreenX(next.scrollX, screenW, zoom, midX)).toBeCloseTo(ranch.width / 2, eps);
    } else if (tip === "west") {
      expect(worldXAtScreenX(next.scrollX, screenW, zoom, left)).toBeCloseTo(0, eps);
    } else if (tip === "east") {
      expect(worldXAtScreenX(next.scrollX, screenW, zoom, rightX)).toBeCloseTo(ranch.width, eps);
    }
    return clampCameraScrollWithInsets(
      next.scrollX,
      next.scrollY,
      ranch.width,
      ranch.height,
      screenW,
      screenH,
      zoom,
      insets,
    );
  };

  it("lets each ranch tip reach the clear band on phone portrait at opening, mid, and min zoom", () => {
    const zooms = [44 / TILE_W, 0.35, limits.minZoom];
    const tips: LayoutTip[] = ["north", "south", "east", "west"];
    for (const zoom of zooms) {
      for (const tip of tips) {
        assertTip(tip, 390, 844, zoom, phoneInsets);
      }
    }
  });

  it("lets each ranch tip reach the clear band in landscape", () => {
    const landscapeInsets = { top: 52, bottom: 98, left: 14, right: 14 };
    const zooms = [44 / TILE_W, 0.35, limits.minZoom];
    const tips: LayoutTip[] = ["north", "south", "east", "west"];
    for (const zoom of zooms) {
      for (const tip of tips) {
        assertTip(tip, 844, 390, zoom, landscapeInsets);
      }
    }
  });
});

describe("applyPanFriction", () => {
  it("stops momentum when speed falls below the cutoff", () => {
    const next = applyPanFriction(20, 0, 48, 0.9, 28);
    expect(next).toBeNull();
  });

  it("keeps moving while velocity is still high", () => {
    const next = applyPanFriction(400, 0, 16, 0.9, 2);
    expect(next).not.toBeNull();
    expect(next!.vx).toBeLessThan(400);
    expect(next!.vx).toBeGreaterThan(0);
  });
});
