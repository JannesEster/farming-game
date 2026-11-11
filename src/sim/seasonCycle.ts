import { CONFIG, type GameConfig } from "./config";
import { daysInMonth, isRainyMonth } from "./calendar";
import { chargeMonthlyCosts, syncHeadFromComposition } from "./economy";
import type { CalendarDate } from "./types";
import type { GameState } from "./types";

export type CyclePhase =
  | "dry_season"
  | "rain_season"
  | "calving"
  | "weaning"
  | "weaner_sale";

export function cyclePhase(date: CalendarDate, config: GameConfig = CONFIG): CyclePhase {
  const m = date.month;
  if (config.calendar.weaningMonths.includes(m)) return "weaning";
  if (config.calendar.weanerSaleMonths.includes(m)) return "weaner_sale";
  if (config.calendar.calvingMonths.includes(m)) return "calving";
  return isRainyMonth(m, config) ? "rain_season" : "dry_season";
}

export function cyclePhaseLabel(phase: CyclePhase): string {
  switch (phase) {
    case "dry_season":
      return "Dry season";
    case "rain_season":
      return "Rain season";
    case "calving":
      return "Calving season";
    case "weaning":
      return "Weaning";
    case "weaner_sale":
      return "Weaner sale time";
    default:
      return "Season";
  }
}

export function isLastDayOfMonth(date: CalendarDate): boolean {
  return date.day >= daysInMonth(date.year, date.month);
}

export function monthKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

export function tryCalving(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story || story.breedingPaused) return;
  if (!config.calendar.calvingMonths.includes(state.date.month)) return;
  if (state.herd.condition < config.story.breedingMinCondition) return;
  const eventId = `calving-${monthKey(state.date)}`;
  if (story.seasonEventsFired.includes(eventId)) return;
  story.seasonEventsFired.push(eventId);
  const cows = story.composition.cow;
  if (cows < 10) return;
  const calvingRate = config.story.monthlyCalvingFraction;
  const births = Math.max(0, Math.floor(cows * calvingRate));
  if (births <= 0) return;
  story.composition.calf += births;
  syncHeadFromComposition(state);
  story.pendingCards.push({
    id: eventId,
    kind: "season",
    title: "Calving",
    body: `${births} calves on the ground. Tag and register within six months.`,
    priority: 2,
  });
}

export function tryWeaning(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  if (!config.calendar.weaningMonths.includes(state.date.month)) return;
  const eventId = `weaning-${monthKey(state.date)}`;
  if (story.seasonEventsFired.includes(eventId)) return;
  story.seasonEventsFired.push(eventId);
  const calves = story.composition.calf;
  if (calves <= 0) return;
  const wean = Math.floor(calves * config.story.weaningFraction);
  if (wean <= 0) return;
  story.composition.calf -= wean;
  story.composition.weaner += wean;
  syncHeadFromComposition(state);
  story.pendingCards.push({
    id: eventId,
    kind: "season",
    title: "Weaning",
    body: `${wean} weaners ready. Consider auction Apr to Jun.`,
    priority: 2,
  });
}

export function closeMonth(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  const key = monthKey(state.date);
  if (story.lastMonthKey === key) return;
  story.lastMonthKey = key;
  const costs = chargeMonthlyCosts(state, config);
  const phase = cyclePhase(state.date, config);
  const net = story.ledger.incomeNad - story.ledger.expenseNad;
  const money = (amount: number) => {
    const rounded = Math.round(amount);
    const sign = rounded < 0 ? "-" : "";
    const body = Math.abs(rounded).toLocaleString("en-NA");
    return `N$${sign}${body}`;
  };
  const body = [
    `${cyclePhaseLabel(phase)} ended.`,
    `Income ${money(story.ledger.incomeNad)}. Expenses ${money(story.ledger.expenseNad)}.`,
    `Costs: labour ${money(costs.labour)}, lick ${money(costs.lick)}, diesel ${money(costs.diesel)}, repairs ${money(costs.repairs)}, other ${money(costs.other)}.`,
    `Net ${money(net)}. Rain season-to-date ${Math.round(state.seasonRainMm)} mm.`,
    story.ledger.deathCount > 0 ? `${story.ledger.deathCount} deaths logged.` : "No deaths logged.",
    story.composition.weaner > 0 ? `${story.composition.weaner} weaners in herd.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  story.pendingCards.push({
    id: `month-${key}`,
    kind: "summary",
    title: `Month in review`,
    body,
    priority: 5,
  });

  story.ledger = {
    incomeNad: 0,
    expenseNad: 0,
    sales: [],
    deathCount: 0,
    notes: [],
  };
}

export function weeklyDigest(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  if (state.date.day % 7 !== 0) return;
  const lines: string[] = [];
  if (story.lastDailyNote) lines.push(story.lastDailyNote);
  const phase = cyclePhaseLabel(cyclePhase(state.date, config));
  lines.push(phase);
  if (state.herd.condition < 40) lines.push(`Condition ${Math.round(state.herd.condition)}%`);
  story.pendingCards.push({
    id: `week-${state.date.year}-${state.date.month}-${state.date.day}`,
    kind: "weekly",
    title: "Week on the farm",
    body: lines.join(" · "),
    priority: 1,
  });
}
