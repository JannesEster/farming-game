import { CONFIG } from "./config";
import { defaultRanchClock } from "./clock";
import { defaultClassLiveweights, migrateLegacyComposition } from "./cattleClasses";
import { defaultNotificationState } from "./notifications";
import { defaultCostLevers, defaultInfrastructureWear } from "./levers";
import { defaultWorkGrid, freshDailyPlay } from "./workGrid";
import { createStoryState, defaultComposition } from "./story";
import type { GameState } from "./types";
import type { HerdComposition } from "./storyTypes";

export const GAME_STATE_VERSION = 5;

export type LegacySavedGame = {
  version?: 1 | 2 | 3 | 4 | 5;
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
  if (!state.clock) {
    state.clock = defaultRanchClock();
    state.clock.settings.daysPerMonth = CONFIG.calendar.daysPerMonthDefault;
    state.clock.settings.dayLengthSeconds = CONFIG.time.dayLengthSecondsDefault as 180 | 240 | 300;
    state.clock.settings.catchUpCapMs = CONFIG.time.catchUpCapMs;
  }
  if (!state.notifications) state.notifications = defaultNotificationState();
  if (state.date.hour < 0 || state.date.hour > 23) state.date.hour = CONFIG.calendar.startHour;
  if (state.story) {
    if (!state.story.costLevers) state.story.costLevers = defaultCostLevers();
    if (!state.story.workGrid) state.story.workGrid = defaultWorkGrid();
    if (!state.story.infrastructure) state.story.infrastructure = defaultInfrastructureWear();
    if (!state.story.dailyPlay) state.story.dailyPlay = freshDailyPlay();
    if (!state.story.monthDiary) state.story.monthDiary = [];
    if (state.story.pendingPlayerEvent === undefined) state.story.pendingPlayerEvent = null;
    if (state.story.farmhand.hired && !state.story.farmhandPresence) {
      state.story.farmhandPresence = {
        tileX: state.width / 2,
        tileY: state.height / 2,
        targetTileX: state.width / 2,
        targetTileY: state.height / 2,
        activeJob: null,
        activityLabel: "At the yard",
        walkProgress: 1,
      };
    }
    if (state.story.farmhand.job && state.story.workGrid.check_water === 0 && state.story.workGrid.move_herd_help === 0) {
      if (state.story.farmhand.job === "check_water") state.story.workGrid.check_water = 2;
      if (state.story.farmhand.job === "move_herd") state.story.workGrid.move_herd_help = 2;
    }
  }
  return state;
}

export function parseLegacySaved(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as LegacySavedGame;
    if (!data.state) return null;
    if (data.version !== undefined && data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4) {
    return null;
  }
    const state = data.state;
    if (!Array.isArray(state.camps) || !state.herd || !state.date) return null;
    return migrateState(state);
  } catch {
    return null;
  }
}
