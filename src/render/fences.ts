import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { fenceGateBetweenCamps } from "../sim/path";
import { TILE_OUTSIDE, type GameState } from "../sim/types";
import { tileTop } from "./iso";
import type { IsoLayout } from "./iso";
import { palette } from "./palette";
import { CAMP_GATE_METRES, PIXELS_PER_METRE } from "./worldScale";

export type FenceSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "boundary" | "selected" | "inner";
  gate: boolean;
};

function edgeHasGate(
  gate: { a: { x: number; y: number }; b: { x: number; y: number } } | null,
  x: number,
  y: number,
  nx: number,
  ny: number,
): boolean {
  if (!gate) return false;
  return (
    (gate.a.x === x && gate.a.y === y && gate.b.x === nx && gate.b.y === ny) ||
    (gate.b.x === x && gate.b.y === y && gate.a.x === nx && gate.a.y === ny)
  );
}

export function collectFenceSegments(
  state: GameState,
  layout: IsoLayout,
  herdCampId: number,
  selected: boolean,
): FenceSegment[] {
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  const segments: FenceSegment[] = [];

  const fenceKind = (a: number, b: number): FenceSegment["kind"] => {
    if (a === TILE_OUTSIDE || b === TILE_OUTSIDE) return "boundary";
    if (selected && (a === herdCampId || b === herdCampId)) return "selected";
    return "inner";
  };

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const id = state.campIds[y * state.width + x];
      const top = tileTop(x, y, layout, tileW, tileH);
      const right = { x: top.x + tileW / 2, y: top.y + tileH / 2 };
      const bottom = { x: top.x, y: top.y + tileH };
      const left = { x: top.x - tileW / 2, y: top.y + tileH / 2 };
      const rightId = x + 1 < state.width ? state.campIds[y * state.width + x + 1] : null;
      const downId = y + 1 < state.height ? state.campIds[(y + 1) * state.width + x] : null;

      if (rightId !== null && rightId !== id) {
        const gatePair = id >= 0 && rightId >= 0 ? fenceGateBetweenCamps(state, id, rightId) : null;
        const gate = edgeHasGate(gatePair, x, y, x + 1, y);
        segments.push({
          x1: right.x,
          y1: right.y,
          x2: bottom.x,
          y2: bottom.y,
          kind: fenceKind(id, rightId),
          gate,
        });
      } else if (rightId === null && id !== TILE_OUTSIDE) {
        segments.push({
          x1: right.x,
          y1: right.y,
          x2: bottom.x,
          y2: bottom.y,
          kind: "boundary",
          gate: false,
        });
      }

      if (downId !== null && downId !== id) {
        const gatePair = id >= 0 && downId >= 0 ? fenceGateBetweenCamps(state, id, downId) : null;
        const gate = edgeHasGate(gatePair, x, y, x, y + 1);
        segments.push({
          x1: left.x,
          y1: left.y,
          x2: bottom.x,
          y2: bottom.y,
          kind: fenceKind(id, downId),
          gate,
        });
      } else if (downId === null && id !== TILE_OUTSIDE) {
        segments.push({
          x1: left.x,
          y1: left.y,
          x2: bottom.x,
          y2: bottom.y,
          kind: "boundary",
          gate: false,
        });
      }
    }
  }
  return openFenceGates(mergeStraightFences(segments));
}

/**
 * Posts along a straightened run. A few metres apart, the way a stock fence
 * is built, rather than one post per tile step.
 */
export const FENCE_POST_SPACING_METRES = 4;

function pointKey(x: number, y: number): string {
  return `${Math.round(x)}:${Math.round(y)}`;
}

function sameDirection(a: FenceSegment, b: FenceSegment): boolean {
  if (a.kind !== b.kind) return false;
  const adx = a.x2 - a.x1;
  const ady = a.y2 - a.y1;
  const bdx = b.x2 - b.x1;
  const bdy = b.y2 - b.y1;
  const al = Math.hypot(adx, ady) || 1;
  const bl = Math.hypot(bdx, bdy) || 1;
  const cross = (adx / al) * (bdy / bl) - (ady / al) * (bdx / bl);
  const dot = (adx / al) * (bdx / bl) + (ady / al) * (bdy / bl);
  return Math.abs(cross) < 0.02 && dot > 0.98;
}

