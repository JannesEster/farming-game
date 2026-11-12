import { CONFIG, type GameConfig } from "./config";
import { STEP3C } from "./step3cConfig";
import type { GameState } from "./types";
import type { AnimalRecord, StockClass, StoryState } from "./storyTypes";

export const ANIMAL_CLASS_LABEL: Record<StockClass, string> = {
  cow: "Cow",
  heifer: "Heifer",
  pregnant_heifer: "Pregnant heifer",
  tolly: "Tolly",
  stoor: "Stoor",
  ox: "Ox",
  bull: "Bull",
  calf: "Calf",
};

const CLASS_ORDER: StockClass[] = [
  "cow",
  "bull",
  "calf",
  "heifer",
  "pregnant_heifer",
  "tolly",
  "stoor",
  "ox",
];

export function mixHash(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
}

export function unitFromHash(n: number): number {
  return mixHash(n) / 4294967296;
}

export type AnimalFilter = {
  stockClass?: StockClass;
  minWeightKg?: number;
  maxWeightKg?: number;
  outOnly?: boolean;
};

/** Preset from the step 3c brief: tollies over 300 kg. */
export const TOLLY_OVER_300: AnimalFilter = { stockClass: "tolly", minWeightKg: 300 };

export function filterAnimals(animals: AnimalRecord[], filter: AnimalFilter): AnimalRecord[] {
  return animals.filter((animal) => {
    if (animal.whereabouts === "sold") return false;
    if (filter.stockClass && animal.stockClass !== filter.stockClass) return false;
    if (filter.minWeightKg !== undefined && animal.weightKg < filter.minWeightKg) return false;
    if (filter.maxWeightKg !== undefined && animal.weightKg > filter.maxWeightKg) return false;
    if (filter.outOnly && animal.whereabouts !== "escaped" && animal.whereabouts !== "neighbour") return false;
    return true;
  });
}

export function conditionWord(condition: number): string {
  if (condition >= 70) return "good";
  if (condition >= 45) return "fair";
  return "poor";
}

export function whereaboutsSentence(animal: AnimalRecord): string {
  switch (animal.whereabouts) {
    case "escaped":
      return animal.escapeReason === "broken_fence"
        ? "Out through a broken fence, grazing outside the camp."
        : "Out through an open gate, grazing outside the camp.";
    case "neighbour":
      return "On a neighbour's land. Round it up when you can.";
    case "cut_out":
      return "Separated from the herd and being driven.";
    case "sold":
      return "Sold.";
    default:
      return animal.split ? "In another camp." : "With the herd.";
  }
}

/** Plain English. Never includes an internal id. */
export function animalDetailCopy(animal: AnimalRecord): { title: string; body: string } {
  const label = ANIMAL_CLASS_LABEL[animal.stockClass];
  const title = `Tag ${animal.tag}`;
  const body = `${label}. ${Math.round(animal.weightKg)} kg. Condition ${conditionWord(animal.condition)} (${Math.round(animal.condition)}). ${whereaboutsSentence(animal)}`;
  return { title, body };
}

export function animalListLine(animal: AnimalRecord): string {
  const label = ANIMAL_CLASS_LABEL[animal.stockClass];
  const where =
    animal.whereabouts === "escaped" || animal.whereabouts === "neighbour"
      ? " · out"
      : animal.whereabouts === "cut_out"
        ? " · driving"
        : "";
  return `${animal.tag} · ${label} · ${Math.round(animal.weightKg)} kg${where}`;
}

