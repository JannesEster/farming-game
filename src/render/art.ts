import type { GroundTexture } from "./colour";

export const ART_ORIGIN = {
  diamond: { x: 0.5, y: 0 },
  cow: { x: 0.5, y: 0.82 },
  tree: { x: 0.5, y: 0.92 },
  bush: { x: 0.5, y: 0.88 },
  termite: { x: 0.5, y: 0.9 },
  house: { x: 0.5, y: 0.92 },
  shed: { x: 0.5, y: 0.9 },
  tower: { x: 0.5, y: 0.94 },
  blades: { x: 0.5, y: 0.5 },
  kraal: { x: 0.5, y: 0.78 },
  reservoir: { x: 0.5, y: 0.58 },
  trough: { x: 0.5, y: 0.82 },
  bakkie: { x: 0.5, y: 0.88 },
  garden: { x: 0.5, y: 0.9 },
};

const TOWER_HEIGHT = 128;
const TOWER_AXLE_Y = 22;

export const WINDMILL_AXLE_LIFT = ART_ORIGIN.tower.y * TOWER_HEIGHT - TOWER_AXLE_Y;

export type ArtSheet = {
  grounds: Record<GroundTexture, HTMLCanvasElement[]>;
  cows: HTMLCanvasElement[];
  tree: HTMLCanvasElement;
  treeDead: HTMLCanvasElement;
  bush: HTMLCanvasElement;
  termite: HTMLCanvasElement;
  house: HTMLCanvasElement;
  shed: HTMLCanvasElement;
  tower: HTMLCanvasElement;
  blades: HTMLCanvasElement;
  kraal: HTMLCanvasElement;
  reservoir: HTMLCanvasElement;
  trough: HTMLCanvasElement;
  bakkie: HTMLCanvasElement;
  garden: HTMLCanvasElement;
};

export type HerdOffset = { x: number; y: number; flip: boolean; coat: number; scale: number };

function canvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (!ctx) throw new Error("Could not draw the farm art.");
  draw(ctx);
  return element;
}

function hash(x: number, y: number): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
}

function dropShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(42, 20, 8, 0.32)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function buildArt(tileWidth: number, tileHeight: number): ArtSheet {
  return {
    grounds: {
      grass: [0, 1, 2, 3].map((variant) => drawGrassDiamond(tileWidth, tileHeight, variant)),
      sand: [0, 1, 2].map((variant) => drawSandDiamond(tileWidth, tileHeight, variant, false)),
      yard: [0, 1, 2].map((variant) => drawSandDiamond(tileWidth, tileHeight, variant, true)),
      track: [0, 1].map((variant) => drawTrackDiamond(tileWidth, tileHeight, variant)),
    },
    cows: [
      drawCow("#a0522d", false),
      drawCow("#8b4513", false),
      drawCow("#6e341c", false),
      drawCow("#c4a882", true),
      drawCow("#d8c8b4", true),
      drawCow("#7a5a3a", false),
    ],
    tree: drawAcacia(),
    treeDead: drawAcacia(true),
    bush: drawThornBush(),
    termite: drawTermite(),
    house: drawFarmhouse(),
    shed: drawShed(),
    tower: drawTower(),
    blades: drawBlades(),
    kraal: drawKraal(),
    reservoir: drawReservoir(),
    trough: drawTrough(),
    bakkie: drawBakkie(),
    garden: drawGarden(),
  };
}

export function groundTextureKey(kind: GroundTexture, variant: number): string {
  return `ground-${kind}-${variant}`;
}

export function herdLayout(count: number, seed: number, radiusX: number, radiusY: number): HerdOffset[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const offsets: HerdOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = next() * Math.PI * 2;
    const dist = Math.sqrt(next()) * (0.35 + next() * 0.65);
    offsets.push({
      x: Math.cos(angle) * radiusX * dist,
      y: Math.sin(angle) * radiusY * dist,
      flip: next() > 0.5,
      coat: Math.floor(next() * 6),
      scale: 0.42 + next() * 0.22,
    });
  }
  return offsets;
}

function diamondPath(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number): void {
  ctx.beginPath();
  ctx.moveTo(w / 2, pad);
  ctx.lineTo(w - pad, h / 2);
  ctx.lineTo(w / 2, h - pad);
  ctx.lineTo(pad, h / 2);
  ctx.closePath();
}

