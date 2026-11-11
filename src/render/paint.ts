/** Shared painterly helpers for procedural farm sprites (noise, light, diamonds). */

export function hash2(x: number, y: number, seed = 0): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 0.017) * 43758.5453) % 1;
}

export function diamondPath(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number): void {
  ctx.beginPath();
  ctx.moveTo(w / 2, pad);
  ctx.lineTo(w - pad, h / 2);
  ctx.lineTo(w / 2, h - pad);
  ctx.lineTo(pad, h / 2);
  ctx.closePath();
}

export function scatterNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  seed: number,
  alpha: number,
  colours: string[],
): void {
  for (let i = 0; i < count; i += 1) {
    const px = hash2(i, seed, 1.1) * w;
    const py = hash2(i, seed, 2.3) * h;
    ctx.fillStyle = colours[i % colours.length];
    ctx.globalAlpha = alpha * (0.45 + hash2(px, py, seed) * 0.9);
    const r = 0.6 + hash2(i, i, seed) * 2.2;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.65, hash2(i, py, seed) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function softShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.34,
): void {
  ctx.fillStyle = `rgba(36, 18, 8, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function isoShade(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.22): void {
  const grd = ctx.createLinearGradient(w / 2, 0, w / 2, h);
  grd.addColorStop(0, `rgba(255, 248, 232, ${strength})`);
  grd.addColorStop(0.45, "rgba(255,255,255,0)");
  grd.addColorStop(1, `rgba(40, 20, 8, ${strength * 1.35})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
}

export function highlightStroke(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number): void {
  ctx.strokeStyle = "rgba(255, 245, 220, 0.18)";
  ctx.lineWidth = 1.2;
  diamondPath(ctx, w, h, pad);
  ctx.stroke();
  ctx.strokeStyle = "rgba(50, 28, 12, 0.12)";
  ctx.lineWidth = 1;
  diamondPath(ctx, w, h, pad + 1);
  ctx.stroke();
}
