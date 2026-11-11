import { createGame } from "../sim/simulation";
import { PURCHASE_BUDGET_NAD } from "./budget";
import { buildGameConfig, type OfferGenParams } from "./buildGameConfig";
import { buildPriceLines, defaultWeanerHerd } from "./pricing";
import { REGIONS } from "./regionData";
import type { FarmOfferCard, FenceCondition, WaterInventory } from "./types";
import type { FarmMeta } from "../sim/types";
import { createRng } from "../sim/rng";

function infraForRegion(
  regionKey: keyof typeof REGIONS,
  campCount: number,
  rngSeed: number,
): { water: WaterInventory; fence: FenceCondition } {
  const rng = createRng(rngSeed);
  const roll = rng.next();
  const fence: FenceCondition = roll < 0.35 ? "good" : roll < 0.72 ? "fair" : "poor";

  const bases: Record<keyof typeof REGIONS, WaterInventory> = {
    karas: { boreholes: 2, windmills: 1, solar: 2 },
    khomas: { boreholes: 1, windmills: 2, solar: 1 },
    otjozondjupa: { boreholes: 1, windmills: 1, solar: 1 },
    omaheke: { boreholes: 2, windmills: 1, solar: 2 },
  };
  const water = { ...bases[regionKey] };
  if (campCount > 14) water.boreholes += 1;
  return { water, fence };
}

function campCountFor(regionKey: keyof typeof REGIONS, seed: number): number {
  const region = REGIONS[regionKey];
  const rng = createRng(seed + 17);
  const span = region.terrain.campCountMax - region.terrain.campCountMin;
  return region.terrain.campCountMin + Math.floor(rng.next() * (span + 1));
}

export function attachFarmMeta(state: ReturnType<typeof createGame>, meta: FarmMeta): void {
  state.farmMeta = meta;
}

function buildOffer(
  id: string,
  regionKey: keyof typeof REGIONS,
  mapSeed: number,
  bundleSeed: number,
  playable: boolean,
  lockedReason: string | undefined,
  livestock: FarmOfferCard["livestock"],
  herdHead: number,
  subtitle: string,
  herdStartNearYard = false,
): FarmOfferCard {
  const region = REGIONS[regionKey];
  const campCount = campCountFor(regionKey, bundleSeed);
  const { water, fence } = infraForRegion(regionKey, campCount, bundleSeed);
  const workerHouses = regionKey === "khomas" ? 2 : 1;

  const herd = defaultWeanerHerd(
    herdHead,
    livestock.species === "cattle" ? "Brahman / Bonsmara cattle" : livestock.classLabel,
  );
  const { lines, asking } = buildPriceLines(
    region,
    region.listingHectares,
    {
      boreholes: water.boreholes,
      windmills: water.windmills,
      solar: water.solar,
      workerHouses,
    },
    herd,
  );

  const params: OfferGenParams = {
    region,
    hectares: region.listingHectares,
    campCount,
    water,
    fenceCondition: fence,
    herdHead,
    herdName: livestock.classLabel,
    mapSeed,
    herdStartNearYard,
  };
  const config = buildGameConfig(params);
  const previewState = createGame(mapSeed, config);
  attachFarmMeta(previewState, {
    offerId: id,
    regionKey,
    regionLabel: region.label,
    hectares: region.listingHectares,
    rainfallMm: region.rainThreeSeasonMm,
    campCount,
    fenceCondition: fence,
    water,
  });

  return {
    id,
    seed: mapSeed,
    regionKey,
    title: `${region.label} ${livestock.species === "sheep" ? "sheep" : livestock.species === "mixed" ? "mixed" : "cattle"} farm`,
    subtitle,
    hectares: region.listingHectares,
    rainfallMm: region.rainThreeSeasonMm,
    rainfallSource: "NSA commercial census 2011–2014 three-season mean",
    campCount,
    water,
    buildings: {
      farmhouse: 1,
      workerHouses,
      kraals: 1,
      sheds: 1 + water.solar,
    },
    fenceCondition: fence,
    livestock,
    askingPriceNad: asking,
    priceLines: lines,
    playable,
    lockedReason,
    previewState,
  };
}

/** Four farm cards from one bundle seed (stable across refreshes of the picker). */
export function generateFarmOffers(bundleSeed = 88001): FarmOfferCard[] {
  const base = bundleSeed;
  return [
    buildOffer(
      "karas-sheep",
      "karas",
      base + 1,
      base + 101,
      false,
      "Sheep & small stock coming soon",
      { species: "sheep", head: 820, classLabel: "Dorper & Damara sheep" },
      0,
      "Dry south //Karas — Dorper country, jackal pressure",
    ),
    buildOffer(
      "khomas-mixed",
      "khomas",
      base + 2,
      base + 202,
      false,
      "Mixed small stock coming soon",
      { species: "mixed", head: 140, classLabel: "Cattle with Dorper flock" },
      0,
      "Central highlands — cattle plus sheep camps",
    ),
    buildOffer(
      "otjozondjupa-ranch",
      "otjozondjupa",
      3300,
      base + 303,
      true,
      undefined,
      { species: "cattle", head: 120, classLabel: "120-head cattle herd" },
      120,
      "Thornbush savanna — your classic 120-head ranch",
      true,
    ),
    buildOffer(
      "omaheke-weaners",
      "omaheke",
      base + 4,
      base + 404,
      true,
      undefined,
      { species: "cattle", head: 95, classLabel: "Weaners for SA feedlots" },
      95,
      "Kalahari east — weaner outfit, live export story",
    ),
  ];
}

export function budgetRemaining(askingPriceNad: number): number {
  return PURCHASE_BUDGET_NAD - askingPriceNad;
}

export function cashAfterPurchase(askingPriceNad: number): number {
  const remaining = budgetRemaining(askingPriceNad);
  // TODO(A): minimum operating float if offer is cheap.
  return Math.max(remaining, 120_000);
}