function drawGrassDiamond(tileWidth: number, tileHeight: number, variant: number): HTMLCanvasElement {
  const bleed = 6;
  const w = tileWidth + bleed;
  const h = tileHeight + bleed;
  return canvas(w, h, (ctx) => {
    ctx.fillStyle = "#e8e0d0";
    diamondPath(ctx, w, h, 2);
    ctx.fill();
    ctx.save();
    diamondPath(ctx, w, h, 2);
    ctx.clip();
    for (let i = 0; i < 18 + variant * 3; i += 1) {
      const px = 8 + ((i * 37 + variant * 11) % (w - 16));
      const py = 6 + ((i * 53 + variant * 7) % (h - 12));
      const tall = 4 + (i % 5);
      ctx.strokeStyle = `rgba(90, 70, 40, ${0.08 + (i % 3) * 0.04})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (i % 2 === 0 ? 1 : -1), py - tall);
      ctx.stroke();
    }
    const patch = variant % 2 === 0 ? "rgba(180, 140, 60, 0.07)" : "rgba(120, 90, 50, 0.06)";
    ctx.fillStyle = patch;
    ctx.beginPath();
    ctx.ellipse(w * (0.3 + variant * 0.15), h * 0.55, w * 0.22, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSandDiamond(tileWidth: number, tileHeight: number, variant: number, yard: boolean): HTMLCanvasElement {
  const bleed = 6;
  const w = tileWidth + bleed;
  const h = tileHeight + bleed;
  const base = yard ? "#c86e42" : "#b85a34";
  const dark = yard ? "#a85630" : "#9a4a28";
  return canvas(w, h, (ctx) => {
    ctx.fillStyle = base;
    diamondPath(ctx, w, h, 2);
    ctx.fill();
    ctx.save();
    diamondPath(ctx, w, h, 2);
    ctx.clip();
    for (let i = 0; i < 24; i += 1) {
      const px = ((i * 41 + variant * 13) % w);
      const py = ((i * 29 + variant * 9) % h);
      ctx.fillStyle = i % 3 === 0 ? dark : "#cd7848";
      ctx.globalAlpha = 0.15 + (i % 4) * 0.06;
      ctx.fillRect(px, py, 2, 1);
    }
    ctx.globalAlpha = 1;
    if (variant === 1) {
      ctx.strokeStyle = "rgba(110, 70, 40, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.6);
      ctx.lineTo(w * 0.75, h * 0.45);
      ctx.stroke();
    }
  });
}

function drawTrackDiamond(tileWidth: number, tileHeight: number, variant: number): HTMLCanvasElement {
  const bleed = 6;
  const w = tileWidth + bleed;
  const h = tileHeight + bleed;
  return canvas(w, h, (ctx) => {
    ctx.fillStyle = "#a05830";
    diamondPath(ctx, w, h, 2);
    ctx.fill();
    ctx.save();
    diamondPath(ctx, w, h, 2);
    ctx.clip();
    ctx.fillStyle = "#7a4018";
    for (const lane of variant === 0 ? [0.38, 0.62] : [0.42, 0.58]) {
      ctx.beginPath();
      ctx.ellipse(w * lane, h * 0.5, w * 0.06, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(60, 32, 16, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.35);
    ctx.lineTo(w * 0.85, h * 0.65);
    ctx.stroke();
  });
}

function drawCow(coat: string, pale: boolean): HTMLCanvasElement {
  return canvas(44, 36, (ctx) => {
    dropShadow(ctx, 22, 30, 14, 5);
    ctx.fillStyle = "#3a2010";
    for (const [x, y] of [
      [12, 28],
      [18, 31],
      [26, 28],
      [32, 31],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x, y, 1.8, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(20, 18, 12, 7.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(15, 13, 5, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    if (pale) {
      ctx.fillStyle = "#f0e6d4";
      ctx.beginPath();
      ctx.ellipse(14, 17, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(32, 15, 5.5, 4, 0.25, 0, Math.PI * 2);
    ctx.fill();
    if (!pale) {
      ctx.fillStyle = "#6a3a22";
      ctx.beginPath();
      ctx.ellipse(21, 14, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(34, 13);
    ctx.lineTo(37, 9);
    ctx.moveTo(30, 12);
    ctx.lineTo(28, 9);
    ctx.stroke();
    ctx.fillStyle = "#1a1008";
    ctx.beginPath();
    ctx.arc(36, 13, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawAcacia(dead = false): HTMLCanvasElement {
  return canvas(112, 96, (ctx) => {
    dropShadow(ctx, 56, 86, 30, 9);
    const trunk = dead ? "#5a4030" : "#6a4832";
    const canopy = dead ? "#4a5038" : "#3a5e2c";
    const highlight = dead ? "#5a6048" : "#5a8a3a";
    ctx.fillStyle = trunk;
    ctx.fillRect(50, 54, 12, 30);
    ctx.fillRect(46, 68, 6, 14);
    ctx.fillRect(60, 66, 5, 12);
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.ellipse(56, 48, 46, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(52, 42, 38, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dead ? "#6a7048" : "#78a048";
    ctx.beginPath();
    ctx.ellipse(40, 40, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(42, 28, 16, 0.15)";
    ctx.beginPath();
    ctx.ellipse(56, 52, 44, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawThornBush(): HTMLCanvasElement {
  return canvas(52, 40, (ctx) => {
    dropShadow(ctx, 26, 32, 16, 5);
    const greens = ["#4a5428", "#5a6830", "#6a7434"];
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = greens[i % greens.length];
      const ox = 14 + (i % 3) * 10;
      const oy = 12 + Math.floor(i / 3) * 6;
      ctx.beginPath();
      ctx.ellipse(ox, oy, 10 + (i % 2) * 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#3a4018";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i += 1) {
      const ax = 10 + i * 5;
      const ay = 22 + (i % 2) * 4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + 2, ay - 6);
      ctx.stroke();
    }
  });
}

function drawTermite(): HTMLCanvasElement {
  return canvas(36, 28, (ctx) => {
    dropShadow(ctx, 18, 24, 10, 4);
    ctx.fillStyle = "#8a6a48";
    ctx.beginPath();
    ctx.ellipse(18, 18, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a08058";
    ctx.beginPath();
    ctx.ellipse(18, 14, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 40, 24, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 16);
    ctx.lineTo(26, 16);
    ctx.stroke();
  });
}

function drawFarmhouse(): HTMLCanvasElement {
  return canvas(140, 118, (ctx) => {
    dropShadow(ctx, 70, 106, 38, 10);
    const cream = "#efe4cc";
    const creamDark = "#d8c8a8";
    const roof = "#8a9498";
    const roofDark = "#6a7478";
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.moveTo(22, 52);
    ctx.lineTo(70, 76);
    ctx.lineTo(70, 98);
    ctx.lineTo(22, 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = creamDark;
    ctx.beginPath();
    ctx.moveTo(70, 76);
    ctx.lineTo(118, 52);
    ctx.lineTo(118, 74);
    ctx.lineTo(70, 98);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c8b898";
    ctx.beginPath();
    ctx.moveTo(16, 74);
    ctx.lineTo(22, 78);
    ctx.lineTo(22, 52);
    ctx.lineTo(16, 56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#b8a888";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(18 + i * 11, 80, 8, 16);
    }
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(70, 18);
    ctx.lineTo(132, 44);
    ctx.lineTo(70, 68);
    ctx.lineTo(8, 44);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 8; i += 1) {
      const y = 28 + i * 5;
      ctx.strokeStyle = i % 2 === 0 ? roofDark : "#a0aaae";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(20 + i * 2, y);
      ctx.lineTo(120 - i * 2, y + 8);
      ctx.stroke();
    }
    ctx.fillStyle = roofDark;
    ctx.beginPath();
    ctx.moveTo(70, 18);
    ctx.lineTo(132, 44);
    ctx.lineTo(70, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#667078";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 18);
    ctx.lineTo(70, 68);
    ctx.stroke();
    ctx.fillStyle = "#4a3420";
    ctx.fillRect(34, 58, 12, 16);
    ctx.fillStyle = "#6a8ab0";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(36, 60, 8, 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#b8a078";
    ctx.fillRect(88, 58, 22, 6);
    ctx.fillRect(88, 64, 4, 22);
    ctx.fillRect(106, 64, 4, 22);
    ctx.fillRect(88, 84, 22, 4);
  });
}

function drawShed(): HTMLCanvasElement {
  return canvas(72, 56, (ctx) => {
    dropShadow(ctx, 36, 50, 22, 6);
    ctx.fillStyle = "#c8b8a0";
    ctx.beginPath();
    ctx.moveTo(10, 28);
    ctx.lineTo(36, 40);
    ctx.lineTo(36, 52);
    ctx.lineTo(10, 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a89878";
    ctx.beginPath();
    ctx.moveTo(36, 40);
    ctx.lineTo(62, 28);
    ctx.lineTo(62, 40);
    ctx.lineTo(36, 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a9094";
    ctx.beginPath();
    ctx.moveTo(36, 12);
    ctx.lineTo(68, 26);
    ctx.lineTo(36, 38);
    ctx.lineTo(4, 26);
    ctx.closePath();
    ctx.fill();
  });
}

function drawTower(): HTMLCanvasElement {
  return canvas(48, TOWER_HEIGHT, (ctx) => {
    dropShadow(ctx, 24, 118, 14, 5);
    ctx.strokeStyle = "#5c4030";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(14, 114);
    ctx.lineTo(18, 26);
    ctx.moveTo(34, 114);
    ctx.lineTo(30, 26);
    ctx.moveTo(14, 114);
    ctx.lineTo(30, 26);
    ctx.moveTo(34, 114);
    ctx.lineTo(18, 26);
    ctx.stroke();
    ctx.strokeStyle = "#8a6a48";
    ctx.lineWidth = 1.4;
    for (const y of [44, 62, 80, 98]) {
      ctx.beginPath();
      ctx.moveTo(15, y + 6);
      ctx.lineTo(33, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#4a3828";
    ctx.fillRect(16, 18, 16, 8);
    ctx.strokeStyle = "#6a5040";
    ctx.strokeRect(16, 18, 16, 8);
    ctx.fillStyle = "#b8c4c8";
    ctx.beginPath();
    ctx.arc(24, TOWER_AXLE_Y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#788890";
    ctx.stroke();
  });
}

function drawBlades(): HTMLCanvasElement {
  return canvas(96, 96, (ctx) => {
    const cx = 48;
    const cy = 48;
    ctx.strokeStyle = "#c8d4d8";
    ctx.fillStyle = "#dce8ec";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 42, cy + Math.sin(angle) * 42);
      ctx.stroke();
    }
    ctx.fillStyle = "#f0f4f6";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8aa4aa";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function drawKraal(): HTMLCanvasElement {
  return canvas(128, 80, (ctx) => {
    dropShadow(ctx, 64, 68, 34, 8);
    const posts = 20;
    for (let i = 0; i < posts; i += 1) {
      const angle = (Math.PI * 2 * i) / posts;
      const x = 64 + Math.cos(angle) * 48;
      const y = 38 + Math.sin(angle) * 20;
      ctx.fillStyle = "#4a3018";
      ctx.fillRect(x - 2, y - 14, 4, 16);
      ctx.fillStyle = "#6a4428";
      ctx.beginPath();
      ctx.arc(x, y - 14, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#9a7a58";
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 3; ring += 1) {
      const rx = 48 - ring * 4;
      const ry = 20 - ring * 2;
      ctx.beginPath();
      ctx.ellipse(64, 38, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(90, 60, 30, 0.15)";
    ctx.beginPath();
    ctx.ellipse(64, 40, 40, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawReservoir(): HTMLCanvasElement {
  return canvas(96, 62, (ctx) => {
    dropShadow(ctx, 48, 54, 28, 7);
    ctx.fillStyle = "#a8a098";
    ctx.beginPath();
    ctx.ellipse(48, 34, 40, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#888078";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#286868";
    ctx.beginPath();
    ctx.ellipse(48, 32, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#48a8a0";
    ctx.beginPath();
    ctx.ellipse(38, 30, 12, 5, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#184848";
    ctx.beginPath();
    ctx.ellipse(48, 36, 30, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawTrough(): HTMLCanvasElement {
  return canvas(44, 28, (ctx) => {
    dropShadow(ctx, 22, 24, 14, 4);
    ctx.fillStyle = "#6a4a30";
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(22, 18);
    ctx.lineTo(40, 10);
    ctx.lineTo(22, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a7870";
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(22, 17);
    ctx.lineTo(34, 12);
    ctx.lineTo(22, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(8, 12, 4, 10);
    ctx.fillRect(32, 12, 4, 10);
    ctx.strokeStyle = "#8a6a48";
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 12, 4, 10);
    ctx.strokeRect(32, 12, 4, 10);
  });
}

function drawBakkie(): HTMLCanvasElement {
  return canvas(64, 40, (ctx) => {
    dropShadow(ctx, 32, 34, 22, 6);
    ctx.fillStyle = "#e8ece8";
    ctx.beginPath();
    ctx.moveTo(6, 20);
    ctx.lineTo(32, 28);
    ctx.lineTo(58, 20);
    ctx.lineTo(58, 26);
    ctx.lineTo(6, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d0d4d0";
    ctx.fillRect(8, 14, 28, 10);
    ctx.fillStyle = "#88a0b0";
    ctx.fillRect(10, 15, 10, 6);
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(18, 30, 5, 0, Math.PI * 2);
    ctx.arc(48, 30, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGarden(): HTMLCanvasElement {
  return canvas(52, 36, (ctx) => {
    dropShadow(ctx, 26, 30, 18, 5);
    ctx.strokeStyle = "#8a6a48";
    ctx.strokeRect(8, 12, 36, 18);
    ctx.fillStyle = "#4a6a32";
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        ctx.fillRect(11 + col * 8, 14 + row * 5, 5, 3);
      }
    }
  });
}

export function maybeTermiteAt(x: number, y: number): boolean {
  return hash(x, y) > 0.96;
}

export function treeDeadAt(x: number, y: number): boolean {
  return hash(x + 3, y + 7) > 0.88;
}
