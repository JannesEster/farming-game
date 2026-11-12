import { TILE_HOMESTEAD, TILE_OUTSIDE, type Feature, type FeatureKind, type TilePoint } from "./types";

type Stamp = { kind: FeatureKind; into: number; along: number; scale: number };

/**
 * Steel yards beside the farm road, from the reference photos in
 * docs/reference/cattle-yards/. Steps are into the camp and along the road.
 * Pens use different scales so the complex reads as several sizes.
 */
const YARD: Stamp[] = [
  { kind: "loading_ramp", into: 1, along: 0, scale: 1 },
  { kind: "race", into: 2, along: 0, scale: 1 },
  { kind: "race", into: 2, along: 1, scale: 1 },
  { kind: "crush", into: 3, along: 1, scale: 1 },
  { kind: "handling_roof", into: 3, along: 0, scale: 1 },
  { kind: "holding_pen", into: 1, along: 2, scale: 1.35 },
  { kind: "holding_pen", into: 3, along: 2, scale: 1.05 },
  { kind: "holding_pen", into: 4, along: 3, scale: 0.72 },
];

const COMPACT: Stamp[] = [
  { kind: "loading_ramp", into: 1, along: 0, scale: 1 },
  { kind: "race", into: 2, along: 0, scale: 1 },
  { kind: "race", into: 2, along: 1, scale: 1 },
  { kind: "crush", into: 2, along: 2, scale: 1 },
  { kind: "handling_roof", into: 3, along: 1, scale: 1 },
  { kind: "holding_pen", into: 1, along: 2, scale: 1.35 },
  { kind: "holding_pen", into: 1, along: 3, scale: 1 },
  { kind: "holding_pen", into: 3, along: 2, scale: 0.72 },
];

const INTO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function placeCattleHandlingYard(args: {
  grid: Int16Array | number[];
  width: number;
  height: number;
  features: Feature[];
  house: TilePoint;
  avoidCampId?: number;
}): boolean {
  const { grid, width, height, features, house, avoidCampId } = args;
  const occupied = new Set(
    features.filter((feature) => feature.kind !== "track").map((feature) => `${feature.x},${feature.y}`),
  );
  const tracks = features.filter((feature) => feature.kind === "track");
  const idAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return TILE_OUTSIDE;
    return grid[y * width + x];
  };

  let best: { score: number; tiles: Feature[]; pad: TilePoint | null } | null = null;
  const layouts = [YARD, COMPACT];
  for (let layoutIndex = 0; layoutIndex < layouts.length && best === null; layoutIndex += 1) {
    const layout = layouts[layoutIndex];
    for (const track of tracks) {
      const fromHouse = Math.hypot(track.x - house.x, track.y - house.y);
      if (fromHouse < 8) continue;
      for (const [ix, iy] of INTO) {
        const beside = idAt(track.x + ix, track.y + iy);
        if (beside < 0) continue;
        const alongs = ix !== 0 ? ([[0, 1], [0, -1]] as const) : ([[1, 0], [-1, 0]] as const);
        for (const [ax, ay] of alongs) {
          const tiles: Feature[] = [];
          let ok = true;
          for (const piece of layout) {
            const x = track.x + ix * piece.into + ax * piece.along;
            const y = track.y + iy * piece.into + ay * piece.along;
            if (idAt(x, y) !== beside || occupied.has(`${x},${y}`)) {
              ok = false;
              break;
            }
            tiles.push({ kind: piece.kind, x, y, scale: piece.scale });
          }
          if (!ok) continue;
          const padX = track.x - ix;
          const padY = track.y - iy;
          const pad =
            padX >= 0 && padY >= 0 && padX < width && padY < height && idAt(padX, padY) === TILE_OUTSIDE
              ? { x: padX, y: padY }
              : null;
          let score = fromHouse;
          if (beside === avoidCampId) score -= 40;
          if (!best || score > best.score) best = { score, tiles, pad };
        }
      }
    }
  }
  if (!best) return false;
  for (const tile of best.tiles) features.push(tile);
  if (best.pad && !features.some((feature) => feature.kind === "track" && feature.x === best.pad!.x && feature.y === best.pad!.y)) {
    const id = idAt(best.pad.x, best.pad.y);
    if (id !== TILE_HOMESTEAD) features.push({ kind: "track", x: best.pad.x, y: best.pad.y, scale: 1 });
  }
  return true;
}
