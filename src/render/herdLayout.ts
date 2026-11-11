import type { CampState, GameState, TilePoint } from "../sim/types";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import type { HerdOffset } from "./art";
import { tileCenter, worldToTile, type IsoLayout } from "./iso";
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

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Steps from each camp tile to a tile that is not this camp (fence, yard, or another camp). */
function campInsetDepth(camp: CampState): Map<string, number> {
  const members = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
  const depth = new Map<string, number>();
  const queue: { x: number; y: number; d: number }[] = [];
  for (const tile of camp.tiles) {
    const edge = DIRS.some(([dx, dy]) => !members.has(`${tile.x + dx},${tile.y + dy}`));
    if (!edge) continue;
    depth.set(`${tile.x},${tile.y}`, 0);
    queue.push({ x: tile.x, y: tile.y, d: 0 });
  }
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    for (const [dx, dy] of DIRS) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;
      if (!members.has(key) || depth.has(key)) continue;
      depth.set(key, current.d + 1);
      queue.push({ x, y, d: current.d + 1 });
    }
  }
  return depth;
}

/** Interior tile near the camp anchor, inset from the fence and from the yard. */
export function grazingCenterTile(camp: CampState): TilePoint {
  if (camp.tiles.length === 0) return camp.anchor;
  const depth = campInsetDepth(camp);
  let maxDepth = 0;
  for (const value of depth.values()) maxDepth = Math.max(maxDepth, value);
  const minDepth = Math.min(2, maxDepth);
  let best = camp.anchor;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [key, value] of depth) {
    if (value < minDepth) continue;
    const [x, y] = key.split(",").map(Number);
    const dist = (x - camp.anchor.x) ** 2 + (y - camp.anchor.y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = { x, y };
    }
  }
  return best;
}

function onCampTile(
  x: number,
  y: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  members: Set<string>,
): boolean {
  const tile = worldToTile(x, y, layout, tileW, tileH);
  return members.has(`${Math.round(tile.x)},${Math.round(tile.y)}`);
}

/**
 * Loose grazing mob. Animals stand on interior tiles of the camp, with
 * spacing, instead of stacking on the anchor tile at the fence.
 */
export function spreadInCamp(
  camp: CampState,
  count: number,
  seed: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): HerdOffset[] {
  const next = rng(seed + camp.id * 997);
  if (count <= 0) return [];
  const members = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
  const centerTile = grazingCenterTile(camp);
  const center = tileCenter(centerTile.x, centerTile.y, layout, tileW, tileH);
  const anchor = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
  let reachX = tileW;
  let reachY = tileH;
  for (const tile of camp.tiles) {
    const point = tileCenter(tile.x, tile.y, layout, tileW, tileH);
    reachX = Math.max(reachX, Math.abs(point.x - center.x));
    reachY = Math.max(reachY, Math.abs(point.y - center.y));
  }
  const radiusX = Math.min(tileW * 2.7, Math.max(tileW * 1.15, reachX * 0.42));
  const radiusY = Math.min(tileH * 3.4, Math.max(tileH * 1.35, reachY * 0.42));
  const points: { x: number; y: number }[] = [];
  let minDist = Math.min(radiusX, radiusY) * 0.22;
  for (let round = 0; round < 7 && points.length < count; round += 1) {
    let guard = 0;
    while (points.length < count && guard < count * 36) {
      guard += 1;
      const angle = next() * Math.PI * 2;
      const radial = Math.sqrt(next());
      const x = center.x + Math.cos(angle) * radiusX * radial;
      const y = center.y + Math.sin(angle) * radiusY * radial;
      if (!onCampTile(x, y, layout, tileW, tileH, members)) continue;
      let spaced = true;
      for (const placed of points) {
        const dx = placed.x - x;
        const dy = placed.y - y;
        if (dx * dx + dy * dy < minDist * minDist) {
          spaced = false;
          break;
        }
      }
      if (spaced) points.push({ x, y });
    }
    minDist *= 0.7;
  }
  while (points.length < count) {
    points.push({
      x: center.x + (next() - 0.5) * tileW * 0.4,
      y: center.y + (next() - 0.5) * tileH * 0.4,
    });
  }
  return points.map((point) => ({
    x: point.x - anchor.x,
    y: point.y - anchor.y,
    flip: next() > 0.5,
    coat: Math.floor(next() * 6),
    scale: 0.9 + next() * 0.1,
  }));
}

/** Pull a foot point off a camp edge so the sprite stays inside the fence. */
function nudgeInsideCamp(
  state: GameState,
  x: number,
  y: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  const tile = worldToTile(x, y, layout, tileW, tileH);
  const tx = Math.round(tile.x);
  const ty = Math.round(tile.y);
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return { x, y };
  const id = state.campIds[ty * state.width + tx];
  if (id < 0) return { x, y };
  let pushX = 0;
  let pushY = 0;
  for (const [dx, dy] of DIRS) {
    const nx = tx + dx;
    const ny = ty + dy;
    const outside =
      nx < 0 || ny < 0 || nx >= state.width || ny >= state.height
        ? true
        : state.campIds[ny * state.width + nx] !== id;
    if (!outside) continue;
    const edge = tileCenter(tx + dx * 0.45, ty + dy * 0.45, layout, tileW, tileH);
    const middle = tileCenter(tx, ty, layout, tileW, tileH);
    pushX += middle.x - edge.x;
    pushY += middle.y - edge.y;
  }
  const len = Math.hypot(pushX, pushY);
  if (len < 1) return { x, y };
  return { x: x + (pushX / len) * 14, y: y + (pushY / len) * 14 };
}

