import { CONFIG } from "../sim/config";

/** Kalahari dry-season colours for camps, sand and fences. */
export const palette = {
  sand: 0xc45a30,
  sandLight: 0xd87a48,
  sandDark: 0xa84828,
  track: 0xdca260,
  trackRut: 0xc99458,
  grassGreen: 0x6a7830,
  /** Brighter flush after rain. Art read, not a stocking figure. */
  grassFlush: 0x8fb84a,
  grassGold: 0xc89228,
  grassBrown: 0x8a4c22,
  fence: 0x5a5248,
  fenceWire: 0x4a443c,
  fenceStrong: 0x625850,
  fenceSelected: 0xc89038,
  fencePost: 0x5c3a22,
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

/**
 * Camp colour from standing grass and soil moisture.
 * Moisture pulls a recovering camp toward green and darkens wet ground.
 * The calendar month is not a tint.
 */
export function grassTint(fraction: number, moisture01 = 0): number {
  const mid = CONFIG.view.grassColourMidpoint;
  const wet = Math.max(0, Math.min(1, moisture01));
  const bareMix = (1 - fraction) * CONFIG.view.soilMixAtBare * (1 - wet * 0.35);
  const capped = Math.max(0, Math.min(1, fraction));
  let grass =
    capped <= mid
      ? lerpColour(palette.grassBrown, palette.grassGold, mid === 0 ? 0 : capped / mid)
      : lerpColour(palette.grassGold, palette.grassGreen, (capped - mid) / (1 - mid));
  if (capped > mid) {
    const coverPull = (capped - mid) / (1 - mid);
    grass = lerpColour(grass, palette.grassFlush, coverPull * CONFIG.view.flushCoverMix);
  }
  if (wet > 0 && capped > mid * 0.45) {
    grass = lerpColour(grass, palette.grassFlush, Math.min(1, wet * capped) * CONFIG.view.flushMoistureMix);
  }
  grass = lerpColour(grass, palette.sand, Math.min(1, bareMix));
  const wetLine = CONFIG.rain.wetGroundMoistureMm / Math.max(1, CONFIG.rain.moistureMmForFullGrowth);
  if (wet >= wetLine) grass = lerpColour(grass, 0x24382c, 0.28);
  return grass;
}

export function campFillColour(cover: number, soilMoistureMm: number): number {
  const wet = soilMoistureMm / Math.max(1, CONFIG.rain.moistureMmForFullGrowth);
  return grassTint(cover, wet);
}
