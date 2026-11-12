import { CONFIG, type GameConfig } from "./config";
import { clamp, lerp } from "./math";
import {
  dailyDemandKg,
  effectiveGrazingHectares,
  grazeableFraction,
  residualDmKgPerHa,
} from "./pasture";
import { createStoryState, initStoryPeople } from "./story";
import { campGateToward } from "./path";
import { createRng, type Rng } from "./rng";
import {
  TILE_HOMESTEAD,
  TILE_OUTSIDE,
  type CampState,
  type Feature,
  type GameState,
  type TilePoint,
} from "./types";

type Draft = {
  openness: number;
  tiles: TilePoint[];
};

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

function placeCenters(
  rng: Rng,
  count: number,
  width: number,
  height: number,
  config: GameConfig,
): TilePoint[] | null {
  const min = config.map.borderTiles + config.map.centerInset;
  const maxX = width - config.map.borderTiles - config.map.centerInset - 1;
  const maxY = height - config.map.borderTiles - config.map.centerInset - 1;
  if (maxX <= min || maxY <= min) return null;
  const minDist = config.map.campCenterMinDistance;
  const centers: TilePoint[] = [];
  let guard = 0;
  while (centers.length < count && guard < 500) {
    guard += 1;
    const x = min + Math.floor(rng.next() * (maxX - min + 1));
    const y = min + Math.floor(rng.next() * (maxY - min + 1));
    const clear = centers.every((c) => (c.x - x) ** 2 + (c.y - y) ** 2 >= minDist * minDist);
    if (clear) centers.push({ x, y });
  }
  return centers.length === count ? centers : null;
}

function nearestCenter(x: number, y: number, centers: TilePoint[]): number {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < centers.length; i += 1) {
    const d = (centers[i].x - x) ** 2 + (centers[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function centroid(tiles: TilePoint[]): TilePoint {
  let x = 0;
  let y = 0;
  for (const tile of tiles) {
    x += tile.x;
    y += tile.y;
  }
  return { x: x / tiles.length, y: y / tiles.length };
}

function collect(grid: number[], width: number, height: number, id: number): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[idx(x, y, width)] === id) tiles.push({ x, y });
    }
  }
  return tiles;
}

function campAdjacentToHomestead(
  camps: CampState[],
  grid: number[],
  width: number,
  height: number,
): CampState | null {
  const homestead = new Set<string>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[idx(x, y, width)] === TILE_HOMESTEAD) homestead.add(`${x},${y}`);
    }
  }
  for (const camp of camps) {
    for (const tile of camp.tiles) {
      const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const;
      for (const [dx, dy] of neighbors) {
        if (homestead.has(`${tile.x + dx},${tile.y + dy}`)) return camp;
      }
    }
  }
  return null;
}

function isEdge(grid: number[], width: number, height: number, x: number, y: number): boolean {
  const id = grid[idx(x, y, width)];
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of steps) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
    if (grid[idx(nx, ny, width)] !== id) return true;
  }
  return false;
}

