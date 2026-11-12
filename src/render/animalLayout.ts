import { visualCampId } from "../sim/animals";
import type { AnimalRecord } from "../sim/storyTypes";
import { herdWorldTile } from "../sim/transit";
import type { GameState } from "../sim/types";
import type { HerdOffset } from "./art";
import { offsetsForHerd } from "./herdLayout";
import { tileCenter, type IsoLayout } from "./iso";

export type AnimalSpriteRole = "herd-animal" | "escaped-animal" | "cut-out-animal" | "other-camp-animal";

export type PlacedAnimal = {
  animal: AnimalRecord;
  x: number;
  y: number;
  octant: number;
  role: AnimalSpriteRole;
  calf: boolean;
};

function hashUnit(n: number): number {
  const x = Math.imul(n ^ (n >>> 16), 2246822507) >>> 0;
  return x / 4294967296;
}

export function layoutAnimals(
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  timeMs: number,
): PlacedAnimal[] {
  const animals = (state.story?.animals ?? []).filter((animal) => animal.whereabouts !== "sold");
  if (animals.length === 0) return [];
  const herdTile = herdWorldTile(state);
  const herdPoint = tileCenter(herdTile.x, herdTile.y, layout, tileW, tileH);
  const home = animals.filter(
    (animal) => animal.whereabouts === "in_camp" && !animal.split && visualCampId(state, animal) === state.herd.campId,
  );
  const walking = Boolean(state.herd.transit && state.herd.transit.phase !== "approach" && state.herd.transit.progress < 1);
  const offsets: HerdOffset[] = offsetsForHerd(
    state,
    layout,
    tileW,
    tileH,
    walking,
    state.herd.transit?.progress ?? 0,
    { x: 1, y: 0 },
    timeMs,
    herdPoint.x,
    herdPoint.y,
    home.length,
  );
  const homeIndex = new Map(home.map((animal, index) => [animal.id, index]));
  const placed: PlacedAnimal[] = [];
  for (const animal of animals) {
    const calf = animal.stockClass === "calf";
    const homeAt = homeIndex.get(animal.id);
    if (homeAt !== undefined && animal.whereabouts === "in_camp") {
      const offset = offsets[homeAt];
      placed.push({
        animal,
        x: herdPoint.x + (offset?.x ?? 0),
        y: herdPoint.y + (offset?.y ?? 0),
        octant: offset?.octant ?? animal.facing,
        role: "herd-animal",
        calf,
      });
      continue;
    }
    if (animal.whereabouts === "escaped" || animal.whereabouts === "neighbour") {
      const point = tileCenter(animal.tileX, animal.tileY, layout, tileW, tileH);
      placed.push({
        animal,
        x: point.x,
        y: point.y,
        octant: animal.facing,
        role: "escaped-animal",
        calf,
      });
      continue;
    }
    if (animal.whereabouts === "cut_out") {
      const point = tileCenter(animal.tileX, animal.tileY, layout, tileW, tileH);
      placed.push({
        animal,
        x: point.x,
        y: point.y,
        octant: animal.facing,
        role: "cut-out-animal",
        calf,
      });
      continue;
    }
    const camp = state.camps.find((item) => item.id === animal.campId) ?? state.camps[0];
    const anchor = camp ? tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH) : herdPoint;
    const spin = hashUnit(Number(animal.tag) || animal.tileX * 13);
    const angle = spin * Math.PI * 2;
    const radius = 10 + (spin * 18);
    placed.push({
      animal,
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius * 0.6,
      octant: animal.facing,
      role: "other-camp-animal",
      calf,
    });
  }
  return placed;
}
