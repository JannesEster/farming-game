import { CONFIG, type GameConfig } from "./config";
import { isRainyMonth } from "./calendar";
import { STEP2, isSummerLickMonth } from "./step2Config";
import { defaultWorkGrid, freshDailyPlay } from "./workGrid";
import type { CostLevers, InfrastructureWear } from "./storyTypes";
import type { GameState } from "./types";

export function defaultCostLevers(): CostLevers {
  return {
    lick: "summer_phosphate_p12",
    pump: "windmill",
    bakkieRunsPerMonth: STEP2.bakkieRunsDefault,
    maintenance: "maintain",
    solarPaid: false,
  };
}

export function defaultInfrastructureWear(): InfrastructureWear {
  return {
    fenceWear: 0.12,
    pumpReliability: 0.92,
    deferredMaintenanceMonths: 0,
  };
}

export function ensureStep2State(state: GameState): void {
  if (!state.story) return;
  if (!state.story.costLevers) state.story.costLevers = defaultCostLevers();
  if (!state.story.infrastructure) state.story.infrastructure = defaultInfrastructureWear();
  if (!state.story.workGrid) state.story.workGrid = defaultWorkGrid();
  if (!state.story.farmhandPresence) {
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
  if (!state.story.dailyPlay) state.story.dailyPlay = freshDailyPlay();
  if (!state.story.monthDiary) state.story.monthDiary = [];
  if (state.story.pendingPlayerEvent === undefined) state.story.pendingPlayerEvent = null;
}

export function lickCostFactor(levers: CostLevers): number {
  switch (levers.lick) {
    case "summer_phosphate_p6":
      return STEP2.lickSummerP6Factor;
    case "summer_phosphate_p12":
      return STEP2.lickSummerP12Factor;
    case "winter_protein_urea":
      return STEP2.lickWinterProteinFactor;
    default:
      return 1;
  }
}

export function lickLabel(lick: CostLevers["lick"]): string {
  switch (lick) {
    case "summer_phosphate_p6":
      return "Summer phosphate P6";
    case "summer_phosphate_p12":
      return "Summer phosphate P12";
    case "winter_protein_urea":
      return "Winter protein urea lick";
    default:
      return "Lick";
  }
}

export function pumpLabel(pump: CostLevers["pump"]): string {
  switch (pump) {
    case "diesel":
      return "Diesel pump";
    case "solar":
      return "Solar pump";
    case "windmill":
      return "Windmill";
    default:
      return "Pump";
  }
}

export function dieselLitresForMonth(state: GameState, _config: GameConfig = CONFIG): number {
  const levers = state.story?.costLevers ?? defaultCostLevers();
  const runs = Math.max(STEP2.bakkieRunsMin, Math.min(STEP2.bakkieRunsMax, levers.bakkieRunsPerMonth));
  let pumpFactor = 1;
  if (levers.pump === "diesel") pumpFactor = 1.35;
  if (levers.pump === "solar") pumpFactor = 0.45;
  if (levers.pump === "windmill") pumpFactor = 0.75;
  const baseRuns = STEP2.bakkieRunsDefault;
  const runRatio = runs / baseRuns;
  return STEP2.dieselLitresPerBakkieRun * baseRuns * runRatio * pumpFactor;
}

export function dieselCostNad(state: GameState, dieselShareBase: number, config: GameConfig = CONFIG): number {
  const litres = dieselLitresForMonth(state, config);
  const priced = litres * config.economy.dieselNadPerLitre;
  const anchor = dieselShareBase;
  const blend = anchor * 0.55 + priced * 0.45;
  return Math.round(blend);
}

export function lickCostNad(state: GameState, lickShareBase: number): number {
  const levers = state.story?.costLevers ?? defaultCostLevers();
  return Math.round(lickShareBase * lickCostFactor(levers));
}

export function repairCostNad(state: GameState, repairsShareBase: number): number {
  const infra = state.story?.infrastructure ?? defaultInfrastructureWear();
  const levers = state.story?.costLevers ?? defaultCostLevers();
  let mul = 1;
  if (levers.maintenance === "defer") mul += infra.deferredMaintenanceMonths * 0.15 + infra.fenceWear * 0.8;
  else mul += infra.fenceWear * 0.25;
  mul += (1 - infra.pumpReliability) * 0.6;
  return Math.round(repairsShareBase * mul);
}

export function tickLickCondition(state: GameState, config: GameConfig = CONFIG): void {
  const levers = state.story?.costLevers;
  if (!levers) return;
  const summer = isSummerLickMonth(state.date.month);
  const match =
    (summer && levers.lick.startsWith("summer")) || (!summer && levers.lick === "winter_protein_urea");
  const delta = match ? STEP2.lickMatchConditionBonus : -STEP2.lickMismatchConditionPenalty;
  state.herd.condition = Math.max(
    config.herd.conditionMin,
    Math.min(config.herd.conditionMax, state.herd.condition + delta),
  );
}

export function tickInfrastructureWear(state: GameState, _config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story?.infrastructure) return;
  const infra = story.infrastructure;
  const grid = story.workGrid;
  const fixPri = grid?.fix_fences ?? 0;
  if (fixPri > 0 && story.farmhand.hired) {
    infra.fenceWear = Math.max(0, infra.fenceWear - STEP2.fenceWearRepairPerDayJob);
  } else {
    infra.fenceWear = Math.min(1, infra.fenceWear + STEP2.fenceWearPerDayNoJob);
  }
  const levers = story.costLevers ?? defaultCostLevers();
  if (levers.maintenance === "maintain") {
    infra.pumpReliability = Math.min(1, infra.pumpReliability + 0.004);
    infra.deferredMaintenanceMonths = 0;
  } else {
    infra.deferredMaintenanceMonths += 1 / _config.calendar.daysPerMonthDefault;
    infra.pumpReliability = Math.max(0.4, infra.pumpReliability - 0.006);
  }
}

export function payForSolarUpgrade(state: GameState): { ok: boolean; message: string } {
  const story = state.story;
  if (!story) return { ok: false, message: "Missing story." };
  const levers = story.costLevers ?? defaultCostLevers();
  if (levers.solarPaid) return { ok: false, message: "Solar pump already paid for." };
  if (state.cashNad < STEP2.solarPumpUpfrontNad) {
    return { ok: false, message: `Need N$${STEP2.solarPumpUpfrontNad.toLocaleString("en-NA")} for solar pump.` };
  }
  state.cashNad -= STEP2.solarPumpUpfrontNad;
  levers.solarPaid = true;
  levers.pump = "solar";
  story.ledger.expenseNad += STEP2.solarPumpUpfrontNad;
  return { ok: true, message: "Solar pump installed on the main borehole." };
}

export function seasonAppropriateLick(month: number): CostLevers["lick"] {
  return isRainyMonth(month, CONFIG) ? "summer_phosphate_p12" : "winter_protein_urea";
}
