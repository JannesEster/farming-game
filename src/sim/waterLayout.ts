import type { GameConfig } from "./config";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type CampState, type Feature, type GameState, type TilePoint } from "./types";
import type { FarmWaterPoint } from "./storyTypes";

/**
 * Shared water and the homestead yard for a generated farm.
 * Lesson (docs/research/camps-water-infrastructure-lesson.md): camps share a water
 * point on a fence corner, some camps have no water, lick sits with some of the
 * water, and the kraal, crush and loading ramp sit beside the homestead on the
 * farm road. The owner asked for 2 to 4 camps per point.
 */

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

type YardPiece = { kind: Feature["kind"]; x: number; y: number };

/** Local tiles inside the homestead block. Ramp sits on the road edge, facing the track. */
export function homesteadYardPieces(blockW: number, blockH: number, roadSouth: boolean): YardPiece[] {
  const row = (depthFromRoad: number) => (roadSouth ? blockH - 1 - depthFromRoad : depthFromRoad);
  const mid = Math.floor(blockW / 2);
  const wanted: YardPiece[] = [
    { kind: "house", x: 1, y: row(Math.max(2, blockH - 2)) },
    { kind: "windmill", x: mid + 1, y: row(blockH - 1) },
    { kind: "reservoir", x: mid + 2, y: row(blockH - 1) },
    { kind: "shed", x: mid + 2, y: row(2) },
    { kind: "worker_house", x: blockW - 1, y: row(1) },
    { kind: "kraal", x: 0, y: row(1) },
    { kind: "crush", x: mid - 1, y: row(1) },
    { kind: "loading_ramp", x: mid, y: row(0) },
    { kind: "trough", x: mid, y: row(Math.min(3, blockH - 1)) },
    { kind: "lick_feeder", x: 0, y: row(Math.min(2, blockH - 1)) },
  ];
  const used = new Set<string>();
  const placed: YardPiece[] = [];
  for (const piece of wanted) {
    let x = Math.max(0, Math.min(blockW - 1, piece.x));
    let y = Math.max(0, Math.min(blockH - 1, piece.y));
    if (piece.kind === "loading_ramp") {
      x = mid;
      y = row(0);
    }
    if (used.has(`${x},${y}`)) {
      let found = false;
      for (let yy = 0; yy < blockH && !found; yy += 1) {
        for (let xx = 0; xx < blockW; xx += 1) {
          if (used.has(`${xx},${yy}`)) continue;
          if (piece.kind !== "loading_ramp" && xx === mid && yy === row(0)) continue;
          x = xx;
          y = yy;
          found = true;
          break;
        }
      }
    }
    used.add(`${x},${y}`);
    placed.push({ kind: piece.kind, x, y });
  }
  return placed;
}

function campIdAt(grid: number[], width: number, height: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return TILE_OUTSIDE;
  return grid[y * width + x];
}

function centroid(tiles: TilePoint[]): TilePoint {
  let x = 0;
  let y = 0;
  for (const tile of tiles) {
    x += tile.x;
    y += tile.y;
  }
  const n = Math.max(1, tiles.length);
  return { x: x / n, y: y / n };
}

type Corner = { x: number; y: number; camps: number[] };

function boundaryCorners(grid: number[], width: number, height: number): Corner[] {
  const corners: Corner[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = campIdAt(grid, width, height, x, y);
      if (id < 0) continue;
      const ids = new Set<number>([id]);
      for (const [dx, dy] of DIRS4) {
        const next = campIdAt(grid, width, height, x + dx, y + dy);
        if (next >= 0 && next !== id) ids.add(next);
      }
      if (ids.size < 2 || ids.size > 4) continue;
      corners.push({ x, y, camps: [...ids].sort((a, b) => a - b) });
    }
  }
  return corners;
}

function nearestOpen(
  x: number,
  y: number,
  occupied: Set<string>,
  grid: number[],
  width: number,
  height: number,
  prefer: Set<number>,
): TilePoint | null {
  let fallback: TilePoint | null = null;
  for (let radius = 1; radius <= 2; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (occupied.has(key)) continue;
        const id = campIdAt(grid, width, height, nx, ny);
        if (id === TILE_OUTSIDE) continue;
        const tile = { x: nx, y: ny };
        if (prefer.has(id)) return tile;
        if (!fallback) fallback = tile;
      }
    }
  }
  return fallback;
}

function tooClose(x: number, y: number, points: FarmWaterPoint[], minDist: number): boolean {
  for (const point of points) {
    if (Math.hypot(point.trough.x - x, point.trough.y - y) < minDist) return true;
  }
  return false;
}

/**
 * Fence-corner water points plus the yard point. Mutates `features`.
 * One camp, the farthest from the house and not the opening camp, is left dry.
 */
