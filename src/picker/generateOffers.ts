import type { GameState } from "../sim/types";
import { createGame } from "../sim/simulation";
import { PURCHASE_BUDGET_NAD } from "./budget";
import { buildGameConfig, type OfferGenParams } from "./buildGameConfig";
import { buildPriceLines, defaultWeanerHerd } from "./pricing";
import { REGIONS } from "./regionData";
import type { FarmOfferCard, FenceCondition, WaterInventory } from "./types";
import type { FarmMeta } from "../sim/types";
import { campCountForSeed } from "../sim/metreFarm";
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

function campCountFor(mapSeed: number): number {
  return campCountForSeed(mapSeed);
}

export function attachFarmMeta(state: ReturnType<typeof createGame>, meta: FarmMeta): void {
  state.farmMeta = meta;
}

const previewStateCache = new Map<string, GameState>();

function previewCacheKey(params: OfferGenParams, mapSeed: number): string {
  return [
    mapSeed,
    params.hectares,
    params.campCount,
    params.herdHead,
    params.herdStartNearYard ? 1 : 0,
    params.region.key,
    params.fenceCondition,
    params.water.boreholes,
    params.water.windmills,
    params.water.solar,
  ].join(":");
}

function cachedPreviewState(params: OfferGenParams, mapSeed: number, config: ReturnType<typeof buildGameConfig>): GameState {
  const key = previewCacheKey(params, mapSeed);
  const hit = previewStateCache.get(key);
  if (hit) return JSON.parse(JSON.stringify(hit)) as GameState;
  const state = createGame(mapSeed, config);
  previewStateCache.set(key, state);
  return JSON.parse(JSON.stringify(state)) as GameState;
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
  const campCount = campCountFor(mapSeed);
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
  const previewState = cachedPreviewState(params, mapSeed, config);
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
    rainfallSource: "NSA commercial census 2011 to 2014 three season mean",
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
      "Dry south //Karas. Dorper country, jackal pressure.",
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
      "Central highlands. Cattle plus sheep camps.",
    ),
    buildOffer(
      "otjozondjupa-ranch",
      "otjozondjupa",
      3300,
      base + 303,
      true,
      undefined,
      { species: "cattle", head: 120, classLabel: "cattle herd" },
      120,
      "Thornbush savanna. Your classic 120 head ranch.",
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
      "Kalahari east. Weaner outfit, live export story.",
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
