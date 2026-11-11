import type { PriceBreakdownLine } from "./types";
import {
  BOREHOLE_COST_NAD,
  HOMESTEAD_BUNDLE_COST_NAD,
  SOLAR_PUMP_KIT_COST_NAD,
  WEANER_LIVE_KG,
  WEANER_RATE_NAD_PER_KG,
  WINDMILL_REFURB_COST_NAD,
  WORKER_HOUSE_COST_NAD,
  type RegionTemplate,
} from "./regionData";

export type InfraCounts = {
  boreholes: number;
  windmills: number;
  solar: number;
  workerHouses: number;
};

export type HerdPrice = {
  head: number;
  liveKg: number;
  classLabel: string;
};

/**
 * Land line uses sourced N$/ha; bundle discount is A (TODO) so asking totals fit PURCHASE_BUDGET.
 */
export function landListingDiscountFactor(): number {
  // TODO(A): tune with owner — represents bundled sale / partial bond, not a published rate.
  return 0.22;
}

/** TODO(A): transfer stock valued below replacement auction cost. */
export function herdTransferFactor(): number {
  return 0.5;
}

export function buildPriceLines(
  region: RegionTemplate,
  hectares: number,
  infra: InfraCounts,
  herd: HerdPrice,
): { lines: PriceBreakdownLine[]; asking: number } {
  const landFactor = landListingDiscountFactor();
  const landAtRate = Math.round(hectares * region.landRateNadPerHa);
  const landCharged = Math.round(landAtRate * landFactor);

  const lines: PriceBreakdownLine[] = [
    {
      label: `Land (${hectares.toLocaleString()} ha × N$${region.landRateNadPerHa}/ha)`,
      amountNad: landCharged,
      source: "TODO",
      note: `Listed at NSA ALPI 2023 rate; bundle factor ${landFactor} is TODO(A).`,
    },
    {
      label: "Homestead and yard",
      amountNad: HOMESTEAD_BUNDLE_COST_NAD,
      source: "TODO",
      note: "No sourced homestead build cost in lessons.",
    },
  ];

  if (infra.boreholes > 0) {
    lines.push({
      label: `Boreholes × ${infra.boreholes}`,
      amountNad: infra.boreholes * BOREHOLE_COST_NAD,
      source: "S",
      note: "Schlettwein avg borehole ~N$60,000 (2020).",
    });
  }
  if (infra.windmills > 0) {
    lines.push({
      label: `Windmills × ${infra.windmills}`,
      amountNad: infra.windmills * WINDMILL_REFURB_COST_NAD,
      source: "TODO",
    });
  }
  if (infra.solar > 0) {
    lines.push({
      label: `Solar pump kits × ${infra.solar}`,
      amountNad: infra.solar * SOLAR_PUMP_KIT_COST_NAD,
      source: "S",
      note: "Living Earth installed kit N$28,000 (2026).",
    });
  }
  if (infra.workerHouses > 0) {
    lines.push({
      label: `Worker houses × ${infra.workerHouses}`,
      amountNad: infra.workerHouses * WORKER_HOUSE_COST_NAD,
      source: "TODO",
    });
  }

  const herdAtAuction = Math.round(herd.head * herd.liveKg * WEANER_RATE_NAD_PER_KG);
  const herdValue = Math.round(herdAtAuction * herdTransferFactor());
  lines.push({
    label: `${herd.classLabel} (${herd.head} head)`,
    amountNad: herdValue,
    source: "TODO",
    note: `Based on LLPBN 2025 weaner N$${WEANER_RATE_NAD_PER_KG}/kg × ${herd.liveKg} kg × transfer factor ${herdTransferFactor()} (TODO).`,
  });

  const asking = lines.reduce((sum, line) => sum + line.amountNad, 0);
  return { lines, asking };
}

export function defaultWeanerHerd(head: number, label = "Bonsmara weaners"): HerdPrice {
  return { head, liveKg: WEANER_LIVE_KG, classLabel: label };
}
