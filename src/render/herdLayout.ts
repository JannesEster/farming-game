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

function cowPhase(seed: number, index: number): number {
  return ((seed + index * 7919) % 1000) / 1000;
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
    const tile = tiles[(i * 7 + 3) % tiles.length];
    const pt = tileCenter(tile.x, tile.y, layout, tileW, tileH);
    const jitterX = (next() - 0.5) * tileW * 0.72;
    const jitterY = (next() - 0.5) * tileH * 1.1;
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

/**
 * Loose trekking mob along the path tangent: leaders and stragglers, lateral drift,
 * slight speed variation, and brief nibbles. Bunches a little at the gate without a rigid column.
 */
export function organicTrekOffsets(
  count: number,
  seed: number,
  dirX: number,
  dirY: number,
  progress: number,
  timeMs: number,
): HerdOffset[] {
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;
  const px = -uy;
  const py = ux;
  const next = rng(seed + 4049);
  const herdScale = Math.max(1, Math.sqrt(count / 24));
  const stringOut = (36 + progress * 260) * herdScale;
  const gatePinch = Math.exp(-((progress - 0.48) ** 2) / 0.012);
  const offsets: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const phase = cowPhase(seed, i);
    const rank = count <= 1 ? 0.5 : i / (count - 1);
    const speedMul = 0.85 + phase * 0.3;
    const alongCompress = 1 - gatePinch * 0.28;
    const leaderLag = (rank - 0.42) * stringOut * speedMul * alongCompress;
    const wobbleAlong = Math.sin(timeMs / 820 + phase * 8.4) * (5.5 * herdScale);
    const baseAcross = (next() - 0.5) * 52 * herdScale;
    const drift =
      Math.sin(timeMs / 640 + phase * 14.2) * (22 * herdScale) +
      Math.cos(timeMs / 930 + phase * 6.1) * (16 * herdScale) +
      baseAcross;
    const gateTight = gatePinch * 0.55;
    const across = drift * (1 - gateTight);
    const nibble = Math.sin(timeMs / 380 + i * 1.65 + phase * 4) > 0.965;
    const nibbleBack = nibble ? -5.5 : 0;
    offsets.push({
      x: ux * (leaderLag + wobbleAlong + nibbleBack) + px * across,
      y: uy * (leaderLag + wobbleAlong + nibbleBack) + py * across,
      flip: ux + across * 0.02 > 0,
      coat: Math.floor(phase * 6) % 6,
      scale: (0.64 + (phase % 0.12)) * (nibble ? 0.92 : 1),
    });
  }
  return offsets;
}

export function lateralSpreadPx(offsets: HerdOffset[]): number {
  if (offsets.length < 2) return 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const o of offsets) {
    minX = Math.min(minX, o.x);
    maxX = Math.max(maxX, o.x);
  }
  return maxX - minX;
}

/** Width of the mob perpendicular to the march direction (world units). */
export function mobSpanPx(offsets: HerdOffset[]): { width: number; height: number } {
  if (offsets.length < 2) return { width: 0, height: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const o of offsets) {
    minX = Math.min(minX, o.x);
    maxX = Math.max(maxX, o.x);
    minY = Math.min(minY, o.y);
    maxY = Math.max(maxY, o.y);
  }
  return { width: maxX - minX, height: maxY - minY };
}

export function mobWidthPx(offsets: HerdOffset[], dirX: number, dirY: number): number {
  if (offsets.length < 2) return 0;
  const len = Math.hypot(dirX, dirY) || 1;
  const px = -dirY / len;
  const py = dirX / len;
  let minP = Number.POSITIVE_INFINITY;
  let maxP = Number.NEGATIVE_INFINITY;
  for (const o of offsets) {
    const perp = o.x * px + o.y * py;
    minP = Math.min(minP, perp);
    maxP = Math.max(maxP, perp);
  }
  return maxP - minP;
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
      scale: s.scale * (1 - t * 0.08) + m.scale * t * 0.08,
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
  timeMs: number,
): HerdOffset[] {
  const count = state.herd.headCount;
  let campId = state.herd.campId;
  if (inTransit && progress > 0.85 && state.herd.transit) campId = state.herd.transit.toCampId;
  const camp = state.camps.find((c) => c.id === campId);
  if (!camp) return [];
  const spread = spreadInCamp(camp, count, state.seed, layout, tileW, tileH);
  if (!inTransit) return spread;
  const trek = organicTrekOffsets(count, state.seed, tangent.x, tangent.y, progress, timeMs);
  let trekWeight = 1;
  if (progress > 0.86) trekWeight = Math.max(0, (1 - progress) / 0.14);
  return blendOffsets(spread, trek, trekWeight);
}
