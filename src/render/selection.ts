import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";

export type HerdTapAction = "select" | "deselect";

export type GroundTapAction = "deselect" | "clear_pending" | "pick_camp" | "noop";

export function resolveHerdTap(selected: boolean): HerdTapAction {
  return selected ? "deselect" : "select";
}

/**
 * When the herd is selected, a tap on open ground either clears a pending move
 * or deselects the herd. Returns pick_camp when the tile is a grazing camp.
 */
export function resolveGroundTap(
  selected: boolean,
  pendingCampId: number | null,
  campId: number | null,
): GroundTapAction {
  if (!selected) return "noop";
  if (campId !== null && campId >= 0 && campId !== TILE_HOMESTEAD && campId !== TILE_OUTSIDE) {
    return "pick_camp";
  }
  if (pendingCampId !== null) return "clear_pending";
  return "deselect";
}

export function shouldShowMoveConfirm(selected: boolean, pendingCampId: number | null): boolean {
  return selected && pendingCampId !== null;
}
