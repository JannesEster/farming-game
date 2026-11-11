import type { CampState, GameState } from "../sim/types";
import type { HerdOffset } from "./art";
import { tileCenter } from "./iso";
import type { IsoLayout } from "./iso";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Spread cattle across camp tiles for grazing (August dry season mob). */
export function spreadInCamp(
  camp: CampState,
  count: number,
  seed: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): HerdOffset[] {
  const next = rng(seed + camp.id * 997);
  const tiles = camp.tiles.length > 0 ? camp.tiles : [camp.anchor];
  const center = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
  const offsets: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const tile = tiles[i % tiles.length];
    const pt = tileCenter(tile.x, tile.y, layout, tileW, tileH);
    const jitterX = (next() - 0.5) * tileW * 0.55;
    const jitterY = (next() - 0.5) * tileH * 0.9;
    offsets.push({
      x: pt.x - center.x + jitterX,
      y: pt.y - center.y + jitterY,
      flip: next() > 0.5,
      coat: Math.floor(next() * 6),
      scale: 0.62 + next() * 0.14,
    });
  }
  return offsets;
}

/** Narrow column for walking through a gate. */
export function marchColumn(count: number, seed: number, dirX: number, dirY: number): HerdOffset[] {
  const next = rng(seed + 4049);
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;
  const px = -uy;
  const py = ux;
  const offsets: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const along = (i - count / 2) * 5.5 + (next() - 0.5) * 2;
    const across = (next() - 0.5) * 10;
    offsets.push({
      x: ux * along + px * across,
      y: uy * along + py * across,
      flip: ux > 0,
      coat: Math.floor(next() * 6),
      scale: 0.64 + next() * 0.12,
    });
  }
  return offsets;
}

export function blendOffsets(
  spread: HerdOffset[],
  march: HerdOffset[],
  columnWeight: number,
): HerdOffset[] {
  const t = Math.max(0, Math.min(1, columnWeight));
  return spread.map((s, i) => {
    const m = march[i] ?? march[march.length - 1] ?? s;
    return {
      x: s.x * (1 - t) + m.x * t,
      y: s.y * (1 - t) + m.y * t,
      flip: t > 0.5 ? m.flip : s.flip,
      coat: s.coat,
      scale: s.scale * (1 - t * 0.15) + m.scale * t * 0.15,
    };
  });
}

export function offsetsForHerd(
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  inTransit: boolean,
  progress: number,
  tangent: { x: number; y: number },
): HerdOffset[] {
  const count = state.herd.headCount;
  let campId = state.herd.campId;
  if (inTransit && progress > 0.85 && state.herd.transit) campId = state.herd.transit.toCampId;
  const camp = state.camps.find((c) => c.id === campId);
  if (!camp) return [];
  const spread = spreadInCamp(camp, count, state.seed, layout, tileW, tileH);
  if (!inTransit) return spread;
  const march = marchColumn(count, state.seed, tangent.x, tangent.y);
  let columnT = 1;
  if (progress > 0.88) columnT = (1 - progress) / 0.12;
  return blendOffsets(spread, march, columnT);
}
