import { CONFIG, type GameConfig } from "./config";
import {
  tollyNadPerKgLive,
  totalCompositionHead,
} from "./cattleClasses";
import type { SaleChannel, SaleLine, StockClass } from "./storyTypes";
import type { GameState } from "./types";

/**
 * Liveweight prices (N$/kg live). See docs/STORY_RULES_REPORT.md for sources.
 */

export type PriceQuote = {
  baseNadPerKgLive: number;
  source: "sourced" | "placeholder";
  note: string;
};

export type MonthlyCostBreakdown = {
  total: number;
  labour: number;
  lick: number;
  diesel: number;
  repairs: number;
  other: number;
  lines: string[];
};

export function farmHectares(state: GameState, config: GameConfig = CONFIG): number {
  return state.farmMeta?.hectares ?? config.farm.hectares;
}

export function operatingCostScale(
  hectares: number,
  head: number,
  config: GameConfig = CONFIG,
): number {
  const haR = hectares / config.economy.operatingCostAnchorHectares;
  const headR = head / config.economy.operatingCostAnchorHead;
  const haPart = Math.pow(Math.max(0.01, haR), config.economy.operatingCostHaExponent);
  const headPart = Math.pow(Math.max(0.01, headR), config.economy.operatingCostHeadExponent);
  return haPart * headPart;
}

export function monthlyOperatingTotalNad(
  state: GameState,
  config: GameConfig = CONFIG,
): number {
  const scale = operatingCostScale(farmHectares(state, config), state.herd.headCount, config);
  return config.economy.operatingCostAnchorMonthlyNad * scale;
}

export function monthlyOperatingCosts(state: GameState, config: GameConfig = CONFIG): MonthlyCostBreakdown {
  const totalBase = monthlyOperatingTotalNad(state, config);
  const labourShare =
    totalBase * config.economy.operatingCostShareLabour +
    (state.story?.farmhand.hired ? state.story.farmhand.wageCashNad : 0);
  const lick = totalBase * config.economy.operatingCostShareLick;
  const diesel = totalBase * config.economy.operatingCostShareDiesel;
  const repairs = totalBase * config.economy.operatingCostShareRepairs;
  const other =
    totalBase * config.economy.operatingCostShareOther +
    config.economy.stateVetAdminNadPerMonth +
    (state.herd.headCount * config.economy.vaccineNadPerHeadPerYear) / 12;

  const labour = labourShare;
  const total = labour + lick + diesel + repairs + other;

  const lines = [
    `Labour N$${Math.round(labour)}`,
    `Lick N$${Math.round(lick)}`,
    `Diesel N$${Math.round(diesel)}`,
    `Repairs N$${Math.round(repairs)}`,
    `Other N$${Math.round(other)}`,
  ];
  return { total, labour, lick, diesel, repairs, other, lines };
}

export function droughtSupplementCostNad(state: GameState, config: GameConfig = CONFIG): number {
  const head = state.herd.headCount;
  const days = config.story.droughtSupplementDays;
  const boskosKg = head * config.story.droughtBoskosKgPerHeadDay * days;
  const boskosCost = boskosKg * config.story.droughtBoskosNadPerKg;
  return Math.round(boskosCost);
}

export function baseLivePrice(
  stockClass: StockClass,
  config: GameConfig = CONFIG,
  state?: GameState,
): PriceQuote {
  switch (stockClass) {
    case "heifer":
      return {
        baseNadPerKgLive: config.cattle.heiferOpenNadPerKgLive,
        source: "sourced",
        note: "Jannes and Reuben, farm data, 12 Nov 2026",
      };
    case "pregnant_heifer":
      return {
        baseNadPerKgLive: config.cattle.heiferPregnantNadPerKgLive,
        source: "sourced",
        note: "Jannes and Reuben, farm data, 12 Nov 2026",
      };
    case "tolly": {
      const date = state?.date ?? { year: config.calendar.startYear, month: config.calendar.startMonth, day: 1, hour: 0 };
      const price = tollyNadPerKgLive(date, config);
      return {
        baseNadPerKgLive: price,
        source: "sourced",
        note: "Jannes tollies band; TODO confirm wet/dry mapping with Reuben",
      };
    }
    case "stoor":
      return {
        baseNadPerKgLive: config.cattle.stoorNadPerKgLive,
        source: "placeholder",
        note: "TODO confirm with Reuben; midpoint between tolly and ox",
      };
    case "ox":
      return {
        baseNadPerKgLive: config.cattle.oxNadPerKgLive,
        source: "sourced",
        note: "Jannes and Reuben, farm data, 12 Nov 2026",
      };
    case "cow":
      return { baseNadPerKgLive: 27.9, source: "sourced", note: "NAU 2025 lean cows live" };
    case "calf":
      return {
        baseNadPerKgLive: 33.5,
        source: "sourced",
        note: "NAU 2025 calves 1 to 350 kg N$33.50/kg live",
      };
    case "bull":
      return {
        baseNadPerKgLive: 33.93,
        source: "sourced",
        note: "NAU 2025 bulls 501 to 600 kg auction",
      };
    default:
      return { baseNadPerKgLive: 25, source: "placeholder", note: "TODO" };
  }
}

