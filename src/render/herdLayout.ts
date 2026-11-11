import type { CampState, GameState } from "../sim/types";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import type { HerdOffset } from "./art";
import { worldToTile, type IsoLayout } from "./iso";
import { trackKeys } from "./colour";

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

const GATE_PROGRESS = 0.5;
const GATE_ALONG_PX = 32;
const GATE_APPROACH_PX = 110;

function tileAllowed(
  state: GameState,
  tx: number,
  ty: number,
  fromCampId: number,
  destCampId: number | undefined,
  inTransit: boolean,
  track: Set<string>,
): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  const key = `${tx},${ty}`;
  const id = state.campIds[ty * state.width + tx];
  if (id === TILE_HOMESTEAD) return false;
  if (id === TILE_OUTSIDE) return inTransit && track.has(key);
  if (inTransit) {
    if (track.has(key)) return true;
    if (id === fromCampId) return true;
    if (destCampId !== undefined && id === destCampId) return true;
    return false;
  }
  return id === fromCampId;
}

/** Pull offsets back until each animal stands on an allowed grazing tile. */
export function clampOffsetsToCamp(
  state: GameState,
  fromCampId: number,
  offsets: HerdOffset[],
  herdX: number,
  herdY: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  inTransit: boolean,
  track: Set<string> = trackKeys(state),
): HerdOffset[] {
  const destCampId = state.herd.transit?.toCampId;
  return offsets.map((o) => {
    let x = o.x;
    let y = o.y;
    for (let step = 0; step < 12; step += 1) {
      const tile = worldToTile(herdX + x, herdY + y, layout, tileW, tileH);
      const tx = Math.round(tile.x);
      const ty = Math.round(tile.y);
      if (tileAllowed(state, tx, ty, fromCampId, destCampId, inTransit, track)) {
        return { ...o, x, y };
      }
      x *= 0.78;
      y *= 0.78;
    }
    return { ...o, x: 0, y: 0 };
  });
}

/** One grazing mob clustered inside the occupied camp (not spread across tiles). */
export function spreadInCamp(
  camp: CampState,
  count: number,
  seed: number,
  _layout: IsoLayout,
  tileW: number,
  tileH: number,
): HerdOffset[] {
  const next = rng(seed + camp.id * 997);
  const radiusX = tileW * 0.36;
  const radiusY = tileH * 0.2;
  const offsets: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const angle = t * Math.PI * 2 * 2.1 + next() * 0.35;
    const radial = Math.sqrt(t) * (0.55 + next() * 0.35);
    offsets.push({
      x: Math.cos(angle) * radiusX * radial + (next() - 0.5) * tileW * 0.08,
      y: Math.sin(angle) * radiusY * radial + (next() - 0.5) * tileH * 0.06,
      flip: next() > 0.5,
      coat: Math.floor(next() * 6),
      scale: 0.88 + next() * 0.08,
    });
  }
  return offsets;
}

