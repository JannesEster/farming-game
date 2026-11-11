import { CONFIG, type GameConfig } from "./config";
import { calvingFromPregnantHeifers } from "./cattleClasses";
import { addDays, daysInMonth, isRainyMonth } from "./calendar";
import { chargeMonthlyCosts, syncHeadFromComposition } from "./economy";
import { formatNad } from "./format";
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

/** Line for month review only when the ranch cycle phase changes across the month end. */
export function monthPhaseTransitionLine(date: CalendarDate, config: GameConfig = CONFIG): string | null {
  const endPhase = cyclePhase(date, config);
  const next = addDays(date, 1);
  if (next.month === date.month) return null;
  const startPhase = cyclePhase(next, config);
  if (endPhase === startPhase) return null;
  return `${cyclePhaseLabel(endPhase)} turns to ${cyclePhaseLabel(startPhase)}.`;
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
  const calvingRate = config.story.monthlyCalvingFraction;
  const births = cows >= 10 ? Math.max(0, Math.floor(cows * calvingRate)) : 0;
  const heiferBirths = calvingFromPregnantHeifers(state, config);
  const total = births + heiferBirths;
  if (total <= 0) return;
  story.composition.calf += births;
  syncHeadFromComposition(state);
  const heiferNote =
    heiferBirths > 0 ? ` ${heiferBirths} heifers calved and joined the cow herd.` : "";
  story.pendingCards.push({
    id: eventId,
    kind: "season",
    title: "Calving",
    body: `${births} calves on the ground.${heiferNote} Tag and register within six months.`,
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
  const heifers = Math.floor(wean / 2);
  const tollies = wean - heifers;
  story.composition.calf -= wean;
  story.composition.heifer += heifers;
  story.composition.tolly += tollies;
  story.classLiveweights.heifer = config.economy.defaultWeanerLiveKg;
  story.classLiveweights.tolly = config.economy.defaultWeanerLiveKg;
  syncHeadFromComposition(state);
  story.pendingCards.push({
    id: eventId,
    kind: "season",
    title: "Weaning",
    body: `${wean} weaned: ${heifers} heifers and ${tollies} tollies. Consider sales Apr to Jun.`,
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
  const net = story.ledger.incomeNad - story.ledger.expenseNad;
  const lines: string[] = [];
  const transition = monthPhaseTransitionLine(state.date, config);
  if (transition) lines.push(transition);
  lines.push(`Income ${formatNad(story.ledger.incomeNad)}. Expenses ${formatNad(story.ledger.expenseNad)}.`);
  lines.push("Costs");
  lines.push(`Labour ${formatNad(costs.labour)}`);
  lines.push(`Lick ${formatNad(costs.lick)}`);
  lines.push(`Diesel ${formatNad(costs.diesel)}`);
  lines.push(`Repairs ${formatNad(costs.repairs)}`);
  lines.push(`Other ${formatNad(costs.other)}`);
  lines.push(`Net ${formatNad(net)}. Rain season-to-date ${Math.round(state.seasonRainMm)} mm.`);
  if (story.ledger.deathCount > 0) lines.push(`${story.ledger.deathCount} deaths logged.`);
  else lines.push("No deaths logged.");
  if (story.composition.tolly + story.composition.heifer > 0) {
    lines.push(`${story.composition.tolly} tollies, ${story.composition.heifer} heifers in herd.`);
  }
  const body = lines.join("\n");

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
