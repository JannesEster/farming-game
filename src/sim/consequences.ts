import { CONFIG, type GameConfig } from "./config";
import { moveAdvice } from "./grazing";
import { grazeableFraction } from "./pasture";
import { findCamp } from "./simulation";
import { syncHeadFromComposition } from "./economy";
import type { StoryState } from "./storyTypes";
import type { CampState, GameState } from "./types";

export type FeedContext = {
  eatenKg: number;
  demandKg: number;
  grazeable: number;
};

export function isPoorFeed(ctx: FeedContext, config: GameConfig = CONFIG): boolean {
  const ratio = ctx.demandKg <= 0 ? 1 : ctx.eatenKg / ctx.demandKg;
  return (
    ratio < config.story.poorFeedIntakeRatio ||
    (ctx.grazeable < config.story.poorFeedGrazeable && ratio < 0.5)
  );
}

export function starvationWarningLevel(days: number, config: GameConfig = CONFIG): 0 | 1 | 2 | 3 {
  if (days < config.story.warnPoorFeedDays1) return 0;
  if (days < config.story.warnPoorFeedDays2) return 1;
  if (days < config.story.warnPoorFeedDays3) return 2;
  return 3;
}

export function applyStarvationDay(state: GameState, ctx: FeedContext, config: GameConfig = CONFIG): string[] {
  const story = state.story;
  if (!story) return [];
  const notes: string[] = [];
  const poor = isPoorFeed(ctx, config);

  if (poor) story.starvation.consecutivePoorFeedDays += 1;
  else story.starvation.consecutivePoorFeedDays = 0;

  const level = starvationWarningLevel(story.starvation.consecutivePoorFeedDays, config);
  const prev = story.starvation.warningLevel;
  story.starvation.warningLevel = level;

  if (level >= 1 && level > prev) {
    const msg =
      level === 1
        ? `${story.starvation.consecutivePoorFeedDays} days on bare veld. Move or sell before condition slips.`
        : level === 2
          ? `Herd losing weight. Sale prices will fall while condition stays low.`
          : `Critical feed shortage. Calving stops; deaths loom without rain or feed.`;
    story.pendingCards.push({
      id: `starve-warn-${state.date.year}-${state.date.month}-${state.date.day}-${level}`,
      kind: "warning",
      title: level === 3 ? "Herd in trouble" : "Feed warning",
      body: msg,
      priority: level,
    });
    notes.push(msg);
  }

  if (poor && story.starvation.consecutivePoorFeedDays >= config.story.weightLossStartsDay) {
    const loss = config.story.dailyWeightLossKg;
    state.herd.averageLiveweightKg = Math.max(
      config.story.minAverageLiveweightKg,
      state.herd.averageLiveweightKg - loss,
    );
  }

  if (level >= 3) story.breedingPaused = true;
  else if (!poor && state.herd.condition > config.story.breedingResumeCondition) story.breedingPaused = false;

  if (
    level >= 3 &&
    story.starvation.consecutivePoorFeedDays >= config.story.deathStartsDay &&
    state.herd.condition <= config.story.deathMaxCondition
  ) {
    const rate = config.story.dailyDeathRateAtZeroCondition;
    const deaths = Math.max(0, Math.ceil(state.herd.headCount * rate));
    if (deaths > 0) applyDeaths(state, deaths, "starvation");
    if (deaths > 0) notes.push(`${deaths} head lost to starvation.`);
  }

  return notes;
}

function applyDeaths(state: GameState, count: number, _cause: string): void {
  const story = state.story!;
  const order: (keyof typeof story.composition)[] = [
    "calf",
    "heifer",
    "tolly",
    "stoor",
    "ox",
    "pregnant_heifer",
    "cow",
    "bull",
  ];
  let left = count;
  for (const cls of order) {
    if (left <= 0) break;
    const take = Math.min(story.composition[cls], left);
    story.composition[cls] -= take;
    left -= take;
  }
  story.starvation.totalDeathsSeason += count - left;
  story.ledger.deathCount += count - left;
  syncHeadFromComposition(state);
}

function campHasTrough(state: GameState, camp: CampState): boolean {
  const tiles = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
  return state.features.some((feature) => feature.kind === "trough" && tiles.has(`${feature.x},${feature.y}`));
}

/**
 * Overgrazing and a dry camp warn before any death.
 * Thirst has no sourced death rate, so a missing trough warns and does not invent mortality.
 */
export function queueHusbandryWarnings(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  const camp = findCamp(state, state.herd.campId);
  if (!camp) return;

  if (story.thirstWarnCampId !== null && story.thirstWarnCampId !== camp.id) story.thirstWarnCampId = null;
  if (!campHasTrough(state, camp) && story.thirstWarnCampId !== camp.id) {
    story.thirstWarnCampId = camp.id;
    story.pendingCards.push({
      id: `thirst-${camp.id}-${state.date.year}-${state.date.month}-${state.date.day}`,
      kind: "warning",
      title: "Water warning",
      body: "This camp has no trough. Move the herd to water before you trust this grass.",
      priority: 4,
    });
  }

  if (story.moveWarnCampId !== null && story.moveWarnCampId !== camp.id) story.moveWarnCampId = null;
  const advice = moveAdvice(state.herd, camp, state.date, config);
  if (!advice.shouldWarn) return;
  if (story.moveWarnCampId === camp.id) return;
  story.moveWarnCampId = camp.id;
  const body =
    advice.reason === "time"
      ? "This camp has had its graze spell. Move the herd so the grass can rest."
      : "This camp is overgrazed. Move the herd before they go hungry.";
  story.pendingCards.push({
    id: `move-${camp.id}-${state.date.year}-${state.date.month}-${state.date.day}`,
    kind: "warning",
    title: "Time to move",
    body,
    priority: 4,
  });
}

export function feedContextForHerd(state: GameState, config: GameConfig = CONFIG): FeedContext {
  const camp = findCamp(state, state.herd.campId);
  const grazeable = camp ? grazeableFraction(camp, config) : 0;
  const story = state.story;
  return {
    eatenKg: story?.eatenYesterdayKg ?? 0,
    demandKg: story?.demandYesterdayKg ?? 0,
    grazeable,
  };
}

export function weeklyStarvationSummary(story: StoryState): string | null {
  if (story.starvation.consecutivePoorFeedDays === 0 && story.ledger.deathCount === 0) return null;
  const parts: string[] = [];
  if (story.starvation.consecutivePoorFeedDays > 0) {
    parts.push(`${story.starvation.consecutivePoorFeedDays} days short on grass`);
  }
  if (story.ledger.deathCount > 0) parts.push(`${story.ledger.deathCount} deaths this month`);
  return parts.length ? parts.join("; ") : null;
}
