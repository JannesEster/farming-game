import { isRainyMonth } from "../sim/calendar";
import type { GameState } from "../sim/types";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import { grazeableFraction } from "../sim/pasture";
import { CONFIG } from "../sim/config";
import { grassTint, palette, shade, toCss } from "./palette";

export type GroundTexture = "grass" | "sand" | "yard" | "track";

export function trackKeys(state: GameState): Set<string> {
  const keys = new Set<string>();
  for (const feature of state.features) {
    if (feature.kind === "track") keys.add(`${feature.x},${feature.y}`);
  }
  return keys;
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
