import type { GameState } from "./types";
import type { MorningDecisionId } from "./storyTypes";
import { defaultWorkGrid } from "./workGrid";
import { seasonAppropriateLick } from "./levers";
import { emitNotification, defaultNotificationState } from "./notifications";

const DECISION_COPY: Record<
  MorningDecisionId,
  { question: string; choices: { id: string; label: string; effect: (state: GameState) => string }[] }
> = {
  lick_batch: {
    question: "Morning: fill lick on one long bakkie round or two short trips?",
    choices: [
      {
        id: "one_trip",
        label: "One long round (saves diesel)",
        effect: (state) => {
          if (state.story?.costLevers) {
            state.story.costLevers.bakkieRunsPerMonth = Math.max(2, state.story.costLevers.bakkieRunsPerMonth - 1);
          }
          return "Bakkie runs trimmed this month.";
        },
      },
      {
        id: "two_trips",
        label: "Two short trips (better lick cover)",
        effect: (state) => {
          state.herd.condition = Math.min(100, state.herd.condition + 0.15);
          return "Lick topped early. Herd nibbles look better.";
        },
      },
    ],
  },
  water_round: {
    question: "Morning: check the far windmill first or the near trough?",
    choices: [
      {
        id: "far_first",
        label: "Far windmill first",
        effect: (state) => {
          if (!state.story?.workGrid) state.story!.workGrid = defaultWorkGrid();
          state.story!.workGrid.check_water = 3;
          return "Farmhand heads to the windmill.";
        },
      },
      {
        id: "near_first",
        label: "Near trough first",
        effect: (state) => {
          state.herd.condition = Math.min(100, state.herd.condition + 0.08);
          return "Trough checked. Cattle drink straight away.";
        },
      },
    ],
  },
  fence_first: {
    question: "Morning: patch a fence gap before other jobs?",
    choices: [
      {
        id: "yes_fence",
        label: "Fence first",
        effect: (state) => {
          if (!state.story?.workGrid) state.story!.workGrid = defaultWorkGrid();
          state.story!.workGrid.fix_fences = 3;
          if (state.story?.infrastructure) state.story.infrastructure.fenceWear = Math.max(0, state.story.infrastructure.fenceWear - 0.05);
          return "Farmhand set to fix fences.";
        },
      },
      {
        id: "no_fence",
        label: "Leave for later",
        effect: (state) => {
          if (state.story?.infrastructure) state.story.infrastructure.fenceWear = Math.min(1, state.story.infrastructure.fenceWear + 0.02);
          return "Fence waits. Wear creeps up.";
        },
      },
    ],
  },
};

export function rollMorningDecision(state: GameState): void {
  const play = state.story?.dailyPlay;
  if (!play || play.morningDecisionAnswered) return;
  if (state.date.hour < 6 || state.date.hour > 8) return;
  const options: MorningDecisionId[] = ["lick_batch", "water_round", "fence_first"];
  const pick = options[state.date.day % options.length];
  play.morningDecisionId = pick;
  const notes = state.notifications ?? defaultNotificationState();
  state.notifications = notes;
  const copy = DECISION_COPY[pick];
  emitNotification(notes, {
    id: `morning-${state.date.year}-${state.date.month}-${state.date.day}`,
    tier: "letter",
    kind: "season",
    title: "Morning choice",
    body: copy.question,
    priority: 2,
    at: { ...state.date },
    cooldownDays: 1,
    dedupeKey: "morning_choice",
  });
}

export function answerMorningDecision(state: GameState, choiceId: string): string {
  const play = state.story?.dailyPlay;
  if (!play?.morningDecisionId || play.morningDecisionAnswered) return "No morning choice pending.";
  const block = DECISION_COPY[play.morningDecisionId];
  const choice = block.choices.find((c) => c.id === choiceId) ?? block.choices[0];
  play.morningDecisionAnswered = true;
  if (state.story?.costLevers && play.morningDecisionId === "lick_batch") {
    state.story.costLevers.lick = seasonAppropriateLick(state.date.month);
  }
  return choice.effect(state);
}

export function refreshDailyGoal(state: GameState): void {
  const play = state.story?.dailyPlay;
  if (!play) return;
  if (state.date.day === 1 || !play.goalMet) return;
  const goals = [
    { text: "Keep herd condition at 55 or better today.", target: "condition_55" },
    { text: "Let the farmhand finish a water check.", target: "water_check" },
  ];
  const g = goals[state.date.day % goals.length];
  play.goalText = g.text;
  play.goalTarget = g.target;
  play.goalProgress = 0;
  play.goalMet = false;
  play.morningDecisionAnswered = false;
  play.morningDecisionId = null;
}
