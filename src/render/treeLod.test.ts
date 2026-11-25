import { describe, expect, it } from "vitest";
import { generateFarm } from "../sim/generate";
import { treesInRect } from "../sim/vegetation";
import { PIXELS_PER_METRE } from "./worldScale";
import {
  TREE_DOT_GRAPHICS_MAX,
  TREE_SPRITE_BUDGET,
  TREE_SPRITE_ZOOM,
  canopyWidthPx,
  treeCanopyMarks,
  treeFileAt,
  treeLodMode,
  treeSpeciesAt,
} from "./treeLod";

describe("tree LOD visibility per zoom", () => {
  const state = generateFarm(3300);
  const sample = treesInRect(state, 1800, 1800, 2400, 2400);
  const zooms = [0.9, TREE_SPRITE_ZOOM, 0.16, 0.1, 0.05, 0.02, 0.012, 0.004];

  it("keeps every tree position at close, mid and far zoom", () => {
    expect(sample.length).toBeGreaterThan(40);
    for (const zoom of zooms) {
      const marks = treeCanopyMarks(sample, zoom);
      expect(marks, `zoom ${zoom}`).toHaveLength(sample.length);
      for (let i = 0; i < sample.length; i += 1) {
        expect(marks[i].x).toBe(sample[i].x);
        expect(marks[i].y).toBe(sample[i].y);
        expect(marks[i].species).toBe(treeSpeciesAt(sample[i].x, sample[i].y));
      }
      const mode = treeLodMode(zoom, sample.length);
      if (zoom >= TREE_SPRITE_ZOOM && sample.length <= TREE_SPRITE_BUDGET) expect(mode).toBe("sprites");
      else expect(mode).toBe("dots");
    }
  });

  it("sizes a mark from that tree's species, and keeps the sand open when zoomed out", () => {
    const marks = treeCanopyMarks(sample, 0.16);
    const large = marks.filter((mark) => mark.species === "large");
    const small = marks.filter((mark) => mark.species === "small");
    const shepherd = marks.filter((mark) => mark.species === "shepherd");
    expect(large.length).toBeGreaterThan(5);
    expect(small.length + shepherd.length).toBeGreaterThan(5);
    const mean = (rows: typeof large) => rows.reduce((sum, mark) => sum + mark.width, 0) / rows.length;
    expect(mean(large)).toBeGreaterThan(mean(small) * 1.5);
    const oldDisk = 12 * PIXELS_PER_METRE;
    expect(mean(large)).toBeLessThan(oldDisk * 0.85);
    expect(mean(large) * 0.16).toBeGreaterThan(6);
    expect(large[0].fill).not.toBe(0x1f5c32);
    expect(large[0].alpha).toBeLessThan(0.9);
    expect(large[0].shade).not.toBe(large[0].fill);
    expect(canopyWidthPx("large", 1.15, 0.2)).toBeGreaterThan(canopyWidthPx("large", 0.85, 0.2));

    const zoom008 = canopyWidthPx("large", 1, 0.08) * 0.08;
    const zoom004 = canopyWidthPx("large", 1, 0.04) * 0.04;
    expect(zoom008).toBeGreaterThan(8);
    expect(zoom004).toBeGreaterThan(4);
    expect(zoom008).toBeCloseTo(zoom004 * 2, 0);
    expect(canopyWidthPx("small", 1, 0.08)).toBeGreaterThan(0);
    expect(canopyWidthPx("small", 1, 0.04)).toBeGreaterThan(0);

    const farZoom = 0.0114;
    const farLarge = canopyWidthPx("large", 1, farZoom) * farZoom;
    const farSmall = canopyWidthPx("small", 1, farZoom) * farZoom;
    expect(farLarge).toBeGreaterThan(1.5);
    expect(farLarge).toBeLessThanOrEqual(2.05);
    expect(farSmall).toBeGreaterThan(0.85);
    expect(farSmall).toBeLessThan(1.25);
    const far = treeCanopyMarks(sample, farZoom).filter((mark) => mark.width > 0);
    expect(far.length).toBe(sample.length);
    const farBig = far.filter((mark) => mark.species === "large");
    const farLittle = far.filter((mark) => mark.species !== "large");
    expect(farBig.length).toBeGreaterThan(0);
    expect(farLittle.length).toBeGreaterThan(0);
    expect(farBig[0].speck).toBe(true);
    expect(farBig[0].alpha).toBeGreaterThan(farLittle[0].alpha);
    expect(treeLodMode(0.01, 20)).toBe("dots");
    expect(treeLodMode(0.22, TREE_SPRITE_BUDGET + 1)).toBe("dots");
  });

  it("uses the same species the close-zoom sprite would pick", () => {
    for (const tree of sample.slice(0, 24)) {
      const file = treeFileAt(tree.x, tree.y);
      const species = treeSpeciesAt(tree.x, tree.y);
      if (file.includes("large")) expect(species).toBe("large");
      else if (file.includes("shepherd")) expect(species).toBe("shepherd");
      else expect(species).toBe("small");
    }
  });

  it("keeps the whole-farm veld on the cheap path and still records every trunk", () => {
    const all = treesInRect(state, 0, 0, state.width, state.height);
    expect(all.length).toBeGreaterThan(TREE_DOT_GRAPHICS_MAX);
    expect(treeLodMode(0.01, all.length)).toBe("dots");
    const marks = treeCanopyMarks(all, 0.01);
    expect(marks).toHaveLength(all.length);
    const drawn = marks.filter((mark) => mark.width > 0);
    expect(drawn.length).toBe(all.length);
    const gap = 34 * (PIXELS_PER_METRE / 2) * 0.01;
    let area = 0;
    for (const mark of drawn) area += Math.PI * ((mark.width * 0.01) / 2) * ((mark.height * 0.01) / 2);
    const coverage = area / (drawn.length * gap * gap);
    expect(coverage).toBeGreaterThan(0.08);
    expect(coverage).toBeLessThan(0.22);
    expect(treeLodMode(0.9, sample.length)).toBe("sprites");
  });
});
