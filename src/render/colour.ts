import type { GameState } from "../sim/types";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import { grazeableFraction } from "../sim/pasture";
import { CONFIG } from "../sim/config";
import { grassTint, palette, shade, toCss } from "./palette";

export function trackKeys(state: GameState): Set<string> {
  const keys = new Set<string>();
  for (const feature of state.features) {
    if (feature.kind === "track") keys.add(`${feature.x},${feature.y}`);
  }
  return keys;
}

export function tileTint(state: GameState, x: number, y: number, track: Set<string>): number {
  if (track.has(`${x},${y}`)) return shade(palette.track, x, y, CONFIG.view.tileShadeSpread);
  const id = state.campIds[y * state.width + x];
  if (id === TILE_OUTSIDE) return shade(palette.sand, x, y, CONFIG.view.tileShadeSpread);
  if (id === TILE_HOMESTEAD) return shade(palette.sandLight, x, y, CONFIG.view.tileShadeSpread);
  const camp = state.camps.find((item) => item.id === id);
  if (!camp) return palette.sand;
  return shade(grassTint(grazeableFraction(camp)), x, y, CONFIG.view.tileShadeSpread);
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