/**
 * Join collinear tile edges that share an endpoint into one run from corner
 * post to corner post. A gate stays its own gap so the wire stops there.
 * Axis-aligned camp borders become the two long isometric diagonals.
 */
export function mergeStraightFences(segments: FenceSegment[]): FenceSegment[] {
  const gates = segments.filter((segment) => segment.gate);
  const wires = segments.filter((segment) => !segment.gate && Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > 0.5);
  const byStart = new Map<string, number[]>();
  const byEnd = new Map<string, number[]>();
  wires.forEach((segment, index) => {
    const start = pointKey(segment.x1, segment.y1);
    const end = pointKey(segment.x2, segment.y2);
    const starts = byStart.get(start);
    if (starts) starts.push(index);
    else byStart.set(start, [index]);
    const ends = byEnd.get(end);
    if (ends) ends.push(index);
    else byEnd.set(end, [index]);
  });
  const used = new Set<number>();
  const merged: FenceSegment[] = [];
  for (let index = 0; index < wires.length; index += 1) {
    if (used.has(index)) continue;
    used.add(index);
    const seed = wires[index];
    let head = seed;
    let tail = seed;
    let guard = 0;
    while (guard < wires.length) {
      guard += 1;
      const next = (byStart.get(pointKey(tail.x2, tail.y2)) ?? []).find(
        (candidate) => !used.has(candidate) && sameDirection(seed, wires[candidate]),
      );
      if (next === undefined) break;
      used.add(next);
      tail = wires[next];
    }
    guard = 0;
    while (guard < wires.length) {
      guard += 1;
      const prev = (byEnd.get(pointKey(head.x1, head.y1)) ?? []).find(
        (candidate) => !used.has(candidate) && sameDirection(seed, wires[candidate]),
      );
      if (prev === undefined) break;
      used.add(prev);
      head = wires[prev];
    }
    merged.push({
      x1: head.x1,
      y1: head.y1,
      x2: tail.x2,
      y2: tail.y2,
      kind: seed.kind,
      gate: false,
    });
  }
  return merged.concat(gates);
}

/** Widen each gate to a real opening and pull the wires back to the gate posts. */
export function openFenceGates(segments: FenceSegment[], gapPx = CAMP_GATE_METRES * PIXELS_PER_METRE): FenceSegment[] {
  const gates = segments.filter((segment) => segment.gate);
  let wires = segments.filter((segment) => !segment.gate);
  const half = gapPx / 2;
  for (const gate of gates) {
    wires = wires.flatMap((wire) => {
      const trimmed = trimWireForGate(wire, gate, half);
      return trimmed ? [trimmed] : [];
    });
  }
  const opened = gates.map((gate) => widenGate(gate, half));
  return wires.concat(opened);
}

function trimWireForGate(segment: FenceSegment, gate: FenceSegment, half: number): FenceSegment | null {
  const gdx = gate.x2 - gate.x1;
  const gdy = gate.y2 - gate.y1;
  const glen = Math.hypot(gdx, gdy) || 1;
  const cross = (segment.x2 - segment.x1) * gdy - (segment.y2 - segment.y1) * gdx;
  const scale = (Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) || 1) * glen;
  if (Math.abs(cross) / scale > 0.02) return segment;
  const dirx = gdx / glen;
  const diry = gdy / glen;
  const cx = (gate.x1 + gate.x2) / 2;
  const cy = (gate.y1 + gate.y2) / 2;
  const touches = (x: number, y: number) =>
    Math.hypot(x - gate.x1, y - gate.y1) < 1.5 || Math.hypot(x - gate.x2, y - gate.y2) < 1.5;
  const pulled = (x: number, y: number) => {
    const along = (x - cx) * dirx + (y - cy) * diry;
    const side = along >= 0 ? 1 : -1;
    return { x: cx + dirx * half * side, y: cy + diry * half * side };
  };
  let x1 = segment.x1;
  let y1 = segment.y1;
  let x2 = segment.x2;
  let y2 = segment.y2;
  if (touches(x1, y1)) {
    const next = pulled(x1, y1);
    x1 = next.x;
    y1 = next.y;
  }
  if (touches(x2, y2)) {
    const next = pulled(x2, y2);
    x2 = next.x;
    y2 = next.y;
  }
  const dot = (x2 - x1) * (segment.x2 - segment.x1) + (y2 - y1) * (segment.y2 - segment.y1);
  if (dot <= 0 || Math.hypot(x2 - x1, y2 - y1) < 4) return null;
  return { ...segment, x1, y1, x2, y2 };
}

