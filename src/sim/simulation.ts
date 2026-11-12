import { CONFIG, type GameConfig } from "./config";
import { defaultRanchClock, ecologyScalePerGameDay, rollGameDayFromState } from "./clock";
import { defaultNotificationState } from "./notifications";
import { isSeasonStart, gameDaysInMonth } from "./calendar";
import {
  createGameFromDefinition,
  isFarmDefinition,
  loadDefaultFarmDefinition,
} from "./farmDefinition";
import { generateFarm } from "./generate";
import {
  dailyDemandKg,
  grazeStanding,
  growthKgPerHa,
  nextCondition,
  nextSoil,
  residualDmKgPerHa,
  tramplingLossKgPerHa,
} from "./pasture";
import { dailyRainMm } from "./rainfall";
import { rngFromState } from "./rng";
import { afterFeedDay } from "./story";
import { requestHerdMove, tryDispatchHerdQueue } from "./herding";
import { herdInTransit } from "./transit";
import type { CampState, GameState, MoveResult } from "./types";

function isDefaultRuntimeConfig(config: GameConfig): boolean {
  return (
    config.worldSeed === CONFIG.worldSeed &&
    config.farm.hectares === CONFIG.farm.hectares &&
    config.map.campCountMin === CONFIG.map.campCountMin &&
    config.map.campCountMax === CONFIG.map.campCountMax &&
    config.herd.headCount === CONFIG.herd.headCount &&
    !config.map.herdStartNearYard
  );
}

export function createGame(seed = CONFIG.worldSeed, config: GameConfig = CONFIG): GameState {
  if (seed === CONFIG.worldSeed && cachedDefaultState && isDefaultRuntimeConfig(config)) {
    return cloneGameState(cachedDefaultState);
  }
  return generateFarm(seed, config);
}

let cachedDefaultState: GameState | null = null;

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** Load public/farms/default-farm.json once; used for seed 3300 at runtime. */
export async function preloadDefaultFarm(config: GameConfig = CONFIG): Promise<boolean> {
  const def = await loadDefaultFarmDefinition();
  if (!def || def.seed !== config.worldSeed) return false;
  cachedDefaultState = createGameFromDefinition(def, config);
  return true;
}

/** Vitest: avoid regenerating seed 3300 from scratch. */
export function primeDefaultFarmCache(def: unknown, config: GameConfig = CONFIG): boolean {
  if (!isFarmDefinition(def) || def.seed !== config.worldSeed) return false;
  cachedDefaultState = createGameFromDefinition(def, config);
  return true;
}

export function clearDefaultFarmCacheForTests(): void {
  cachedDefaultState = null;
}

export function generateFarmState(seed: number, config: GameConfig = CONFIG): GameState {
  return generateFarm(seed, config);
}

export function findCamp(state: GameState, campId: number): CampState | undefined {
  return state.camps.find((camp) => camp.id === campId);
}

export function campIdAt(state: GameState, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return state.campIds[y * state.width + x];
}

/**
 * One game day with a known rainfall.
 * Herd walk progress is not advanced here; see tickTransitRealtime in transit.ts.
 */
export function stepDayWithRain(state: GameState, rainMm: number, config: GameConfig = CONFIG): void {
  if (!state.clock) state.clock = defaultRanchClock();
  if (!state.notifications) state.notifications = defaultNotificationState();
  const nextDate = rollGameDayFromState(state, config);
  if (isSeasonStart(nextDate, config)) state.seasonRainMm = 0;
  state.todayRainMm = rainMm;
  const dpm = gameDaysInMonth(state, config);
  const eco = ecologyScalePerGameDay(dpm, config.calendar.ecologyReferenceDaysPerMonth);
  state.seasonRainMm += rainMm;

  const demand = dailyDemandKg(state.herd, config);
  const walking = herdInTransit(state.herd);
  let eaten = 0;
  for (const camp of state.camps) {
    const occupied = !walking && camp.id === state.herd.campId;
    const soil = nextSoil(camp.soilMoistureMm, rainMm * eco, config);
    let growth = growthKgPerHa(soil.soilForGrowth, camp.restDays, occupied, config) * eco;
    const droughtMul = state.story?.drought.forageMultiplier ?? 1;
    growth *= droughtMul;
    camp.soilMoistureMm = soil.soilAfter;
    camp.standingDmKgPerHa = Math.min(camp.peakDmKgPerHa, camp.standingDmKgPerHa + growth);
    if (occupied) {
      const grazed = grazeStanding(
        camp.standingDmKgPerHa,
        camp.peakDmKgPerHa,
        camp.hectares,
        demand,
        config,
      );
      camp.standingDmKgPerHa = grazed.standingDmKgPerHa;
      eaten = grazed.eatenKg;
      const floor = residualDmKgPerHa(camp.peakDmKgPerHa, config);
      const trample = tramplingLossKgPerHa(camp.hectares, state.herd, config);
      camp.standingDmKgPerHa = Math.max(floor, camp.standingDmKgPerHa - trample);
      camp.restDays = 0;
    } else {
      camp.restDays += 1;
    }
  }

  if (!walking) {
    state.herd.condition = nextCondition(state.herd.condition, eaten, demand, config);
    state.herd.daysInCamp += 1;
    afterFeedDay(state, eaten, demand, config, eco);
  }

  state.date = nextDate;
  tryDispatchHerdQueue(state, config);
}

export function stepDay(state: GameState, config: GameConfig = CONFIG): void {
  const rng = rngFromState(state.rngState);
  const rain = dailyRainMm(state.date, rng, config);
  state.rngState = rng.getState();
  stepDayWithRain(state, rain, config);
}

export function moveHerd(state: GameState, campId: number, config: GameConfig = CONFIG): MoveResult {
  if (state.herd.transit && (state.herd.transit.phase !== "drive" || state.herd.transit.progress < 1)) {
    if (state.herd.transit.phase === "approach" || herdInTransit(state.herd)) {
      return { ok: false, reason: "moving" };
    }
  }
  return requestHerdMove(state, campId, config);
}
