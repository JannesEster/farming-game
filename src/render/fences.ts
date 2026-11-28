import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { usesMetreCoords } from "../sim/metreFarm";
import { campGateBetween, fenceGateBetweenCamps } from "../sim/path";
import { TILE_OUTSIDE, type CampRect, type CampState, type GameState } from "../sim/types";
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

/** Pan and zoom rebuild fences when the camera origin crosses one of these buckets. */
export const FENCE_VIEW_BUCKET_PX = 240;
/** Painted wires are built only inside this view width. Wider views use the Graphics layer. */
export const FENCE_CLOSE_VIEW_PX = 5000;
/** Posts are skipped once the view is this wide. */
export const FENCE_WIDE_VIEW_PX = 8000;
/**
 * Screen length of one painted wire step (`24 * PIXELS_PER_METRE` in v2Art).
 * The cull margin has to cover a pan of one bucket plus one of these steps.
 */
export const FENCE_WIRE_PIECE_PX = 24 * PIXELS_PER_METRE;

export function fenceViewMarginPx(): number {
  return FENCE_VIEW_BUCKET_PX + FENCE_WIRE_PIECE_PX;
}

export type FenceView = { x: number; y: number; right: number; bottom: number };

/** True when the segment's box meets the view, expanded by `margin` px. */
export function fencePieceInView(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  view: FenceView,
  margin: number,
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return maxX >= view.x - margin && minX <= view.right + margin && maxY >= view.y - margin && minY <= view.bottom + margin;
}

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

type MetreRun = { x1: number; y1: number; x2: number; y2: number; a: number; b: number };

const EDGE_EPS = 0.51;

