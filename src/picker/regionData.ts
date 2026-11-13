/**
 * Regional facts for farm picker cards (sourced in farm-life-lesson §4.1, §7.1, §8.1).
 * Assumption fields are marked in comments.
 * Listing hectares are 3 times the previous playable size. Tree chances are tuned
 * so each region keeps about the same tree count. Bush chances are the old values
 * times the area scale and a 0.62 trim, because bushes share the tree random stream.
 */

import { BUSH_COUNT_TRIM, VEGETATION_COUNT_SCALE } from "../sim/config";

function keepBushCount(previousChance: number): number {
  return previousChance * VEGETATION_COUNT_SCALE * BUSH_COUNT_TRIM;
}

export type RegionTemplate = {
  key: "karas" | "khomas" | "otjozondjupa" | "omaheke";
  label: string;
  /** Listing hectares. Three times the previous playable size. */
  listingHectares: number;
  /** S: NSA commercial census average ha where used for flavour text. */
  censusAvgHectares: number;
  /** S: mean of three census rain seasons (mm). */
  rainThreeSeasonMm: number;
  /** S: NSA ALPI 2023 N$/ha. */
  landRateNadPerHa: number;
  /** S: savanna 8 to 10 ha/LSU; arid south higher. */
  hectaresPerLsu: number;
  hectaresPerLsuSource: string;
  biome: string;
  /** Map generator flavour. */
  terrain: {
    campCountMin: number;
    campCountMax: number;
    treeChance: number;
    bushChanceOpen: number;
    bushChanceBushy: number;
    peakDmKgPerHa: number;
    bushyPeakFraction: number;
  };
  rainTable: number[];
};

/** S: Otjozondjupa rain seasons 548, 287, 503 mm → rounded mean. */
const OTJO_RAIN = Math.round((548 + 287 + 503) / 3);

export const REGIONS: Record<RegionTemplate["key"], RegionTemplate> = {
  karas: {
    key: "karas",
    label: "//Karas",
    listingHectares: 4_800 * 3,
    censusAvgHectares: 6_091,
    rainThreeSeasonMm: Math.round((130 + 91 + 100) / 3),
    landRateNadPerHa: 804,
    hectaresPerLsu: 27,
    hectaresPerLsuSource: "Karas land use plan 24 to 30 ha/LSU (eastern/north-eastern band)",
    biome: "Nama Karoo dwarf shrubland",
    terrain: {
      campCountMin: 14,
      campCountMax: 20,
      treeChance: 0.00114,
      bushChanceOpen: keepBushCount(0.045),
      bushChanceBushy: keepBushCount(0.12),
      peakDmKgPerHa: 900,
      bushyPeakFraction: 0.55,
    },
    rainTable: [0, 12, 10, 8, 4, 2, 0, 0, 0, 2, 8, 18, 22],
  },
  khomas: {
    key: "khomas",
    label: "Khomas",
    listingHectares: 2_600 * 3,
    censusAvgHectares: 3_829,
    rainThreeSeasonMm: Math.round((375 + 170 + 325) / 3),
    landRateNadPerHa: 1_857,
    hectaresPerLsu: 9,
    hectaresPerLsuSource: "Savanna farms often quoted 8 to 10 ha/LSU (indicative)",
    biome: "Acacia savanna, hilly highlands",
    terrain: {
      campCountMin: 10,
      campCountMax: 14,
      treeChance: 0.0071,
      bushChanceOpen: keepBushCount(0.09),
      bushChanceBushy: keepBushCount(0.2),
      peakDmKgPerHa: 1_500,
      bushyPeakFraction: 0.65,
    },
    rainTable: [0, 70, 65, 55, 25, 8, 0, 0, 2, 12, 35, 60, 75],
  },
  otjozondjupa: {
    key: "otjozondjupa",
    label: "Otjozondjupa",
    listingHectares: 3_300 * 3,
    censusAvgHectares: 3_327,
    rainThreeSeasonMm: OTJO_RAIN,
    landRateNadPerHa: 1_951,
    hectaresPerLsu: 10,
    hectaresPerLsuSource: "Savanna 8 to 10 ha/LSU (prototype uses 10)",
    biome: "Thornbush savanna",
    terrain: {
      campCountMin: 12,
      campCountMax: 18,
      treeChance: 0.00348,
      bushChanceOpen: keepBushCount(0.1),
      bushChanceBushy: keepBushCount(0.24),
      peakDmKgPerHa: 1_600,
      bushyPeakFraction: 0.6,
    },
    rainTable: [0, 95, 90, 70, 30, 5, 0, 0, 1, 5, 15, 55, 80],
  },
  omaheke: {
    key: "omaheke",
    label: "Omaheke",
    listingHectares: 3_200 * 3,
    censusAvgHectares: 3_531,
    rainThreeSeasonMm: Math.round((408 + 267 + 491) / 3),
    landRateNadPerHa: 2_213,
    hectaresPerLsu: 12,
    hectaresPerLsuSource: "A: Kalahari sandveld, slightly lower capacity than central savanna",
    biome: "Kalahari sandveld savanna",
    terrain: {
      campCountMin: 11,
      campCountMax: 16,
      treeChance: 0.0035,
      bushChanceOpen: keepBushCount(0.07),
      bushChanceBushy: keepBushCount(0.16),
      peakDmKgPerHa: 1_350,
      bushyPeakFraction: 0.62,
    },
    rainTable: [0, 80, 75, 58, 22, 6, 0, 0, 1, 8, 22, 48, 72],
  },
};

/** S: borehole ~N$60,000 (Schlettwein, 2020). */
export const BOREHOLE_COST_NAD = 60_000;

/** S: installed solar pump kit N$28,000 (Living Earth, 2026). */
export const SOLAR_PUMP_KIT_COST_NAD = 28_000;

/**
 * TODO(A): windmill replacement / refurb not sourced; use as tunable infra weight.
 */
export const WINDMILL_REFURB_COST_NAD = 75_000;

/**
 * TODO(A): farmhouse + yard bundle for card economics only.
 */
export const HOMESTEAD_BUNDLE_COST_NAD = 180_000;

/**
 * TODO(A): worker housing on card.
 */
export const WORKER_HOUSE_COST_NAD = 150_000;

/** S: LLPBN 2025 weaner auction average N$31.47/kg (used with assumed live mass). */
export const WEANER_RATE_NAD_PER_KG = 31.47;

/** A: assumed weaner live mass for pricing display. */
export const WEANER_LIVE_KG = 220;
