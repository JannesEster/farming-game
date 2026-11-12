import { CONFIG, type GameConfig } from "./config";
import {
  applyYoungstockGrowth,
  defaultClassLiveweights,
  emptyComposition,
  totalCompositionHead,
  tryMarkPregnantHeifers,
} from "./cattleClasses";
import { applyStarvationDay, feedContextForHerd, queueHusbandryWarnings } from "./consequences";
import { tickDrought, droughtWatchScore } from "./drought";
import { farmhandWaterBonus, tickFarmhand } from "./workers";
import { isLastGameDayOfMonth } from "./calendar";
import {
  closeMonth,
  tryCalving,
  tryWeaning,
  weeklyDigest,
  cyclePhase,
  cyclePhaseLabel,
} from "./seasonCycle";
import type { GameState } from "./types";
import type { HerdComposition, StoryState } from "./storyTypes";

export function defaultComposition(headCount: number, config: GameConfig = CONFIG): HerdComposition {
  const composition = emptyComposition();
  const bulls = Math.max(2, Math.floor(headCount * config.story.bullFraction));
  const calves = Math.max(10, Math.floor(headCount * config.story.calfFraction));
  const young = Math.max(8, Math.floor(headCount * config.story.weanerFraction));
  const heifers = Math.floor(young / 2);
  const tollies = young - heifers;
  const growers = Math.max(4, Math.floor(headCount * config.story.oxFraction));
  composition.bull = bulls;
  composition.calf = calves;
  composition.heifer = heifers;
  composition.tolly = tollies;
  composition.ox = growers;
  composition.cow = Math.max(0, headCount - totalCompositionHead(composition));
  return composition;
}

export function createStoryState(headCount: number, config: GameConfig = CONFIG): StoryState {
  return {
    composition: defaultComposition(headCount, config),
    classLiveweights: defaultClassLiveweights(config),
    starvation: { consecutivePoorFeedDays: 0, warningLevel: 0, totalDeathsSeason: 0 },
    drought: { watchActive: false, choicePending: null, warnedAt: null, forageMultiplier: 1 },
    farmhand: {
      hired: false,
      job: null,
      daysUntilPayroll: config.economy.payrollIntervalDays,
      wageCashNad: config.economy.farmhandMonthlyCashNad,
    },
    breedingPaused: false,
    supplementDaysLeft: 0,
    lastMonthKey: "",
    ledger: { incomeNad: 0, expenseNad: 0, sales: [], deathCount: 0, notes: [] },
    pendingCards: [],
    lastDailyNote: null,
    seasonEventsFired: [],
    eatenYesterdayKg: 0,
    demandYesterdayKg: 0,
    moveWarnCampId: null,
    thirstWarnCampId: null,
  };
}

const BLOCKING_CARD_KINDS = new Set(["drought", "critical"]);

/** A card the player must read before the clock may move on. Weekly notes stay as toasts. */
export function hasBlockingCard(state: GameState): boolean {
  return Boolean(state.story?.pendingCards.some((card) => BLOCKING_CARD_KINDS.has(card.kind)));
}

export function afterFeedDay(
  state: GameState,
  eatenKg: number,
  demandKg: number,
  config: GameConfig = CONFIG,
  ecologyScale = 1,
): void {
  if (!state.story) state.story = createStoryState(state.herd.headCount, config);
  state.story.eatenYesterdayKg = eatenKg;
  state.story.demandYesterdayKg = demandKg;
  queueHusbandryWarnings(state, config);

  const intakeRatio = demandKg <= 0 ? 1 : eatenKg / demandKg;
  applyYoungstockGrowth(state, intakeRatio, config, ecologyScale);

  if (state.story.supplementDaysLeft > 0) {
    state.story.supplementDaysLeft -= 1;
    state.herd.condition = Math.min(
      config.herd.conditionMax,
      state.herd.condition + config.story.supplementConditionPerDay,
    );
  }

  const bonus = farmhandWaterBonus(state, config);
  if (bonus > 0) {
    state.herd.condition = Math.min(config.herd.conditionMax, state.herd.condition + bonus);
  }

  const notes = applyStarvationDay(state, feedContextForHerd(state, config), config);
  if (notes.length) state.story.lastDailyNote = notes[notes.length - 1];

  tryMarkPregnantHeifers(state, config);
  tryCalving(state, config);
  tryWeaning(state, config);
  tickDrought(state, config);
  const farmNote = tickFarmhand(state, config);
  if (farmNote) state.story.lastDailyNote = farmNote;
  weeklyDigest(state, config);

  if (isLastGameDayOfMonth(state, config)) closeMonth(state, config);
}

export function seasonLabelForHud(state: GameState, config: GameConfig = CONFIG): string {
  const phase = cyclePhase(state.date, config);
  let label = cyclePhaseLabel(phase);
  if (state.story?.drought.watchActive && droughtWatchScore(state, config) > 0.35) {
    label += " · drought watch";
  }
  return label;
}

export function popNextCard(state: GameState): StoryState["pendingCards"][0] | null {
  const story = state.story;
  if (!story || story.pendingCards.length === 0) return null;
  story.pendingCards.sort((a, b) => b.priority - a.priority);
  return story.pendingCards.shift() ?? null;
}
