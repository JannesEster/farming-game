import type { CalendarDate, GameState } from "../sim/types";

/** High-level game flow phases (integration-owned). */
export type FlowPhase =
  | "boot"
  | "start"
  | "farmPicker"
  | "playing"
  | "yearEndReview"
  | "gameOver";

export type GameOverReason = "bankrupt" | "herdLost" | "playerQuit";

export type YearBaseline = {
  year: number;
  cashNad: number;
  headCount: number;
  herdCondition: number;
};

export type FlowMeta = {
  /** Farm offer id chosen at purchase (FARM PICKER). */
  farmOfferId: string | null;
  /** Baseline for first-year goals, set when a run starts. */
  yearBaseline: YearBaseline | null;
  /** Game year index for the current season (1 = first year on this farm). */
  farmYear: number;
  tutorial: TutorialProgress;
  milestones: MilestoneProgress;
  gameOverReason: GameOverReason | null;
};

export type TutorialProgress = {
  completed: boolean;
  skipped: boolean;
  currentStepId: TutorialStepId | null;
  finishedStepIds: TutorialStepId[];
};

export type TutorialStepId =
  | "selectHerd"
  | "moveToRestedCamp"
  | "speedUpTime"
  | "checkGrass"
  | "sellAtMarket"
  | "dismissDone";

export type MilestoneId = "restCamp" | "sellBeforeDrought" | "keepWaterRunning";

export type MilestoneProgress = Record<MilestoneId, boolean>;

export type FlowRuntime = {
  phase: FlowPhase;
  meta: FlowMeta;
  slotId: number;
  /** Live sim state while playing; null on menus. */
  gameState: GameState | null;
};

export type YearEndReport = {
  farmYear: number;
  seasonLabel: string;
  rating: FarmRating;
  score: number;
  goalResults: GoalCheckResult[];
  milestoneResults: { id: MilestoneId; met: boolean; label: string }[];
  cashDeltaNad: number;
  headDelta: number;
  conditionDelta: number;
  bankrupt: boolean;
  herdLost: boolean;
  summaryLines: string[];
};

export type FarmRating = "Struggling" | "Steady" | "Thriving";

export type GoalCheckResult = {
  id: FirstYearGoalId;
  met: boolean;
  label: string;
  detail: string;
};

export type FirstYearGoalId = "herdCondition" | "cashOrHead";

export type MonthEndSummary = {
  date: CalendarDate;
  cashNad: number;
  rainMm: number;
  herdCondition: number;
  grazableWorstPct: number;
  headline: string;
};
