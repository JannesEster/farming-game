import { isRainyMonth } from "./calendar";
import { CONFIG, type GameConfig } from "./config";
import type { CalendarDate } from "./types";
import type { GameState } from "./types";
import type { ClassLiveweights, HerdComposition, StockClass, StoryState } from "./storyTypes";
import { syncHeadFromComposition } from "./economy";

export type GrowerStockClass = "heifer" | "tolly" | "stoor" | "ox";

export const GROWER_CLASSES: GrowerStockClass[] = ["heifer", "tolly", "stoor", "ox"];

export const SELL_STOCK_CLASSES: StockClass[] = [
  "heifer",
  "pregnant_heifer",
  "tolly",
  "stoor",
  "ox",
  "cow",
  "calf",
  "bull",
];

export const STOCK_CLASS_LABELS: Record<StockClass, string> = {
  heifer: "Heifers",
  pregnant_heifer: "Pregnant heifers",
  tolly: "Tollies",
  stoor: "Stoors",
  ox: "Oxen",
  cow: "Cows",
  calf: "Calves",
  bull: "Bulls",
};

export const STOCK_CLASS_TOOLTIPS: Record<StockClass, string> = {
  heifer: "Open heifers. Slower growth than steers; lower live price at slaughter.",
  pregnant_heifer: "Heifers in calf. Higher slaughter price than open heifers.",
  tolly: "Young steers from weaning, about 180 to 299 kg live.",
  stoor: "Steers ready for feedlots, about 300 to 399 kg live.",
  ox: "Finished steers from about 400 kg live.",
  cow: "Breeding cows and mature females in the herd.",
  calf: "Calves still on cows before weaning.",
  bull: "Breeding bulls.",
};

export function emptyComposition(): HerdComposition {
  return {
    cow: 0,
    bull: 0,
    calf: 0,
    heifer: 0,
    pregnant_heifer: 0,
    tolly: 0,
    stoor: 0,
    ox: 0,
  };
}

export function totalCompositionHead(composition: HerdComposition): number {
  return (
    composition.cow +
    composition.bull +
    composition.calf +
    composition.heifer +
    composition.pregnant_heifer +
    composition.tolly +
    composition.stoor +
    composition.ox
  );
}

export function defaultClassLiveweights(config: GameConfig = CONFIG): ClassLiveweights {
  const weanKg = config.economy.defaultWeanerLiveKg;
  return {
    heifer: weanKg,
    tolly: weanKg,
    stoor: (config.cattle.stoorWeightMinKg + config.cattle.stoorWeightMaxKg) / 2,
    ox: config.cattle.oxWeightMinKg,
  };
}

/**
 * Rain season Dec to Apr for tolly price. TODO: confirm with Reuben which price
 * belongs to wet vs dry ends of the N$32 to N$38/kg band.
 * Game assumption: wet months Dec to Apr use the high end (N$38).
 */
export function isTollyWetPriceSeason(date: CalendarDate, config: GameConfig = CONFIG): boolean {
  const wetMonths = config.cattle.tollyWetPriceMonths;
  return wetMonths.includes(date.month);
}

export function tollyNadPerKgLive(date: CalendarDate, config: GameConfig = CONFIG): number {
  return isTollyWetPriceSeason(date, config)
    ? config.cattle.tollyNadPerKgWetSeason
    : config.cattle.tollyNadPerKgDrySeason;
}

export function growerStockClassForWeight(kg: number, config: GameConfig = CONFIG): GrowerStockClass {
  if (kg >= config.cattle.oxWeightMinKg) return "ox";
  if (kg >= config.cattle.stoorWeightMinKg) return "stoor";
  return "tolly";
}

export function splitWeanersToHeiferAndTolly(weanerCount: number): { heifer: number; tolly: number } {
  const heifer = Math.floor(weanerCount / 2);
  return { heifer, tolly: weanerCount - heifer };
}

/** Classify a legacy ox count using one liveweight (saved herd average). */
export function classifyLegacyOxenByWeight(
  count: number,
  liveKg: number,
  config: GameConfig = CONFIG,
): Pick<HerdComposition, "tolly" | "stoor" | "ox"> {
  if (count <= 0) return { tolly: 0, stoor: 0, ox: 0 };
  const bucket = growerStockClassForWeight(liveKg, config);
  return {
    tolly: bucket === "tolly" ? count : 0,
    stoor: bucket === "stoor" ? count : 0,
    ox: bucket === "ox" ? count : 0,
  };
}

export type LegacyComposition = HerdComposition & {
  weaner?: number;
};

