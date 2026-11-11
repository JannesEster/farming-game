import type { GameState } from "../sim/types";

/** Condition label shown on farm cards; gameplay effect is TODO. */
export type FenceCondition = "good" | "fair" | "poor";

export type WaterInventory = {
  boreholes: number;
  windmills: number;
  solar: number;
};

export type BuildingInventory = {
  farmhouse: number;
  workerHouses: number;
  kraals: number;
  sheds: number;
};

export type LivestockLine = {
  species: "cattle" | "sheep" | "goats" | "mixed";
  head: number;
  classLabel: string;
  /** Shown when species is not playable yet. */
  displayAsCattle?: boolean;
};

export type PriceBreakdownLine = {
  label: string;
  amountNad: number;
  /** S = sourced unit; A = assumption; TODO = tunable placeholder. */
  source: "S" | "A" | "TODO";
  note?: string;
};

export type FarmOfferCard = {
  id: string;
  seed: number;
  regionKey: "karas" | "khomas" | "otjozondjupa" | "omaheke";
  title: string;
  subtitle: string;
  hectares: number;
  /** Three-season census average mm (S where noted on card). */
  rainfallMm: number;
  rainfallSource: string;
  campCount: number;
  water: WaterInventory;
  buildings: BuildingInventory;
  fenceCondition: FenceCondition;
  livestock: LivestockLine;
  askingPriceNad: number;
  priceLines: PriceBreakdownLine[];
  /** Cattle ranch playable in this build. */
  playable: boolean;
  lockedReason?: string;
  previewState: GameState;
};
