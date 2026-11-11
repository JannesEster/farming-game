import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { fenceGateBetweenCamps } from "../sim/path";
import { TILE_OUTSIDE, type GameState } from "../sim/types";
import { tileTop } from "./iso";
import type { IsoLayout } from "./iso";
import { palette } from "./palette";

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
  return segments;
}

/** World px between the two fence wires so they read as separate strands at ~0.53 zoom. */
export const FENCE_WIRE_STRAND_OFFSET_PX = 8;

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
  for (const sign of [-1, 1]) {
    graphics.beginPath();
    graphics.moveTo(segment.x1 + ox * sign, segment.y1 + oy * sign);
    graphics.lineTo(segment.x2 + ox * sign, segment.y2 + oy * sign);
    graphics.strokePath();
  }
}

export function drawFences(graphics: Phaser.GameObjects.Graphics, segments: FenceSegment[]): void {
  graphics.clear();
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

  drawBucket(buckets.inner, CONFIG.view.fencePx, palette.fenceWire, 0.9);
  drawBucket(buckets.boundary, CONFIG.view.fenceBoundaryPx, palette.fenceStrong, 1);
  drawBucket(buckets.selected, CONFIG.view.fenceSelectedPx, palette.fenceSelected, 1);

  const spacing = CONFIG.view.fencePostSpacingPx;
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
      graphics.fillStyle(palette.fencePost, 1);
      graphics.fillCircle(px, py, segment.gate ? 3.6 : 3);
      if (!segment.gate) {
        graphics.lineStyle(1.4, palette.fencePost, 1);
        graphics.beginPath();
        graphics.moveTo(px, py - 5);
        graphics.lineTo(px, py + 4);
        graphics.strokePath();
      } else if (i === 0 || i === count) {
        graphics.lineStyle(2.2, palette.fencePost, 1);
        graphics.beginPath();
        graphics.moveTo(px, py - 6);
        graphics.lineTo(px, py + 5);
        graphics.strokePath();
      }
    }
  }
}