export function migrateLegacyComposition(
  legacy: LegacyComposition,
  herdLiveKg: number,
  config: GameConfig = CONFIG,
): { composition: HerdComposition; classLiveweights: ClassLiveweights } {
  const composition = emptyComposition();
  composition.cow = legacy.cow ?? 0;
  composition.bull = legacy.bull ?? 0;
  composition.calf = legacy.calf ?? 0;
  composition.heifer = legacy.heifer ?? 0;
  composition.pregnant_heifer = legacy.pregnant_heifer ?? 0;
  const legacyOx = (legacy as { ox?: number }).ox ?? 0;
  const legacyWeaner = (legacy as { weaner?: number }).weaner;
  const hasNewClasses = legacy.tolly !== undefined || legacy.heifer !== undefined;

  if (hasNewClasses) {
    composition.tolly = legacy.tolly ?? 0;
    composition.stoor = legacy.stoor ?? 0;
    composition.ox = legacyOx;
  } else if (legacyOx > 0) {
    const splitOx = classifyLegacyOxenByWeight(legacyOx, herdLiveKg, config);
    composition.tolly = splitOx.tolly;
    composition.stoor = splitOx.stoor;
    composition.ox = splitOx.ox;
  }

  if (legacyWeaner !== undefined && legacyWeaner > 0) {
    const split = splitWeanersToHeiferAndTolly(legacyWeaner);
    composition.heifer += split.heifer;
    composition.tolly += split.tolly;
  }

  return { composition, classLiveweights: defaultClassLiveweights(config) };
}

function blendWeight(prevAvg: number, prevCount: number, incomingKg: number): number {
  if (prevCount <= 0) return incomingKg;
  return (prevAvg * prevCount + incomingKg) / (prevCount + 1);
}

export function reclassifyGrowersByWeight(story: StoryState, config: GameConfig = CONFIG): void {
  const weights = story.classLiveweights;
  if (story.composition.tolly > 0 && weights.tolly >= config.cattle.stoorWeightMinKg) {
    story.composition.tolly -= 1;
    const stoorCount = story.composition.stoor + 1;
    weights.stoor = blendWeight(weights.stoor, story.composition.stoor, weights.tolly);
    story.composition.stoor = stoorCount;
  }
  if (story.composition.stoor > 0 && weights.stoor >= config.cattle.oxWeightMinKg) {
    story.composition.stoor -= 1;
    const oxCount = story.composition.ox + 1;
    weights.ox = blendWeight(weights.ox, story.composition.ox, weights.stoor);
    story.composition.ox = oxCount;
  }
}

export function applyYoungstockGrowth(
  state: GameState,
  intakeRatio: number,
  config: GameConfig = CONFIG,
  ecologyScale = 1,
): void {
  const story = state.story;
  if (!story) return;
  const weights = story.classLiveweights;
  const fed = intakeRatio >= config.story.poorFeedIntakeRatio;
  const delta = (
    fed
      ? config.cattle.dailyYoungstockGainKg * Math.min(1, intakeRatio)
      : -config.story.dailyWeightLossKg
  ) * ecologyScale;

  for (const cls of GROWER_CLASSES) {
    if (story.composition[cls] <= 0) continue;
    weights[cls] = Math.max(config.cattle.tollyWeightMinKg, weights[cls] + delta);
  }

  if (fed && story.composition.heifer > 0) {
    weights.heifer = Math.min(config.cattle.stoorWeightMaxKg, weights.heifer);
  }

  reclassifyGrowersByWeight(story, config);
}

export function tryMarkPregnantHeifers(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story || story.breedingPaused) return;
  if (state.date.month !== config.cattle.heiferBreedingMonth) return;
  if (state.herd.condition < config.story.breedingMinCondition) return;
  const eventId = `heifer-breed-${state.date.year}`;
  if (story.seasonEventsFired.includes(eventId)) return;
  story.seasonEventsFired.push(eventId);
  const open = story.composition.heifer;
  if (open <= 0) return;
  const pregnant = Math.max(0, Math.floor(open * config.cattle.heiferPregnancyFraction));
  if (pregnant <= 0) return;
  story.composition.heifer -= pregnant;
  story.composition.pregnant_heifer += pregnant;
  syncHeadFromComposition(state);
}

export function calvingFromPregnantHeifers(state: GameState, config: GameConfig = CONFIG): number {
  const story = state.story;
  if (!story) return 0;
  const ready = story.composition.pregnant_heifer;
  if (ready <= 0) return 0;
  const calved = Math.max(0, Math.floor(ready * config.cattle.heiferCalvingFraction));
  if (calved <= 0) return 0;
  story.composition.pregnant_heifer -= calved;
  story.composition.cow += calved;
  story.composition.calf += calved;
  syncHeadFromComposition(state);
  return calved;
}

export function compositionSummaryLine(composition: HerdComposition): string {
  const parts: string[] = [];
  const push = (label: string, n: number) => {
    if (n > 0) parts.push(`${label} ${n}`);
  };
  push("cows", composition.cow);
  push("bulls", composition.bull);
  push("calves", composition.calf);
  push("heifers", composition.heifer);
  push("preg. heifers", composition.pregnant_heifer);
  push("tollies", composition.tolly);
  push("stoors", composition.stoor);
  push("oxen", composition.ox);
  return parts.join(", ");
}

export function isLegacyRainMonthForTests(month: number, config: GameConfig = CONFIG): boolean {
  return isRainyMonth(month, config);
}
