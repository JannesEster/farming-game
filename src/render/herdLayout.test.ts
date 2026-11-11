import { describe, expect, it } from "vitest";
import { lateralSpreadPx, mobWidthPx, organicTrekOffsets } from "./herdLayout";

describe("organicTrekOffsets", () => {
  it("spreads cattle wider than a single-file column", () => {
    const count = 24;
    const mid = organicTrekOffsets(count, 42, 1, 0, 0.42, 5000);
    expect(lateralSpreadPx(mid)).toBeGreaterThan(18);
  });

  it("pinches slightly at the gate without collapsing to a line", () => {
    const count = 24;
    const gate = organicTrekOffsets(count, 42, 1, 0, 0.48, 5000);
    const open = organicTrekOffsets(count, 42, 1, 0, 0.2, 5000);
    expect(mobWidthPx(gate, 1, 0)).toBeLessThan(mobWidthPx(open, 1, 0));
    expect(mobWidthPx(gate, 1, 0)).toBeGreaterThan(6);
  });

  it("drifts over time so the mob is not frozen", () => {
    const count = 16;
    const a = organicTrekOffsets(count, 9, 0, 1, 0.5, 1000);
    const b = organicTrekOffsets(count, 9, 0, 1, 0.5, 2500);
    const moved = a.some((offset, i) => Math.hypot(offset.x - b[i].x, offset.y - b[i].y) > 0.5);
    expect(moved).toBe(true);
  });
});