function widenGate(gate: FenceSegment, half: number): FenceSegment {
  const dx = gate.x2 - gate.x1;
  const dy = gate.y2 - gate.y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (gate.x1 + gate.x2) / 2;
  const cy = (gate.y1 + gate.y2) / 2;
  return {
    ...gate,
    x1: cx - (dx / len) * half,
    y1: cy - (dy / len) * half,
    x2: cx + (dx / len) * half,
    y2: cy + (dy / len) * half,
  };
}

/** Nearest point on a fence run. Long runs are not measured from their midpoint. */
export function closestPointOnFence(
  x: number,
  y: number,
  segment: FenceSegment,
): { x: number; y: number } {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / len2));
  return { x: segment.x1 + dx * t, y: segment.y1 + dy * t };
}

/** World px between the two fence wires so they read as separate strands at ~0.53 zoom. */
export const FENCE_WIRE_STRAND_OFFSET_PX = 5;

export function wireStrandOffset(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset = FENCE_WIRE_STRAND_OFFSET_PX,
): { ox: number; oy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { ox: (-dy / len) * offset, oy: (dx / len) * offset };
}

function strokeDoubleWire(
  graphics: Phaser.GameObjects.Graphics,
  segment: FenceSegment,
  colour: number,
  alpha: number,
  width: number,
): void {
  const { ox, oy } = wireStrandOffset(segment.x1, segment.y1, segment.x2, segment.y2);
  graphics.lineStyle(width, colour, alpha);
  for (const sign of [-1, 0, 1]) {
    graphics.beginPath();
    graphics.moveTo(segment.x1 + ox * sign, segment.y1 + oy * sign);
    graphics.lineTo(segment.x2 + ox * sign, segment.y2 + oy * sign);
    graphics.strokePath();
  }
}

export function drawFences(
  graphics: Phaser.GameObjects.Graphics,
  segments: FenceSegment[],
  cameraZoom = 1,
  options: { posts?: boolean } = {},
): void {
  graphics.clear();
  const zoomBoost = Math.max(1, 0.62 / Math.max(cameraZoom, 0.12));
  const buckets: Record<FenceSegment["kind"], FenceSegment[]> = {
    inner: [],
    boundary: [],
    selected: [],
  };
  for (const segment of segments) buckets[segment.kind].push(segment);

  const drawBucket = (list: FenceSegment[], width: number, colour: number, alpha: number) => {
    for (const segment of list) {
      if (segment.gate) continue;
      strokeDoubleWire(graphics, segment, colour, alpha, width);
    }
  };

  drawBucket(
    buckets.inner,
    Math.max(1.1, CONFIG.view.fencePx * 0.65 * zoomBoost),
    palette.fenceWire,
    0.74,
  );
  drawBucket(
    buckets.boundary,
    Math.max(1.3, CONFIG.view.fenceBoundaryPx * 0.7 * zoomBoost),
    palette.fenceStrong,
    0.84,
  );
  drawBucket(
    buckets.selected,
    CONFIG.view.fenceSelectedPx * 0.85 * zoomBoost,
    palette.fenceSelected,
    0.95,
  );

  if (options.posts === false) return;
  const spacing = FENCE_POST_SPACING_METRES * PIXELS_PER_METRE;
  for (const segment of segments) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy);
    const count = Math.max(2, Math.floor(length / spacing));
    for (let i = 0; i <= count; i += 1) {
      if (segment.gate && i > 0 && i < count) continue;
      const t = i / count;
      const px = segment.x1 + dx * t;
      const py = segment.y1 + dy * t;
      const post = (segment.gate ? 3.2 : 2.6) * Math.min(zoomBoost, 2);
      graphics.fillStyle(0x4a3a28, 1);
      graphics.fillRect(px - post * 0.45, py - post * 2.4, post * 0.9, post * 3.1);
      graphics.fillStyle(palette.fencePost, 1);
      graphics.fillRect(px - post * 0.7, py - post * 2.6, post * 1.4, post * 0.55);
    }
  }
}
