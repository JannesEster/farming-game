import type { GroundTexture } from "./colour";
import { diamondPath, highlightStroke, isoShade, scatterNoise, softShadow } from "./paint";

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

export type CowBreedArt = {
  walk: HTMLCanvasElement[];
  graze: HTMLCanvasElement[];
};

export type ArtSheet = {
  grounds: Record<GroundTexture, HTMLCanvasElement[]>;
  cows: CowBreedArt[];
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

export type CowView = "left" | "right" | "toward" | "away";

export type HerdOffset = {
  x: number;
  y: number;
  flip: boolean;
  coat: number;
  scale: number;
  view: CowView;
  /** 0 to 7. Screen facing. 2 is toward the camera, 6 is away, 0 is screen-right. */
  octant?: number;
};

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

export function cowTextureKey(coat: number, walking: boolean, frame: number): string {
  const kind = walking ? "w" : "g";
  const max = walking ? 3 : 2;
  const f = ((frame % max) + max) % max;
  return `cow-${coat % 6}-${kind}${f}`;
}

type BreedPalette = {
  body: string;
  shadow: string;
  pale: boolean;
  patches?: boolean;
  hump?: boolean;
  name: string;
};

const BREEDS: BreedPalette[] = [
  { name: "bonsmara", body: "#a24a28", shadow: "#6e2e18", pale: false },
  { name: "brahman", body: "#c8b090", shadow: "#9a7860", pale: true, hump: true },
  { name: "simmentaler", body: "#d4a868", shadow: "#a87838", pale: true },
  { name: "nguni", body: "#8a4828", shadow: "#5a2810", pale: false, patches: true },
  { name: "dark-bonsmara", body: "#7a3a20", shadow: "#4a2210", pale: false },
  { name: "red-brahman", body: "#b88868", shadow: "#886048", pale: true, hump: true },
];

export function buildArt(tileWidth: number, tileHeight: number): ArtSheet {
  return {
    grounds: {
      grass: [0, 1, 2, 3].map((variant) => drawGrassDiamond(tileWidth, tileHeight, variant)),
      sand: [0, 1, 2].map((variant) => drawSandDiamond(tileWidth, tileHeight, variant, false)),
      yard: [0, 1, 2].map((variant) => drawSandDiamond(tileWidth, tileHeight, variant, true)),
      track: [0, 1].map((variant) => drawTrackDiamond(tileWidth, tileHeight, variant)),
    },
    cows: BREEDS.map((breed, coat) => ({
      walk: [0, 1, 2].map((frame) => drawCow(breed, frame, "walk", coat)),
      graze: [0, 1].map((frame) => drawCow(breed, frame, "graze", coat)),
    })),
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
      flip: false,
      coat: Math.floor(next() * 6),
      scale: 0.42 + next() * 0.22,
      view: next() > 0.5 ? "right" : "left",
    });
  }
  return offsets;
}

