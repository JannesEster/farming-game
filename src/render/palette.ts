import { CONFIG } from "../sim/config";

export const palette = {
  sand: 0xc56a32,
  sandLight: 0xd4894a,
  track: 0xa85a2c,
  grassGreen: 0x7c8a38,
  grassGold: 0xe0a63a,
  grassBrown: 0x8a4c28,
  fence: 0xf3e6c8,
  fenceStrong: 0xfff6e4,
  fenceSelected: 0xffd56a,
};

export function toCss(colour: number): string {
  return `#${colour.toString(16).padStart(6, "0")}`;
}

export function lerpColour(a: number, b: number, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const mix = (from: number, to: number) => Math.round(from + (to - from) * u);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (mix(ar, br) << 16) | (mix(ag, bg) << 8) | mix(ab, bb);
}

export function shade(colour: number, x: number, y: number, spread: number): number {
  const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  const delta = (n - 0.5) * spread;
  const shift = (channel: number) => Math.max(0, Math.min(255, Math.round(channel + delta)));
  const r = shift((colour >> 16) & 255);
  const g = shift((colour >> 8) & 255);
  const b = shift(colour & 255);
  return (r << 16) | (g << 8) | b;
}

export function grassTint(fraction: number): number {
  const mid = CONFIG.view.grassColourMidpoint;
  const soil = (1 - fraction) * CONFIG.view.soilMixAtBare;
  const grass =
    fraction <= mid
      ? lerpColour(palette.grassBrown, palette.grassGold, mid === 0 ? 0 : fraction / mid)
      : lerpColour(palette.grassGold, palette.grassGreen, (fraction - mid) / (1 - mid));
  return lerpColour(grass, palette.sand, soil);
}
