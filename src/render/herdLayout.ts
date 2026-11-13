import { fractionalHour } from "../sim/clock";
import { CONFIG } from "../sim/config";
import { pointCampId, usesMetreCoords } from "../sim/metreFarm";
import { PIXELS_PER_METRE } from "./worldScale";
import { columnMetrics, MOB_LATERAL_TILES } from "../sim/convoy";
import { pointOnPath } from "../sim/path";
import type { CampState, GameState, TilePoint } from "../sim/types";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import type { CowView, HerdOffset } from "./art";
import { cowOctantFromScreen, cowOctantFromTile, cowViewFromOctant } from "./sprites";

export function facingFromTileVector(ux: number, uy: number): number {
  const sx = ux - uy;
  const sy = (ux + uy) * 0.5;
  return Math.atan2(sy, sx);
}

function randomView(next: () => number): CowView {
  const roll = next();
  if (roll < 0.25) return "left";
  if (roll < 0.5) return "right";
  if (roll < 0.75) return "toward";
  return "away";
}
import { tileCenter, worldToTile, type IsoLayout } from "./iso";
import { trackKeys } from "./colour";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** True when the lead is within a few tiles of a path step that changes camp, the actual gate. */
function openingNear(state: GameState, path: TilePoint[], x: number, y: number, tiles: number): boolean {
  const idAt = (tx: number, ty: number) => {
    const gx = Math.round(tx);
    const gy = Math.round(ty);
    if (gx < 0 || gy < 0 || gx >= state.width || gy >= state.height) return TILE_OUTSIDE;
    if (usesMetreCoords(state)) return pointCampId(state, gx, gy);
    return state.campIds[gy * state.width + gx];
  };
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const idA = idAt(a.x, a.y);
    const idB = idAt(b.x, b.y);
    if (idA === idB) continue;
    const touchesCamp = idA >= 0 || idB >= 0 || idA === TILE_HOMESTEAD || idB === TILE_HOMESTEAD;
    if (!touchesCamp) continue;
    if (Math.hypot(x - b.x, y - b.y) <= tiles || Math.hypot(x - a.x, y - a.y) <= tiles) return true;
  }
  return false;
}

function cowPhase(seed: number, index: number): number {
  return ((seed + index * 7919) % 1000) / 1000;
}

function unitHash(seed: number, index: number, salt: number): number {
  const n = Math.imul((seed + 1) ^ Math.imul(index + salt * 17, 2246822519), 3266489917) >>> 0;
  return n / 4294967296;
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
  const id = usesMetreCoords(state) ? pointCampId(state, tx, ty) : state.campIds[ty * state.width + tx];
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

function homesteadTiles(state: GameState): TilePoint[] {
  if (usesMetreCoords(state)) return [];
  const tiles: TilePoint[] = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (state.campIds[y * state.width + x] === TILE_HOMESTEAD) tiles.push({ x, y });
    }
  }
  return tiles;
}

function yardsAway(tile: TilePoint, yards: TilePoint[]): number {
  if (yards.length === 0) return 99;
  let best = 99;
  for (const yard of yards) {
    best = Math.min(best, Math.max(Math.abs(tile.x - yard.x), Math.abs(tile.y - yard.y)));
  }
  return best;
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
 * Loose grazing mob. Animals stand on interior tiles of the camp, clear of
 * the homestead, with enough space to read each animal.
 */
function spreadMetreMob(
  camp: CampState,
  count: number,
  seed: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): HerdOffset[] {
  const next = rng(seed + camp.id * 997);
  const anchor = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
  const offsets: HerdOffset[] = [];
  const placed: { mx: number; my: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    let mx = 0;
    let my = 0;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      mx = (next() - 0.5) * 36;
      my = (next() - 0.5) * 22;
      if (placed.every((point) => (point.mx - mx) ** 2 + (point.my - my) ** 2 >= 1.6)) break;
    }
    placed.push({ mx, my });
    const spot = tileCenter(camp.anchor.x + mx, camp.anchor.y + my, layout, tileW, tileH);
    offsets.push({
      x: spot.x - anchor.x,
      y: spot.y - anchor.y,
      flip: false,
      coat: Math.floor(next() * 6) % 6,
      scale: 0.92 + next() * 0.12,
      view: randomView(next),
      octant: Math.floor(next() * 8) % 8,
      moving: false,
    });
  }
  return offsets;
}