/**
 * Trekking mob: loose spread in camps, stretched queue approaching the gate,
 * and a tight single/double file while each animal crosses the gate opening.
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
  const pathStretchPx = 320 * herdScale;
  const herdAtGate = Math.abs(progress - GATE_PROGRESS) < 0.1;
  const offsets: HerdOffset[] = [];

  for (let i = 0; i < count; i += 1) {
    const phase = cowPhase(seed, i);
    const rank = count <= 1 ? 0.5 : i / (count - 1);

    const alongBase = (0.5 - rank) * pathStretchPx;
    const wobbleAlong = Math.sin(timeMs / 820 + phase * 8.4) * (4.5 * herdScale);

    const looseAcross =
      (next() - 0.5) * 54 * herdScale +
      Math.sin(timeMs / 640 + phase * 14.2) * (22 * herdScale) +
      Math.cos(timeMs / 930 + phase * 6.1) * (14 * herdScale);
    const looseAlong = alongBase + wobbleAlong;

    let across = looseAcross;
    let along = looseAlong;

    if (herdAtGate) {
      const distAlong = Math.abs(looseAlong);
      if (distAlong < GATE_APPROACH_PX) {
        const approachT = 1 - distAlong / GATE_APPROACH_PX;
        const funnel = approachT * approachT;
        const lane = (i % 2 === 0 ? -1 : 1) * (8 + (i % 3));
        const slotJitter = (phase - 0.5) * 4;
        across = looseAcross * (1 - funnel) + (lane + slotJitter) * funnel;

        if (distAlong < GATE_ALONG_PX) {
          const gateT = 1 - distAlong / GATE_ALONG_PX;
          const queueSlot = Math.floor(rank * count);
          const fileLane = (queueSlot % 2 === 0 ? -1 : 1) * 10;
          across = fileLane + slotJitter * 0.25;
          along =
            alongBase * (1 - gateT * 0.92) +
            ((queueSlot % 3) - 1) * 9 * gateT +
            Math.sin(timeMs / 520 + phase * 11) * gateT * 1.2;
        }
      }
    }

    const nibble = Math.sin(timeMs / 380 + i * 1.65 + phase * 4) > 0.97;
    const nibbleBack = nibble ? -5 : 0;

    offsets.push({
      x: ux * (along + nibbleBack) + px * across,
      y: uy * (along + nibbleBack) + py * across,
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

/** Perpendicular spread for animals currently squeezed through the gate opening. */
export function gateFileWidthPx(
  offsets: HerdOffset[],
  dirX: number,
  dirY: number,
  progress: number,
  count: number,
  seed: number,
  timeMs: number,
): number {
  const herdScale = Math.max(1, Math.sqrt(count / 24));
  const pathStretchPx = 320 * herdScale;
  const subset: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const rank = count <= 1 ? 0.5 : i / (count - 1);
    const phase = cowPhase(seed, i);
    const alongBase = (0.5 - rank) * pathStretchPx;
    const wobbleAlong = Math.sin(timeMs / 820 + phase * 8.4) * (4.5 * herdScale);
    const along = alongBase + wobbleAlong;
    if (Math.abs(progress - GATE_PROGRESS) < 0.1 && Math.abs(along) < GATE_ALONG_PX) {
      subset.push(offsets[i]);
    }
  }
  return mobWidthPx(subset.length > 1 ? subset : offsets.slice(0, 2), dirX, dirY);
}

export function mobWidthPx(offsets: HerdOffset[], dirX: number, dirY: number): number {
  if (offsets.length < 2) return 0;
  const pathLen = Math.hypot(dirX, dirY) || 1;
  const perpX = -dirY / pathLen;
  const perpY = dirX / pathLen;
  let minP = Number.POSITIVE_INFINITY;
  let maxP = Number.NEGATIVE_INFINITY;
  for (const o of offsets) {
    const perp = o.x * perpX + o.y * perpY;
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
  herdX: number,
  herdY: number,
): HerdOffset[] {
  const track = trackKeys(state);
  const count = state.herd.headCount;
  const fromCampId = state.herd.campId;
  const fromCamp = state.camps.find((c) => c.id === fromCampId);
  if (!fromCamp) return [];
  let spreadCamp = fromCamp;
  if (inTransit && progress > 0.85 && state.herd.transit) {
    spreadCamp = state.camps.find((c) => c.id === state.herd.transit!.toCampId) ?? fromCamp;
  }
  let spread = spreadInCamp(spreadCamp, count, state.seed, layout, tileW, tileH);
  if (inTransit) {
    const trek = organicTrekOffsets(count, state.seed, tangent.x, tangent.y, progress, timeMs);
    let trekWeight = 1;
    if (progress > 0.86) trekWeight = Math.max(0, (1 - progress) / 0.14);
    spread = blendOffsets(spread, trek, trekWeight);
  }
  return clampOffsetsToCamp(state, fromCampId, spread, herdX, herdY, layout, tileW, tileH, inTransit, track);
}
