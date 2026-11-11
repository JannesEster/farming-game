import { describe, expect, it } from "vitest";
import {
  applyPanFriction,
  boundsCenter,
  boundsFromPoints,
  clampZoom,
  pinchCenter,
  pinchZoom,
  preferredHomesteadZoom,
  zoomScrollDelta,
  zoomToFrameBounds,
} from "./camera";

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

  it("prefers at least phone tile zoom on a narrow viewport", () => {
    const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const zoom = preferredHomesteadZoom(bounds, 390, 844, 64);
    expect(zoom).toBeGreaterThanOrEqual(44 / 64);
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
