import { describe, expect, it } from "vitest";
import { generateFarm } from "../sim/generate";
import { TREE_SPACING_M, treesInRect } from "../sim/vegetation";
import { PIXELS_PER_METRE } from "./worldScale";
import {
  TREE_CANOPY_METRES,
  TREE_DOT_GRAPHICS_MAX,
  TREE_SPRITE_BUDGET,
  TREE_SPRITE_ZOOM,
  treeCanopyMarks,
  treeCanopyRadiusPx,
  treeCanopyScreenPx,
  treeLodMode,
} from "./treeLod";

describe("tree LOD visibility per zoom", () => {
  const state = generateFarm(3300);
  const sample = treesInRect(state, 1800, 1800, 2400, 2400);
  const zooms = [0.9, TREE_SPRITE_ZOOM, 0.16, 0.1, 0.05, 0.02, 0.012, 0.004];

  it("draws every tree at close, mid and far zoom, at the same positions", () => {
    expect(sample.length).toBeGreaterThan(40);
    for (const zoom of zooms) {
      const marks = treeCanopyMarks(sample, zoom);
      expect(marks, `zoom ${zoom}`).toHaveLength(sample.length);
      for (let i = 0; i < sample.length; i += 1) {
        expect(marks[i].x).toBe(sample[i].x);
        expect(marks[i].y).toBe(sample[i].y);
      }
      const mode = treeLodMode(zoom, sample.length);
      if (zoom >= TREE_SPRITE_ZOOM && sample.length <= TREE_SPRITE_BUDGET) expect(mode).toBe("sprites");
      else expect(mode).toBe("dots");
    }
  });

  it("uses the real crown at mid zoom and keeps a readable mark when zoomed out", () => {
    for (const zoom of [0.16, 0.1, 0.05]) {
      const screen = treeCanopyScreenPx(zoom);
      const crown = TREE_CANOPY_METRES * PIXELS_PER_METRE * zoom;
      expect(screen).toBeCloseTo(crown, 1);
      expect(screen).toBeGreaterThan(8);
      expect(treeCanopyRadiusPx(zoom)).toBeCloseTo(treeCanopyRadiusPx(0.18), 1);
    }
    const far = treeCanopyScreenPx(0.012);
    const farGap = TREE_SPACING_M * PIXELS_PER_METRE * 0.012;
    expect(far).toBeGreaterThanOrEqual(1.7);
    expect(far).toBeLessThan(farGap);
    const phone = treeCanopyScreenPx(0.004);
    const phoneGap = TREE_SPACING_M * PIXELS_PER_METRE * 0.004;
    expect(phone).toBeGreaterThan(1);
    expect(phone).toBeLessThan(phoneGap);
    expect(treeLodMode(0.01, 20)).toBe("dots");
    expect(treeLodMode(0.22, TREE_SPRITE_BUDGET + 1)).toBe("dots");
  });

  it("keeps the whole-farm veld on the cheap path without dropping trees", () => {
    const all = treesInRect(state, 0, 0, state.width, state.height);
    expect(all.length).toBeGreaterThan(TREE_DOT_GRAPHICS_MAX);
    expect(treeLodMode(0.01, all.length)).toBe("dots");
    expect(treeCanopyMarks(all, 0.01)).toHaveLength(all.length);
    expect(treeLodMode(0.9, sample.length)).toBe("sprites");
  });
});
