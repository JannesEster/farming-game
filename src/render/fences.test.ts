import { describe, expect, it } from "vitest";
import { CONFIG } from "../sim/config";
import { generateFarm } from "../sim/generate";
import { metreSharedGate } from "../sim/metreFarm";
import { campGateBetween, fenceCrossingsOffGate } from "../sim/path";
import type { GameState } from "../sim/types";
import {
  FENCE_VIEW_BUCKET_PX,
  FENCE_WIRE_PIECE_PX,
  FENCE_WIRE_STRAND_OFFSET_PX,
  closestPointOnFence,
  collectFenceSegments,
  fencePieceInView,
  fenceViewMarginPx,
  mergeStraightFences,
  openFenceGates,
  wireStrandOffset,
  type FenceSegment,
} from "./fences";
import { isoLayout, tileCenter, type IsoLayout } from "./iso";
import { CAMP_GATE_METRES, PIXELS_PER_METRE } from "./worldScale";

describe("double wire fences", () => {
  it("offsets strands by eight world pixels on a flat edge", () => {
    const offset = wireStrandOffset(0, 0, 100, 0);
    expect(Math.hypot(offset.ox, offset.oy)).toBeCloseTo(FENCE_WIRE_STRAND_OFFSET_PX, 5);
    expect(offset.oy).toBeCloseTo(5, 5);
    expect(offset.ox).toBeCloseTo(0, 5);
  });

  it("keeps offset magnitude on diagonal edges", () => {
    const offset = wireStrandOffset(0, 0, 100, 100);
    expect(Math.hypot(offset.ox, offset.oy)).toBeCloseTo(FENCE_WIRE_STRAND_OFFSET_PX, 5);
  });
});

describe("straight fence runs", () => {
  it("joins collinear edges into one line and leaves a gate as a gap", () => {
    const wire = (x1: number, y1: number, x2: number, y2: number, gate = false) => ({
      x1,
      y1,
      x2,
      y2,
      kind: "inner" as const,
      gate,
    });
    const merged = mergeStraightFences([
      wire(0, 0, 32, 16),
      wire(32, 16, 64, 32),
      wire(64, 32, 96, 48, true),
      wire(96, 48, 128, 64),
      wire(128, 64, 128, 96),
    ]);
    const runs = merged.filter((segment) => !segment.gate);
    const gate = merged.find((segment) => segment.gate);
    expect(runs).toHaveLength(3);
    expect(runs.some((segment) => segment.x1 === 0 && segment.y1 === 0 && segment.x2 === 64 && segment.y2 === 32)).toBe(true);
    expect(runs.some((segment) => segment.x1 === 96 && segment.y1 === 48 && segment.x2 === 128 && segment.y2 === 64)).toBe(true);
    expect(gate).toMatchObject({ x1: 64, y1: 32, x2: 96, y2: 48 });
    const corner = runs.find((segment) => segment.y2 === 96);
    expect(corner).toMatchObject({ x1: 128, y1: 64, x2: 128, y2: 96 });
  });

  it("does not cut a staircase into one diagonal", () => {
    const step = (x1: number, y1: number, x2: number, y2: number) => ({
      x1,
      y1,
      x2,
      y2,
      kind: "boundary" as const,
      gate: false,
    });
    const merged = mergeStraightFences([
      step(0, 0, 32, 16),
      step(32, 16, 64, 16),
      step(64, 16, 96, 32),
      step(96, 32, 128, 32),
    ]);
    expect(merged).toHaveLength(4);
  });

  it("draws square-camp fences as long lines on the map axes, open only at the gate", () => {
    const state = generateFarm(3300);
    const tileW = PIXELS_PER_METRE;
    const tileH = PIXELS_PER_METRE / 2;
    const layout = isoLayout(state.width, state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    const segments = collectFenceSegments(state, layout, state.herd.campId, false);
    const edge = Math.hypot(tileW / 2, tileH / 2);
    const axis = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const ne = { x: tileW / 2 / edge, y: tileH / 2 / edge };
      const nw = { x: -ne.x, y: ne.y };
      return Math.abs(ux * ne.x + uy * ne.y) > 0.995 || Math.abs(ux * nw.x + uy * nw.y) > 0.995;
    };
    const wires = segments.filter((segment) => !segment.gate);
    expect(wires.length).toBeGreaterThan(0);
    expect(Math.max(...wires.map((segment) => Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1)))).toBeGreaterThan(edge * 8);
    for (const segment of segments) {
      expect(axis(segment.x2 - segment.x1, segment.y2 - segment.y1)).toBe(true);
    }
    const gates = segments.filter((segment) => segment.gate);
    expect(gates.length).toBeGreaterThan(0);
    const joined = gates.filter((gate) =>
      wires.some((wire) => {
        const touch =
          Math.hypot(wire.x1 - gate.x1, wire.y1 - gate.y1) < 1.5 ||
          Math.hypot(wire.x2 - gate.x1, wire.y2 - gate.y1) < 1.5 ||
          Math.hypot(wire.x1 - gate.x2, wire.y1 - gate.y2) < 1.5 ||
          Math.hypot(wire.x2 - gate.x2, wire.y2 - gate.y2) < 1.5;
        if (!touch) return false;
        const cross =
          (wire.x2 - wire.x1) * (gate.y2 - gate.y1) - (wire.y2 - wire.y1) * (gate.x2 - gate.x1);
        const scale = Math.hypot(wire.x2 - wire.x1, wire.y2 - wire.y1) * Math.hypot(gate.x2 - gate.x1, gate.y2 - gate.y1);
        return Math.abs(cross) / scale < 0.02;
      }),
    );
    expect(joined.length).toBe(gates.length);

    let checked = false;
    for (let i = 0; i < state.camps.length && !checked; i += 1) {
      for (let j = i + 1; j < state.camps.length; j += 1) {
        const gate = campGateBetween(state.camps[i], state.camps[j]);
        const shared = state.camps[i].rect && state.camps[j].rect ? metreSharedGate(state.camps[i].rect!, state.camps[j].rect!) : null;
        if (!gate || !shared) continue;
        const verticalFence = shared.from.x !== shared.to.x;
        const farFrom = verticalFence
          ? { x: shared.from.x, y: shared.from.y + 80 }
          : { x: shared.from.x + 80, y: shared.from.y };
        const farTo = verticalFence
          ? { x: shared.to.x, y: shared.to.y + 80 }
          : { x: shared.to.x + 80, y: shared.to.y };
        expect(fenceCrossingsOffGate(state, [farFrom, farTo])).toBeGreaterThan(0);
        expect(fenceCrossingsOffGate(state, [gate.fromGate, gate.toGate])).toBe(0);
        checked = true;
        break;
      }
    }
    expect(checked).toBe(true);
  });
});

