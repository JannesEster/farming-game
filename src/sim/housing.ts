import { CONFIG, type GameConfig } from "./config";
import { STEP3A } from "./step3aConfig";
import type { Feature, GameState, TilePoint } from "./types";

export function workerHouseFeatures(state: GameState): Feature[] {
  return state.features.filter((f) => f.kind === "worker_house");
}

export function countWorkerHouses(state: GameState): number {
  return workerHouseFeatures(state).length;
}

export function countHousedWorkers(state: GameState): number {
  const story = state.story;
  if (!story) return 0;
  let n = 0;
  if (story.farmhand.hired) n += 1;
  return n;
}

export function freeWorkerHouseSlots(state: GameState): number {
  return Math.max(0, countWorkerHouses(state) - countHousedWorkers(state));
}

export function mainHouseTile(state: GameState): TilePoint {
  const house = state.features.find((f) => f.kind === "house");
  if (house) return { x: house.x, y: house.y };
  return {
    x: CONFIG.map.yard.house.x + 11,
    y: CONFIG.map.yard.house.y + 11,
  };
}

export function workerHouseForFarmhand(state: GameState): TilePoint | null {
  const houses = workerHouseFeatures(state);
  if (houses.length === 0) return null;
  return workerHouseDoorTile(state, houses[0]);
}

/** Tile just outside the cottage door, facing the main homestead yard. */
export function workerHouseDoorTile(state: GameState, house: Feature): TilePoint {
  const main = state.features.find((f) => f.kind === "house");
  if (!main) return { x: house.x, y: house.y + 1 };
  const dx = main.x - house.x;
  const dy = main.y - house.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: house.x + Math.round((dx / len) * 0.85),
    y: house.y + Math.round((dy / len) * 0.85),
  };
}

export function buildWorkerHouse(state: GameState, _config: GameConfig = CONFIG): { ok: boolean; message: string } {
  const tile = STEP3A.workerHouseBuildTile;
  const occupied = state.features.some((f) => f.x === tile.x && f.y === tile.y && f.kind !== "track");
  if (occupied) return { ok: false, message: "That plot is already in use." };
  if (state.cashNad < STEP3A.workerHouseBuildCostNad) {
    return { ok: false, message: `Need N$${STEP3A.workerHouseBuildCostNad.toLocaleString("en-NA")} to build.` };
  }
  const duplicate = state.features.some((f) => f.kind === "worker_house" && f.x === tile.x && f.y === tile.y);
  if (duplicate) return { ok: false, message: "That house is already built." };
  state.cashNad -= STEP3A.workerHouseBuildCostNad;
  state.features.push({ kind: "worker_house", x: tile.x, y: tile.y, scale: 1 });
  return { ok: true, message: "Worker house built. You can hire another hand when ready." };
}