/** Queue the herd along the walked path so they file through the gate on camp or track tiles. */
export function fileAlongPath(
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  count: number,
  seed: number,
  timeMs: number,
  herdX: number,
  herdY: number,
): HerdOffset[] {
  const path = state.herd.transit?.path ?? [];
  const progress = state.herd.transit?.progress ?? 0;
  if (path.length < 2 || count <= 0) {
    return organicTrekOffsets(count, seed, 1, 0, progress, timeMs);
  }
  const points = path.map((tile) => tileCenter(tile.x, tile.y, layout, tileW, tileH));
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1] || 1;
  const spacing = Math.min(18, (total * 0.92) / Math.max(1, count - 1));
  const centerDist = progress * total;

  const pointAt = (distance: number): { x: number; y: number; ux: number; uy: number } => {
    const dist = Math.max(0, Math.min(total, distance));
    let index = 1;
    while (index < lengths.length - 1 && lengths[index] < dist) index += 1;
    const start = lengths[index - 1];
    const span = lengths[index] - start || 1;
    const t = (dist - start) / span;
    const a = points[index - 1];
    const b = points[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: a.x + dx * t, y: a.y + dy * t, ux: dx / len, uy: dy / len };
  };

  const offsets: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const phase = cowPhase(seed, i);
    const rank = count <= 1 ? 0 : i - (count - 1) / 2;
    const wobble = Math.sin(timeMs / 700 + phase * 9) * 3;
    const at = pointAt(centerDist + rank * spacing + wobble);
    const lane = (i % 2 === 0 ? -1 : 1) * 3;
    const px = -at.uy;
    const py = at.ux;
    const foot = nudgeInsideCamp(state, at.x + px * lane, at.y + py * lane, layout, tileW, tileH);
    offsets.push({
      x: foot.x - herdX,
      y: foot.y - herdY,
      flip: at.ux > 0,
      coat: Math.floor(phase * 6) % 6,
      scale: 0.7 + (phase % 0.12),
    });
  }
  return offsets;
}

const YARD_LABEL_CLEARANCE = 5;

function tileNearHomestead(state: GameState, x: number, y: number, clearance: number): boolean {
  const tx = Math.round(x);
  const ty = Math.round(y);
  for (let dy = -clearance; dy <= clearance; dy += 1) {
    for (let dx = -clearance; dx <= clearance; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > clearance) continue;
      const px = tx + dx;
      const py = ty + dy;
      if (px < 0 || py < 0 || px >= state.width || py >= state.height) continue;
      if (state.campIds[py * state.width + px] === TILE_HOMESTEAD) return true;
    }
  }
  return false;
}

/** Camp number sits on grass. If the centroid falls on the yard, move it off the buildings. */
export function campLabelTile(state: GameState, camp: CampState): TilePoint {
  if (camp.tiles.length === 0) return camp.anchor;
  let sx = 0;
  let sy = 0;
  for (const tile of camp.tiles) {
    sx += tile.x;
    sy += tile.y;
  }
  const cx = sx / camp.tiles.length;
  const cy = sy / camp.tiles.length;
  if (!tileNearHomestead(state, cx, cy, YARD_LABEL_CLEARANCE)) {
    let best = camp.tiles[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const tile of camp.tiles) {
      const dist = (tile.x - cx) ** 2 + (tile.y - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }
    return best;
  }
  const graze = grazingCenterTile(camp);
  let best = camp.tiles[0];
  let bestDist = Number.POSITIVE_INFINITY;
  let found = false;
  for (const tile of camp.tiles) {
    if (tileNearHomestead(state, tile.x, tile.y, YARD_LABEL_CLEARANCE)) continue;
    const dist = Math.hypot(tile.x - graze.x, tile.y - graze.y);
    if (dist < 6 || dist > 9) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = tile;
      found = true;
    }
  }
  if (found) return best;
  let far = camp.tiles[0];
  let farDist = -1;
  for (const tile of camp.tiles) {
    const dist = (tile.x - cx) ** 2 + (tile.y - cy) ** 2;
    if (dist > farDist) {
      farDist = dist;
      far = tile;
    }
  }
  return far;
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
  _tangent: { x: number; y: number },
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
    const file = fileAlongPath(state, layout, tileW, tileH, count, state.seed, timeMs, herdX, herdY);
    let fileWeight = 1;
    if (progress < 0.12) fileWeight = progress / 0.12;
    else if (progress > 0.86) fileWeight = Math.max(0, (1 - progress) / 0.14);
    spread = blendOffsets(spread, file, fileWeight);
  }
  return clampOffsetsToCamp(state, fromCampId, spread, herdX, herdY, layout, tileW, tileH, inTransit, track);
}
