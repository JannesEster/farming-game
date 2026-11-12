import { CONFIG } from "./config";

/**
 * Step 2 player levers and events. New numbers live here with TODO assumption tags.
 * Sourced values stay in config.ts / economy.ts.
 */

export const STEP2 = {
  /** A. TODO: bakkie runs per month at full service level on a 3,300 ha ranch. */
  bakkieRunsDefault: 8,
  bakkieRunsMin: 2,
  bakkieRunsMax: 12,
  /** A. TODO: diesel litres saved per run cut (Reuben anchor uses ~18% fuel share). */
  dieselLitresPerBakkieRun: 18,
  /** A. TODO: upfront solar pump install for one main borehole. */
  solarPumpUpfrontNad: 42000,
  /** A. TODO: windmill major service skipped when maintenance deferred. */
  windmillBreakdownChanceDefer: 0.14,
  windmillBreakdownChanceMaintain: 0.04,
  /** A. TODO: repair callout when deferred maintenance bites. */
  emergencyPumpRepairNad: 8500,
  routineMaintenanceNad: 1200,
  /** Lick cost multipliers vs base NAU lickNadPerHeadPerMonth in config. */
  lickSummerP6Factor: 0.92,
  lickSummerP12Factor: 1.08,
  lickWinterProteinFactor: 1.15,
  /** Condition bonus per day when lick matches season (small nudge). */
  lickMatchConditionBonus: 0.04,
  lickMismatchConditionPenalty: 0.02,
  /** Fence wear added per game day when fix_fences job is off. */
  fenceWearPerDayNoJob: 0.002,
  fenceWearRepairPerDayJob: 0.008,
  /** Jackal event. */
  jackalLossCalvesMax: 3,
  jackalGuardCostNad: 650,
  jackalRepairFenceCostNad: 900,
  /** Buyer offer uses live price quotes; this is a small pickup fee. */
  buyerOfferPickupNad: 350,
  /** Player event daily roll when hired farmhand present. */
  eventDailyChance: 0.06,
} as const;

export function isSummerLickMonth(month: number): boolean {
  return CONFIG.calendar.rainyMonths.includes(month);
}
