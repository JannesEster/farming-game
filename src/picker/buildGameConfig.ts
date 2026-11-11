import { CONFIG, type GameConfig } from "../sim/config";
import type { FenceCondition, WaterInventory } from "./types";
import { type RegionTemplate } from "./regionData";

export type OfferGenParams = {
  region: RegionTemplate;
  hectares: number;
  campCount: number;
  water: WaterInventory;
  fenceCondition: FenceCondition;
  herdHead: number;
  herdName: string;
  mapSeed: number;
};

export function buildGameConfig(params: OfferGenParams): GameConfig {
  const { region, hectares, campCount, water, herdHead, herdName } = params;
  const clampedCamps = Math.max(region.terrain.campCountMin, Math.min(region.terrain.campCountMax, campCount));

  return {
    ...CONFIG,
    worldSeed: params.mapSeed,
    farm: {
      name: region.label,
      hectares,
      homesteadHectares: CONFIG.farm.homesteadHectares,
      hectaresPerLsu: region.hectaresPerLsu,
      landValueNadPerHa: region.landRateNadPerHa,
      extraWater: { boreholes: water.boreholes, windmills: water.windmills, solar: water.solar },
      fenceCondition: params.fenceCondition,
    },
    pasture: {
      ...CONFIG.pasture,
      peakDmKgPerHa: region.terrain.peakDmKgPerHa,
      bushyPeakFraction: region.terrain.bushyPeakFraction,
    },
    herd: {
      ...CONFIG.herd,
      name: herdName,
      headCount: herdHead,
    },
    rain: {
      ...CONFIG.rain,
      monthlyMeanMm: region.rainTable.slice(),
    },
    map: {
      ...CONFIG.map,
      campCountMin: clampedCamps,
      campCountMax: clampedCamps,
      treeChance: region.terrain.treeChance,
      bushChanceOpen: region.terrain.bushChanceOpen,
      bushChanceBushy: region.terrain.bushChanceBushy,
    },
    economy: {
      ...CONFIG.economy,
    },
  };
}
