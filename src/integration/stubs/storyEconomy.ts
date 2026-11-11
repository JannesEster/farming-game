import { CONFIG } from "../../sim/config";
import type { GameState } from "../../sim/types";
import { buildYearEndReport } from "../goals";
import type { StoryEconomyPort } from "../interfaces";
import type { FlowMeta } from "../types";

export function stubStoryEconomy(meta: FlowMeta): StoryEconomyPort {
  return {
    isBankrupt(state: GameState) {
      return state.cashNad < -5000;
    },
    isHerdLost(state: GameState) {
      return state.herd.headCount <= 0 || state.herd.condition <= CONFIG.herd.conditionMin;
    },
    buildYearEndReport(state: GameState, farmYear: number) {
      const baseline = meta.yearBaseline ?? {
        year: farmYear,
        cashNad: CONFIG.economy.startingCashNad,
        headCount: CONFIG.herd.headCount,
        herdCondition: CONFIG.herd.startingCondition,
      };
      return buildYearEndReport(state, farmYear, baseline, meta.milestones, {
        bankrupt: state.cashNad < 0,
        herdLost: state.herd.headCount <= 0,
      });
    },
  };
}
