import { CONFIG } from "../sim/config";
import { grazeableFraction } from "../sim/pasture";
import type { GameState } from "../sim/types";
import type {
  FarmRating,
  FirstYearGoalId,
  GoalCheckResult,
  MilestoneId,
  YearBaseline,
  YearEndReport,
} from "./types";

export const FIRST_YEAR_GOALS: { id: FirstYearGoalId; label: string }[] = [
  { id: "herdCondition", label: "Keep herd condition at 3.5 or better" },
  { id: "cashOrHead", label: "End the year with more cash or more cattle than you started" },
];

export const MILESTONE_LABELS: Record<MilestoneId, string> = {
  restCamp: "Rest a camp empty until grass recovers",
  sellBeforeDrought: "Sell stock before the dry pinch",
  keepWaterRunning: "Keep water points running through the year",
};

export function createYearBaseline(state: GameState, farmYear: number): YearBaseline {
  return {
    year: farmYear,
    cashNad: state.cashNad,
    headCount: state.herd.headCount,
    herdCondition: state.herd.condition,
  };
}

export function evaluateFirstYearGoals(state: GameState, baseline: YearBaseline): GoalCheckResult[] {
  const conditionMet = state.herd.condition >= 3.5;
  const cashMet = state.cashNad > baseline.cashNad;
  const headMet = state.herd.headCount > baseline.headCount;
  return [
    {
      id: "herdCondition",
      met: conditionMet,
      label: FIRST_YEAR_GOALS[0].label,
      detail: conditionMet
        ? `Condition ${state.herd.condition.toFixed(1)} held up.`
        : `Condition fell to ${state.herd.condition.toFixed(1)}.`,
    },
    {
      id: "cashOrHead",
      met: cashMet || headMet,
      label: FIRST_YEAR_GOALS[1].label,
      detail: cashMet
        ? `Cash up N$ ${(state.cashNad - baseline.cashNad).toLocaleString("en-NA")}.`
        : headMet
          ? `Herd grew by ${state.herd.headCount - baseline.headCount} head.`
          : `Cash and head count both slipped.`,
    },
  ];
}

export function scoreFarm(
  state: GameState,
  goalResults: GoalCheckResult[],
  milestones: Record<MilestoneId, boolean>,
): { score: number; rating: FarmRating } {
  let score = 50;
  for (const g of goalResults) score += g.met ? 20 : -5;
  const milestoneCount = Object.values(milestones).filter(Boolean).length;
  score += milestoneCount * 10;
  const worstGrazable = worstCampGrazablePct(state);
  if (worstGrazable < CONFIG.pasture.moveWarnGrazeableFraction) score -= 10;
  if (state.herd.condition >= 4) score += 5;
  score = Math.max(0, Math.min(100, score));
  const rating: FarmRating = score >= 75 ? "Thriving" : score >= 50 ? "Steady" : "Struggling";
  return { score, rating };
}

function worstCampGrazablePct(state: GameState): number {
  let worst = 1;
  for (const camp of state.camps) {
    const g = grazeableFraction(camp);
    if (g < worst) worst = g;
  }
  return worst;
}

export function buildYearEndReport(
  state: GameState,
  farmYear: number,
  baseline: YearBaseline,
  milestones: Record<MilestoneId, boolean>,
  flags: { bankrupt: boolean; herdLost: boolean },
): YearEndReport {
  const goalResults = evaluateFirstYearGoals(state, baseline);
  const { score, rating } = scoreFarm(state, goalResults, milestones);
  const cashDelta = state.cashNad - baseline.cashNad;
  const headDelta = state.herd.headCount - baseline.headCount;
  const conditionDelta = state.herd.condition - baseline.herdCondition;
  const seasonLabel = `Year ${farmYear} (${CONFIG.calendar.seasonStartMonth === 7 ? "Jul–Jun" : "season"})`;
  const summaryLines = [
    `Cash ${cashDelta >= 0 ? "+" : ""}N$ ${cashDelta.toLocaleString("en-NA")}`,
    `Herd ${headDelta >= 0 ? "+" : ""}${headDelta} head, condition ${conditionDelta >= 0 ? "+" : ""}${conditionDelta.toFixed(1)}`,
    `${goalResults.filter((g) => g.met).length}/${goalResults.length} first-year goals met`,
  ];
  return {
    farmYear,
    seasonLabel,
    rating,
    score,
    goalResults,
    milestoneResults: (Object.keys(milestones) as MilestoneId[]).map((id) => ({
      id,
      met: milestones[id],
      label: MILESTONE_LABELS[id],
    })),
    cashDeltaNad: cashDelta,
    headDelta,
    conditionDelta,
    bankrupt: flags.bankrupt,
    herdLost: flags.herdLost,
    summaryLines,
  };
}

/** Tutorial / sim hooks set milestones when player actions match real practice. */
export function detectMilestones(
  state: GameState,
  prev: Record<MilestoneId, boolean>,
): Record<MilestoneId, boolean> {
  const next = { ...prev };
  for (const camp of state.camps) {
    if (camp.restDays >= CONFIG.pasture.fullRestDays) next.restCamp = true;
  }
  if (state.cashNad < CONFIG.economy.startingCashNad * 0.95 && state.herd.headCount < CONFIG.herd.headCount) {
    next.sellBeforeDrought = true;
  }
  const windmill = state.features.some((f) => f.kind === "windmill");
  const trough = state.features.some((f) => f.kind === "trough");
  if (windmill && trough) next.keepWaterRunning = true;
  return next;
}
