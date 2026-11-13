import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { usesMetreCoords } from "../sim/metreFarm";
import { fenceGateBetweenCamps } from "../sim/path";
import { TILE_OUTSIDE, type GameState } from "../sim/types";
import { tileCenter, tileTop } from "./iso";
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

function edgeKey(x1: number, y1: number, x2: number, y2: number): string {
  const a = `${Math.round(x1)},${Math.round(y1)}`;
  const b = `${Math.round(x2)},${Math.round(y2)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** One straight run per rectangle edge. Shared edges are drawn once, with a gate at the middle. */
function collectRectFenceSegments(
  state: GameState,
  layout: IsoLayout,
  herdCampId: number,
  selected: boolean,
): FenceSegment[] {
  const tileW = PIXELS_PER_METRE;
  const tileH = PIXELS_PER_METRE / 2;
  const edges = new Map<string, { x1: number; y1: number; x2: number; y2: number; a: number; b: number }>();
  for (const camp of state.camps) {
    const rect = camp.rect;
    if (!rect) continue;
    const sides = [
      [rect.x, rect.y, rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
      [rect.x, rect.y + rect.h, rect.x, rect.y],
    ];
    for (const [x1, y1, x2, y2] of sides) {
      const key = edgeKey(x1, y1, x2, y2);
      const existing = edges.get(key);
      if (existing) existing.b = camp.id;
      else edges.set(key, { x1, y1, x2, y2, a: camp.id, b: TILE_OUTSIDE });
    }
  }
  const segments: FenceSegment[] = [];
  for (const edge of edges.values()) {
    const p1 = tileCenter(edge.x1, edge.y1, layout, tileW, tileH);
    const p2 = tileCenter(edge.x2, edge.y2, layout, tileW, tileH);
    const kind: FenceSegment["kind"] =
      edge.b < 0 ? "boundary" : selected && (edge.a === herdCampId || edge.b === herdCampId) ? "selected" : "inner";
    segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, kind, gate: false });
    if (edge.b < 0) continue;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const half = 4;
    segments.push({
      x1: midX - (dx / len) * half,
      y1: midY - (dy / len) * half,
      x2: midX + (dx / len) * half,
      y2: midY + (dy / len) * half,
      kind,
      gate: true,
    });
  }
  return openFenceGates(mergeStraightFences(segments));
}

export function collectFenceSegments(
  state: GameState,
  layout: IsoLayout,
  herdCampId: number,
  selected: boolean,
): FenceSegment[] {
  if (usesMetreCoords(state)) return collectRectFenceSegments(state, layout, herdCampId, selected);
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
    wires = wires.flatMap((wire) => splitWireAtGate(wire, gate, half));
  }
  const opened = gates.map((gate) => widenGate(gate, half));
  return wires.concat(opened);
}

/** Cut a straight wire where a gate sits on it, and pull an end that already meets the gate. */
function splitWireAtGate(segment: FenceSegment, gate: FenceSegment, half: number): FenceSegment[] {
  const gdx = gate.x2 - gate.x1;
  const gdy = gate.y2 - gate.y1;
  const glen = Math.hypot(gdx, gdy) || 1;
  const cross = (segment.x2 - segment.x1) * gdy - (segment.y2 - segment.y1) * gdx;
  const scale = (Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) || 1) * glen;
  if (Math.abs(cross) / scale > 0.02) return [segment];
  const dirx = gdx / glen;
  const diry = gdy / glen;
  const cx = (gate.x1 + gate.x2) / 2;
  const cy = (gate.y1 + gate.y2) / 2;
  const along = (x: number, y: number) => (x - cx) * dirx + (y - cy) * diry;
  const a1 = along(segment.x1, segment.y1);
  const a2 = along(segment.x2, segment.y2);
  const lo = Math.min(a1, a2);
  const hi = Math.max(a1, a2);
  if (hi < -half - 1.5 || lo > half + 1.5) return [segment];
  const forward = a2 >= a1;
  const point = (d: number) => ({ x: cx + dirx * d, y: cy + diry * d });
  const pieces: FenceSegment[] = [];
  const push = (from: number, to: number) => {
    if (to - from < 4) return;
    const p = point(from);
    const q = point(to);
    pieces.push({
      ...segment,
      x1: forward ? p.x : q.x,
      y1: forward ? p.y : q.y,
      x2: forward ? q.x : p.x,
      y2: forward ? q.y : p.y,
      gate: false,
    });
  };
  if (lo < -half) push(lo, Math.min(hi, -half));
  if (hi > half) push(Math.max(lo, half), hi);
  return pieces;
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
  options: { posts?: boolean; single?: boolean } = {},
): void {
  graphics.clear();
  if (options.single) {
    const width = 1.6 / Math.max(cameraZoom, 0.004);
    graphics.lineStyle(width, 0x2a241c, 0.95);
    for (const segment of segments) {
      if (segment.gate) continue;
      graphics.beginPath();
      graphics.moveTo(segment.x1, segment.y1);
      graphics.lineTo(segment.x2, segment.y2);
      graphics.strokePath();
    }
    return;
  }
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
