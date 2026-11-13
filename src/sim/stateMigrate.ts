import { CONFIG } from "./config";
import { defaultRanchClock } from "./clock";
import { defaultClassLiveweights, migrateLegacyComposition } from "./cattleClasses";
import { defaultNotificationState } from "./notifications";
import { defaultCostLevers, defaultInfrastructureWear } from "./levers";
import { defaultFarmerPresence } from "./herding";
import { repairStuckTransit } from "./transit";
import { DEFAULT_PLAYER_DISPLAY_NAME } from "./playerName";
import { defaultWorkGrid, freshDailyPlay } from "./workGrid";
import { createStoryState, defaultComposition } from "./story";
import type { GameState } from "./types";
import type { FarmWaterPoint, HerdComposition } from "./storyTypes";
import { STEP3B } from "./step3bConfig";

import { ensureAnimals } from "./animals";
import { defaultDrinkingTrip } from "./water";
import { defaultBakkieRun } from "./bakkie";

export const GAME_STATE_VERSION = 8;

function deriveWaterPointsFromFeatures(state: GameState): FarmWaterPoint[] {
  const points: FarmWaterPoint[] = [];
  const windmills = state.features.filter((f) => f.kind === "windmill" || f.kind === "solar_pump");
  for (const pump of windmills) {
    const trough =
      state.features.find(
        (f) => f.kind === "trough" && Math.hypot(f.x - pump.x, f.y - pump.y) <= 2,
      ) ?? pump;
    const servedCampIds = state.camps
      .filter((camp) => camp.tiles.some((t) => Math.hypot(t.x - trough.x, t.y - trough.y) <= 1.5))
      .slice(0, 4)
      .map((c) => c.id);
    points.push({
      id: `wp-${pump.x}-${pump.y}`,
      tile: { x: pump.x, y: pump.y },
      trough: { x: trough.x, y: trough.y },
      pump: pump.kind === "solar_pump" ? "solar" : "windmill",
      reservoir: state.features.some(
        (f) => f.kind === "reservoir" && Math.hypot(f.x - pump.x, f.y - pump.y) <= 2,
      ),
      servedCampIds,
      lick: state.features.some(
        (f) => f.kind === "lick_feeder" && Math.hypot(f.x - trough.x, f.y - trough.y) <= 2,
      ),
    });
  }
  return points;
}

function snapWorkerCottagesOntoYard(state: GameState): void {
  const houses = state.features.filter((f) => f.kind === "worker_house");
  if (houses.length === 0) {
    state.features.push({ kind: "worker_house", x: 17, y: 15, scale: 1 });
    return;
  }
  const yard: { x: number; y: number }[] = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (state.campIds[y * state.width + x] === -1) yard.push({ x, y });
    }
  }
  if (yard.length === 0) return;
  const main = state.features.find((f) => f.kind === "house");
  for (const cottage of houses) {
    const id = state.campIds[cottage.y * state.width + cottage.x];
    if (id === -1) continue;
    let best = yard[0];
    let bestD = Number.POSITIVE_INFINITY;
    for (const tile of yard) {
      const d = main
        ? Math.hypot(tile.x - main.x, tile.y - main.y)
        : Math.hypot(tile.x - cottage.x, tile.y - cottage.y);
      const occupied = state.features.some(
        (f) => f !== cottage && f.x === tile.x && f.y === tile.y && f.kind !== "track" && f.kind !== "bush",
      );
      if (occupied) continue;
      if (d < bestD && d > 0.5) {
        bestD = d;
        best = tile;
      }
    }
    cottage.x = best.x;
    cottage.y = best.y;
  }
}

function ensureHandlingYardFeatures(state: GameState): void {
  const has = (kind: string) => state.features.some((f) => f.kind === kind);
  if (!has("crush")) {
    state.features.push({ kind: "crush", x: STEP3B.crushTile.x, y: STEP3B.crushTile.y, scale: 1 });
  }
  if (!has("loading_ramp")) {
    state.features.push({
      kind: "loading_ramp",
      x: STEP3B.loadingRampTile.x,
      y: STEP3B.loadingRampTile.y,
      scale: 1,
    });
  }
}

export type LegacySavedGame = {
  version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
    if (!state.story.farmerPresence) state.story.farmerPresence = defaultFarmerPresence(state);
    if (!state.story.playerDisplayName?.trim()) state.story.playerDisplayName = DEFAULT_PLAYER_DISPLAY_NAME;
    if (state.story.herdMoveQueue === undefined) state.story.herdMoveQueue = null;
    snapWorkerCottagesOntoYard(state);
    if (!state.story.drinkingTrip) state.story.drinkingTrip = defaultDrinkingTrip();
    if (state.story.saleConvoy === undefined) state.story.saleConvoy = null;
    if (!state.story.bakkieRun) state.story.bakkieRun = defaultBakkieRun();
    if (state.story.bakkieDieselLitresMonth === undefined) state.story.bakkieDieselLitresMonth = 0;
  }
  repairStuckTransit(state);
  if (!state.farmWaterPoints?.length) {
    state.farmWaterPoints = deriveWaterPointsFromFeatures(state);
  }
  ensureHandlingYardFeatures(state);
  if (state.herd.transit) {
    if (!state.herd.transit.phase) state.herd.transit.phase = "drive";
    if (!state.herd.transit.herder) state.herd.transit.herder = "farmer";
    if (state.herd.transit.approachProgress === undefined) state.herd.transit.approachProgress = 1;
  }
  if (state.story) {
    if (!state.story.animals) state.story.animals = [];
    if (state.story.cutOut === undefined) state.story.cutOut = null;
    if (!state.story.selectedAnimalIds) state.story.selectedAnimalIds = [];
    if (state.story.focusedAnimalId === undefined) state.story.focusedAnimalId = null;
    ensureAnimals(state);
  }
  state.stateVersion = GAME_STATE_VERSION;
  return state;
}

export function parseLegacySaved(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as LegacySavedGame;
    if (!data.state) return null;
    if (
      data.version !== undefined &&
      data.version !== 1 &&
      data.version !== 2 &&
      data.version !== 3 &&
      data.version !== 4 &&
      data.version !== 5 &&
      data.version !== 6 &&
      data.version !== 7 &&
      data.version !== 8
    ) {
      return null;
    }
    const state = data.state;
    if (!Array.isArray(state.camps) || !state.herd || !state.date) return null;
    if (!Array.isArray(state.features) || !Array.isArray(state.campIds)) return null;
    if (!state.width || !state.height || state.campIds.length !== state.width * state.height) return null;
    return migrateState(state);
  } catch {
    return null;
  }
}
