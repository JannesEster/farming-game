import { CONFIG, type GameConfig } from "./config";
import type { SaleChannel, SaleLine, StockClass } from "./storyTypes";
import type { GameState } from "./types";

/**
 * Liveweight prices (N$/kg live). See docs/STORY_RULES_REPORT.md for NAU / Reuben sources.
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
  // Camelthorn pods: gathered on farm; no sourced cash price (TODO in report).
  return Math.round(boskosCost);
}

export function baseLivePrice(stockClass: StockClass, _config: GameConfig = CONFIG): PriceQuote {
  switch (stockClass) {
    case "weaner":
      // S: NAU Ox Production 2025 weaner/tollies auction N$32.81/kg live (mid of 32.81 to 34.83 band).
      return { baseNadPerKgLive: 33.32, source: "sourced", note: "NAU 2025 weaner auction band" };
    case "ox":
      // S: NAU live oxen 401 to 600 kg class N$40.17/kg live.
      return { baseNadPerKgLive: 40.17, source: "sourced", note: "NAU 2025 ox 401 to 600 kg auction" };
    case "cow":
      // S: NAU lean cows 301 to 500 kg N$27.90/kg live.
      return { baseNadPerKgLive: 27.9, source: "sourced", note: "NAU 2025 lean cows live" };
    case "calf":
      return {
        baseNadPerKgLive: 33.5,
        source: "sourced",
        note: "NAU 2025 calves 1 to 350 kg N$33.50/kg live",
      };
    case "bull":
      // S: NAU Bulls 501 to 600 kg N$33.93/kg live at auction.
      return {
        baseNadPerKgLive: 33.93,
        source: "sourced",
        note: "NAU 2025 bulls 501 to 600 kg auction",
      };
    default:
      return { baseNadPerKgLive: 25, source: "placeholder", note: "TODO" };
  }
}

export function classLiveweightKg(stockClass: StockClass, herdAvgKg: number, config: GameConfig = CONFIG): number {
  switch (stockClass) {
    case "calf":
      return Math.max(120, herdAvgKg * 0.35);
    case "weaner":
      return config.economy.defaultWeanerLiveKg;
    case "ox":
      return config.pasture.lsuLiveweightKg;
    case "bull":
      return config.pasture.lsuLiveweightKg * 1.1;
    case "cow":
      return config.pasture.lsuLiveweightKg * 0.95;
    default:
      return herdAvgKg;
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
  const base = baseLivePrice(stockClass, config);
  const lw = classLiveweightKg(stockClass, state.herd.averageLiveweightKg, config);
  const unit =
    base.baseNadPerKgLive * lw * conditionPriceFactor(state.herd.condition) * channelPriceFactor(channel, config);
  const gross = unit * count;
  const costs = sellingCosts(gross, channel, count, config);
  return {
    stockClass,
    count,
    channel,
    pricePerKgLive: base.baseNadPerKgLive * conditionPriceFactor(state.herd.condition) * channelPriceFactor(channel, config),
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
  const total = c.cow + c.bull + c.calf + c.weaner + c.ox;
  state.herd.headCount = Math.max(0, total);
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
