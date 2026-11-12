import { CONFIG, type GameConfig } from "../sim/config";
import { campGateBetween, planHerdPath, trackTileSet } from "../sim/path";
import type { FarmOfferCard } from "./types";
import type { GameState } from "../sim/types";

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

function homesteadReachable(state: GameState): boolean {
  const tracks = trackTileSet(state);
  const homesteadTiles = new Set<string>();
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (state.campIds[idx(x, y, state.width)] === -1) homesteadTiles.add(`${x},${y}`);
    }
  }
  const yardTrack = [...tracks].find((key) => {
    const [sx] = key.split(",").map(Number);
    return homesteadTiles.has(key) || Math.abs(sx - state.width / 2) < 4;
  });
  if (!yardTrack) return tracks.size > 0;
  return tracks.size > 0;
}

function campsHaveGates(state: GameState): boolean {
  let touching = 0;
  for (let i = 0; i < state.camps.length; i += 1) {
    for (let j = i + 1; j < state.camps.length; j += 1) {
      if (campGateBetween(state.camps[i], state.camps[j])) touching += 1;
    }
  }
  return touching > 0;
}

function campCountMatchesCard(state: GameState, card: FarmOfferCard): boolean {
  return state.camps.length === card.campCount;
}

function waterMatchesCard(state: GameState, card: FarmOfferCard): boolean {
  const meta = state.farmMeta?.water;
  if (!meta) return false;
  return (
    meta.boreholes === card.water.boreholes &&
    meta.windmills === card.water.windmills &&
    meta.solar === card.water.solar
  );
}

export type OfferValidation = {
  ok: boolean;
  errors: string[];
};

const validationByCard = new WeakMap<FarmOfferCard, OfferValidation>();

export function validateOfferCard(card: FarmOfferCard, config: GameConfig = CONFIG): OfferValidation {
  const cached = validationByCard.get(card);
  if (cached) return cached;
  const state = card.previewState;
  const errors: string[] = [];

  if (!campCountMatchesCard(state, card)) {
    errors.push(`camp count ${state.camps.length} != card ${card.campCount}`);
  }

  const grazingHa = config.farm.hectares - config.farm.homesteadHectares;
  const sumHa = state.camps.reduce((s, c) => s + c.hectares, 0);
  if (Math.abs(sumHa - grazingHa) > 0.5) {
    errors.push(`grazing ha ${sumHa} != ${grazingHa}`);
  }

  if (!campsHaveGates(state)) errors.push("no camp gate pairs");
  if (!homesteadReachable(state)) errors.push("homestead track network missing");

  for (const camp of state.camps) {
    if (camp.tiles.length < config.map.minCampTiles) {
      errors.push(`camp ${camp.id} too small (${camp.tiles.length} tiles)`);
    }
    const other = state.camps.find((c) => c.id !== camp.id);
    if (other) {
      const path = planHerdPath(state, camp.id, other.id);
      if (path.length < 2) errors.push(`no path ${camp.id} -> ${other.id}`);
    }
  }

  if (!waterMatchesCard(state, card)) {
    errors.push("water inventory mismatch card");
  }

  if (card.playable && state.herd.headCount <= 0) {
    errors.push("playable offer missing herd");
  }

  const result = { ok: errors.length === 0, errors };
  validationByCard.set(card, result);
  return result;
}
