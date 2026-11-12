import { visualCampId } from "../sim/animals";
import type { AnimalRecord } from "../sim/storyTypes";
import { herdWorldTile } from "../sim/transit";
import type { GameState } from "../sim/types";
import type { HerdOffset } from "./art";
import { offsetsForHerd } from "./herdLayout";
import { tileCenter, type IsoLayout } from "./iso";
import { cowOctantFromScreen } from "./sprites";
import { yardSlots } from "./yardDraw";

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
      const lined = saleLinePoint(state, animal, layout, tileW, tileH);
      if (lined) {
        placed.push({ animal, x: lined.x, y: lined.y, octant: lined.octant, role: "cut-out-animal", calf });
        continue;
      }
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

/** Sale animals stand inside the pens, and the rest walk up the race toward the ramp. */
function saleLinePoint(
  state: GameState,
  animal: AnimalRecord,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): { x: number; y: number; octant: number } | null {
  const sale = state.story?.saleConvoy;
  const ids = sale?.animalIds ?? [];
  const showing =
    sale &&
    (sale.phase === "kraal" || sale.phase === "crush" || sale.phase === "ramp" || sale.phase === "loading") &&
    ids.includes(animal.id);
  if (!showing || !sale) return null;
  const index = Math.max(0, ids.indexOf(animal.id));
  const slots = yardSlots(state.features, layout, tileW, tileH);
  if (slots && slots.pens.length > 0) {
    const penCount = Math.min(ids.length, Math.max(slots.pens.length, 5));
    if (index < penCount) {
      const pen = slots.pens[index % slots.pens.length];
      const slot = Math.floor(index / slots.pens.length);
      const across = slot === 0 ? -0.38 : 0.34;
      const depth = index % 2 === 0 ? -0.22 : 0.28;
      const aim = slots.race[0] ?? { x: pen.x, y: pen.y + 20 };
      return {
        x: pen.x + pen.alongX * pen.halfAlong * across + pen.intoX * pen.halfInto * depth,
        y: pen.y + pen.alongY * pen.halfAlong * across + pen.intoY * pen.halfInto * depth,
        octant: cowOctantFromScreen(aim.x - pen.x, aim.y - pen.y),
      };
    }
    const raceIndex = index - penCount;
    const raceSlots = Math.max(1, ids.length - penCount);
    const t = (raceIndex + 0.5) / raceSlots;
    const cursor = pointAlong(slots.race, t);
    const ahead = pointAlong(slots.race, Math.min(1, t + 0.2));
    return {
      x: cursor.x,
      y: cursor.y,
      octant: cowOctantFromScreen(ahead.x - cursor.x, ahead.y - cursor.y),
    };
  }
  const pens = state.features.filter((feature) => feature.kind === "holding_pen");
  const ramp = state.features.find((feature) => feature.kind === "loading_ramp") ?? pens[0];
  if (!ramp) return null;
  const at = tileCenter(ramp.x, ramp.y, layout, tileW, tileH);
  return { x: at.x, y: at.y, octant: 0 };
}

function pointAlong(points: { x: number; y: number }[], t: number): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1] || 1;
  const dist = Math.max(0, Math.min(1, t)) * total;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < dist) i += 1;
  const span = lengths[i] - lengths[i - 1] || 1;
  const u = (dist - lengths[i - 1]) / span;
  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * u,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * u,
  };
}
