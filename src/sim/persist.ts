import { CONFIG } from "./config";
import { createGame } from "./simulation";
import type { GameState } from "./types";
import {
  anySlotOccupied,
  getActiveSlotId,
  readSlot,
  writeSlot,
} from "../integration/saveSlots";
import { defaultFlowMeta } from "../integration/metaDefaults";
import { migrateState, parseLegacySaved } from "./stateMigrate";

export { LEGACY_SAVE_KEY, LEGACY_SINGLE_V2_KEY } from "./saveKeys";
import { LEGACY_SAVE_KEY, LEGACY_SINGLE_V2_KEY } from "./saveKeys";

/** @deprecated Single-key v2 slot writer removed. Use slot saves. */
export const SAVE_KEY = LEGACY_SINGLE_V2_KEY;

export type SavedGame = {
  version: 1 | 2 | 3;
  savedAt: string;
  state: GameState;
};

export function serializeState(state: GameState): string {
  const payload: SavedGame = {
    version: 3,
    savedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(payload);
}

export function parseSaved(raw: string): GameState | null {
  return parseLegacySaved(raw);
}

export function hasSavedGame(): boolean {
  return anySlotOccupied();
}

export function loadSavedGame(): GameState | null {
  const slot = readSlot(getActiveSlotId());
  return slot?.state ?? null;
}

/** @deprecated Use GameFlowService.persist(). Kept for picker tests. */
export function saveGame(state: GameState): void {
  if (typeof localStorage === "undefined") return;
  const slotId = getActiveSlotId();
  const existing = readSlot(slotId);
  writeSlot(slotId, {
    version: 3,
    savedAt: new Date().toISOString(),
    slotId,
    meta: existing?.meta ?? defaultFlowMeta(),
    state: migrateState(state),
  });
}

export function clearSavedGame(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LEGACY_SINGLE_V2_KEY);
  localStorage.removeItem(LEGACY_SAVE_KEY);
}

export function initialGameState(): GameState {
  return loadSavedGame() ?? createGame(CONFIG.worldSeed);
}
