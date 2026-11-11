import { describe, expect, it } from "vitest";
import { doubleTapGoesHome } from "./tap";

describe("doubleTapGoesHome", () => {
  it("recenters only when the second tap missed the herd", () => {
    expect(doubleTapGoesHome(false)).toBe(true);
    expect(doubleTapGoesHome(true)).toBe(false);
  });
});
