import { describe, expect, it } from "vitest";
import { zoomScrollDelta } from "./camera";

describe("zoom scroll correction", () => {
  it("keeps the world point under the pointer when zoom changes", () => {
    const before = { x: 120, y: 88 };
    const after = { x: 140, y: 72 };
    const delta = zoomScrollDelta(before.x, before.y, after.x, after.y);
    expect(delta.scrollX).toBe(before.x - after.x);
    expect(delta.scrollY).toBe(before.y - after.y);
  });
});