export function classLiveweightKg(
  stockClass: StockClass,
  state: GameState,
  config: GameConfig = CONFIG,
): number {
  const story = state.story;
  const weights = story?.classLiveweights;
  switch (stockClass) {
    case "calf":
      return Math.max(120, state.herd.averageLiveweightKg * 0.35);
    case "heifer":
      return weights?.heifer ?? config.economy.defaultWeanerLiveKg;
    case "pregnant_heifer":
      return weights?.heifer ?? config.economy.defaultWeanerLiveKg;
    case "tolly":
      return weights?.tolly ?? config.economy.defaultWeanerLiveKg;
    case "stoor":
      return weights?.stoor ?? (config.cattle.stoorWeightMinKg + config.cattle.stoorWeightMaxKg) / 2;
    case "ox":
      return weights?.ox ?? config.cattle.oxWeightMinKg;
    case "bull":
      return config.pasture.lsuLiveweightKg * 1.1;
    case "cow":
      return config.pasture.lsuLiveweightKg * 0.95;
    default:
      return state.herd.averageLiveweightKg;
  }
}

export function conditionPriceFactor(condition: number): number {
  const c = Math.max(0, Math.min(100, condition));
  if (c >= 70) return 1;
  if (c >= 50) return 0.92;
  if (c >= 30) return 0.82;
  if (c >= 15) return 0.7;
  return 0.55;
}

export function channelPriceFactor(channel: SaleChannel, config: GameConfig = CONFIG): number {
  switch (channel) {
    case "auction":
      return 1;
    case "speculator":
      return 0.94;
    case "feedlot":
      return config.economy.feedlotPriceFactor;
    default:
      return 1;
  }
}

export function sellingCosts(
  totalNad: number,
  channel: SaleChannel,
  headCount: number,
  config: GameConfig = CONFIG,
): number {
  let levy = totalNad * config.economy.llpbnLevyRate;
  let commission = 0;
  let grading = 0;
  if (channel === "auction") {
    commission = totalNad * config.economy.auctionCommissionRate;
    grading = headCount * config.economy.ncaGradingNadPerHead;
  }
  if (channel === "feedlot") {
    levy = totalNad * config.economy.liveExportLevyRate;
  }
  return levy + commission + grading;
}

export function quoteSale(
  state: GameState,
  stockClass: StockClass,
  count: number,
  channel: SaleChannel,
  config: GameConfig = CONFIG,
): SaleLine | { reason: string } {
  const story = state.story;
  if (!story) return { reason: "missing story" };
  const available = story.composition[stockClass] ?? 0;
  if (count <= 0 || count > available) return { reason: "not enough animals" };
  const base = baseLivePrice(stockClass, config, state);
  const lw = classLiveweightKg(stockClass, state, config);
  const unit =
    base.baseNadPerKgLive * lw * conditionPriceFactor(state.herd.condition) * channelPriceFactor(channel, config);
  const gross = unit * count;
  const costs = sellingCosts(gross, channel, count, config);
  return {
    stockClass,
    count,
    channel,
    pricePerKgLive:
      base.baseNadPerKgLive * conditionPriceFactor(state.herd.condition) * channelPriceFactor(channel, config),
    totalNad: Math.max(0, gross - costs),
  };
}

export function applySale(state: GameState, line: SaleLine): void {
  const story = state.story;
  if (!story) return;
  story.composition[line.stockClass] -= line.count;
  state.cashNad += line.totalNad;
  story.ledger.incomeNad += line.totalNad;
  story.ledger.sales.push(line);
  syncHeadFromComposition(state);
}

export function syncHeadFromComposition(state: GameState): void {
  const c = state.story?.composition;
  if (!c) return;
  state.herd.headCount = Math.max(0, totalCompositionHead(c));
}

export function chargeMonthlyCosts(state: GameState, config: GameConfig = CONFIG): MonthlyCostBreakdown {
  const story = state.story;
  const costs = monthlyOperatingCosts(state, config);
  if (!story) return costs;
  state.cashNad -= costs.total;
  story.ledger.expenseNad += costs.total;
  story.ledger.notes.push(`Running costs N$${Math.round(costs.total)}`);
  return costs;
}