function rectCorners(rect: CampRect): { x: number; y: number }[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

/** True when (x, y) sits on the rectangle border, including the exclusive far edges. */
function onRectBorder(rect: CampRect, x: number, y: number): boolean {
  const onX = x >= rect.x - EDGE_EPS && x <= rect.x + rect.w + EDGE_EPS;
  const onY = y >= rect.y - EDGE_EPS && y <= rect.y + rect.h + EDGE_EPS;
  if (Math.abs(y - rect.y) <= EDGE_EPS && onX) return true;
  if (Math.abs(y - (rect.y + rect.h)) <= EDGE_EPS && onX) return true;
  if (Math.abs(x - rect.x) <= EDGE_EPS && onY) return true;
  if (Math.abs(x - (rect.x + rect.w)) <= EDGE_EPS && onY) return true;
  return false;
}

/**
 * The sim gate, on the shared fence line. `campGateBetween` steps 1 m across
 * that line, so the drawn opening is centred on the boundary coordinate.
 */
function simGateOnFence(from: CampState, to: CampState): { x: number; y: number; vertical: boolean } | null {
  const gate = campGateBetween(from, to);
  if (!gate) return null;
  const vertical = gate.fromGate.x !== gate.toGate.x;
  if (vertical) {
    return { x: Math.max(gate.fromGate.x, gate.toGate.x), y: gate.fromGate.y, vertical: true };
  }
  return { x: gate.fromGate.x, y: Math.max(gate.fromGate.y, gate.toGate.y), vertical: false };
}

/** Drop a `CAMP_GATE_METRES` gap out of a run, keeping each piece on its own line. */
function cutRunAtGate(run: MetreRun, gx: number, gy: number, vertical: boolean, half: number): MetreRun[] {
  if (vertical) {
    if (Math.abs(run.x1 - gx) > EDGE_EPS || Math.abs(run.x2 - gx) > EDGE_EPS) return [run];
    const lo = Math.min(run.y1, run.y2);
    const hi = Math.max(run.y1, run.y2);
    const gLo = gy - half;
    const gHi = gy + half;
    if (hi <= gLo + 0.01 || lo >= gHi - 0.01) return [run];
    const downward = run.y2 >= run.y1;
    const pieces: MetreRun[] = [];
    const push = (from: number, to: number) => {
      if (to - from < 0.05) return;
      pieces.push({ ...run, x1: gx, x2: gx, y1: downward ? from : to, y2: downward ? to : from });
    };
    if (lo < gLo) push(lo, Math.min(hi, gLo));
    if (hi > gHi) push(Math.max(lo, gHi), hi);
    return pieces;
  }
  if (Math.abs(run.y1 - gy) > EDGE_EPS || Math.abs(run.y2 - gy) > EDGE_EPS) return [run];
  const lo = Math.min(run.x1, run.x2);
  const hi = Math.max(run.x1, run.x2);
  const gLo = gx - half;
  const gHi = gx + half;
  if (hi <= gLo + 0.01 || lo >= gHi - 0.01) return [run];
  const rightward = run.x2 >= run.x1;
  const pieces: MetreRun[] = [];
  const push = (from: number, to: number) => {
    if (to - from < 0.05) return;
    pieces.push({ ...run, y1: gy, y2: gy, x1: rightward ? from : to, x2: rightward ? to : from });
  };
  if (lo < gLo) push(lo, Math.min(hi, gLo));
  if (hi > gHi) push(Math.max(lo, gHi), hi);
  return pieces;
}

/**
 * Camp fences in metre space. Each side is split at neighbouring corners, so a
 * piece is either shared with one camp or is outer boundary. Gate openings come
 * from `campGateBetween` and are cut before the iso projection, so a gate cannot
 * slide a parallel wire onto its own line.
 */
function collectRectFenceSegments(
  state: GameState,
  layout: IsoLayout,
  herdCampId: number,
  selected: boolean,
): FenceSegment[] {
  const camps = state.camps.filter((camp): camp is CampState & { rect: CampRect } => Boolean(camp.rect));
  const pieces: MetreRun[] = [];
  for (const camp of camps) {
    const rect = camp.rect;
    const sides = [
      { horizontal: true, line: rect.y, lo: rect.x, hi: rect.x + rect.w },
      { horizontal: true, line: rect.y + rect.h, lo: rect.x, hi: rect.x + rect.w },
      { horizontal: false, line: rect.x, lo: rect.y, hi: rect.y + rect.h },
      { horizontal: false, line: rect.x + rect.w, lo: rect.y, hi: rect.y + rect.h },
    ];
    for (const side of sides) {
      if (side.hi - side.lo < 0.05) continue;
      const splits = [side.lo, side.hi];
      for (const other of camps) {
        if (other.id === camp.id) continue;
        for (const corner of rectCorners(other.rect)) {
          const cross = side.horizontal ? corner.y : corner.x;
          const along = side.horizontal ? corner.x : corner.y;
          if (Math.abs(cross - side.line) > EDGE_EPS) continue;
          if (along < side.lo - EDGE_EPS || along > side.hi + EDGE_EPS) continue;
          splits.push(Math.min(side.hi, Math.max(side.lo, along)));
        }
      }
      splits.sort((left, right) => left - right);
      const unique: number[] = [];
      for (const split of splits) {
        if (unique.length === 0 || split - unique[unique.length - 1] > 0.01) unique.push(split);
      }
      for (let index = 0; index < unique.length - 1; index += 1) {
        const from = unique[index];
        const to = unique[index + 1];
        if (to - from < 0.05) continue;
        const mid = (from + to) / 2;
        const mx = side.horizontal ? mid : side.line;
        const my = side.horizontal ? side.line : mid;
        const neighbour = camps.find((other) => other.id !== camp.id && onRectBorder(other.rect, mx, my));
        pieces.push({
          x1: side.horizontal ? from : side.line,
          y1: side.horizontal ? side.line : from,
          x2: side.horizontal ? to : side.line,
          y2: side.horizontal ? side.line : to,
          a: camp.id,
          b: neighbour ? neighbour.id : TILE_OUTSIDE,
        });
      }
    }
  }

  const deduped = new Map<string, MetreRun>();
  for (const piece of pieces) {
    const key = edgeKey(piece.x1, piece.y1, piece.x2, piece.y2);
    const existing = deduped.get(key);
    if (!existing || (existing.b < 0 && piece.b >= 0)) deduped.set(key, piece);
  }

  let wires = [...deduped.values()];
  const gateRuns: MetreRun[] = [];
  const half = CAMP_GATE_METRES / 2;
  for (let i = 0; i < camps.length; i += 1) {
    for (let j = i + 1; j < camps.length; j += 1) {
      const gate = simGateOnFence(camps[i], camps[j]);
      if (!gate) continue;
      const next: MetreRun[] = [];
      for (const wire of wires) next.push(...cutRunAtGate(wire, gate.x, gate.y, gate.vertical, half));
      wires = next;
      gateRuns.push({
        x1: gate.vertical ? gate.x : gate.x - half,
        y1: gate.vertical ? gate.y - half : gate.y,
        x2: gate.vertical ? gate.x : gate.x + half,
        y2: gate.vertical ? gate.y + half : gate.y,
        a: camps[i].id,
        b: camps[j].id,
      });
    }
  }

  const tileW = PIXELS_PER_METRE;
  const tileH = PIXELS_PER_METRE / 2;
  const project = (run: MetreRun, gate: boolean): FenceSegment => {
    const p1 = tileCenter(run.x1, run.y1, layout, tileW, tileH);
    const p2 = tileCenter(run.x2, run.y2, layout, tileW, tileH);
    const kind: FenceSegment["kind"] =
      run.b < 0 ? "boundary" : selected && (run.a === herdCampId || run.b === herdCampId) ? "selected" : "inner";
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, kind, gate };
  };
  const segments = wires.map((run) => project(run, false)).concat(gateRuns.map((run) => project(run, true)));
  return mergeStraightFences(segments);
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

/**
 * Cut a straight wire where a gate sits on it. Parallel is not enough: in the
 * iso view every east-west run is parallel, and rebuilding from the gate centre
 * used to move those runs onto the gate's line.
 */
function splitWireAtGate(segment: FenceSegment, gate: FenceSegment, half: number): FenceSegment[] {
  const gdx = gate.x2 - gate.x1;
  const gdy = gate.y2 - gate.y1;
  const glen = Math.hypot(gdx, gdy) || 1;
  const sdx = segment.x2 - segment.x1;
  const sdy = segment.y2 - segment.y1;
  const slen = Math.hypot(sdx, sdy) || 1;
  const cross = sdx * gdy - sdy * gdx;
  if (Math.abs(cross) / (slen * glen) > 0.02) return [segment];
  const dirx = gdx / glen;
  const diry = gdy / glen;
  const cx = (gate.x1 + gate.x2) / 2;
  const cy = (gate.y1 + gate.y2) / 2;
  const lateral = (x: number, y: number) => (x - cx) * -diry + (y - cy) * dirx;
  if (Math.abs(lateral(segment.x1, segment.y1)) > 1.5 || Math.abs(lateral(segment.x2, segment.y2)) > 1.5) {
    return [segment];
  }
  const along = (x: number, y: number) => (x - cx) * dirx + (y - cy) * diry;
  const a1 = along(segment.x1, segment.y1);
  const a2 = along(segment.x2, segment.y2);
  const lo = Math.min(a1, a2);
  const hi = Math.max(a1, a2);
  if (hi < -half - 1.5 || lo > half + 1.5) return [segment];
  const forward = a2 >= a1;
  const point = (d: number) => {
    const t = Math.abs(a2 - a1) < 1e-6 ? 0 : (d - a1) / (a2 - a1);
    return { x: segment.x1 + sdx * t, y: segment.y1 + sdy * t };
  };
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

/** Below this zoom the mid stroke is not used, and a world-pixel line shrinks under a screen pixel. */
export const FENCE_FAR_MAX_ZOOM = 0.02;
/** Inner fences at the whole-farm view. On-screen pixels, not world pixels. */
export const FENCE_FAR_INNER_PX = 1.15;
/** Outer perimeter, a little heavier than the inner wires. */
export const FENCE_FAR_BOUNDARY_PX = 1.5;
/** Opening left at a gate so the 3.6 m gap still reads when the farm fills the screen. */
export const FENCE_FAR_GAP_PX = 4.5;
/** Light tick across that opening. */
export const FENCE_FAR_TICK_PX = 4;

export type FarFenceStroke = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  screenPx: number;
  role: "wire" | "gate";
  kind: FenceSegment["kind"];
};

/** World-pixel stroke that lands at `screenPx` once the camera zoom is applied. */
export function farFenceLineWidth(zoom: number, screenPx: number): number {
  return screenPx / Math.max(zoom, 0.0004);
}

function farScreenPx(kind: FenceSegment["kind"]): number {
  return kind === "inner" ? FENCE_FAR_INNER_PX : FENCE_FAR_BOUNDARY_PX;
}

/**
 * Pull a wire back from a gate so the opening is at least `halfGap` world px
 * from the gate centre. The real 3.6 m gap is a fraction of a pixel at farm zoom.
 */
function trimWireForFarGates(
  wire: FenceSegment,
  gates: FenceSegment[],
  halfGap: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = wire.x2 - wire.x1;
  const dy = wire.y2 - wire.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  let t0 = 0;
  let t1 = len;
  for (const gate of gates) {
    const gdx = gate.x2 - gate.x1;
    const gdy = gate.y2 - gate.y1;
    const glen = Math.hypot(gdx, gdy) || 1;
    const cross = dx * gdy - dy * gdx;
    if (Math.abs(cross) / (len * glen) > 0.04) continue;
    const cx = (gate.x1 + gate.x2) / 2;
    const cy = (gate.y1 + gate.y2) / 2;
    const lat = (cx - wire.x1) * -uy + (cy - wire.y1) * ux;
    if (Math.abs(lat) > 12) continue;
    const t = (cx - wire.x1) * ux + (cy - wire.y1) * uy;
    if (t < -halfGap || t > len + halfGap) continue;
    if (t <= len / 2) t0 = Math.max(t0, t + halfGap);
    else t1 = Math.min(t1, t - halfGap);
  }
  if (t1 - t0 < 2) return null;
  return {
    x1: wire.x1 + ux * t0,
    y1: wire.y1 + uy * t0,
    x2: wire.x1 + ux * t1,
    y2: wire.y1 + uy * t1,
  };
}

/**
 * Far-zoom fence plan. A few dozen runs, not the tree canopy, so this stays on
 * the Graphics layer and is rebuilt with the view bucket. A baked wide texture
 * would shrink a 1 px line under a texel.
 */
export function farFenceStrokes(segments: FenceSegment[], zoom: number): FarFenceStroke[] {
  const z = Math.max(zoom, 0.0004);
  const halfGap = FENCE_FAR_GAP_PX / 2 / z;
  const gates = segments.filter((segment) => segment.gate);
  const strokes: FarFenceStroke[] = [];
  for (const wire of segments) {
    if (wire.gate) continue;
    const trimmed = trimWireForFarGates(wire, gates, halfGap);
    if (!trimmed) continue;
    strokes.push({
      ...trimmed,
      screenPx: farScreenPx(wire.kind),
      role: "wire",
      kind: wire.kind,
    });
  }
  const tick = FENCE_FAR_TICK_PX / z;
  for (const gate of gates) {
    const dx = gate.x2 - gate.x1;
    const dy = gate.y2 - gate.y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const cx = (gate.x1 + gate.x2) / 2;
    const cy = (gate.y1 + gate.y2) / 2;
    strokes.push({
      x1: cx - px * (tick / 2),
      y1: cy - py * (tick / 2),
      x2: cx + px * (tick / 2),
      y2: cy + py * (tick / 2),
      screenPx: FENCE_FAR_INNER_PX,
      role: "gate",
      kind: gate.kind,
    });
  }
  return strokes;
}

/** Thin dark camp lines for the whole-farm view. Gates are a gap plus a light tick. */
export function drawFarFences(graphics: Phaser.GameObjects.Graphics, segments: FenceSegment[], zoom: number): void {
  graphics.clear();
  const z = Math.max(zoom, 0.0004);
  for (const stroke of farFenceStrokes(segments, zoom)) {
    const color = stroke.role === "gate" ? 0xf4ead8 : stroke.kind === "selected" ? palette.fenceSelected : 0x1a120e;
    graphics.lineStyle(stroke.screenPx / z, color, stroke.role === "gate" ? 0.92 : 0.96);
    graphics.beginPath();
    graphics.moveTo(stroke.x1, stroke.y1);
    graphics.lineTo(stroke.x2, stroke.y2);
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
