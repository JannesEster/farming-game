import type { GameState } from "./types";

export const DEFAULT_PLAYER_DISPLAY_NAME = "Farmer";

export function farmerDisplayName(state: GameState): string {
  const name = state.story?.playerDisplayName?.trim();
  return name && name.length > 0 ? name : DEFAULT_PLAYER_DISPLAY_NAME;
}
