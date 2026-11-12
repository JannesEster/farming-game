import { HANDLING_YARD, HANDLING_YARD_COMPACT, truckBayTiles, type YardStamp } from "../render/worldScale";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type Feature, type TilePoint } from "./types";

/**
 * Steel yards beside the farm road, from docs/reference/cattle-yards/yards-aerial.png.
 * `into` steps off the road into the camp. `along` steps along the road.
 * Pen scales are metres. The gravel bay is long enough for the road train.
 */
const YARD: readonly YardStamp[] = HANDLING_YARD;
const COMPACT: readonly YardStamp[] = HANDLING_YARD_COMPACT;

const INTO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

type Placed = {
  score: number;
  tiles: Feature[];
  reserved: TilePoint[];
  gravel: TilePoint[];
};

export function placeCattleHandlingYard(args: {
  grid: Int16Array | number[];
  width: number;
  height: number;
  features: Feature[];
  house: TilePoint;
  avoidCampId?: number;
}): TilePoint[] {
  const { grid, width, height, features, house, avoidCampId } = args;
  const blocked = new Set(
    features
      .filter((feature) => feature.kind !== "track" && feature.kind !== "tree" && feature.kind !== "bush")
      .map((feature) => `${feature.x},${feature.y}`),
  );
  const tracks = features.filter((feature) => feature.kind === "track");
  const idAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return TILE_OUTSIDE;
    return grid[y * width + x];
  };

  let best: Placed | null = null;
  const layouts = [YARD, COMPACT];
  for (let layoutIndex = 0; layoutIndex < layouts.length && best === null; layoutIndex += 1) {
    const layout = layouts[layoutIndex];
    // Extra tiles past the stamps so the drawn pens, which overhang their centre tiles, stay clear of trees.
    const intoMax = Math.max(...layout.map((piece) => piece.into)) + 2;
    const alongMax = Math.max(...layout.map((piece) => piece.along)) + 2;
    for (const track of tracks) {
      const fromHouse = Math.hypot(track.x - house.x, track.y - house.y);
      if (fromHouse < 8) continue;
      for (const [ix, iy] of INTO) {
        const beside = idAt(track.x + ix, track.y + iy);
        if (beside < 0) continue;
        const alongs = ix !== 0 ? ([[0, 1], [0, -1]] as const) : ([[1, 0], [-1, 0]] as const);
        for (const [ax, ay] of alongs) {
          const at = (into: number, along: number) => ({
            x: track.x + ix * into + ax * along,
            y: track.y + iy * into + ay * along,
          });
          let ok = true;
          const reserved: TilePoint[] = [];
          for (let into = 1; into <= intoMax && ok; into += 1) {
            for (let along = 0; along <= alongMax; along += 1) {
              const cell = at(into, along);
              if (idAt(cell.x, cell.y) !== beside || blocked.has(`${cell.x},${cell.y}`)) {
                ok = false;
                break;
              }
              reserved.push(cell);
            }
          }
          if (!ok) continue;
          const rampStamp = layout.find((piece) => piece.kind === "loading_ramp");
          const rampCell = rampStamp ? at(rampStamp.into, rampStamp.along) : at(1, 0);
          if (Math.hypot(rampCell.x - house.x, rampCell.y - house.y) < 8) continue;
          const bay = truckBayTiles();
          let bayOk = true;
          for (let along = -bay; along <= alongMax + 2 && bayOk; along += 1) {
            const cell = at(0, along);
            if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;
            if (idAt(cell.x, cell.y) === TILE_HOMESTEAD) {
              bayOk = false;
              break;
            }
            if (blocked.has(`${cell.x},${cell.y}`)) {
              bayOk = false;
              break;
            }
          }
          if (!bayOk) continue;
          const tiles = layout.map((piece) => {
            const cell = at(piece.into, piece.along);
            return { kind: piece.kind, x: cell.x, y: cell.y, scale: piece.scale };
          });
          const gravel: TilePoint[] = [];
          for (let along = -bay; along <= alongMax + 2; along += 1) {
            for (const into of [0, -1]) {
              const cell = at(into, along);
              if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;
              if (idAt(cell.x, cell.y) === TILE_HOMESTEAD) continue;
              gravel.push(cell);
            }
          }
          let score = fromHouse;
          if (beside === avoidCampId) score -= 40;
          if (!best || score > best.score) best = { score, tiles, reserved, gravel };
        }
      }
    }
  }
  if (!best) return [];
  const reservedKeys = new Set(best.reserved.map((tile) => `${tile.x},${tile.y}`));
  for (let i = features.length - 1; i >= 0; i -= 1) {
    const feature = features[i];
    if ((feature.kind === "tree" || feature.kind === "bush") && reservedKeys.has(`${feature.x},${feature.y}`)) {
      features.splice(i, 1);
    }
  }
  for (const tile of best.tiles) features.push(tile);
  const trackKeys = new Set(features.filter((feature) => feature.kind === "track").map((feature) => `${feature.x},${feature.y}`));
  for (const tile of best.gravel) {
    const key = `${tile.x},${tile.y}`;
    if (trackKeys.has(key)) continue;
    features.push({ kind: "track", x: tile.x, y: tile.y, scale: 1 });
    trackKeys.add(key);
  }
  return best.reserved;
}
