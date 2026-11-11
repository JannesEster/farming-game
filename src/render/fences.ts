import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { trackTileSet } from "../sim/path";
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

function isGateTile(state: GameState, x: number, y: number, tracks: Set<string>): boolean {
  if (!tracks.has(`${x},${y}`)) return false;
  const width = state.width;
  const id = state.campIds[y * width + x];
  if (id < 0 && id !== TILE_OUTSIDE) return false;
  const neighbors = [
    state.campIds[y * width + (x + 1)],
    state.campIds[y * width + (x - 1)],
    state.campIds[(y + 1) * width + x],
    state.campIds[(y - 1) * width + x],
  ];
  const camps = new Set(neighbors.filter((n) => n >= 0));
  return camps.size >= 1 || (id >= 0 && neighbors.some((n) => n !== id && n >= 0));
}

export function collectFenceSegments(
  state: GameState,
  layout: IsoLayout,
  herdCampId: number,
  selected: boolean,
): FenceSegment[] {
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  const tracks = trackTileSet(state);
  const gateTiles = new Set<string>();
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (isGateTile(state, x, y, tracks)) gateTiles.add(`${x},${y}`);
    }
  }

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
        const gate =
          gateTiles.has(`${x},${y}`) ||
          gateTiles.has(`${x + 1},${y}`) ||
          tracks.has(`${x},${y}`) ||
          tracks.has(`${x + 1},${y}`);
        segments.push({
          x1: right.x,
          y1: right.y,
          x2: bottom.x,
          y2: bottom.y,
          kind: rightId === null ? "boundary" : fenceKind(id, rightId),
          gate: gate && id >= 0 && rightId >= 0,
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
        const gate =
          gateTiles.has(`${x},${y}`) ||
          gateTiles.has(`${x},${y + 1}`) ||
          tracks.has(`${x},${y}`) ||
          tracks.has(`${x},${y + 1}`);
        segments.push({
          x1: left.x,
          y1: left.y,
          x2: bottom.x,
          y2: bottom.y,
          kind: downId === null ? "boundary" : fenceKind(id, downId),
          gate: gate && id >= 0 && downId >= 0,
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

export function drawFences(graphics: Phaser.GameObjects.Graphics, segments: FenceSegment[]): void {
  graphics.clear();
  const buckets: Record<FenceSegment["kind"], FenceSegment[]> = {
    inner: [],
    boundary: [],
    selected: [],
  };
  for (const segment of segments) buckets[segment.kind].push(segment);

  const strokeWire = (list: FenceSegment[], width: number, colour: number, alpha: number) => {
    if (list.length === 0) return;
    graphics.lineStyle(width, colour, alpha);
    for (const segment of list) {
      if (segment.gate) continue;
      graphics.beginPath();
      graphics.moveTo(segment.x1, segment.y1);
      graphics.lineTo(segment.x2, segment.y2);
      graphics.strokePath();
    }
  };

  strokeWire(buckets.inner, CONFIG.view.fencePx, palette.fenceWire, 0.85);
  strokeWire(buckets.boundary, CONFIG.view.fenceBoundaryPx, palette.fenceStrong, 1);
  strokeWire(buckets.selected, CONFIG.view.fenceSelectedPx, palette.fenceSelected, 1);

  const spacing = CONFIG.view.fencePostSpacingPx;
  for (const segment of segments) {
    const colour = segment.kind === "selected" ? palette.fencePost : palette.fencePost;
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy);
    const count = Math.max(2, Math.floor(length / spacing));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const px = segment.x1 + dx * t;
      const py = segment.y1 + dy * t;
      if (segment.gate && i > 0 && i < count) continue;
      graphics.fillStyle(colour, 1);
      graphics.fillCircle(px, py, segment.gate ? 3.4 : 2.6);
      if (!segment.gate) {
        graphics.lineStyle(1.2, palette.fence, 0.9);
        graphics.beginPath();
        graphics.moveTo(px, py - 4);
        graphics.lineTo(px, py + 3);
        graphics.strokePath();
      } else if (i === 0 || i === count) {
        graphics.lineStyle(2, palette.fenceStrong, 1);
        graphics.beginPath();
        graphics.moveTo(px, py - 5);
        graphics.lineTo(px, py + 4);
        graphics.strokePath();
      }
    }
  }
}