function tryBuild(rng: Rng, config: GameConfig): { state: GameState; score: number } | null {
  const width = config.map.tilesX;
  const height = config.map.tilesY;
  const span = config.map.campCountMax - config.map.campCountMin;
  const campCount = config.map.campCountMin + Math.floor(rng.next() * (span + 1));
  const centers = placeCenters(rng, campCount, width, height, config);
  if (!centers) return null;

  const openness = centers.map(() => rng.next());
  const grid = new Array<number>(width * height).fill(TILE_OUTSIDE);
  const border = config.map.borderTiles;
  for (let y = border; y < height - border; y += 1) {
    for (let x = border; x < width - border; x += 1) {
      grid[idx(x, y, width)] = nearestCenter(x, y, centers);
    }
  }

  const drafts: Draft[] = openness.map((value) => ({ openness: value, tiles: [] }));
  for (let i = 0; i < drafts.length; i += 1) drafts[i].tiles = collect(grid, width, height, i);
  let largest = 0;
  for (let i = 1; i < drafts.length; i += 1) {
    if (drafts[i].tiles.length > drafts[largest].tiles.length) largest = i;
  }
  if (drafts[largest].tiles.length === 0) return null;

  const mid = centroid(drafts[largest].tiles);
  const blockW = config.map.homesteadTilesX;
  const blockH = config.map.homesteadTilesY;
  const hx = clamp(
    Math.round(mid.x - blockW / 2),
    border,
    width - border - blockW,
  );
  const hy = clamp(
    Math.round(mid.y - blockH / 2),
    border,
    height - border - blockH,
  );
  for (let y = hy; y < hy + blockH; y += 1) {
    for (let x = hx; x < hx + blockW; x += 1) grid[idx(x, y, width)] = TILE_HOMESTEAD;
  }
  for (let i = 0; i < drafts.length; i += 1) drafts[i].tiles = collect(grid, width, height, i);

  const alive = drafts.filter((draft) => draft.tiles.length > 0);
  if (alive.length < config.map.campCountMin || alive.length > config.map.campCountMax) return null;

  const ranked = alive
    .map((draft) => ({ draft, center: centroid(draft.tiles) }))
    .sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x);

  const finalGrid = grid.slice();
  ranked.forEach((entry, id) => {
    for (const tile of entry.draft.tiles) finalGrid[idx(tile.x, tile.y, width)] = id;
  });

  const grazingHa = config.farm.hectares - config.farm.homesteadHectares;
  const totalTiles = ranked.reduce((sum, entry) => sum + entry.draft.tiles.length, 0);
  const opennessByCamp = ranked.map((entry) => entry.draft.openness);
  const camps: CampState[] = ranked.map((entry, id) => {
    const tiles = collect(finalGrid, width, height, id);
    const peak = clamp(
      config.pasture.peakDmKgPerHa *
        lerp(config.pasture.bushyPeakFraction, 1, entry.draft.openness),
      config.pasture.forageDmKgPerHaMin,
      config.pasture.forageDmKgPerHaMax,
    );
    const cover = lerp(config.pasture.startingCoverMin, config.pasture.startingCoverMax, rng.next());
    return {
      id,
      name: `Camp ${id + 1}`,
      hectares: grazingHa * (tiles.length / totalTiles),
      peakDmKgPerHa: peak,
      standingDmKgPerHa: peak * cover,
      soilMoistureMm: 0,
      restDays: 0,
      tiles,
      anchor: tiles[0],
    };
  });

  const score = camps.reduce((min, camp) => Math.min(min, camp.tiles.length), Number.POSITIVE_INFINITY);

  const features: Feature[] = [];
  const yard = config.map.yard;
  const buildings: { kind: Feature["kind"]; at: TilePoint }[] = [
    { kind: "house", at: yard.house },
    { kind: "windmill", at: yard.windmill },
    { kind: "reservoir", at: yard.reservoir },
    { kind: "kraal", at: yard.kraal },
    { kind: "shed", at: yard.shed },
  ];
  for (const building of buildings) {
    features.push({
      kind: building.kind,
      x: hx + building.at.x,
      y: hy + building.at.y,
      scale: 1,
    });
  }
  features.push({
    kind: "worker_house",
    x: hx + blockW - 2,
    y: hy + blockH - 1,
    scale: 1,
  });
  features.push({ kind: "crush", x: hx + 2, y: hy + 3, scale: 1 });
  features.push({ kind: "loading_ramp", x: hx + 3, y: hy + blockH - 2, scale: 1 });

  const spaceDown = height - (hy + blockH);
  const spaceUp = hy;
  const track: TilePoint[] = [];
  const doorX = hx + Math.floor(blockW / 2);
  if (spaceDown >= spaceUp) {
    for (let y = hy + blockH; y < height; y += 1) track.push({ x: doorX, y });
  } else {
    for (let y = hy - 1; y >= 0; y -= 1) track.push({ x: doorX, y });
  }
  for (const tile of track) features.push({ kind: "track", x: tile.x, y: tile.y, scale: 1 });
  const trackKeys = new Set(track.map((tile) => `${tile.x},${tile.y}`));
  const homesteadDoor = { x: doorX, y: spaceDown >= spaceUp ? hy + blockH : hy - 1 };

  for (const camp of camps) {
    const gate = campGateToward(camp, homesteadDoor);
    const dx = homesteadDoor.x - gate.x;
    const dy = homesteadDoor.y - gate.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = Math.round(gate.x + dx * t);
      const y = Math.round(gate.y + dy * t);
      const key = `${x},${y}`;
      if (trackKeys.has(key)) continue;
      const id = finalGrid[idx(x, y, width)];
      if (id >= 0 || id === TILE_HOMESTEAD) continue;
      trackKeys.add(key);
      features.push({ kind: "track", x, y, scale: 1 });
    }
  }

  for (const camp of camps) {
    const pool = camp.tiles.filter((tile) => !isEdge(finalGrid, width, height, tile.x, tile.y));
    const choices = pool.length > 0 ? pool : camp.tiles;
    const middle = centroid(camp.tiles);
    let anchor = choices[0];
    let best = Number.POSITIVE_INFINITY;
    for (const tile of choices) {
      const d = (tile.x - middle.x) ** 2 + (tile.y - middle.y) ** 2;
      if (d < best) {
        best = d;
        anchor = tile;
      }
    }
    camp.anchor = anchor;
    features.push({ kind: "trough", x: anchor.x, y: anchor.y, scale: 1 });
  }

  const occupied = new Set(features.map((feature) => `${feature.x},${feature.y}`));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = finalGrid[idx(x, y, width)];
      const key = `${x},${y}`;
      if (id === TILE_HOMESTEAD || trackKeys.has(key) || occupied.has(key)) continue;
      if (isEdge(finalGrid, width, height, x, y)) continue;
      const treeChance =
        id === TILE_OUTSIDE ? config.map.treeChance * config.map.outsidePlantFactor : config.map.treeChance;
      if (rng.next() < treeChance) {
        const scale = lerp(config.map.treeScaleMin, config.map.treeScaleMax, rng.next());
        features.push({ kind: "tree", x, y, scale });
        occupied.add(key);
        continue;
      }
      const open = id >= 0 ? opennessByCamp[id] : 1;
      let bushChance = lerp(config.map.bushChanceBushy, config.map.bushChanceOpen, clamp(open, 0, 1));
      if (id === TILE_OUTSIDE) bushChance = config.map.bushChanceOpen * config.map.outsidePlantFactor;
      if (rng.next() < bushChance) {
        const scale = lerp(config.map.bushScaleMin, config.map.bushScaleMax, rng.next());
        features.push({ kind: "bush", x, y, scale });
      }
    }
  }

  const mapMidX = width / 2;
  const mapMidY = height / 2;
  const central = camps.filter((camp) => {
    const middle = centroid(camp.tiles);
    return Math.abs(middle.x - mapMidX) < width * 0.3 && Math.abs(middle.y - mapMidY) < height * 0.3;
  });
  const pool = central.length > 0 ? central : camps;
  const byGrass = [...pool].sort((a, b) => grazeableFraction(a, config) - grazeableFraction(b, config));
  let start = byGrass[Math.floor(byGrass.length / 2)];
  if (config.map.herdStartNearYard) {
    const besideYard = campAdjacentToHomestead(camps, finalGrid, width, height);
    if (besideYard) start = besideYard;
  }
  for (const camp of camps) {
    camp.restDays =
      camp.id === start.id ? 0 : Math.floor(rng.next() * (config.pasture.initialRestDaysMax + 1));
  }
  ensureOpeningCamp(start, features, config);

  const state: GameState = {
    seed: 0,
    rngState: 0,
    clock: {
      settings: {
        dayLengthSeconds: config.time.dayLengthSecondsDefault as 180 | 240 | 300,
        daysPerMonth: config.calendar.daysPerMonthDefault,
        catchUpCapMs: config.time.catchUpCapMs,
      },
      bankMs: 0,
      speed: 1,
    },
    notifications: { log: [], letters: [], alerts: [], lastFiredDayKey: {} },
    date: {
      year: config.calendar.startYear,
      month: config.calendar.startMonth,
      day: config.calendar.startDay,
      hour: config.calendar.startHour,
    },
    seasonRainMm: 0,
    todayRainMm: 0,
    cashNad: config.economy.startingCashNad,
    width,
    height,
    campIds: finalGrid,
    camps,
    herd: {
      name: config.herd.name,
      headCount: config.herd.headCount,
      averageLiveweightKg: config.herd.averageLiveweightKg,
      condition: config.herd.startingCondition,
      campId: start.id,
      daysInCamp: config.herd.startingDaysInCamp,
      transit: null,
    },
    features,
    story: createStoryState(config.herd.headCount, config),
  };
  return { state, score };
}

