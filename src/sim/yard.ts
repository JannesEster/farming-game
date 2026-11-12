import { CONFIG } from "./config";
import type { FeatureKind, GameState, TilePoint } from "./types";

export function homesteadYardTile(state: GameState): TilePoint {
  const house = state.features.find((f) => f.kind === "house");
  if (house) return { x: house.x + 1, y: house.y + 2 };
  return {
    x: CONFIG.map.yard.house.x + 12,
    y: CONFIG.map.yard.house.y + 12,
  };
}

export function saleFeatureTile(state: GameState, kind: FeatureKind): TilePoint | null {
  const f = state.features.find((feat) => feat.kind === kind);
  return f ? { x: f.x, y: f.y } : null;
}

/** Camp nearest the homestead kraal for sale drives. */
export function kraalDestinationCampId(state: GameState): number | null {
  const kraal = state.features.find((f) => f.kind === "kraal");
  if (!kraal) return state.camps[0]?.id ?? null;
  const at = state.campIds[kraal.y * state.width + kraal.x];
  if (at !== undefined && at >= 0) return at;
  let best: number | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const camp of state.camps) {
    const d = Math.hypot(camp.anchor.x - kraal.x, camp.anchor.y - kraal.y);
    if (d < bestD) {
      bestD = d;
      best = camp.id;
    }
  }
  return best;
}
