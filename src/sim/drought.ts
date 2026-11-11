import { CONFIG, type GameConfig } from "./config";
import { droughtSupplementCostNad } from "./economy";
import type { DroughtChoiceId, StoryState } from "./storyTypes";
import type { GameState } from "./types";

export function expectedRainByMonth(month: number, config: GameConfig = CONFIG): number {
  return config.rain.monthlyMeanMm[month] ?? 0;
}

export function droughtWatchScore(state: GameState, config: GameConfig = CONFIG): number {
  const month = state.date.month;
  const inRainWindow = month >= config.story.droughtWatchStartMonth || month <= 4;
  if (!inRainWindow) return 0;
  const expected =
    expectedRainByMonth(11, config) +
    expectedRainByMonth(12, config) +
    (month >= 1 ? expectedRainByMonth(1, config) : 0) +
    (month >= 2 ? expectedRainByMonth(2, config) : 0) +
    (month >= 3 ? expectedRainByMonth(3, config) : 0);
  const deficit = expected - state.seasonRainMm;
  if (deficit <= config.story.droughtDeficitWarnMm) return 0;
  return Math.min(1, deficit / (expected || 1));
}

export function tickDrought(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  const score = droughtWatchScore(state, config);
  story.drought.watchActive = score >= config.story.droughtWatchThreshold;
  if (score > 0) {
    story.drought.forageMultiplier = 1 - score * config.story.droughtForageCutMax;
  } else {
    story.drought.forageMultiplier = 1;
  }

  const month = state.date.month;
  if (
    story.drought.watchActive &&
    !story.drought.warnedAt &&
    month >= config.story.droughtWarnMonth
  ) {
    story.drought.warnedAt = { ...state.date };
    story.pendingCards.push({
      id: `drought-warn-${state.date.year}-${month}`,
      kind: "warning",
      title: "Late rains",
      body: `Season rain is ${Math.round(state.seasonRainMm)} mm, below a normal start. Mets outlook warned a hot, drier 2026/27 season.`,
      priority: 4,
    });
  }

  if (
    story.drought.watchActive &&
    score >= config.story.droughtChoiceScore &&
    story.drought.choicePending === null &&
    month >= config.story.droughtChoiceMonth
  ) {
    story.drought.choicePending = "sell_down";
    story.pendingCards.push({
      id: `drought-choice-${state.date.year}-${month}`,
      kind: "drought",
      title: "Drought building",
      body: "Choose: sell down weaners, cut boskos with camelthorn pods, or move to greener camps.",
      priority: 6,
    });
  }
}

export function resolveDroughtChoice(
  state: GameState,
  choice: DroughtChoiceId,
  config: GameConfig = CONFIG,
): { ok: boolean; message: string } {
  const story = state.story;
  if (!story) return { ok: false, message: "Missing story state." };
  if (!story.drought.choicePending) return { ok: false, message: "No drought choice pending." };

  switch (choice) {
    case "sell_down": {
      const n = Math.min(story.composition.weaner, config.story.droughtSellWeaners);
      if (n <= 0) return { ok: false, message: "No weaners to sell." };
      story.composition.weaner -= n;
      const price = n * config.economy.defaultWeanerLiveKg * config.economy.droughtQuickSaleNadPerKg;
      state.cashNad += price;
      story.ledger.incomeNad += price;
      story.drought.choicePending = null;
      return { ok: true, message: `Sold ${n} weaners out of hand for N$${Math.round(price)}.` };
    }
    case "buy_feed": {
      const cost = droughtSupplementCostNad(state, config);
      if (state.cashNad < cost) return { ok: false, message: "Not enough cash for boskos drought feed." };
      state.cashNad -= cost;
      story.ledger.expenseNad += cost;
      story.supplementDaysLeft += config.story.droughtSupplementDays;
      story.drought.choicePending = null;
      story.drought.forageMultiplier = Math.min(1, story.drought.forageMultiplier + 0.15);
      return {
        ok: true,
        message: `Boskos and camelthorn pods for ${config.story.droughtSupplementDays} days (N$${cost}).`,
      };
    }
    case "move_herd":
      story.drought.choicePending = null;
      return { ok: true, message: "Move the herd to rested camps with grass. Empty camps recover when rain returns." };
    default:
      return { ok: false, message: "Unknown choice." };
  }
}

export function hasDroughtChoice(story: StoryState): boolean {
  return story.drought.choicePending !== null;
}
