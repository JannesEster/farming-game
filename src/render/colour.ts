import { isRainyMonth } from "../sim/calendar";
import type { GameState } from "../sim/types";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import { grazeableFraction } from "../sim/pasture";
import { CONFIG } from "../sim/config";
import { clamp } from "../sim/math";
import { grassTint, palette, shade, toCss } from "./palette";

import { SPRITE_KEYS } from "./sprites";

export type GroundTexture = "grass" | "sand" | "yard" | "track";

export type PaintedGroundStamp = {
  key: string;
  alpha: number;
  rotation: number;
  tint: number;
};

function hash01(x: number, y: number, salt = 0): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + salt) * 43758.5453) % 1;
}

/** Low-frequency organic field (0 to 1), smooth across neighbouring tiles. */
export function veldCoverField(x: number, y: number, salt: number): number {
  const s = 0.092;
  const v =
    Math.sin((x + salt * 1.7) * s * 2.05) * 0.34 +
    Math.sin((y - salt * 0.85) * s * 1.55) * 0.28 +
    Math.sin((x + y + salt) * s * 0.82) * 0.24 +
    Math.sin((x * 1.25 - y * 0.72 + salt * 2.2) * s * 1.28) * 0.16;
  return clamp((v + 0.74) / 1.48, 0, 1);
}

function radialFeather(x: number, y: number): number {
  return clamp(0.32 + veldCoverField(x * 2.4 + 11, y * 2.4 - 7, 5.1) * 0.58, 0.3, 0.9);
}

function dryGoldenTint(x: number, y: number): number {
  const jitter = (veldCoverField(x, y, 18.2) - 0.5) * 10;
  const r = clamp(Math.round(242 + jitter), 232, 252);
  const g = clamp(Math.round(226 + jitter * 0.55), 214, 238);
  const b = clamp(Math.round(198 + jitter * 0.35), 186, 214);
  return (r << 16) | (g << 8) | b;
}

function mutedOliveTint(x: number, y: number): number {
  const jitter = (veldCoverField(x, y, 31.4) - 0.5) * 6;
  const r = clamp(Math.round(218 + jitter * 0.4), 208, 228);
  const g = clamp(Math.round(228 + jitter * 0.5), 218, 238);
  const b = clamp(Math.round(206 + jitter * 0.35), 196, 218);
  return (r << 16) | (g << 8) | b;
}

export function trackKeys(state: GameState): Set<string> {
  const keys = new Set<string>();
  for (const feature of state.features) {
    if (feature.kind === "track") keys.add(`${feature.x},${feature.y}`);
  }
  return keys;
}

function touchesGrazing(state: GameState, x: number, y: number, ring = 4): boolean {
  for (let dy = -ring; dy <= ring; dy += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > ring) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
      const id = state.campIds[ny * state.width + nx];
      if (id >= 0 || id === TILE_HOMESTEAD) return true;
    }
  }
  return false;
}

export function groundTexture(state: GameState, x: number, y: number, track: Set<string>): GroundTexture {
  if (track.has(`${x},${y}`)) return "track";
  const id = state.campIds[y * state.width + x];
  if (id === TILE_OUTSIDE) return "sand";
  if (id === TILE_HOMESTEAD) return "yard";
  return "grass";
}

export function tileTint(state: GameState, x: number, y: number, track: Set<string>): number {
  const kind = groundTexture(state, x, y, track);
  if (kind === "track") return shade(palette.track, x, y, CONFIG.view.tileShadeSpread);
  if (kind === "sand") return shade(palette.sand, x, y, CONFIG.view.tileShadeSpread);
  if (kind === "yard") return shade(palette.sandLight, x, y, CONFIG.view.tileShadeSpread);
  const camp = state.camps.find((item) => item.id === state.campIds[y * state.width + x]);
  if (!camp) return palette.sand;
  const dry = !isRainyMonth(state.date.month, CONFIG);
  return shade(grassTint(grazeableFraction(camp), dry), x, y, CONFIG.view.tileShadeSpread);
}

export function paintedTileRotation(x: number, y: number): number {
  return (hash01(x, y, 2.5) - 0.5) * 0.05;
}

