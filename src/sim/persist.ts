import { CONFIG } from "./config";
import { createGame } from "./simulation";
import type { GameState } from "./types";

export const SAVE_KEY = "farming-game-v2";

export const LEGACY_SAVE_KEY = "farming-game-v1";

export type SavedGame = {
  version: 1;
  savedAt: string;
  state: GameState;
};

export function serializeState(state: GameState): string {
  const payload: SavedGame = {
    version: 1,
    savedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(payload);
}

export function parseSaved(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as Partial<SavedGame>;
    if (data.version !== 1 || !data.state) return null;
    const state = data.state;
    if (!Array.isArray(state.camps) || !state.herd || !state.date) return null;
    if (state.herd.transit === undefined) state.herd.transit = null;
    if (state.date.hour === undefined) state.date.hour = CONFIG.calendar.startHour;
    if (state.herd.transit) {
      if (state.herd.transit.walkGameHours === undefined) {
        state.herd.transit.walkGameHours = 0;
      }
      if (state.herd.transit.hoursApplied === undefined) {
        state.herd.transit.hoursApplied = 0;
      }
    }
    return state;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  if (typeof localStorage === "undefined") return false;
  return Boolean(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
}

export function loadSavedGame(): GameState | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
  if (!raw) return null;
  return parseSaved(raw);
}

export function saveGame(state: GameState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SAVE_KEY, serializeState(state));
}

export function clearSavedGame(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SAVE_KEY);
}

export function initialGameState(): GameState {
  return loadSavedGame() ?? createGame(CONFIG.worldSeed);
}
