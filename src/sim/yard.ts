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

/** Walk `steps` tiles out from the yard along the farm road (track features). */
export function tileAlongRoad(state: GameState, steps: number): TilePoint {
  const house = state.features.find((f) => f.kind === "house") ?? { x: 12, y: 12 };
  const tracks: TilePoint[] = state.features
    .filter((f) => f.kind === "track")
    .map((f) => ({ x: f.x, y: f.y }));
  if (tracks.length === 0) return { x: house.x, y: house.y + 2 + steps };
  const key = (p: TilePoint) => `${p.x},${p.y}`;
  const set = new Set(tracks.map((t) => key(t)));
  let cur: TilePoint = tracks[0];
  let best = Number.POSITIVE_INFINITY;
  for (const t of tracks) {
    const d = Math.hypot(t.x - house.x, t.y - house.y);
    if (d < best) {
      best = d;
      cur = t;
    }
  }
  const seen = new Set<string>();
  for (let i = 0; i < steps; i += 1) {
    seen.add(key(cur));
    const nbrs = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ].filter((p) => set.has(key(p)) && !seen.has(key(p)));
    nbrs.sort(
      (a, b) => Math.hypot(b.x - house.x, b.y - house.y) - Math.hypot(a.x - house.x, a.y - house.y),
    );
    if (nbrs.length === 0) break;
    cur = nbrs[0];
  }
  return { x: cur.x, y: cur.y };
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