export function placeSharedWaterPoints(input: {
  grid: number[];
  width: number;
  height: number;
  camps: CampState[];
  features: Feature[];
  startCampId: number;
  config: GameConfig;
}): FarmWaterPoint[] {
  const { grid, width, height, camps, features, startCampId, config } = input;
  const house = features.find((feature) => feature.kind === "house") ?? { x: 0, y: 0 };
  const occupied = new Set(features.map((feature) => `${feature.x},${feature.y}`));
  const points: FarmWaterPoint[] = [];

  let dryId = -1;
  let dryDist = -1;
  for (const camp of camps) {
    if (camp.id === startCampId) continue;
    const middle = centroid(camp.tiles);
    const dist = (middle.x - house.x) ** 2 + (middle.y - house.y) ** 2;
    if (dist > dryDist || (dist === dryDist && (dryId < 0 || camp.id < dryId))) {
      dryDist = dist;
      dryId = camp.id;
    }
  }

  const windmills = Math.max(0, config.farm.extraWater?.windmills ?? 1);
  const solars = Math.max(0, config.farm.extraWater?.solar ?? 1);
  const pumpAt = (index: number): "windmill" | "solar" => {
    const cycle = windmills + solars;
    if (cycle <= 0) return index % 2 === 0 ? "windmill" : "solar";
    return index % cycle < windmills ? "windmill" : "solar";
  };

  const onHomestead = (tile: TilePoint) => campIdAt(grid, width, height, tile.x, tile.y) === TILE_HOMESTEAD;
  const yardMill = features.find((feature) => feature.kind === "windmill" && onHomestead(feature));
  const yardTrough = features.find((feature) => feature.kind === "trough" && onHomestead(feature));
  const yardReservoir = features.find((feature) => feature.kind === "reservoir" && onHomestead(feature));
  const yardLick = features.find((feature) => feature.kind === "lick_feeder" && onHomestead(feature));

  const touching = new Set<number>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (campIdAt(grid, width, height, x, y) !== TILE_HOMESTEAD) continue;
      for (const [dx, dy] of DIRS4) {
        const id = campIdAt(grid, width, height, x + dx, y + dy);
        if (id >= 0 && id !== dryId) touching.add(id);
      }
    }
  }
  const yardServed: number[] = [];
  if (touching.has(startCampId)) yardServed.push(startCampId);
  const rankedTouch = [...touching].sort((a, b) => {
    const ca = camps.find((camp) => camp.id === a);
    const cb = camps.find((camp) => camp.id === b);
    const da = ca ? (centroid(ca.tiles).x - house.x) ** 2 + (centroid(ca.tiles).y - house.y) ** 2 : 0;
    const db = cb ? (centroid(cb.tiles).x - house.x) ** 2 + (centroid(cb.tiles).y - house.y) ** 2 : 0;
    return da - db || a - b;
  });
  for (const id of rankedTouch) {
    if (yardServed.length >= 4) break;
    if (!yardServed.includes(id)) yardServed.push(id);
  }
  if (yardMill && yardTrough && yardServed.length >= 2) {
    points.push({
      id: "wp-yard",
      tile: { x: yardMill.x, y: yardMill.y },
      trough: { x: yardTrough.x, y: yardTrough.y },
      pump: "windmill",
      reservoir: Boolean(yardReservoir),
      servedCampIds: yardServed,
      lick: Boolean(yardLick),
    });
  }

  const covered = new Set<number>(points.flatMap((point) => point.servedCampIds));
  const corners = boundaryCorners(grid, width, height);

  const claim = (corner: Corner, index: number, allowAlreadyServed: boolean): boolean => {
    if (occupied.has(`${corner.x},${corner.y}`)) return false;
    if (campIdAt(grid, width, height, corner.x, corner.y) === dryId) return false;
    const fresh = corner.camps.filter((id) => id !== dryId && !covered.has(id));
    const usable = allowAlreadyServed
      ? corner.camps.filter((id) => id !== dryId).slice(0, 4)
      : fresh.slice(0, 4);
    if (usable.length < 2) return false;
    if (!allowAlreadyServed && fresh.length < 2) return false;
    if (tooClose(corner.x, corner.y, points, allowAlreadyServed ? 4 : 6)) return false;
    const prefer = new Set(usable);
    const pumpTile = nearestOpen(corner.x, corner.y, occupied, grid, width, height, prefer) ?? {
      x: corner.x,
      y: corner.y,
    };
    occupied.add(`${pumpTile.x},${pumpTile.y}`);
    const reservoirTile = nearestOpen(corner.x, corner.y, occupied, grid, width, height, prefer) ?? {
      x: corner.x,
      y: corner.y,
    };
    occupied.add(`${reservoirTile.x},${reservoirTile.y}`);
    const wantLick = index % 2 === 0;
    const lickTile = wantLick ? nearestOpen(corner.x, corner.y, occupied, grid, width, height, prefer) : null;
    if (lickTile) occupied.add(`${lickTile.x},${lickTile.y}`);
    const pump = pumpAt(index);
    features.push({ kind: "trough", x: corner.x, y: corner.y, scale: 1 });
    occupied.add(`${corner.x},${corner.y}`);
    features.push({
      kind: pump === "solar" ? "solar_pump" : "windmill",
      x: pumpTile.x,
      y: pumpTile.y,
      scale: 1,
    });
    features.push({ kind: "reservoir", x: reservoirTile.x, y: reservoirTile.y, scale: 1 });
    if (lickTile) features.push({ kind: "lick_feeder", x: lickTile.x, y: lickTile.y, scale: 0.85 });
    for (const id of usable) covered.add(id);
    points.push({
      id: `wp-${corner.x}-${corner.y}`,
      tile: { ...pumpTile },
      trough: { x: corner.x, y: corner.y },
      pump,
      reservoir: true,
      servedCampIds: usable,
      lick: Boolean(lickTile),
    });
    return true;
  };

  const pick = (preferCamp: number | null, allowAlreadyServed: boolean): Corner | null => {
    let best: Corner | null = null;
    let bestScore = -1;
    for (const corner of corners) {
      if (occupied.has(`${corner.x},${corner.y}`)) continue;
      if (campIdAt(grid, width, height, corner.x, corner.y) === dryId) continue;
      if (preferCamp !== null && campIdAt(grid, width, height, corner.x, corner.y) !== preferCamp) continue;
      if (preferCamp !== null && !corner.camps.includes(preferCamp)) continue;
      const fresh = corner.camps.filter((id) => id !== dryId && !covered.has(id));
      if (!allowAlreadyServed && fresh.length < 2) continue;
      if (allowAlreadyServed && fresh.length < 1) continue;
      if (allowAlreadyServed && corner.camps.filter((id) => id !== dryId).length < 2) continue;
      if (tooClose(corner.x, corner.y, points, allowAlreadyServed ? 4 : 6)) continue;
      const score = fresh.length * 10 - Math.hypot(corner.x - house.x, corner.y - house.y) * 0.01;
      if (score > bestScore || (score === bestScore && best && (corner.y < best.y || (corner.y === best.y && corner.x < best.x)))) {
        bestScore = score;
        best = corner;
      }
    }
    return best;
  };

  let openingLoose = false;
  let opening = pick(startCampId, false);
  if (!opening) {
    opening = pick(startCampId, true);
    openingLoose = true;
  }
  if (opening) claim(opening, points.length, openingLoose);

  let guard = 0;
  while (guard < camps.length) {
    guard += 1;
    const next = pick(null, false);
    if (!next || !claim(next, points.length, false)) break;
  }

  for (const camp of camps) {
    if (camp.id === dryId || covered.has(camp.id)) continue;
    const corner = pick(camp.id, true);
    if (corner && claim(corner, points.length, true)) continue;
    const host = points
      .filter((point) => point.servedCampIds.length < 4)
      .sort(
        (a, b) =>
          Math.hypot(a.trough.x - camp.anchor.x, a.trough.y - camp.anchor.y) -
          Math.hypot(b.trough.x - camp.anchor.x, b.trough.y - camp.anchor.y),
      )[0];
    if (host) {
      host.servedCampIds.push(camp.id);
      covered.add(camp.id);
    }
  }

  if (dryId >= 0) {
    for (const point of points) {
      point.servedCampIds = point.servedCampIds.filter((id) => id !== dryId);
    }
  }
  return points.filter((point) => point.servedCampIds.length >= 2 && point.servedCampIds.length <= 4);
}

/** True when a trough tile or a shared point already waters this camp. */
export function campWateredBy(features: Feature[], points: FarmWaterPoint[], camp: CampState): boolean {
  const tiles = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
  if (features.some((feature) => feature.kind === "trough" && tiles.has(`${feature.x},${feature.y}`))) return true;
  return points.some((point) => point.servedCampIds.includes(camp.id));
}

export function rampTouchesTrack(state: Pick<GameState, "features">): boolean {
  const ramp = state.features.find((feature) => feature.kind === "loading_ramp");
  if (!ramp) return false;
  const tracks = new Set(
    state.features.filter((feature) => feature.kind === "track").map((feature) => `${feature.x},${feature.y}`),
  );
  return DIRS4.some(([dx, dy]) => tracks.has(`${ramp.x + dx},${ramp.y + dy}`));
}
