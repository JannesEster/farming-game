import { describe, expect, it } from "vitest";
import { mobSpanPx, mobWidthPx, organicTrekOffsets } from "./herdLayout";

const HERD = 120;

describe("organicTrekOffsets", () => {
  it("spreads a 120-head mob over hundreds of world pixels", () => {
    const mid = organicTrekOffsets(HERD, 42, 1, 0, 0.45, 5000);
    const span = mobSpanPx(mid);
    expect(span.width).toBeGreaterThan(200);
    expect(span.height).toBeGreaterThan(120);
    expect(mobWidthPx(mid, 1, 0)).toBeGreaterThan(120);
  });

  it("pinches slightly at the gate but keeps animals separated", () => {
    const gate = organicTrekOffsets(HERD, 42, 1, 0, 0.48, 5000);
    const open = organicTrekOffsets(HERD, 42, 1, 0, 0.2, 5000);
    expect(mobWidthPx(gate, 1, 0)).toBeLessThan(mobWidthPx(open, 1, 0));
    expect(mobWidthPx(gate, 1, 0)).toBeGreaterThan(100);
    expect(mobSpanPx(gate).width).toBeGreaterThan(160);
  });

  it("drifts over time so the mob is not frozen", () => {
    const a = organicTrekOffsets(HERD, 9, 0, 1, 0.5, 1000);
    const b = organicTrekOffsets(HERD, 9, 0, 1, 0.5, 2500);
    const moved = a.some((offset, i) => Math.hypot(offset.x - b[i].x, offset.y - b[i].y) > 0.5);
    expect(moved).toBe(true);
  });
});
