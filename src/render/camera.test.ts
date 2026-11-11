import { describe, expect, it } from "vitest";
import {
  applyPanFriction,
  boundsCenter,
  boundsFromPoints,
  clampCameraScroll,
  clampZoom,
  computeZoomLimits,
  fullMapZoom,
  minZoomForCampOverview,
  homesteadBoundsPad,
  minimapTileFromNormalized,
  pinchCenter,
  pinchZoom,
  preferredHomesteadZoom,
  zoomScrollDelta,
  zoomToFrameBounds,
} from "./camera";
import { isoLayout } from "./iso";

const TILE_W = 64;
const TILE_H = 32;
const PAD = 24;

describe("clampCameraScroll", () => {
  it("uses negative scroll to centre the map when the view is wider than the layout", () => {
    const layoutW = 2400;
    const viewW = 5200;
    const result = clampCameraScroll(0, 0, layoutW, 1200, viewW, 800);
    expect(result.scrollX).toBe((layoutW - viewW) / 2);
    expect(result.scrollX).toBeLessThan(0);
  });

  it("clamps scroll when the view is smaller than the layout", () => {
    const result = clampCameraScroll(9999, 9999, 2400, 1200, 400, 300);
    expect(result.scrollX).toBe(2000);
    expect(result.scrollY).toBe(900);
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

  it("lets a chunked 76 by 76 ranch pinch out far enough for four camps", () => {
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
      minCampsVisibleAtMinZoom: 4,
    });
    const overview = minZoomForCampOverview(full * 0.92, 14, 4);
    expect(limits.minZoom).toBeCloseTo(Math.min(full * 0.92, overview), 5);
    expect(limits.minZoom).toBeLessThan(full * 0.92);
  });
});

describe("minimap tile pick", () => {
  it("maps normalised coordinates using live map width and height", () => {
    expect(minimapTileFromNormalized(0.5, 0.5, 80, 60)).toEqual({ x: 40, y: 30 });
    expect(minimapTileFromNormalized(1.2, -0.1, 80, 60)).toEqual({ x: 79, y: 0 });
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
