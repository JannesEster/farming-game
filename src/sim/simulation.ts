import { CONFIG, type GameConfig } from "./config";
import { addDays, isSeasonStart } from "./calendar";
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
import { herdInTransit, startHerdMove } from "./transit";
import type { CampState, GameState, MoveResult } from "./types";

export function createGame(seed = CONFIG.worldSeed, config: GameConfig = CONFIG): GameState {
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
  if (isSeasonStart(state.date, config)) state.seasonRainMm = 0;
  state.todayRainMm = rainMm;
  state.seasonRainMm += rainMm;

  const demand = dailyDemandKg(state.herd, config);
  const walking = herdInTransit(state.herd);
  let eaten = 0;
  for (const camp of state.camps) {
    const occupied = !walking && camp.id === state.herd.campId;
    const soil = nextSoil(camp.soilMoistureMm, rainMm, config);
    let growth = growthKgPerHa(soil.soilForGrowth, camp.restDays, occupied, config);
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
    afterFeedDay(state, eaten, demand, config);
  }

  state.date = addDays(state.date, 1);
}

export function stepDay(state: GameState, config: GameConfig = CONFIG): void {
  const rng = rngFromState(state.rngState);
  const rain = dailyRainMm(state.date, rng, config);
  state.rngState = rng.getState();
  stepDayWithRain(state, rain, config);
}

export function moveHerd(state: GameState, campId: number): MoveResult {
  if (herdInTransit(state.herd)) return { ok: false, reason: "moving" };
  const camp = findCamp(state, campId);
  if (!camp) return { ok: false, reason: "missing" };
  if (camp.id === state.herd.campId) return { ok: false, reason: "same" };
  startHerdMove(state, camp.id);
  return { ok: true, campName: camp.name };
}