function drawGrassDiamond(tileWidth: number, tileHeight: number, variant: number): HTMLCanvasElement {
  const bleed = 8;
  const w = tileWidth + bleed;
  const h = tileHeight + bleed;
  return canvas(w, h, (ctx) => {
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, "#e8d8b8");
    base.addColorStop(0.5, "#d8c8a0");
    base.addColorStop(1, "#c8a878");
    ctx.fillStyle = base;
    diamondPath(ctx, w, h, 2);
    ctx.fill();
    ctx.save();
    diamondPath(ctx, w, h, 2);
    ctx.clip();
    scatterNoise(
      ctx,
      w,
      h,
      28 + variant * 4,
      variant + 2.1,
      0.55,
      ["#8a7038", "#a88848", "#6a5828", "#c8a060"],
    );
    for (let i = 0; i < 22 + variant * 4; i += 1) {
      const px = 6 + ((i * 37 + variant * 11) % (w - 12));
      const py = 5 + ((i * 53 + variant * 7) % (h - 10));
      const tall = 3 + (i % 6) + variant;
      const lean = i % 2 === 0 ? 1.2 : -1.1;
      const hue = i % 3 === 0 ? "rgba(110, 90, 48," : "rgba(70, 90, 38,";
      ctx.strokeStyle = `${hue}${0.14 + (i % 4) * 0.05})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + lean, py - tall * 0.55, px + lean * 1.6, py - tall);
      ctx.stroke();
    }
    ctx.fillStyle = variant % 2 === 0 ? "rgba(160, 120, 50, 0.08)" : "rgba(90, 120, 50, 0.06)";
    ctx.beginPath();
    ctx.ellipse(w * (0.28 + variant * 0.14), h * 0.52, w * 0.24, h * 0.34, 0.15, 0, Math.PI * 2);
    ctx.fill();
    isoShade(ctx, w, h, 0.16);
    highlightStroke(ctx, w, h, 2);
    ctx.restore();
  });
}

function drawSandDiamond(tileWidth: number, tileHeight: number, variant: number, yard: boolean): HTMLCanvasElement {
  const bleed = 8;
  const w = tileWidth + bleed;
  const h = tileHeight + bleed;
  return canvas(w, h, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    const top = yard ? "#e09868" : "#d07848";
    const mid = yard ? "#c87040" : "#b86038";
    const bot = yard ? "#a85030" : "#9a4828";
    grd.addColorStop(0, top);
    grd.addColorStop(0.48, mid);
    grd.addColorStop(1, bot);
    ctx.fillStyle = grd;
    diamondPath(ctx, w, h, 2);
    ctx.fill();
    ctx.save();
    diamondPath(ctx, w, h, 2);
    ctx.clip();
    scatterNoise(ctx, w, h, 36, variant + (yard ? 0.9 : 0), 0.7, ["#c88858", "#a04828", "#e0a878", "#904830"]);
    if (variant === 1) {
      ctx.strokeStyle = "rgba(90, 55, 28, 0.22)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.62);
      ctx.quadraticCurveTo(w * 0.45, h * 0.48, w * 0.78, h * 0.42);
      ctx.stroke();
    }
    isoShade(ctx, w, h, 0.2);
    highlightStroke(ctx, w, h, 2);
    ctx.restore();
  });
}

function drawTrackDiamond(tileWidth: number, tileHeight: number, variant: number): HTMLCanvasElement {
  const bleed = 8;
  const w = tileWidth + bleed;
  const h = tileHeight + bleed;
  return canvas(w, h, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#b06838");
    grd.addColorStop(1, "#8a4820");
    ctx.fillStyle = grd;
    diamondPath(ctx, w, h, 2);
    ctx.fill();
    ctx.save();
    diamondPath(ctx, w, h, 2);
    ctx.clip();
    ctx.fillStyle = "#6a3816";
    for (const lane of variant === 0 ? [0.36, 0.64] : [0.4, 0.6]) {
      ctx.beginPath();
      ctx.ellipse(w * lane, h * 0.5, w * 0.07, h * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    scatterNoise(ctx, w, h, 18, variant + 4.2, 0.45, ["#5a3010", "#9a5830"]);
    ctx.strokeStyle = "rgba(50, 28, 12, 0.38)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.34);
    ctx.lineTo(w * 0.88, h * 0.66);
    ctx.stroke();
    isoShade(ctx, w, h, 0.18);
    highlightStroke(ctx, w, h, 2);
    ctx.restore();
  });
}

function drawCow(
  breed: BreedPalette,
  frame: number,
  pose: "walk" | "graze",
  coatSeed: number,
): HTMLCanvasElement {
  const w = 52;
  const h = 42;
  const step = pose === "walk" ? Math.sin((frame / 3) * Math.PI * 2) * 2.2 : frame * 0.35;
  return canvas(w, h, (ctx) => {
    softShadow(ctx, 26, 34, 16, 5.5, 0.36);
    const hoofLift = pose === "walk" ? step : 0;
    ctx.fillStyle = "#2e1a10";
    for (const [x, y, lift] of [
      [14, 32, -hoofLift],
      [20, 34, hoofLift],
      [30, 32, hoofLift * 0.7],
      [36, 34, -hoofLift * 0.6],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x, y + lift, 2, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const bodyGrad = ctx.createLinearGradient(8, 10, 40, 26);
    bodyGrad.addColorStop(0, breed.body);
    bodyGrad.addColorStop(0.55, breed.shadow);
    bodyGrad.addColorStop(1, breed.body);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(24, 20, 14, 8 + step * 0.15, -0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = breed.body;
    ctx.beginPath();
    ctx.ellipse(17, 14, 6, 5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    if (breed.hump) {
      ctx.fillStyle = breed.shadow;
      ctx.beginPath();
      ctx.ellipse(26, 11, 5, 4.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (breed.pale && !breed.patches) {
      ctx.fillStyle = "#f0e6d0";
      ctx.beginPath();
      ctx.ellipse(17, 18, 6, 4.5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    if (breed.patches) {
      ctx.fillStyle = "#f4ece0";
      ctx.beginPath();
      ctx.ellipse(28, 18, 5, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1008";
      ctx.beginPath();
      ctx.ellipse(22 + (coatSeed % 3), 21, 3.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(36, 15, 6, 4.5, 0.22, 0, Math.PI * 2);
    ctx.fill();
    if (!breed.pale && !breed.patches) {
      ctx.fillStyle = breed.shadow;
      ctx.beginPath();
      ctx.ellipse(23, 14, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const headY = pose === "graze" ? 18 + frame * 1.2 : 14 - step * 0.2;
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(38, headY);
    ctx.lineTo(41, headY - 4);
    ctx.moveTo(34, headY - 1);
    ctx.lineTo(32, headY - 4);
    ctx.stroke();
    ctx.fillStyle = "#1a1008";
    ctx.beginPath();
    ctx.arc(40, headY, 1.3, 0, Math.PI * 2);
    ctx.fill();
    if (pose === "graze") {
      ctx.fillStyle = "rgba(90, 120, 50, 0.55)";
      ctx.beginPath();
      ctx.ellipse(42, headY + 3, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawAcacia(dead = false): HTMLCanvasElement {
  return canvas(124, 108, (ctx) => {
    softShadow(ctx, 62, 94, 34, 10, 0.38);
    const trunk = dead ? "#5a4030" : "#6a4832";
    const trunkHi = dead ? "#6a5040" : "#8a6848";
    const canopy = dead ? "#4a5038" : "#3a5828";
    const highlight = dead ? "#5a6048" : "#6a9838";
    const trunkGrad = ctx.createLinearGradient(48, 50, 68, 90);
    trunkGrad.addColorStop(0, trunkHi);
    trunkGrad.addColorStop(1, trunk);
    ctx.fillStyle = trunkGrad;
    ctx.fillRect(54, 56, 14, 34);
    ctx.fillRect(49, 70, 7, 16);
    ctx.fillRect(64, 68, 6, 14);
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.ellipse(62, 46, 50, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(58, 38, 42, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dead ? "#6a7048" : "#88b050";
    ctx.beginPath();
    ctx.ellipse(44, 36, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    scatterNoise(ctx, 124, 70, 12, dead ? 1.2 : 3.4, 0.35, ["#98c058", "#4a6828"]);
    ctx.fillStyle = "rgba(42, 28, 16, 0.14)";
    ctx.beginPath();
    ctx.ellipse(62, 52, 48, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawThornBush(): HTMLCanvasElement {
  return canvas(56, 44, (ctx) => {
    softShadow(ctx, 28, 36, 18, 5.5, 0.34);
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
  return canvas(40, 32, (ctx) => {
    softShadow(ctx, 20, 27, 11, 4.5, 0.32);
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
  return canvas(152, 128, (ctx) => {
    softShadow(ctx, 76, 114, 42, 11, 0.4);
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
  return canvas(78, 60, (ctx) => {
    softShadow(ctx, 39, 54, 24, 6.5, 0.34);
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
  return canvas(52, TOWER_HEIGHT, (ctx) => {
    softShadow(ctx, 26, 118, 15, 5.5, 0.34);
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
  return canvas(136, 88, (ctx) => {
    softShadow(ctx, 68, 74, 36, 9, 0.36);
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
  return canvas(104, 68, (ctx) => {
    softShadow(ctx, 52, 58, 30, 7.5, 0.34);
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
  return canvas(48, 32, (ctx) => {
    softShadow(ctx, 24, 28, 15, 4.5, 0.32);
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
  return canvas(72, 46, (ctx) => {
    softShadow(ctx, 36, 40, 24, 6.5, 0.34);
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
  return canvas(56, 40, (ctx) => {
    softShadow(ctx, 28, 34, 19, 5.5, 0.3);
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
  return hash(x, y) > 0.992;
}

export function treeDeadAt(x: number, y: number): boolean {
  return hash(x + 3, y + 7) > 0.88;
}
