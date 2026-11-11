import { describe, expect, it } from "vitest";
import { FENCE_WIRE_STRAND_OFFSET_PX, wireStrandOffset } from "./fences";

describe("double wire fences", () => {
  it("offsets strands by eight world pixels on a flat edge", () => {
    const offset = wireStrandOffset(0, 0, 100, 0);
    expect(Math.hypot(offset.ox, offset.oy)).toBeCloseTo(FENCE_WIRE_STRAND_OFFSET_PX, 5);
    expect(offset.oy).toBeCloseTo(5, 5);
    expect(offset.ox).toBeCloseTo(0, 5);
  });

  it("keeps offset magnitude on diagonal edges", () => {
    const offset = wireStrandOffset(0, 0, 100, 100);
    expect(Math.hypot(offset.ox, offset.oy)).toBeCloseTo(FENCE_WIRE_STRAND_OFFSET_PX, 5);
  });
});