function farmLayout(state: GameState): IsoLayout {
  return isoLayout(state.width, state.height, PIXELS_PER_METRE, PIXELS_PER_METRE / 2, CONFIG.view.boundsPadPx);
}

function screenToMetre(sx: number, sy: number, layout: IsoLayout): { x: number; y: number } {
  const tileW = PIXELS_PER_METRE;
  const tileH = PIXELS_PER_METRE / 2;
  const lx = sx - layout.originX;
  const ly = sy - layout.originY - tileH / 2;
  return {
    x: (lx / (tileW / 2) + ly / (tileH / 2)) / 2,
    y: (ly / (tileH / 2) - lx / (tileW / 2)) / 2,
  };
}

function segmentDistance(x: number, y: number, segment: FenceSegment): number {
  const point = closestPointOnFence(x, y, segment);
  return Math.hypot(point.x - x, point.y - y);
}

function onCampBorder(state: GameState, x: number, y: number): number {
  let count = 0;
  for (const camp of state.camps) {
    const rect = camp.rect;
    if (!rect) continue;
    const onX = x >= rect.x - 0.6 && x <= rect.x + rect.w + 0.6;
    const onY = y >= rect.y - 0.6 && y <= rect.y + rect.h + 0.6;
    const hit =
      (Math.abs(y - rect.y) <= 0.6 && onX) ||
      (Math.abs(y - (rect.y + rect.h)) <= 0.6 && onX) ||
      (Math.abs(x - rect.x) <= 0.6 && onY) ||
      (Math.abs(x - (rect.x + rect.w)) <= 0.6 && onY);
    if (hit) count += 1;
  }
  return count;
}

