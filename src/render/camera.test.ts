import { describe, expect, it } from "vitest";
import { CONFIG } from "../sim/config";
import { generateFarm } from "../sim/generate";
import {
  clampScroll,
  homesteadFrameBounds,
  legibilityScale,
  panInertiaStep,
  panReleaseVelocity,
  rectCenter,
  zoomScrollDelta,
  zoomToFitRect,
} from "./camera";
import { isoLayout, tileCenter } from "./iso";

describe("zoom scroll correction", () => {
  it("keeps the world point under the pointer when zoom changes", () => {
    const before = { x: 120, y: 88 };
    const after = { x: 140, y: 72 };
    const delta = zoomScrollDelta(before.x, before.y, after.x, after.y);
    expect(delta.scrollX).toBe(before.x - after.x);
    expect(delta.scrollY).toBe(before.y - after.y);
  });
});

describe("homestead framing", () => {
  it("bounds homestead tiles, buildings, and the herd anchor", () => {
    const state = generateFarm(991);
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const layout = isoLayout(state.width, state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    const camp = state.camps.find((c) => c.id === state.herd.campId) ?? state.camps[0];
    const herd = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
    const bounds = homesteadFrameBounds(
      state,
      layout,
      tileW,
      tileH,
      herd.x,
      herd.y,
      CONFIG.view.homesteadFramePadPx,
    );
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
    expect(rectCenter(bounds).x).toBeGreaterThan(0);
  });

  it("picks a higher zoom when the viewport is small", () => {
    const state = generateFarm(991);
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const layout = isoLayout(state.width, state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    const camp = state.camps.find((c) => c.id === state.herd.campId) ?? state.camps[0];
    const herd = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
    const bounds = homesteadFrameBounds(
      state,
      layout,
      tileW,
      tileH,
      herd.x,
      herd.y,
      CONFIG.view.homesteadFramePadPx,
    );
    const phoneZoom = zoomToFitRect(390, 520, bounds, CONFIG.view.framingMargin);
    const fullMapZoom = Math.min(390 / layout.width, 520 / layout.height) * CONFIG.view.fitMargin;
    expect(phoneZoom).toBeGreaterThan(fullMapZoom);
  });
});

describe("clampScroll", () => {
  it("centers when the view is wider than the map", () => {
    const result = clampScroll(10, 20, 0.1, 800, 600, 400, 300);
    expect(result.scrollX).toBeCloseTo((400 - 8000) / 2, 0);
    expect(result.scrollY).toBeCloseTo((300 - 6000) / 2, 0);
  });

  it("clamps when the map is larger than the view", () => {
    const result = clampScroll(-50, 999, 1, 200, 200, 800, 600);
    expect(result.scrollX).toBe(0);
    expect(result.scrollY).toBe(400);
  });
});

describe("legibilityScale", () => {
  it("does not shrink below base scale when zoom is high", () => {
    expect(legibilityScale(1.2, 40, 50, 0.78)).toBe(0.78);
  });

  it("boosts scale when zoomed out", () => {
    const scale = legibilityScale(0.25, 40, 52, 0.78);
    expect(scale).toBeGreaterThan(0.78);
  });
});

describe("pan inertia", () => {
  it("decays velocity over time", () => {
    const step = panInertiaStep(0, 0, 0.2, 0, 32, 0.9, 0.001);
    expect(Math.abs(step.velX)).toBeLessThan(0.2);
    expect(step.scrollX).toBeGreaterThan(0);
  });

  it("derives release velocity from drag", () => {
    const v = panReleaseVelocity(48, 0, 1, 16);
    expect(v.velX).toBe(-3);
    expect(v.velY).toBeCloseTo(0);
  });
});
