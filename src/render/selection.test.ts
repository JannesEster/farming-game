import { describe, expect, it } from "vitest";
import {
  resolveGroundTap,
  resolveHerdTap,
  shouldShowMoveConfirm,
} from "./selection";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";

describe("herd selection taps", () => {
  it("toggles the herd on repeat taps", () => {
    expect(resolveHerdTap(false)).toBe("select");
    expect(resolveHerdTap(true)).toBe("deselect");
  });

  it("deselects on empty ground when nothing is pending", () => {
    expect(resolveGroundTap(true, null, TILE_OUTSIDE)).toBe("deselect");
    expect(resolveGroundTap(true, null, null)).toBe("deselect");
  });

  it("clears a pending move before deselecting on neutral ground", () => {
    expect(resolveGroundTap(true, 3, TILE_HOMESTEAD)).toBe("clear_pending");
    expect(resolveGroundTap(true, 3, TILE_OUTSIDE)).toBe("clear_pending");
  });

  it("picks a camp when a grazing tile is tapped", () => {
    expect(resolveGroundTap(true, null, 5)).toBe("pick_camp");
    expect(resolveGroundTap(false, null, 5)).toBe("noop");
  });

  it("shows move confirm only with a pending camp", () => {
    expect(shouldShowMoveConfirm(true, 2)).toBe(true);
    expect(shouldShowMoveConfirm(true, null)).toBe(false);
    expect(shouldShowMoveConfirm(false, 2)).toBe(false);
  });
});