function classBaseKg(stockClass: StockClass, state: GameState, config: GameConfig): number {
  const weights = state.story?.classLiveweights;
  switch (stockClass) {
    case "calf":
      return Math.max(120, state.herd.averageLiveweightKg * 0.35);
    case "heifer":
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

function weightForNew(state: GameState, stockClass: StockClass, salt: number, config: GameConfig): number {
  if (stockClass === "tolly") {
    const already = (state.story?.animals ?? []).filter((animal) => animal.stockClass === "tolly").length;
    const table = [312, 328, 246, 344, 274];
    return table[already % table.length];
  }
  const base = classBaseKg(stockClass, state, config);
  const jitter = (unitFromHash(salt) - 0.5) * 2 * STEP3C.weightJitterFraction * base;
  return Math.max(40, Math.round(base + jitter));
}

function takeTag(story: StoryState, seed: number): string {
  if (story.nextAnimalTag === undefined) {
    story.nextAnimalTag = 100 + (Math.abs(seed) % 700);
  }
  const tag = String(story.nextAnimalTag);
  story.nextAnimalTag += 1;
  return tag;
}

function makeAnimal(
  state: GameState,
  stockClass: StockClass,
  salt: number,
  config: GameConfig,
): AnimalRecord {
  const story = state.story!;
  const tag = takeTag(story, state.seed);
  const camp = state.camps.find((item) => item.id === state.herd.campId);
  const anchor = camp?.anchor ?? { x: 0, y: 0 };
  const condition = Math.max(
    0,
    Math.min(100, state.herd.condition + (unitFromHash(salt + 3) - 0.5) * 8),
  );
  return {
    id: `a-${tag}`,
    tag,
    stockClass,
    weightKg: weightForNew(state, stockClass, salt + 9, config),
    condition,
    campId: state.herd.campId,
    whereabouts: "in_camp",
    tileX: anchor.x,
    tileY: anchor.y,
    facing: mixHash(salt) % 8,
    activity: "graze",
    escapeHours: 0,
    escapeReason: null,
    neighbourCharged: false,
    split: false,
  };
}

export function livingAnimals(state: GameState): AnimalRecord[] {
  return (state.story?.animals ?? []).filter((animal) => animal.whereabouts !== "sold");
}

export function findAnimal(state: GameState, id: string): AnimalRecord | undefined {
  return state.story?.animals?.find((animal) => animal.id === id);
}

/**
 * Keep one animal per head in the composition. Existing tags, weights, and
 * whereabouts stay when the counts already match.
 */
export function reconcileAnimals(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story) return;
  if (!story.animals) story.animals = [];
  const living = story.animals.filter((animal) => animal.whereabouts !== "sold");
  const extras: AnimalRecord[] = [];
  const deficits: StockClass[] = [];
  for (const stockClass of CLASS_ORDER) {
    const want = story.composition[stockClass] ?? 0;
    const group = living.filter((animal) => animal.stockClass === stockClass);
    if (group.length > want) extras.push(...group.slice(want));
    for (let i = group.length; i < want; i += 1) deficits.push(stockClass);
  }
  let salt = (story.nextAnimalTag ?? 100) * 17 + state.seed;
  while (extras.length > 0 && deficits.length > 0) {
    const animal = extras.pop()!;
    const nextClass = deficits.pop()!;
    animal.stockClass = nextClass;
    if (nextClass === "pregnant_heifer") animal.weightKg = Math.round(animal.weightKg * 1.06);
    if (nextClass === "calf") animal.weightKg = weightForNew(state, "calf", salt, config);
    salt += 1;
  }
  if (extras.length > 0) {
    const drop = new Set(extras.map((animal) => animal.id));
    story.animals = story.animals.filter((animal) => !drop.has(animal.id));
  }
  for (const stockClass of deficits) {
    story.animals.push(makeAnimal(state, stockClass, salt, config));
    salt += 1;
  }
  if (story.selectedAnimalIds) {
    const ids = new Set(story.animals.map((animal) => animal.id));
    story.selectedAnimalIds = story.selectedAnimalIds.filter((id) => ids.has(id));
  }
  if (story.focusedAnimalId && !story.animals.some((animal) => animal.id === story.focusedAnimalId)) {
    story.focusedAnimalId = null;
  }
}

export function ensureAnimals(state: GameState, config: GameConfig = CONFIG): void {
  reconcileAnimals(state, config);
}

export function moveCampAnimals(state: GameState, fromCampId: number, toCampId: number): void {
  for (const animal of state.story?.animals ?? []) {
    if (animal.split) continue;
    if (animal.whereabouts !== "in_camp") continue;
    if (animal.campId !== fromCampId) continue;
    animal.campId = toCampId;
  }
}

export function visualCampId(state: GameState, animal: AnimalRecord): number {
  if (animal.split) return animal.campId;
  if (animal.whereabouts === "in_camp" || animal.whereabouts === "cut_out") return state.herd.campId;
  return animal.campId;
}
