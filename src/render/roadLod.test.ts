import { describe, expect, it } from "vitest";
import { PIXELS_PER_METRE } from "./worldScale";
import { roadDrawMode, roadPaintKey } from "./v2Ground";

describe("farm road level of detail", () => {
  it("keeps the 1.6 m two-track while each rut is at least 2 screen pixels", () => {
    const zoom = 2 / (0.4 * PIXELS_PER_METRE);
    expect(roadDrawMode(zoom)).toBe("tracks");
    expect(roadDrawMode(0.47)).toBe("tracks");
    expect(roadPaintKey(0.47)).toBe("tracks");
  });

  it("collapses to one line once a rut would be thinner than 2 screen pixels", () => {
    const zoom = 2 / (0.4 * PIXELS_PER_METRE) - 0.01;
    expect(roadDrawMode(zoom)).toBe("line");
    expect(roadPaintKey(zoom).startsWith("line:")).toBe(true);
    expect(roadPaintKey(0.2)).not.toBe(roadPaintKey(0.12));
  });
});