export function spreadInCamp(
  camp: CampState,
  count: number,
  seed: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  state?: GameState,
): HerdOffset[] {
  if (count <= 0) return [];
  if (camp.rect) return spreadMetreMob(camp, count, seed, layout, tileW, tileH);
  const next = rng(seed + camp.id * 997);
  const yards = state ? homesteadTiles(state) : [];
  const grazeTiles = camp.tiles.filter((tile) => yardsAway(tile, yards) >= 4);
  const members = new Set((grazeTiles.length > 0 ? grazeTiles : camp.tiles).map((tile) => `${tile.x},${tile.y}`));
  const yardPoints = yards.map((tile) => tileCenter(tile.x, tile.y, layout, tileW, tileH));
  const yardCenter = yardPoints.length
    ? {
        x: yardPoints.reduce((sum, point) => sum + point.x, 0) / yardPoints.length,
        y: yardPoints.reduce((sum, point) => sum + point.y, 0) / yardPoints.length,
      }
    : tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
  let center = yardCenter;
  let centerDist = -1;
  for (const tile of grazeTiles.length > 0 ? grazeTiles : camp.tiles) {
    const point = tileCenter(tile.x, tile.y, layout, tileW, tileH);
    const dist = Math.hypot(point.x - yardCenter.x, point.y - yardCenter.y);
    if (dist > centerDist) {
      centerDist = dist;
      center = point;
    }
  }
  const anchor = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
  const candidates: { x: number; y: number; rank: number }[] = [];
  for (const key of members) {
    const [tx, ty] = key.split(",").map(Number);
    const spot = tileCenter(tx, ty, layout, tileW, tileH);
    const jitterA = next() * Math.PI * 2;
    const x = spot.x + Math.cos(jitterA) * tileW * 0.12;
    const y = spot.y + Math.sin(jitterA) * tileH * 0.12;
    if (!onCampTile(x, y, layout, tileW, tileH, members)) continue;
    const dx = x - center.x;
    const dy = y - center.y;
    candidates.push({ x, y, rank: Math.hypot(dx, dy) });
  }
  candidates.sort((a, b) => a.rank - b.rank);
  const grazing = candidates;
  const safe: typeof grazing = [];
  const covers = (extra: { x: number; y: number }) => {
    let minX = extra.x;
    let maxX = extra.x;
    let minY = extra.y;
    let maxY = extra.y;
    for (const point of safe) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    return yardPoints.some((yard) => yard.x >= minX && yard.x <= maxX && yard.y >= minY && yard.y <= maxY);
  };
  for (const candidate of grazing) {
    if (!covers(candidate)) safe.push(candidate);
  }
  const take = (gap: number) => {
    const chosen: { x: number; y: number }[] = [];
    const gap2 = gap * gap;
    for (const candidate of (safe.length >= count ? safe : grazing)) {
      if (chosen.length >= count) break;
      let spaced = true;
      for (const placed of chosen) {
        const dx = placed.x - candidate.x;
        const dy = placed.y - candidate.y;
        if (dx * dx + dy * dy < gap2) {
          spaced = false;
          break;
        }
      }
      if (spaced) chosen.push(candidate);
    }
    return chosen;
  };
  let gap = tileW * 0.92;
  let points = take(gap);
  while (points.length < count && gap > tileW * 0.42) {
    gap *= 0.94;
    points = take(gap);
  }
  return points.map((point) => ({
    x: point.x - anchor.x,
    y: point.y - anchor.y,
    flip: false,
    coat: Math.floor(next() * 6),
    scale: 0.72 + next() * 0.08,
    view: randomView(next),
    octant: Math.floor(next() * 8),
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

const WATER_KINDS = new Set(["windmill", "trough", "reservoir", "solar_pump"]);
/**
 * How far a cow's feet stay from each structure, in tiles.
 * The windmill cut-out reaches about 5 tile-steps from its foot (11 m tower),
 * so 5.1 tiles keeps bodies off the legs and the wheel. Tanks and troughs are smaller.
 */
function waterFootClearTiles(kind: string): number {
  if (kind === "windmill") return 5.6;
  if (kind === "reservoir") return 2.8;
  if (kind === "trough") return 2.3;
  return 2.4;
}

function shiftOffWater(
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  foot: { x: number; y: number },
  fallback: { x: number; y: number },
  legal: (x: number, y: number) => boolean,
): { x: number; y: number } {
  const tilePx = Math.hypot(tileW / 2, tileH / 2);
  const centers = state.features
    .filter((feature) => WATER_KINDS.has(feature.kind))
    .map((feature) => ({
      ...tileCenter(feature.x, feature.y, layout, tileW, tileH),
      need: waterFootClearTiles(feature.kind) * tilePx,
    }));
  const score = (point: { x: number; y: number }) => {
    let worst = Number.POSITIVE_INFINITY;
    for (const center of centers) {
      worst = Math.min(worst, Math.hypot(point.x - center.x, point.y - center.y) / center.need);
    }
    return worst;
  };
  let pushed = { x: foot.x, y: foot.y };
  for (const center of centers) {
    const dx = pushed.x - center.x;
    const dy = pushed.y - center.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= center.need) continue;
    const awayX = dist < 1 ? fallback.x - center.x : dx;
    const awayY = dist < 1 ? fallback.y - center.y : dy;
    const away = Math.hypot(awayX, awayY) || 1;
    pushed = {
      x: center.x + (awayX / away) * center.need,
      y: center.y + (awayY / away) * center.need,
    };
  }
  if (legal(pushed.x, pushed.y)) return pushed;
  let best = legal(foot.x, foot.y) ? foot : fallback;
  let bestScore = score(best);
  for (let step = 9; step >= 1; step -= 1) {
    const t = step / 10;
    const trial = {
      x: foot.x + (pushed.x - foot.x) * t,
      y: foot.y + (pushed.y - foot.y) * t,
    };
    if (!legal(trial.x, trial.y)) continue;
    const next = score(trial);
    if (next > bestScore) {
      best = trial;
      bestScore = next;
    }
  }
  return best;
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
  const spacingW = Math.abs(tileW - PIXELS_PER_METRE) < 1.5 ? CONFIG.view.tileWidth : tileW;
  const spacingH = Math.abs(tileW - PIXELS_PER_METRE) < 1.5 ? CONFIG.view.tileHeight : tileH;
  const tilePx = Math.hypot(spacingW / 2, spacingH / 2);
  const metrics = columnMetrics(path, progress, count);
  const leadDist = progress * total;
  const rearDist = metrics.rearProgress * total;
  const leadTile = pointOnPath(path, progress);
  const nearGate = openingNear(state, path, leadTile.x, leadTile.y, 3);
  const lanes = nearGate ? Math.min(2, count) : Math.min(metrics.abreast, Math.max(1, count));
  const lateral = tilePx * (nearGate ? 0.4 : MOB_LATERAL_TILES);
  // A long path is in metres. The iso short axis can squash that 45 m file so only
  // part of the herd is placed, and the rest are drawn back at the camp. Stretch
  // the file in spacing steps so every animal stays on the road.
  const projected = Math.max(tilePx * 0.6, leadDist - rearDist);
  const ranksNeeded = Math.max(1, Math.ceil(count / Math.max(1, lanes)));
  const spanPx =
    metrics.total > 80 ? Math.max(projected, (ranksNeeded - 1) * tilePx * 0.92) : projected;
  const ranks = Math.max(1, Math.round(spanPx / (tilePx * 0.92)));
  const movingCount = Math.min(count, Math.max(lanes, ranks * lanes));
  const spacing = ranks <= 1 ? 0 : spanPx / (ranks - 1);

  const pointAt = (distance: number): { x: number; y: number; ux: number; uy: number } => {
    if (distance < 0 && points.length >= 2) {
      const a = points[0];
      const b = points[1];
      const fx = b.x - a.x;
      const fy = b.y - a.y;
      const flen = Math.hypot(fx, fy) || 1;
      const bx = a.x - b.x;
      const by = a.y - b.y;
      const blen = Math.hypot(bx, by) || 1;
      return {
        x: a.x + (bx / blen) * -distance,
        y: a.y + (by / blen) * -distance,
        ux: fx / flen,
        uy: fy / flen,
      };
    }
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
  const track = trackKeys(state);
  const fromId = state.herd.campId;
  const destId = state.herd.transit?.toCampId ?? fromId;
  const onCorridor = (tx: number, ty: number) => {
    for (const tile of path) {
      if (Math.max(Math.abs(tile.x - tx), Math.abs(tile.y - ty)) <= 2) return true;
    }
    return false;
  };
  const legal = (px0: number, py0: number) => {
    const tile = worldToTile(px0, py0, layout, tileW, tileH);
    const tx = Math.round(tile.x);
    const ty = Math.round(tile.y);
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
    const id = usesMetreCoords(state) ? pointCampId(state, tx, ty) : state.campIds[ty * state.width + tx];
    if (id === TILE_HOMESTEAD) return false;
    if (id === fromId || id === destId || track.has(`${tx},${ty}`)) return true;
    return onCorridor(tx, ty);
  };
  for (let i = 0; i < count; i += 1) {
    const phase = cowPhase(seed, i);
    const waiting = i >= movingCount;
    const laneIndex = i % lanes;
    const rank = Math.floor(i / lanes);
    const alongJitter = (unitHash(seed, i, 1) - 0.5) * 0.6 * tilePx;
    const latJitter = (unitHash(seed, i, 3) - 0.5) * 0.6 * tilePx;
    const straggle = !waiting && unitHash(seed, i, 5) > 0.88 ? tilePx * (0.16 + unitHash(seed, i, 7) * 0.2) : 0;
    const stagger = rank % 2 === 1 ? lateral * 0.38 : 0;
    const wobble = Math.sin(timeMs / 520 + phase * 9) * tilePx * 0.06;
    const dist = waiting
      ? 0
      : Math.max(tilePx * 0.15, Math.min(leadDist + tilePx * 0.12, leadDist - rank * spacing + wobble + alongJitter - straggle));
    const at = pointAt(dist);
    const lane = (laneIndex - (lanes - 1) / 2) * lateral + stagger + (waiting ? 0 : latJitter);
    const px = -at.uy;
    const py = at.ux;
    let foot = { x: at.x + px * lane, y: at.y + py * lane };
    if (!legal(foot.x, foot.y)) foot = { x: at.x + px * lane * 0.45, y: at.y + py * lane * 0.45 };
    if (!legal(foot.x, foot.y)) foot = { x: at.x, y: at.y };
    foot = shiftOffWater(state, layout, tileW, tileH, foot, { x: at.x, y: at.y }, legal);
    const stood = worldToTile(foot.x, foot.y, layout, tileW, tileH);
    const sx = Math.round(stood.x);
    const sy = Math.round(stood.y);
    const stoodId =
      sx >= 0 && sy >= 0 && sx < state.width && sy < state.height
        ? usesMetreCoords(state)
          ? pointCampId(state, sx, sy)
          : state.campIds[sy * state.width + sx]
        : TILE_OUTSIDE;
    if (stoodId === fromId || stoodId === destId) {
      const nudged = nudgeInsideCamp(state, foot.x, foot.y, layout, tileW, tileH);
      if (legal(nudged.x, nudged.y)) foot = nudged;
    }
    foot = shiftOffWater(state, layout, tileW, tileH, foot, { x: at.x, y: at.y }, legal);
    const heading = Math.atan2(at.uy, at.ux) + (unitHash(seed, i, 9) - 0.5) * 0.8;
    const octant = cowOctantFromScreen(Math.cos(heading), Math.sin(heading));
    offsets.push({
      x: foot.x - herdX,
      y: foot.y - herdY,
      flip: false,
      coat: Math.floor(phase * 6) % 6,
      scale: 0.58 + (phase % 0.1),
      view: cowViewFromOctant(octant),
      octant,
      moving: !waiting,
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
  if (camp.rect) {
    const cx = camp.rect.x + camp.rect.w / 2;
    const cy = camp.rect.y + camp.rect.h / 2;
    if (Math.hypot(cx - camp.anchor.x, cy - camp.anchor.y) > 40) return { x: Math.round(cx), y: Math.round(cy) };
    return { x: Math.round(cx), y: Math.round(camp.rect.y + Math.min(camp.rect.h * 0.2, 400)) };
  }
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
      flip: false,
      coat: Math.floor(phase * 6) % 6,
      scale: (0.52 + (phase % 0.1)) * (nibble ? 0.92 : 1),
      view: cowViewFromOctant(cowOctantFromTile(ux, uy)),
      octant: cowOctantFromTile(ux, uy),
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
      flip: false,
      coat: s.coat,
      scale: s.scale * (1 - t * 0.08) + m.scale * t * 0.08,
      view: t > 0.5 ? m.view : s.view,
      octant: t > 0.5 ? m.octant : s.octant,
    };
  });
}

export function offsetsForHerd(
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  inTransit: boolean,
  _progress: number,
  _tangent: { x: number; y: number },
  timeMs: number,
  herdX: number,
  herdY: number,
  countOverride?: number,
): HerdOffset[] {
  const track = trackKeys(state);
  const count = countOverride ?? state.herd.headCount;
  const fromCampId = state.herd.campId;
  const fromCamp = state.camps.find((c) => c.id === fromCampId);
  if (!fromCamp) return [];
  const spread = spreadInCamp(fromCamp, count, state.seed, layout, tileW, tileH, state);
  if (inTransit) {
    const file = fileAlongPath(state, layout, tileW, tileH, count, state.seed, timeMs, herdX, herdY);
    const anchor = tileCenter(fromCamp.anchor.x, fromCamp.anchor.y, layout, tileW, tileH);
    return file.map((step, index) => {
      if (step.moving) return step;
      const home = spread[index] ?? step;
      return {
        ...home,
        x: anchor.x + home.x - herdX,
        y: anchor.y + home.y - herdY,
        moving: false,
      };
    });
  }
  const graze = state.story?.grazeIn;
  if (graze && graze.campId === fromCampId) {
    const dayLength = state.clock?.settings.dayLengthSeconds ?? 240;
    const now = fractionalHour(state.date.hour, state.clock?.bankMs ?? 0, dayLength);
    const elapsed = now >= graze.startedHour ? now - graze.startedHour : now + 24 - graze.startedHour;
    if (elapsed >= 3 && state.story) state.story.grazeIn = null;
    else {
      const t = Math.max(0, Math.min(1, elapsed / 2));
      const cluster = 0.4 + 0.6 * t;
      return spread.map((spot) => ({ ...spot, x: spot.x * cluster, y: spot.y * cluster, moving: false }));
    }
  }
  return clampOffsetsToCamp(state, fromCampId, spread, herdX, herdY, layout, tileW, tileH, inTransit, track);
}
