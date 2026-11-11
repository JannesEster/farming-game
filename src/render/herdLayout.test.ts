import { describe, expect, it } from "vitest";
import { gateFileWidthPx, mobSpanPx, mobWidthPx, organicTrekOffsets } from "./herdLayout";

const HERD = 120;

describe("organicTrekOffsets", () => {
  it("spreads a 120-head mob over hundreds of world pixels", () => {
    const mid = organicTrekOffsets(HERD, 42, 1, 0, 0.45, 5000);
    const span = mobSpanPx(mid);
    expect(span.width).toBeGreaterThan(200);
    expect(span.height).toBeGreaterThan(120);
    expect(mobWidthPx(mid, 1, 0)).toBeGreaterThan(120);
  });

  it("funnels through the gate in a narrow single or double file", () => {
    const gate = organicTrekOffsets(HERD, 42, 1, 0, 0.5, 5000);
    const open = organicTrekOffsets(HERD, 42, 1, 0, 0.2, 5000);
    expect(gateFileWidthPx(gate, 1, 0, 0.5, HERD, 42, 5000)).toBeLessThan(mobWidthPx(open, 1, 0));
    expect(gateFileWidthPx(gate, 1, 0, 0.5, HERD, 42, 5000)).toBeLessThan(36);
    expect(mobSpanPx(open).width).toBeGreaterThan(200);
    expect(mobSpanPx(gate).width).toBeGreaterThan(140);
  });

  it("drifts over time so the mob is not frozen", () => {
    const a = organicTrekOffsets(HERD, 9, 0, 1, 0.5, 1000);
    const b = organicTrekOffsets(HERD, 9, 0, 1, 0.5, 2500);
    const moved = a.some((offset, i) => Math.hypot(offset.x - b[i].x, offset.y - b[i].y) > 0.5);
    expect(moved).toBe(true);
  });
});
