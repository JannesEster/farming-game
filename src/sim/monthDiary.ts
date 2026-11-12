import { formatNad } from "./format";
import {
  dieselCostNad,
  dieselLitresForMonth,
  lickCostNad,
  lickLabel,
  pumpLabel,
  repairCostNad,
} from "./levers";
import type { MonthlyCostBreakdown } from "./economy";
import type { StoryState } from "./storyTypes";
import type { GameState } from "./types";
import { CONFIG, type GameConfig } from "./config";

export function appendMonthDiary(story: StoryState, line: string): void {
  if (!story.monthDiary) story.monthDiary = [];
  story.monthDiary.push(line);
  if (story.monthDiary.length > 24) story.monthDiary.shift();
}

export function buildMonthDiaryBody(
  state: GameState,
  costs: MonthlyCostBreakdown,
  config: GameConfig = CONFIG,
): string[] {
  const story = state.story;
  const lines: string[] = [];
  if (story?.monthDiary?.length) {
    lines.push("What happened");
    for (const row of story.monthDiary.slice(-8)) lines.push(row);
  }
  const levers = story?.costLevers;
  lines.push(`Cash move: income ${formatNad(story?.ledger.incomeNad ?? 0)}, spend ${formatNad(story?.ledger.expenseNad ?? 0)}.`);
  lines.push("Why the bills moved");
  const head = state.herd.headCount;
  const hired = story?.farmhand.hired ? "Farmhand wage included." : "No extra wage this month.";
  lines.push(`Labour N$${Math.round(costs.labour)}. ${hired}`);
  if (levers) {
    const lickNad = lickCostNad(state, costs.lick);
    lines.push(
      `Lick N$${lickNad}. ${lickLabel(levers.lick)} for ${head} head. Change lick type in Ranch ops if costs or condition slip.`,
    );
    const dieselNad = dieselCostNad(state, costs.diesel, config);
    const litres = Math.round(dieselLitresForMonth(state, config));
    lines.push(
      `Diesel N$${dieselNad}. About ${litres} L from ${levers.bakkieRunsPerMonth} bakkie runs and ${pumpLabel(levers.pump).toLowerCase()}. Fewer runs or solar cuts fuel.`,
    );
    const repairs = repairCostNad(state, costs.repairs);
    lines.push(
      `Repairs N$${repairs}. Fence wear ${Math.round((story.infrastructure?.fenceWear ?? 0) * 100)}%, pump reliability ${Math.round((story.infrastructure?.pumpReliability ?? 1) * 100)}%. ${levers.maintenance === "maintain" ? "Maintenance plan active." : "Deferred maintenance adds risk."}`,
    );
  } else {
    lines.push(...costs.lines);
  }
  lines.push(`Other N$${Math.round(costs.other)}. Vet and vaccine levy.`);
  const net = (story?.ledger.incomeNad ?? 0) - (story?.ledger.expenseNad ?? 0);
  lines.push(`Month net ${formatNad(net)}. Season rain ${Math.round(state.seasonRainMm)} mm.`);
  return lines;
}
