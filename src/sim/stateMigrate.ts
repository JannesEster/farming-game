import { CONFIG } from "./config";
import { defaultClassLiveweights, migrateLegacyComposition } from "./cattleClasses";
import { createStoryState, defaultComposition } from "./story";
import type { GameState } from "./types";
import type { HerdComposition } from "./storyTypes";

export type LegacySavedGame = {
  version?: 1 | 2 | 3;
  savedAt?: string;
  state?: GameState;
};

function needsCattleClassMigration(composition: HerdComposition & { weaner?: number }): boolean {
  if ("weaner" in composition && (composition.weaner ?? 0) > 0) return true;
  if (composition.heifer === undefined && composition.tolly === undefined) return true;
  return false;
}

export function migrateState(state: GameState): GameState {
  if (!state.story) {
    state.story = createStoryState(state.herd.headCount, CONFIG);
    state.story.composition = defaultComposition(state.herd.headCount, CONFIG);
  }
  const comp = state.story.composition as HerdComposition & { weaner?: number };
  if (needsCattleClassMigration(comp) || !state.story.classLiveweights) {
    const migrated = migrateLegacyComposition(comp, state.herd.averageLiveweightKg, CONFIG);
    state.story.composition = migrated.composition;
    state.story.classLiveweights = migrated.classLiveweights ?? defaultClassLiveweights(CONFIG);
  }
  if (state.herd.transit === undefined) state.herd.transit = null;
  if (state.story) {
    if (state.story.moveWarnCampId === undefined) state.story.moveWarnCampId = null;
    if (state.story.thirstWarnCampId === undefined) state.story.thirstWarnCampId = null;
  }
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
    if (data.version !== undefined && data.version !== 1 && data.version !== 2 && data.version !== 3) return null;
    const state = data.state;
    if (!Array.isArray(state.camps) || !state.herd || !state.date) return null;
    return migrateState(state);
  } catch {
    return null;
  }
}