/** Golden dry-grass base with soft olive overlays. No per-tile colour flips. */
export function paintedGroundStamps(
  state: GameState,
  x: number,
  y: number,
  track: Set<string>,
): PaintedGroundStamp[] {
  const rotation = paintedTileRotation(x, y);
  if (track.has(`${x},${y}`)) {
    return [
      {
        key: SPRITE_KEYS.tileDryGrass,
        alpha: 1,
        rotation: 0,
        tint: dryGoldenTint(x, y),
      },
      {
        key: SPRITE_KEYS.tileTrack,
        alpha: 0.55,
        rotation: 0,
        tint: 0xd7c4a4,
      },
    ];
  }

  const id = state.campIds[y * state.width + x];
  const dryBase: PaintedGroundStamp = {
    key: SPRITE_KEYS.tileDryGrass,
    alpha: 0.98,
    rotation: 0,
    tint: dryGoldenTint(x, y),
  };

  if (id === TILE_OUTSIDE) {
    if (touchesGrazing(state, x, y, 5)) {
      return [dryBase];
    }
    return [
      {
        key: SPRITE_KEYS.tileSand,
        alpha: 0.9,
        rotation: 0,
        tint: 0xeadfce,
      },
    ];
  }

  if (id === TILE_HOMESTEAD) {
    const stamps = [dryBase];
    if (veldCoverField(x, y, 2.1) > 0.78) {
      stamps.push({
        key: SPRITE_KEYS.tileSand,
        alpha: 0.14,
        rotation: rotation * 0.6,
        tint: 0xf0e6d8,
      });
    }
    return stamps;
  }

  const camp = state.camps.find((item) => item.id === id);
  if (!camp) return [dryBase];

  const frac = grazeableFraction(camp);
  const rainy = isRainyMonth(state.date.month, CONFIG);
  const field = veldCoverField(x, y, camp.id * 13.7 + state.seed * 0.001);
  const campWide = clamp(frac * 0.72 + field * 0.18 + (rainy ? 0.06 : -0.02), 0, 1);
  const cover = clamp(frac * 0.42 + field * 0.38 + (rainy ? 0.08 : -0.04), 0, 1);
  const stamps: PaintedGroundStamp[] = [
    {
      ...dryBase,
      alpha: clamp(1.05 - campWide * 0.35, 0.72, 1),
      tint: grassTint(frac, !rainy),
    },
  ];

  if (frac < 0.24) {
    stamps.push({
      key: SPRITE_KEYS.tileOvergrazed,
      alpha: clamp(0.18 + (0.24 - frac) * 0.55, 0.18, 0.32),
      rotation: rotation * 0.85,
      tint: 0xe8dcc8,
    });
  }

  if (cover > 0.1) {
    const feather = radialFeather(x, y);
    const greenAlpha = clamp(0.34 + cover * 0.42, 0.34, 0.72) * feather;
    stamps.push({
      key: SPRITE_KEYS.tileGreenGrass,
      alpha: greenAlpha,
      rotation: rotation * 0.65,
      tint: mutedOliveTint(x, y),
    });
  } else if (frac < 0.2 && veldCoverField(x, y, 6.3) > 0.58) {
    stamps.push({
      key: SPRITE_KEYS.tileSand,
      alpha: 0.22,
      rotation,
      tint: 0xeadfce,
    });
  }

  return stamps;
}

export function terrainVariant(x: number, y: number, kind: GroundTexture): number {
  const n = Math.abs(Math.sin(x * 17.31 + y * 43.17 + (kind === "grass" ? 2.1 : 0)) * 99173.17) % 1;
  if (kind === "grass") return Math.floor(n * 4);
  if (kind === "sand" || kind === "yard") return Math.floor(n * 3);
  return Math.floor(n * 2);
}

export function paintMinimap(canvas: HTMLCanvasElement, state: GameState): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const track = trackKeys(state);
  const cw = canvas.width / state.width;
  const ch = canvas.height / state.height;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      ctx.fillStyle = toCss(tileTint(state, x, y, track));
      ctx.fillRect(Math.floor(x * cw), Math.floor(y * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
    }
  }
  const camp = state.camps.find((item) => item.id === state.herd.campId);
  if (!camp) return;
  const hx = (camp.anchor.x + 0.5) * cw;
  const hy = (camp.anchor.y + 0.5) * ch;
  ctx.beginPath();
  ctx.fillStyle = "#1c120c";
  ctx.arc(hx, hy, Math.max(4, cw * 1.15), 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f6e7c4";
  ctx.stroke();
}
