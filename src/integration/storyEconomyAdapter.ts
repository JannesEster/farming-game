import { CONFIG } from "../sim/config";
import { buildYearEndReport as buildGoalsYearEnd } from "./goals";
import type { StoryEconomyPort } from "./interfaces";
import type { FlowMeta, MonthEndSummary, YearEndReport } from "./types";
import type { GameState } from "../sim/types";

export function createStoryEconomy(meta: FlowMeta): StoryEconomyPort {
  return {
    isBankrupt(state: GameState) {
      if (state.cashNad <= CONFIG.economy.bankruptFloorNad) return true;
      const story = state.story;
      if (!story) return false;
      return story.farmhand.hired && state.cashNad < 0 && story.farmhand.daysUntilPayroll <= 3;
    },
    isHerdLost(state: GameState) {
      return state.herd.headCount <= 0 || state.herd.condition <= CONFIG.herd.conditionMin + 1;
    },
    buildYearEndReport(state: GameState, farmYear: number): YearEndReport {
      const baseline = meta.yearBaseline ?? {
        year: farmYear,
        cashNad: state.cashNad,
        headCount: state.herd.headCount,
        herdCondition: state.herd.condition,
      };
      const report = buildGoalsYearEnd(state, farmYear, baseline, meta.milestones, {
        bankrupt: state.cashNad < 0,
        herdLost: state.herd.headCount <= 0,
      });
      const ledger = state.story?.ledger;
      if (ledger) {
        const net = Math.round(ledger.incomeNad - ledger.expenseNad);
        const money = (amount: number) => {
          const rounded = Math.round(amount);
          const sign = rounded < 0 ? "-" : "";
          return `N$${sign}${Math.abs(rounded).toLocaleString("en-NA")}`;
        };
        report.summaryLines.unshift(
          `Season ledger (open month) income ${money(ledger.incomeNad)}. Spend ${money(ledger.expenseNad)}. Net ${money(net)}.`,
        );
      }
      if (state.story?.starvation.totalDeathsSeason && state.story.starvation.totalDeathsSeason > 0) {
        report.summaryLines.push(`${state.story.starvation.totalDeathsSeason} deaths this season`);
      }
      return report;
    },
    buildMonthEndSummary(state: GameState): MonthEndSummary {
      const story = state.story;
      const net = story ? story.ledger.incomeNad - story.ledger.expenseNad : 0;
      const headline = story
        ? `Month ended · net N$${Math.round(net)} · rain ${Math.round(state.seasonRainMm)} mm YTD`
        : "Month ended";
      return {
        date: { ...state.date },
        cashNad: state.cashNad,
        rainMm: state.seasonRainMm,
        herdCondition: state.herd.condition,
        grazableWorstPct: 0,
        headline,
      };
    },
  };
}
