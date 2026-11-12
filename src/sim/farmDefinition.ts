import { CONFIG, type GameConfig } from "./config";
import { generateFarm } from "./generate";
import type { CampState, Feature, GameState, TilePoint } from "./types";

export type FarmCampInfrastructure = {
  water: boolean;
  lick: boolean;
  kraal: boolean;
  windmill: boolean;
  solar: boolean;
  reservoir: boolean;
  trough: boolean;
};

export type FarmDefinitionGate = {
  campA: number;
  campB: number;
  fromGate: TilePoint;
  toGate: TilePoint;
};

/** Compact on disk; camp membership lives in campIds grid. */
export type FarmDefinition = {
  schemaVersion: 2;
  id: string;
  label: string;
  seed: number;
  hectares: number;
  metresPerTile: number;
  width: number;
  height: number;
  campIds: number[];
  camps: {
    id: number;
    name: string;
    hectares: number;
    anchor: TilePoint;
    infrastructure: FarmCampInfrastructure;
  }[];
  gates: FarmDefinitionGate[];
  laneKeys: string[];
  features: Feature[];
  regionKey?: string;
};

export function metresPerTileFromConfig(config: GameConfig = CONFIG): number {
  return config.transit.kmPerTile * 1000;
}

function campBounds(campIds: number[], width: number, campId: number): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let y = 0; y < campIds.length / width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (campIds[y * width + x] === campId) tiles.push({ x, y });
    }
  }
  return tiles;
}

export function farmDefinitionFromState(state: GameState, config: GameConfig = CONFIG): FarmDefinition {
  const gates: FarmDefinitionGate[] = [];
  for (let i = 0; i < state.camps.length; i += 1) {
    for (let j = i + 1; j < state.camps.length; j += 1) {
      const a = state.camps[i];
      const b = state.camps[j];
      const pair = gateBetweenCamps(a, b);
      if (pair) gates.push({ campA: a.id, campB: b.id, fromGate: pair.fromGate, toGate: pair.toGate });
    }
  }
  const laneKeys: string[] = [];
  const features: Feature[] = [];
  for (const feature of state.features) {
    if (feature.kind === "track") laneKeys.push(`${feature.x},${feature.y}`);
    else features.push({ ...feature });
  }

  return {
    schemaVersion: 2,
    id: state.farmMeta?.offerId ?? `seed-${state.seed}`,
    label: config.farm.name,
    seed: state.seed,
    hectares: state.farmMeta?.hectares ?? config.farm.hectares,
    metresPerTile: metresPerTileFromConfig(config),
    width: state.width,
    height: state.height,
    campIds: [...state.campIds],
    camps: state.camps.map((camp) => ({
      id: camp.id,
      name: camp.name,
      hectares: camp.hectares,
      anchor: { ...camp.anchor },
      infrastructure: infrastructureForCamp(state, camp),
    })),
    gates,
    laneKeys,
    features,
    regionKey: state.farmMeta?.regionKey,
  };
}

function gateBetweenCamps(
  from: CampState,
  to: CampState,
): { fromGate: TilePoint; toGate: TilePoint } | null {
  let best: { fromGate: TilePoint; toGate: TilePoint; score: number } | null = null;
  const toCenter = centroid(to.tiles);
  for (const tile of from.tiles) {
    const neighbors = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ];
    for (const n of neighbors) {
      if (!to.tiles.some((t) => t.x === n.x && t.y === n.y)) continue;
      const dx = toCenter.x - tile.x;
      const dy = toCenter.y - tile.y;
      const score = dx * dx + dy * dy;
      if (!best || score < best.score) {
        best = { fromGate: tile, toGate: n, score };
      }
    }
  }
  return best ? { fromGate: best.fromGate, toGate: best.toGate } : null;
}

function centroid(tiles: TilePoint[]): TilePoint {
  let x = 0;
  let y = 0;
  for (const t of tiles) x += t.x, y += t.y;
  return { x: x / tiles.length, y: y / tiles.length };
}

function infrastructureForCamp(state: GameState, camp: CampState): FarmCampInfrastructure {
  const keys = new Set(camp.tiles.map((t) => `${t.x},${t.y}`));
  const inCamp = (kind: Feature["kind"]) =>
    state.features.some((f) => f.kind === kind && keys.has(`${f.x},${f.y}`));
  return {
    water: inCamp("trough") || inCamp("windmill") || inCamp("reservoir"),
    lick: inCamp("trough"),
    kraal: inCamp("kraal"),
    windmill: inCamp("windmill"),
    solar: false,
    reservoir: inCamp("reservoir"),
    trough: inCamp("trough"),
  };
}

export function isFarmDefinition(value: unknown): value is FarmDefinition {
  if (!value || typeof value !== "object") return false;
  const def = value as FarmDefinition;
  return def.schemaVersion === 2 && Array.isArray(def.campIds) && Array.isArray(def.camps);
}

/** Build runtime state from compact farm JSON. Pasture stats come from the same seed via generateFarm. */
export function gameStateFromFarmDefinition(def: FarmDefinition, config: GameConfig = CONFIG): GameState {
  const generated = generateFarm(def.seed, config);
  const camps: CampState[] = def.camps.map((dc) => {
    const prior = generated.camps.find((c) => c.id === dc.id);
    const tiles = campBounds(def.campIds, def.width, dc.id);
    return {
      id: dc.id,
      name: dc.name,
      hectares: dc.hectares,
      peakDmKgPerHa: prior?.peakDmKgPerHa ?? config.pasture.peakDmKgPerHa,
      standingDmKgPerHa: prior?.standingDmKgPerHa ?? config.pasture.peakDmKgPerHa * 0.7,
      soilMoistureMm: prior?.soilMoistureMm ?? 0,
      restDays: prior?.restDays ?? 0,
      tiles,
      anchor: { ...dc.anchor },
    };
  });
  const laneFeatures: Feature[] = def.laneKeys.map((key) => {
    const [sx, sy] = key.split(",").map(Number);
    return { kind: "track", x: sx, y: sy, scale: 1 };
  });
  const herdCamp =
    generated.herd.campId >= 0 && def.campIds.includes(generated.herd.campId)
      ? generated.herd.campId
      : (camps[0]?.id ?? 0);
  return {
    ...generated,
    seed: def.seed,
    width: def.width,
    height: def.height,
    campIds: [...def.campIds],
    camps,
    features: [...def.features, ...laneFeatures],
    herd: { ...generated.herd, campId: herdCamp },
    farmMeta: generated.farmMeta
      ? { ...generated.farmMeta, offerId: def.id, regionKey: def.regionKey ?? generated.farmMeta.regionKey }
      : undefined,
  };
}

export const DEFAULT_FARM_PATH = "/farms/default-farm.json";

let defaultFarmPromise: Promise<FarmDefinition | null> | null = null;

export function loadFarmDefinitionFromUrl(url: string): Promise<FarmDefinition | null> {
  return fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (isFarmDefinition(data) ? data : null))
    .catch(() => null);
}

export function loadDefaultFarmDefinition(): Promise<FarmDefinition | null> {
  if (!defaultFarmPromise) {
    const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
    const path = `${base}${DEFAULT_FARM_PATH.replace(/^\//, "")}`;
    defaultFarmPromise = loadFarmDefinitionFromUrl(path);
  }
  return defaultFarmPromise;
}

export function createGameFromDefinition(def: FarmDefinition, config: GameConfig = CONFIG): GameState {
  return gameStateFromFarmDefinition(def, config);
}
