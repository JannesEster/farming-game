import { CONFIG } from "../sim/config";

/** Kalahari dry-season colours for camps, sand and fences. */
export const palette = {
  sand: 0xb84e28,
  sandLight: 0xcc6a3a,
  sandDark: 0x9a3a1e,
  track: 0x8f4a24,
  trackRut: 0x6e3518,
  grassGreen: 0x6a7a2e,
  grassGold: 0xd4a02e,
  grassBrown: 0x7a4a20,
  fence: 0xc4a880,
  fenceWire: 0x8a6a48,
  fenceStrong: 0xe8d4b0,
  fenceSelected: 0xf0c050,
  fencePost: 0x5c3a1e,
  water: 0x2a6a6a,
  waterHighlight: 0x6ab8b0,
  shadow: 0x2a1408,
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
