import { CONFIG } from "./config";
import { createStoryState, defaultComposition } from "./story";
import type { GameState } from "./types";

export type LegacySavedGame = {
  version?: 1 | 2;
  savedAt?: string;
  state?: GameState;
};

export function migrateState(state: GameState): GameState {
  if (!state.story) {
    state.story = createStoryState(state.herd.headCount, CONFIG);
    state.story.composition = defaultComposition(state.herd.headCount, CONFIG);
  }
  if (state.herd.transit === undefined) state.herd.transit = null;
  if (state.date.hour === undefined) state.date.hour = CONFIG.calendar.startHour;
  if (state.herd.transit) {
    if (state.herd.transit.walkGameHours === undefined) state.herd.transit.walkGameHours = 0;
    if (state.herd.transit.hoursApplied === undefined) state.herd.transit.hoursApplied = 0;
  }
  return state;
}

export function parseLegacySaved(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as LegacySavedGame;
    if (!data.state) return null;
    if (data.version !== undefined && data.version !== 1 && data.version !== 2) return null;
    const state = data.state;
    if (!Array.isArray(state.camps) || !state.herd || !state.date) return null;
    return migrateState(state);
  } catch {
    return null;
  }
}
