import { CONFIG, type GameConfig } from "./config";
import type { FarmhandJob } from "./storyTypes";
import type { GameState } from "./types";

export function hireFarmhand(state: GameState, config: GameConfig = CONFIG): { ok: boolean; message: string } {
  const story = state.story;
  if (!story) return { ok: false, message: "Missing story." };
  if (story.farmhand.hired) return { ok: false, message: "Farmhand already hired." };
  story.farmhand.hired = true;
  story.farmhand.wageCashNad = config.economy.farmhandMonthlyCashNad;
  story.farmhand.daysUntilPayroll = config.economy.payrollIntervalDays;
  story.farmhand.job = "check_water";
  return { ok: true, message: "Hired Piet. He can check water or help move the herd." };
}

export function setFarmhandJob(state: GameState, job: FarmhandJob): void {
  const story = state.story;
  if (!story?.farmhand.hired) return;
  story.farmhand.job = job;
}

export function tickFarmhand(state: GameState, config: GameConfig = CONFIG): string | null {
  const story = state.story;
  if (!story?.farmhand.hired) return null;
  story.farmhand.daysUntilPayroll -= 1;
  if (story.farmhand.daysUntilPayroll <= 0) {
    story.farmhand.daysUntilPayroll = config.economy.payrollIntervalDays;
    return "Farmhand paid (wages run with month-end costs).";
  }
  if (story.farmhand.job === "check_water" && state.date.day % config.story.farmhandWaterCheckInterval === 0) {
    return "Farmhand checked water points.";
  }
  if (story.farmhand.job === "move_herd" && state.herd.condition < config.story.farmhandMoveCondition) {
    return "Farmhand suggests moving the herd to greener grass.";
  }
  return null;
}

export function farmhandWaterBonus(state: GameState, config: GameConfig = CONFIG): number {
  if (state.story?.farmhand.hired && state.story.farmhand.job === "check_water") {
    return config.story.farmhandWaterConditionBonus;
  }
  return 0;
}