/** Top up the opening camp so a new player is not already out of grass or water. */
function ensureOpeningCamp(camp: CampState, features: Feature[], config: GameConfig): void {
  const herd = {
    name: config.herd.name,
    headCount: config.herd.headCount,
    averageLiveweightKg: config.herd.averageLiveweightKg,
    condition: config.herd.startingCondition,
    campId: camp.id,
    daysInCamp: config.herd.startingDaysInCamp,
    transit: null,
  };
  const demand = dailyDemandKg(herd, config);
  const grazeHa = effectiveGrazingHectares(camp.hectares, config);
  const floor = residualDmKgPerHa(camp.peakDmKgPerHa, config);
  if (demand > 0 && grazeHa > 0) {
    const needed = floor + (config.pasture.openingMinGrassDays * demand) / grazeHa;
    camp.standingDmKgPerHa = Math.min(camp.peakDmKgPerHa, Math.max(camp.standingDmKgPerHa, needed));
  }
  const tiles = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
  const hasTrough = features.some((feature) => feature.kind === "trough" && tiles.has(`${feature.x},${feature.y}`));
  if (!hasTrough) features.push({ kind: "trough", x: camp.anchor.x, y: camp.anchor.y, scale: 1 });
}

export function generateFarm(seed: number, config: GameConfig = CONFIG): GameState {
  const rng = createRng(seed);
  let best: { state: GameState; score: number } | null = null;
  for (let attempt = 0; attempt < config.map.placementAttempts; attempt += 1) {
    const built = tryBuild(rng, config);
    if (!built || built.state.camps.length === 0) continue;
    if (!best || built.score > best.score) best = built;
    if (built.score >= config.map.minCampTiles) break;
  }
  if (!best || best.state.camps.length < config.map.campCountMin) {
    throw new Error("Could not place a farm with enough camps.");
  }
  best.state.seed = seed;
  best.state.rngState = rng.getState();
  initStoryPeople(best.state, config);
  return best.state;
}
