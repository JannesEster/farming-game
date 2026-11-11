import { CONFIG, type GameConfig } from "./config";
import type { SaleChannel, SaleLine, StockClass } from "./storyTypes";
import type { GameState } from "./types";

/**
 * Liveweight prices (N$/kg live) and fees. S = sourced in farm-life-lesson; A = gameplay placeholder.
 * See story report for line references in uploaded research files.
 */

export type PriceQuote = {
  baseNadPerKgLive: number;
  source: "sourced" | "placeholder";
  note: string;
};

export function baseLivePrice(stockClass: StockClass, _config: GameConfig = CONFIG): PriceQuote {
  switch (stockClass) {
    case "weaner":
      // S: LLPBN 2025 annual average weaners at auction N$31.47/kg (farm-life-lesson §5.2).
      return { baseNadPerKgLive: 31.47, source: "sourced", note: "LLPBN 2025 weaner auction avg" };
    case "ox":
      // S: LABTA slaughter oxen average N$35.91/kg live, week to 15 Jun 2026 (farm-life-lesson §5.2).
      return { baseNadPerKgLive: 35.91, source: "sourced", note: "LABTA slaughter oxen avg Jun 2026" };
    case "cow":
      // S: lean cows N$23.95/kg live same auction week (farm-life-lesson §5.2).
      return { baseNadPerKgLive: 23.95, source: "sourced", note: "LABTA lean cows avg Jun 2026" };
    case "calf":
      // A: share of weaner price for young calf sold out of hand.
      return {
        baseNadPerKgLive: 28,
        source: "placeholder",
        note: "TODO tune: calf out-of-hand vs weaner auction",
      };
    case "bull":
      // A: no Namibian bull/kg quote in lessons; use slaughter bull SA proxy scaled.
      return {
        baseNadPerKgLive: 28.92,
        source: "placeholder",
        note: "TODO tune: SA slaughter bulls R/kg proxy (Vleisprys Nov 2026)",
      };
    default:
      return { baseNadPerKgLive: 25, source: "placeholder", note: "TODO" };
  }
}

export function classLiveweightKg(stockClass: StockClass, herdAvgKg: number, config: GameConfig = CONFIG): number {
  switch (stockClass) {
    case "calf":
      // A: ~55% of cow weight at weaning (NAU ratios; namibian-livestock §2.4).
      return Math.max(120, herdAvgKg * 0.35);
    case "weaner":
      // A: ~220 kg weaner for price math (farm-life-lesson §8.5 assumption).
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
      // A: quick out-of-hand discount.
      return 0.94;
    case "feedlot":
      // S-ish: weaner export/feedlot demand; A spread for gameplay.
      return config.economy.feedlotPriceFactor;
    default:
      return 1;
  }
}

export function sellingCosts(totalNad: number, channel: SaleChannel, config: GameConfig = CONFIG): number {
  let levy = totalNad * config.economy.llpbnLevyRate;
  let commission = 0;
  if (channel === "auction") {
    // A: SA public auction ~8% (Farmer's Weekly Dec 2021); Namibia Agra rate unpublished.
    commission = totalNad * config.economy.auctionCommissionRate;
  }
  if (channel === "feedlot") {
    levy = totalNad * config.economy.liveExportLevyRate;
  }
  return levy + commission;
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
  const costs = sellingCosts(gross, channel, config);
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
  const total =
    c.cow + c.bull + c.calf + c.weaner + c.ox;
  state.herd.headCount = Math.max(0, total);
}

export function monthlyOperatingCosts(state: GameState, config: GameConfig = CONFIG): { total: number; lines: string[] } {
  const lines: string[] = [];
  let total = 0;
  if (state.story?.farmhand.hired) {
  // S: N$14/hr × 45h × 52/12 ≈ N$2,730 (farm-life-lesson §1.4); housing compulsory, not deducted.
    total += state.story.farmhand.wageCashNad;
    lines.push(`Wages N$${Math.round(state.story.farmhand.wageCashNad)}`);
  }
  // S: phosphate/green & protein/dry licks are real costs; amounts are placeholders.
  const lick = config.economy.monthlyLickNad;
  total += lick;
  lines.push(`Licks & supplements N$${lick}`);
  const vet = config.economy.monthlyVetNad;
  total += vet;
  lines.push(`Vet & dosing N$${vet}`);
  const diesel = config.economy.monthlyDieselNad;
  total += diesel;
  lines.push(`Diesel (farm run) N$${diesel}`);
  return { total, lines };
}

export function chargeMonthlyCosts(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  const costs = monthlyOperatingCosts(state, config);
  state.cashNad -= costs.total;
  story.ledger.expenseNad += costs.total;
  story.ledger.notes.push(...costs.lines.map((l) => `Paid ${l}`));
}
