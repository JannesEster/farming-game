import { CONFIG, type GameConfig } from "./config";
import { freeWorkerHouseSlots } from "./housing";
import { defaultWorkGrid } from "./workGrid";
import { ensureStep2State } from "./levers";
import type { FarmhandJob, WorkJobId } from "./storyTypes";
import type { GameState } from "./types";

export function hireFarmhand(state: GameState, config: GameConfig = CONFIG): { ok: boolean; message: string } {
  const story = state.story;
  if (!story) return { ok: false, message: "Missing story." };
  if (story.farmhand.hired) return { ok: false, message: "Farmhand already hired." };
  if (freeWorkerHouseSlots(state) < 1) {
    return { ok: false, message: "No free worker house. Build one in Ranch ops first." };
  }
  story.farmhand.hired = true;
  story.farmhand.wageCashNad = config.economy.farmhandMonthlyCashNad;
  story.farmhand.daysUntilPayroll = config.economy.payrollIntervalDays;
  story.farmhand.job = "check_water";
  if (!story.workGrid) story.workGrid = defaultWorkGrid();
  story.workGrid.check_water = 2;
  ensureStep2State(state);
  return { ok: true, message: "Hired Piet. Set his jobs on the work grid in Ranch ops." };
}

/** @deprecated use setWorkPriority from workGrid */
export function setFarmhandJob(state: GameState, job: FarmhandJob): void {
  const story = state.story;
  if (!story?.farmhand.hired) return;
  story.farmhand.job = job;
  if (!story.workGrid) story.workGrid = defaultWorkGrid();
  const map: Record<NonNullable<FarmhandJob>, WorkJobId> = {
    check_water: "check_water",
    move_herd: "move_herd_help",
  };
  if (job) {
    for (const key of Object.keys(story.workGrid) as WorkJobId[]) story.workGrid[key] = 0;
    story.workGrid[map[job]] = 2;
  }
}

export function tickFarmhand(state: GameState, config: GameConfig = CONFIG): string | null {
  const story = state.story;
  if (!story?.farmhand.hired) return null;
  story.farmhand.daysUntilPayroll -= 1;
  if (story.farmhand.daysUntilPayroll <= 0) {
    story.farmhand.daysUntilPayroll = config.economy.payrollIntervalDays;
    return "Farmhand paid (wages run with month-end costs).";
  }
  return null;
}

export function farmhandWaterBonus(state: GameState, config: GameConfig = CONFIG): number {
  const story = state.story;
  if (!story?.farmhand.hired) return 0;
  const waterOn = (story.workGrid?.check_water ?? 0) > 0 || story.farmhand.job === "check_water";
  if (waterOn) return config.story.farmhandWaterConditionBonus;
  return 0;
}
