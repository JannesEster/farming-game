import { describe, expect, it } from "vitest";
import { CONFIG } from "../sim/config";
import { generateFarm } from "../sim/generate";
import { campGateBetween, fenceCrossingsOffGate } from "../sim/path";
import { FENCE_WIRE_STRAND_OFFSET_PX, collectFenceSegments, mergeStraightFences, wireStrandOffset } from "./fences";
import { isoLayout } from "./iso";

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
    const layout = isoLayout(state.width, state.height, CONFIG.view.tileWidth, CONFIG.view.tileHeight, CONFIG.view.boundsPadPx);
    const segments = collectFenceSegments(state, layout, state.herd.campId, false);
    const edge = Math.hypot(CONFIG.view.tileWidth / 2, CONFIG.view.tileHeight / 2);
    const axis = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const ne = { x: CONFIG.view.tileWidth / 2 / edge, y: CONFIG.view.tileHeight / 2 / edge };
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
        if (!gate) continue;
        let far: { from: { x: number; y: number }; to: { x: number; y: number }; dist: number } | null = null;
        for (const tile of state.camps[i].tiles) {
          const neighbors = [
            { x: tile.x + 1, y: tile.y },
            { x: tile.x - 1, y: tile.y },
            { x: tile.x, y: tile.y + 1 },
            { x: tile.x, y: tile.y - 1 },
          ];
          for (const next of neighbors) {
            if (next.x < 0 || next.y < 0 || next.x >= state.width || next.y >= state.height) continue;
            if (state.campIds[next.y * state.width + next.x] !== state.camps[j].id) continue;
            const dist = Math.hypot(tile.x - gate.fromGate.x, tile.y - gate.fromGate.y);
            if (!far || dist > far.dist) far = { from: tile, to: next, dist };
          }
        }
        if (!far || far.dist < 4) continue;
        expect(fenceCrossingsOffGate(state, [far.from, far.to])).toBeGreaterThan(0);
        expect(fenceCrossingsOffGate(state, [gate.fromGate, gate.toGate])).toBe(0);
        checked = true;
        break;
      }
    }
    expect(checked).toBe(true);
  });
});
