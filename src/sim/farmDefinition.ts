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

export type FarmDefinitionCamp = {
  id: number;
  name: string;
  hectares: number;
  /** Tile membership for the camp polygon on the grid. */
  tiles: TilePoint[];
  anchor: TilePoint;
  infrastructure: FarmCampInfrastructure;
};

export type FarmDefinitionGate = {
  campA: number;
  campB: number;
  fromGate: TilePoint;
  toGate: TilePoint;
};

export type FarmDefinition = {
  schemaVersion: 1;
  id: string;
  label: string;
  seed: number;
  hectares: number;
  /** Metres represented by one map tile. A. TODO: matches CONFIG.transit.kmPerTile. */
  metresPerTile: number;
  width: number;
  height: number;
  campIds: number[];
  camps: FarmDefinitionCamp[];
  gates: FarmDefinitionGate[];
  lanes: TilePoint[];
  waterpoints: TilePoint[];
  features: Feature[];
  /** ISO 3166 style region key for rainfall table. */
  regionKey?: string;
};

export function metresPerTileFromConfig(config: GameConfig = CONFIG): number {
  return config.transit.kmPerTile * 1000;
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
  const lanes: TilePoint[] = [];
  const waterpoints: TilePoint[] = [];
  for (const feature of state.features) {
    if (feature.kind === "track") lanes.push({ x: feature.x, y: feature.y });
    if (feature.kind === "trough" || feature.kind === "windmill" || feature.kind === "reservoir") {
      waterpoints.push({ x: feature.x, y: feature.y });
    }
  }

  const camps: FarmDefinitionCamp[] = state.camps.map((camp) => ({
    id: camp.id,
    name: camp.name,
    hectares: camp.hectares,
    tiles: camp.tiles,
    anchor: camp.anchor,
    infrastructure: infrastructureForCamp(state, camp),
  }));

  return {
    schemaVersion: 1,
    id: state.farmMeta?.offerId ?? `seed-${state.seed}`,
    label: config.farm.name,
    seed: state.seed,
    hectares: state.farmMeta?.hectares ?? config.farm.hectares,
    metresPerTile: metresPerTileFromConfig(config),
    width: state.width,
    height: state.height,
    campIds: [...state.campIds],
    camps,
    gates,
    lanes,
    waterpoints,
    features: state.features.map((f) => ({ ...f })),
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

/** Build runtime state from a farm definition (pasture values come from generator defaults). */
export function gameStateFromFarmDefinition(def: FarmDefinition, config: GameConfig = CONFIG): GameState {
  const generated = generateFarm(def.seed, config);
  const camps: CampState[] = def.camps.map((dc) => {
    const prior = generated.camps.find((c) => c.id === dc.id);
    return {
      id: dc.id,
      name: dc.name,
      hectares: dc.hectares,
      peakDmKgPerHa: prior?.peakDmKgPerHa ?? config.pasture.peakDmKgPerHa,
      standingDmKgPerHa: prior?.standingDmKgPerHa ?? config.pasture.peakDmKgPerHa * 0.7,
      soilMoistureMm: prior?.soilMoistureMm ?? 0,
      restDays: prior?.restDays ?? 0,
      tiles: dc.tiles.map((t) => ({ ...t })),
      anchor: { ...dc.anchor },
    };
  });
  return {
    ...generated,
    seed: def.seed,
    width: def.width,
    height: def.height,
    campIds: [...def.campIds],
    camps,
    features: def.features.map((f) => ({ ...f })),
  };
}