describe("metre fence coverage", () => {
  const seeds = [3300, 1, 2, 3, 7];

  it("covers every camp perimeter except the real gate openings", () => {
    for (const seed of seeds) {
      const state = generateFarm(seed);
      const layout = farmLayout(state);
      const segments = collectFenceSegments(state, layout, state.herd.campId, false);
      const wires = segments.filter((segment) => !segment.gate);
      const gates = segments.filter((segment) => segment.gate);
      let missed = 0;
      const samples: string[] = [];
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
          const length = Math.hypot(x2 - x1, y2 - y1);
          const steps = Math.max(1, Math.round(length / 5));
          for (let step = 0; step <= steps; step += 1) {
            const t = step / steps;
            const mx = x1 + (x2 - x1) * t;
            const my = y1 + (y2 - y1) * t;
            const at = tileCenter(mx, my, layout, PIXELS_PER_METRE, PIXELS_PER_METRE / 2);
            const onWire = wires.some((wire) => segmentDistance(at.x, at.y, wire) <= 2);
            const inGate = gates.some((gate) => segmentDistance(at.x, at.y, gate) <= 2);
            if (onWire || inGate) continue;
            missed += 1;
            if (samples.length < 6) samples.push(`${seed}:${mx.toFixed(0)},${my.toFixed(0)}`);
          }
        }
      }
      expect(missed, `seed ${seed} uncovered ${samples.join(" ")}`).toBe(0);
    }
  });

  it("draws one 3.6 m gate for every sim gate, 16 of 16 on seed 3300", () => {
    for (const seed of seeds) {
      const state = generateFarm(seed);
      const layout = farmLayout(state);
      const tileW = PIXELS_PER_METRE;
      const tileH = PIXELS_PER_METRE / 2;
      const gates = collectFenceSegments(state, layout, state.herd.campId, false).filter((segment) => segment.gate);
      const isoPerMetre = Math.hypot(tileW / 2, tileH / 2);
      let pairs = 0;
      for (let i = 0; i < state.camps.length; i += 1) {
        for (let j = i + 1; j < state.camps.length; j += 1) {
          const shared = campGateBetween(state.camps[i], state.camps[j]);
          if (!shared) continue;
          pairs += 1;
          const vertical = shared.fromGate.x !== shared.toGate.x;
          const gx = vertical ? Math.max(shared.fromGate.x, shared.toGate.x) : shared.fromGate.x;
          const gy = vertical ? shared.fromGate.y : Math.max(shared.fromGate.y, shared.toGate.y);
          const centre = tileCenter(gx, gy, layout, tileW, tileH);
          const matches = gates.filter((gate) => {
            const mx = (gate.x1 + gate.x2) / 2;
            const my = (gate.y1 + gate.y2) / 2;
            return Math.hypot(mx - centre.x, my - centre.y) < 1.5;
          });
          expect(matches, `seed ${seed} camps ${state.camps[i].id}-${state.camps[j].id}`).toHaveLength(1);
          const width = Math.hypot(matches[0].x2 - matches[0].x1, matches[0].y2 - matches[0].y1) / isoPerMetre;
          expect(width).toBeCloseTo(CAMP_GATE_METRES, 2);
        }
      }
      if (seed === 3300) expect(pairs).toBe(16);
      expect(gates).toHaveLength(pairs);
    }
  });

  it("styles shared lines as inner fences and the outer perimeter as boundary", () => {
    const state = generateFarm(3300);
    const layout = farmLayout(state);
    const wires = collectFenceSegments(state, layout, state.herd.campId, false).filter((segment) => !segment.gate);
    expect(wires.length).toBeGreaterThan(0);
    for (const wire of wires) {
      const mid = screenToMetre((wire.x1 + wire.x2) / 2, (wire.y1 + wire.y2) / 2, layout);
      const owners = onCampBorder(state, mid.x, mid.y);
      const onOuter = mid.x < 0.6 || mid.y < 0.6 || mid.x > state.width - 0.6 || mid.y > state.height - 0.6;
      if (owners >= 2) expect(wire.kind).toBe("inner");
      else if (onOuter) expect(wire.kind).toBe("boundary");
      else expect(wire.kind).toBe("inner");
      expect(wire.kind === "boundary" && owners >= 2).toBe(false);
    }
    expect(wires.some((wire) => wire.kind === "boundary")).toBe(true);
    expect(wires.some((wire) => wire.kind === "inner")).toBe(true);
  });

  it("keeps every wire on a camp side line after the gate is cut", () => {
    for (const seed of [3300, 1, 7]) {
      const state = generateFarm(seed);
      const layout = farmLayout(state);
      const wires = collectFenceSegments(state, layout, state.herd.campId, false).filter((segment) => !segment.gate);
      for (const wire of wires) {
        const a = screenToMetre(wire.x1, wire.y1, layout);
        const b = screenToMetre(wire.x2, wire.y2, layout);
        const vertical = Math.abs(a.x - b.x) < 0.05;
        const horizontal = Math.abs(a.y - b.y) < 0.05;
        expect(vertical || horizontal).toBe(true);
        const onLine = state.camps.some((camp) => {
          const rect = camp.rect;
          if (!rect) return false;
          if (vertical) {
            const x = (a.x + b.x) / 2;
            return Math.abs(x - rect.x) < 0.05 || Math.abs(x - (rect.x + rect.w)) < 0.05;
          }
          const y = (a.y + b.y) / 2;
          return Math.abs(y - rect.y) < 0.05 || Math.abs(y - (rect.y + rect.h)) < 0.05;
        });
        expect(onLine).toBe(true);
      }
    }
  });
});

