import { CONFIG, type GameConfig } from "./config";
import { clamp } from "./math";
import type { CampState, HerdState } from "./types";

/** No gameplay numbers live in this file. They come from config.ts. */

export function herdLiveweightKg(herd: HerdState): number {
  return herd.headCount * herd.averageLiveweightKg;
}

export function herdLsu(herd: HerdState, config: GameConfig = CONFIG): number {
  return herdLiveweightKg(herd) / config.pasture.lsuLiveweightKg;
}

export function carryingCapacityLsu(config: GameConfig = CONFIG): number {
  return config.farm.hectares / config.farm.hectaresPerLsu;
}

export function dailyDemandKg(herd: HerdState, config: GameConfig = CONFIG): number {
  return herdLiveweightKg(herd) * config.pasture.dailyIntakeFractionOfLiveweight;
}

/** Litter and unpalatable residue left in the camp after grazing. Not the May budget half. */
export function residualDmKgPerHa(peakDmKgPerHa: number, config: GameConfig = CONFIG): number {
  return Math.max(
    config.pasture.residualDmKgPerHaMin,
    peakDmKgPerHa * config.pasture.residualFractionOfPeak,
  );
}

/** @deprecated Use residualDmKgPerHa. Kept for older tests that name the grazing stop line. */
export function floorDmKgPerHa(peakDmKgPerHa: number, config: GameConfig = CONFIG): number {
  return residualDmKgPerHa(peakDmKgPerHa, config);
}

/** Kruger May budget: only this fraction of standing DM counts as consumable for the season plan. */
export function consumableDmKgInCamp(camp: CampState, config: GameConfig = CONFIG): number {
  return camp.standingDmKgPerHa * camp.hectares * config.pasture.consumableFractionOfStandingDm;
}

export function effectiveGrazingHectares(hectares: number, config: GameConfig = CONFIG): number {
  return Math.max(1, hectares * config.pasture.activeGrazingFractionOfCamp);
}

export function grazeableFraction(camp: CampState, config: GameConfig = CONFIG): number {
  const floor = residualDmKgPerHa(camp.peakDmKgPerHa, config);
  const band = camp.peakDmKgPerHa - floor;
  if (band <= 0) return 0;
  return clamp((camp.standingDmKgPerHa - floor) / band, 0, 1);
}

export function grazingDaysLeft(camp: CampState, herd: HerdState, config: GameConfig = CONFIG): number {
  const demand = dailyDemandKg(herd, config);
  if (demand <= 0) return Number.POSITIVE_INFINITY;
  const floor = residualDmKgPerHa(camp.peakDmKgPerHa, config);
  const available =
    Math.max(0, camp.standingDmKgPerHa - floor) * effectiveGrazingHectares(camp.hectares, config);
  return available / demand;
}

export function growthKgPerHa(
  moistureMm: number,
  restDays: number,
  occupied: boolean,
  config: GameConfig = CONFIG,
): number {
  if (occupied) return 0;
  const moisture = clamp(moistureMm / config.rain.moistureMmForFullGrowth, 0, 1);
  const t = clamp(restDays / config.pasture.fullRestDays, 0, 1);
  const rest = config.pasture.restGrowthFloor + (1 - config.pasture.restGrowthFloor) * t;
  return config.pasture.maxDailyGrowthKgPerHa * moisture * rest;
}

/** LSU per ha at the farm guide rate (1 LSU per hectaresPerLsu). */
export function nominalLsuPerHa(config: GameConfig = CONFIG): number {
  return 1 / config.farm.hectaresPerLsu;
}

/** Extra DM loss from trampling and hoof damage while cattle occupy a camp (Reuben rule). */
export function tramplingLossKgPerHa(
  campHectares: number,
  herd: HerdState,
  config: GameConfig = CONFIG,
): number {
  if (campHectares <= 0) return 0;
  const lsu = herdLsu(herd, config);
  const pressure = lsu / campHectares;
  const nominal = nominalLsuPerHa(config);
  if (nominal <= 0) return 0;
  const pressureRatio = pressure / nominal;
  return config.pasture.tramplingDmKgPerHaPerDayAtNominalStocking * pressureRatio;
}

export function grazeStanding(
  standingDmKgPerHa: number,
  peakDmKgPerHa: number,
  hectares: number,
  demandKg: number,
  config: GameConfig = CONFIG,
): { standingDmKgPerHa: number; eatenKg: number } {
  if (hectares <= 0) return { standingDmKgPerHa, eatenKg: 0 };
  const floor = residualDmKgPerHa(peakDmKgPerHa, config);
  const grazeHa = effectiveGrazingHectares(hectares, config);
  const available = Math.max(0, standingDmKgPerHa - floor) * grazeHa;
  const eatenKg = Math.min(Math.max(0, demandKg), available);
  return {
    standingDmKgPerHa: standingDmKgPerHa - eatenKg / hectares,
    eatenKg,
  };
}

export function nextCondition(
  condition: number,
  eatenKg: number,
  demandKg: number,
  config: GameConfig = CONFIG,
): number {
  const ratio = demandKg <= 0 ? 1 : eatenKg / demandKg;
  let next = condition;
  if (ratio < 1) next -= config.herd.conditionDropPerDayAtNoFeed * (1 - ratio);
  else next += config.herd.conditionGainPerDayWhenFed;
  return clamp(next, config.herd.conditionMin, config.herd.conditionMax);
}

export function nextSoil(
  soilMoistureMm: number,
  rainMm: number,
  config: GameConfig = CONFIG,
): { soilForGrowth: number; soilAfter: number } {
  const soilForGrowth = soilMoistureMm + rainMm;
  return {
    soilForGrowth,
    soilAfter: soilForGrowth * config.rain.moistureRetention,
  };
}