describe("gate openings stay on their own wire", () => {
  it("does not move a parallel wire onto the gate line", () => {
    const wire = { x1: 0, y1: 100, x2: 200, y2: 100, kind: "inner" as const, gate: false };
    const gate = { x1: 80, y1: 0, x2: 120, y2: 0, kind: "inner" as const, gate: true };
    const out = openFenceGates([wire, gate], 40);
    const kept = out.filter((segment) => !segment.gate);
    expect(kept).toHaveLength(1);
    expect(kept[0].y1).toBeCloseTo(100, 5);
    expect(kept[0].y2).toBeCloseTo(100, 5);
    expect(kept[0].x1).toBeCloseTo(0, 5);
    expect(kept[0].x2).toBeCloseTo(200, 5);
  });

  it("cuts the wire the gate sits on and leaves the pieces on that line", () => {
    const wire = { x1: 0, y1: 40, x2: 400, y2: 40, kind: "inner" as const, gate: false };
    const gate = { x1: 180, y1: 40, x2: 220, y2: 40, kind: "inner" as const, gate: true };
    const out = openFenceGates([wire, gate], 40);
    const wires = out.filter((segment) => !segment.gate);
    expect(wires).toHaveLength(2);
    for (const piece of wires) {
      expect(piece.y1).toBeCloseTo(40, 5);
      expect(piece.y2).toBeCloseTo(40, 5);
    }
    const covers = (x: number) =>
      wires.some((piece) => x >= Math.min(piece.x1, piece.x2) - 0.01 && x <= Math.max(piece.x1, piece.x2) + 0.01);
    expect(covers(100)).toBe(true);
    expect(covers(200)).toBe(false);
    expect(covers(300)).toBe(true);
  });
});

describe("fence view culling", () => {
  it("keeps a wire that enters a view shifted by a full bucket", () => {
    const margin = fenceViewMarginPx();
    expect(margin).toBeGreaterThanOrEqual(FENCE_VIEW_BUCKET_PX + FENCE_WIRE_PIECE_PX);
    const view = { x: 0, y: 0, right: 1280, bottom: 800 };
    const piece = FENCE_WIRE_PIECE_PX;
    const pieces = [];
    for (let index = -8; index < 24; index += 1) {
      const x1 = index * piece;
      const y1 = index * piece * 0.5;
      pieces.push({ x1, y1, x2: x1 + piece, y2: y1 + piece * 0.5 });
    }
    const shifts = [
      { x: 0, y: 0 },
      { x: FENCE_VIEW_BUCKET_PX, y: 0 },
      { x: -FENCE_VIEW_BUCKET_PX, y: 0 },
      { x: 0, y: FENCE_VIEW_BUCKET_PX },
      { x: FENCE_VIEW_BUCKET_PX, y: FENCE_VIEW_BUCKET_PX },
      { x: -FENCE_VIEW_BUCKET_PX, y: -FENCE_VIEW_BUCKET_PX },
    ];
    let checked = 0;
    for (const shift of shifts) {
      const moved = {
        x: view.x + shift.x,
        y: view.y + shift.y,
        right: view.right + shift.x,
        bottom: view.bottom + shift.y,
      };
      for (const item of pieces) {
        if (!fencePieceInView(item.x1, item.y1, item.x2, item.y2, moved, 0)) continue;
        checked += 1;
        expect(fencePieceInView(item.x1, item.y1, item.x2, item.y2, view, margin)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
    const outside = { x1: view.right + margin + piece, y1: 10, x2: view.right + margin + piece * 2, y2: 20 };
    expect(fencePieceInView(outside.x1, outside.y1, outside.x2, outside.y2, view, margin)).toBe(false);
  });
});
