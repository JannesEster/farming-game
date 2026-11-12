import { CONFIG } from "../sim/config";

/** PNG sprite keys loaded from `public/sprites/`. */
export const SPRITE_KEYS = {
  farmhouse: "spr-farmhouse",
  windmill: "spr-windmill",
  shed: "spr-shed",
  kraal: "spr-kraal",
  trough: "spr-trough",
  bakkie: "spr-bakkie",
  gate: "spr-gate",
  fence: "spr-fence",
  camelthorn1: "spr-camelthorn-1",
  camelthorn2: "spr-camelthorn-2",
  shepherdsTree: "spr-shepherds-tree",
  thornBush1: "spr-thorn-bush-1",
  thornBush2: "spr-thorn-bush-2",
  termiteMound: "spr-termite-mound",
  rockCluster: "spr-rock-cluster",
  tileDryGrass: "spr-tile-dry-grass",
  tileGreenGrass: "spr-tile-green-grass",
  tileSand: "spr-tile-kalahari-sand",
  tileTrack: "spr-tile-dirt-track",
  tileOvergrazed: "spr-tile-overgrazed",
  cattleBrahman: "spr-cattle-brahman",
  cattleBonsmara: "spr-cattle-bonsmara",
  cattleSimmentaler: "spr-cattle-simmentaler",
  cattleNguni: "spr-cattle-nguni",
  cattleAngus: "spr-cattle-angus",
  cattleCalf: "spr-cattle-calf",
  cowDot: "spr-cow-dot",
  farmhand: "spr-farmhand",
  farmer: "spr-farmer",
  workerHouse: "spr-worker-house",
  solarPump: "spr-solar-pump",
  crush: "spr-crush",
  loadingRamp: "spr-loading-ramp",
  cattleTruck: "spr-cattle-truck",
  lickFeeder: "spr-lick-feeder",
  reservoir: "spr-reservoir",
  cowDrink: "spr-cow-drink",
} as const;

export type PersonDir = "n" | "e" | "s" | "w";

export function personTextureKey(role: "farmer" | "farmhand", dir: PersonDir, frame: number): string {
  return `${role === "farmer" ? SPRITE_KEYS.farmer : SPRITE_KEYS.farmhand}-${dir}-${frame % 2}`;
}

/** Farmhand and farmer walk textures (4 directions, 2 frames). */
export function ensureFarmhandTexture(scene: Phaser.Scene): void {
  ensurePersonWalkTextures(scene, "farmhand");
}

export function ensureFarmerTexture(scene: Phaser.Scene): void {
  ensurePersonWalkTextures(scene, "farmer");
}

export const FARMHAND_TEXTURE_HEIGHT = 96;
export const PERSON_TEXTURE_HEIGHT = 96;

function drawPersonFrame(
  g: Phaser.GameObjects.Graphics,
  shirt: number,
  hat: number,
  frame: number,
  dir: PersonDir,
): void {
  g.clear();
  const lean = frame === 1 ? 2 : 0;
  g.fillStyle(shirt, 1);
  g.fillRoundedRect(14 + lean, 28, 36, 42, 4);
  g.fillStyle(0xf2c9a0, 1);
  g.fillCircle(32, 20, 14);
  g.fillStyle(hat, 1);
  g.fillEllipse(32, 15, 22, 11);
  g.fillStyle(0x1a3550, 1);
  g.fillRoundedRect(22, 62, 20, 24, 3);
  g.fillStyle(0x2a2a2a, 1);
  if (dir === "n") {
    g.fillRect(20, 84, 12, 10);
    g.fillRect(32, 84, 12, 10);
  } else if (dir === "s") {
    g.fillRect(18, 86, 14, 8);
    g.fillRect(38, 86, 14, 8);
  } else if (dir === "e") {
    g.fillRect(16 + lean, 86, 14, 8);
    g.fillRect(40 + lean, 84, 14, 8);
  } else {
    g.fillRect(18 - lean, 84, 14, 8);
    g.fillRect(34 - lean, 86, 14, 8);
  }
}

export function ensurePersonWalkTextures(scene: Phaser.Scene, role: "farmer" | "farmhand"): void {
  const shirt = role === "farmer" ? 0x2d6a4f : 0xff8c1a;
  const hat = role === "farmer" ? 0xc4a574 : 0x3d2c1e;
  const base = role === "farmer" ? SPRITE_KEYS.farmer : SPRITE_KEYS.farmhand;
  const dirs: PersonDir[] = ["n", "e", "s", "w"];
  for (const dir of dirs) {
    for (let frame = 0; frame < 2; frame += 1) {
      const key = personTextureKey(role, dir, frame);
      if (scene.textures.exists(key)) continue;
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPersonFrame(g, shirt, hat, frame, dir);
      g.generateTexture(key, 64, 96);
      g.destroy();
    }
  }
  if (!scene.textures.exists(base)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPersonFrame(g, shirt, hat, 0, "s");
    g.generateTexture(base, 64, 96);
    g.destroy();
  }
}

/** Cab and a slatted livestock trailer, seen from the side the ramp faces. */
export function paintLivestockTruck(): HTMLCanvasElement {
  const w = 420;
  const h = 168;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "rgba(30, 20, 12, 0.28)";
  ctx.beginPath();
  ctx.ellipse(210, 150, 180, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2a3138";
  ctx.fillRect(28, 108, 360, 10);

  ctx.fillStyle = "#6e5438";
  ctx.fillRect(118, 48, 268, 62);
  ctx.fillStyle = "#1a120c";
  for (let i = 0; i < 9; i += 1) {
    ctx.fillRect(128 + i * 28, 52, 8, 54);
  }
  ctx.strokeStyle = "#3a2a1c";
  ctx.lineWidth = 3;
  ctx.strokeRect(118, 48, 268, 62);
  ctx.beginPath();
  ctx.moveTo(124, 70);
  ctx.lineTo(380, 70);
  ctx.moveTo(124, 88);
  ctx.lineTo(380, 88);
  ctx.stroke();
  ctx.fillStyle = "#5c4632";
  ctx.fillRect(368, 50, 16, 58);
  ctx.fillStyle = "#c4b8a4";
  ctx.fillRect(372, 62, 6, 22);

  ctx.fillStyle = "#e7e2d6";
  ctx.beginPath();
  ctx.moveTo(18, 78);
  ctx.lineTo(46, 70);
  ctx.lineTo(78, 70);
  ctx.lineTo(104, 58);
  ctx.lineTo(118, 58);
  ctx.lineTo(118, 112);
  ctx.lineTo(18, 112);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d4cfc3";
  ctx.fillRect(24, 84, 88, 28);
  ctx.fillStyle = "#8ec4e4";
  ctx.beginPath();
  ctx.moveTo(48, 64);
  ctx.lineTo(100, 56);
  ctx.lineTo(108, 72);
  ctx.lineTo(50, 80);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9fd0ea";
  ctx.fillRect(28, 88, 22, 16);
  ctx.fillStyle = "#2c3440";
  ctx.fillRect(16, 96, 16, 8);
  ctx.fillStyle = "#f2e7a4";
  ctx.fillRect(18, 98, 8, 4);
  ctx.fillStyle = "#8a9298";
  ctx.fillRect(108, 78, 8, 16);
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.moveTo(112, 70);
  ctx.lineTo(126, 62);
  ctx.lineTo(126, 78);
  ctx.lineTo(112, 82);
  ctx.closePath();
  ctx.fill();

  const wheel = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#1c2228";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d98a4";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  };
  wheel(48, 122, 16);
  wheel(86, 122, 16);
  wheel(196, 124, 17);
  wheel(236, 124, 17);
  wheel(330, 124, 17);
  wheel(368, 124, 17);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(176, 112, 18, 16);
  ctx.fillRect(350, 112, 18, 16);
  return canvas;
}

export function ensureStep3bPropTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(SPRITE_KEYS.reservoir)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x8d8680, 1);
    g.fillEllipse(56, 62, 96, 46);
    g.fillStyle(0x6a6560, 1);
    g.fillEllipse(56, 54, 84, 36);
    g.fillStyle(0x3d7eae, 1);
    g.fillEllipse(56, 50, 64, 24);
    g.lineStyle(3, 0x4e4944, 1);
    g.strokeEllipse(56, 62, 96, 46);
    g.generateTexture(SPRITE_KEYS.reservoir, 112, 96);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.solarPump)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x2b3550, 1);
    g.fillRect(36, 58, 40, 28);
    g.fillStyle(0x1a4a8f, 1);
    g.beginPath();
    g.moveTo(24, 58);
    g.lineTo(56, 26);
    g.lineTo(88, 58);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xd4dce8, 0.9);
    for (let i = 0; i < 4; i += 1) {
      g.lineBetween(30 + i * 14, 52, 48 + i * 8, 34);
    }
    g.generateTexture(SPRITE_KEYS.solarPump, 112, 96);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.lickFeeder)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x5c5348, 1);
    g.fillRoundedRect(20, 52, 72, 26, 4);
    g.fillStyle(0xc9a45c, 0.85);
    g.fillEllipse(56, 48, 54, 14);
    g.generateTexture(SPRITE_KEYS.lickFeeder, 112, 80);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.crush)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.lineStyle(5, 0x6a4a2a, 1);
    g.strokeRect(18, 22, 76, 58);
    g.lineBetween(18, 50, 94, 50);
    g.fillStyle(0x8b6b3a, 0.35);
    g.fillRect(22, 54, 68, 22);
    g.generateTexture(SPRITE_KEYS.crush, 112, 96);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.loadingRamp)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x8b7355, 1);
    g.fillTriangle(16, 72, 96, 72, 56, 28);
    g.lineStyle(3, 0x5c4330, 1);
    g.lineBetween(24, 72, 56, 32);
    g.lineBetween(56, 32, 88, 72);
    g.generateTexture(SPRITE_KEYS.loadingRamp, 112, 96);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.cattleTruck)) {
    scene.textures.addCanvas(SPRITE_KEYS.cattleTruck, paintLivestockTruck());
  }
  if (!scene.textures.exists(SPRITE_KEYS.cowDrink)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x7a4e2d, 1);
    g.fillEllipse(108, 46, 86, 36);
    g.fillRect(78, 58, 8, 28);
    g.fillRect(96, 58, 8, 28);
    g.fillRect(122, 58, 8, 28);
    g.fillRect(140, 58, 8, 28);
    g.fillStyle(0x6b4226, 1);
    g.fillTriangle(78, 40, 36, 78, 88, 46);
    g.fillStyle(0x8a5a34, 1);
    g.fillEllipse(30, 84, 34, 18);
    g.fillStyle(0x2a1a12, 1);
    g.fillCircle(20, 82, 2.4);
    g.fillStyle(0xf2efe6, 1);
    g.fillEllipse(118, 38, 12, 9);
    g.generateTexture(SPRITE_KEYS.cowDrink, 180, 110);
    g.destroy();
  }
}

export function ensureDrinkCowTexture(scene: Phaser.Scene, baseKey: string): string {
  const drinkKey = `${baseKey}-drink`;
  if (scene.textures.exists(drinkKey)) return drinkKey;
  if (!scene.textures.exists(baseKey)) return baseKey;
  const source = scene.textures.get(baseKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(source, 0, 0);
    ctx.save();
    ctx.translate(canvas.width * 0.52, canvas.height * 0.72);
    ctx.rotate(0.42);
    ctx.fillStyle = "#2a1a12";
    ctx.fillRect(-10, -6, 28, 10);
    ctx.restore();
  }
  scene.textures.addCanvas(drinkKey, canvas);
  return drinkKey;
}

export function ensureWorkerHouseTexture(scene: Phaser.Scene): void {
  const key = SPRITE_KEYS.workerHouse;
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xd7c3a4, 1);
  g.fillRect(18, 58, 92, 40);
  g.fillStyle(0xb08968, 1);
  g.fillRect(14, 94, 100, 8);
  g.fillStyle(0x8d97a0, 1);
  g.beginPath();
  g.moveTo(8, 62);
  g.lineTo(64, 22);
  g.lineTo(120, 62);
  g.closePath();
  g.fillPath();
  g.lineStyle(2, 0x5e676e, 1);
  for (let i = 0; i < 9; i += 1) {
    const y = 26 + i * 3.8;
    const t = i / 9;
    const left = 16 + t * 40;
    const right = 112 - t * 40;
    g.lineBetween(left, y, right, y + 4);
  }
  g.fillStyle(0x4a3528, 1);
  g.fillRect(54, 70, 20, 28);
  g.fillStyle(0x6e8199, 0.95);
  g.fillRect(28, 68, 16, 12);
  g.fillRect(84, 68, 16, 12);
  g.generateTexture(key, 128, 112);
  g.destroy();
}

export const WORKER_COTTAGE_NATIVE_WIDTH = 128;

export function inferPersonDir(dx: number, dy: number): PersonDir {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "e" : "w";
  return dy >= 0 ? "s" : "n";
}

export const SPRITE_FILES: { key: string; file: string }[] = [
  { key: SPRITE_KEYS.farmhouse, file: "farmhouse.png" },
  { key: SPRITE_KEYS.windmill, file: "windmill.png" },
  { key: SPRITE_KEYS.shed, file: "shed.png" },
  { key: SPRITE_KEYS.kraal, file: "kraal.png" },
  { key: SPRITE_KEYS.trough, file: "trough.png" },
  { key: SPRITE_KEYS.bakkie, file: "bakkie.png" },
  { key: SPRITE_KEYS.gate, file: "gate.png" },
  { key: SPRITE_KEYS.fence, file: "fence.png" },
  { key: SPRITE_KEYS.camelthorn1, file: "camelthorn-1.png" },
  { key: SPRITE_KEYS.camelthorn2, file: "camelthorn-2.png" },
  { key: SPRITE_KEYS.shepherdsTree, file: "shepherds-tree.png" },
  { key: SPRITE_KEYS.thornBush1, file: "thorn-bush-1.png" },
  { key: SPRITE_KEYS.thornBush2, file: "thorn-bush-2.png" },
  { key: SPRITE_KEYS.termiteMound, file: "termite-mound.png" },
  { key: SPRITE_KEYS.rockCluster, file: "rock-cluster.png" },
  { key: SPRITE_KEYS.tileDryGrass, file: "tile-dry-grass.png" },
  { key: SPRITE_KEYS.tileGreenGrass, file: "tile-green-grass.png" },
  { key: SPRITE_KEYS.tileSand, file: "tile-kalahari-sand.png" },
  { key: SPRITE_KEYS.tileTrack, file: "tile-dirt-track.png" },
  { key: SPRITE_KEYS.tileOvergrazed, file: "tile-overgrazed.png" },
  { key: SPRITE_KEYS.cattleBrahman, file: "cattle-brahman.png" },
  { key: SPRITE_KEYS.cattleBonsmara, file: "cattle-bonsmara.png" },
  { key: SPRITE_KEYS.cattleSimmentaler, file: "cattle-simmentaler.png" },
  { key: SPRITE_KEYS.cattleNguni, file: "cattle-nguni.png" },
  { key: SPRITE_KEYS.cattleAngus, file: "cattle-angus.png" },
  { key: SPRITE_KEYS.cattleCalf, file: "cattle-calf.png" },
];

export const PAINTED_TILE_NATIVE_W = 256;
export const PAINTED_TILE_NATIVE_H = 128;

/** Base path for Vite `public/sprites`. */
export function spritesBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}sprites/`;
}

export function preloadPaintedSprites(loader: Phaser.Loader.LoaderPlugin): void {
  const prefix = spritesBaseUrl();
  for (const entry of SPRITE_FILES) {
    loader.image(entry.key, `${prefix}${entry.file}`);
  }
}

export function paintedSpritesReady(textures: Phaser.Textures.TextureManager): boolean {
  return textures.exists(SPRITE_KEYS.farmhouse);
}

/** Breed PNG for procedural coat index from herdLayout. */
export function cattleSpriteForCoat(coat: number): string {
  const table = [
    SPRITE_KEYS.cattleBonsmara,
    SPRITE_KEYS.cattleBrahman,
    SPRITE_KEYS.cattleSimmentaler,
    SPRITE_KEYS.cattleNguni,
    SPRITE_KEYS.cattleAngus,
    SPRITE_KEYS.cattleBonsmara,
  ];
  return table[((coat % table.length) + table.length) % table.length];
}

export function treeSpriteKey(x: number, y: number): string {
  const n = Math.abs(Math.sin(x * 9.17 + y * 23.11) * 43758.5453) % 1;
  if (n > 0.986) return SPRITE_KEYS.shepherdsTree;
  return n > 0.5 ? SPRITE_KEYS.camelthorn2 : SPRITE_KEYS.camelthorn1;
}

export function maybePaintedTermiteAt(x: number, y: number): boolean {
  return Math.abs(Math.sin(x * 5.17 + y * 11.3 + 1.9) * 43758.5453) % 1 > 0.992;
}

export function bushSpriteKey(x: number, y: number): string {
  const n = Math.abs(Math.sin(x * 11.3 + y * 17.7) * 99173.17) % 1;
  return n > 0.5 ? SPRITE_KEYS.thornBush2 : SPRITE_KEYS.thornBush1;
}

export function maybeRockAt(x: number, y: number): boolean {
  return Math.abs(Math.sin(x * 7.1 + y * 19.3 + 2.7) * 43758.5453) % 1 > 0.986;
}

export type PropSpriteDef = {
  key: string;
  originX: number;
  originY: number;
  scale: number;
};

/**
 * TODO(A): the herd cow texture stands for a 1.4 m animal. Prop metres below use that
 * so a windmill and a reservoir read next to the cattle, not as towers over dots.
 */
export const COW_SHOULDER_METRES = 1.4;

export function worldPxPerMetre(): number {
  return (128 * cattleDisplayScale()) / COW_SHOULDER_METRES;
}

export function scaleToSpanMetres(nativePx: number, metres: number): number {
  return (metres * worldPxPerMetre()) / nativePx;
}

/** Homestead prop scale tuned for 64×32 iso tiles on phone zoom. */
export function propSpriteForKind(kind: string, x: number, y: number, featureScale: number): PropSpriteDef {
  const tileW = CONFIG.view.tileWidth;
  const tw = PAINTED_TILE_NATIVE_W;
  switch (kind) {
    case "house":
      return { key: SPRITE_KEYS.farmhouse, originX: 0.5, originY: 0.9, scale: (tileW * 2.45) / tw };
    case "windmill":
      // Painted art is 512×739. TODO(A): full sprite height stands for an 8 m mill (about 6 to 10 m).
      return { key: SPRITE_KEYS.windmill, originX: 0.48, originY: 0.94, scale: scaleToSpanMetres(739, 8) };
    case "shed":
      return { key: SPRITE_KEYS.shed, originX: 0.5, originY: 0.88, scale: (tileW * 1.28) / 512 };
    case "kraal":
      // Art is 512 px wide. Keep the pen smaller than the house footprint (2.05 tiles).
      return { key: SPRITE_KEYS.kraal, originX: 0.5, originY: 0.82, scale: (tileW * 1.3) / 512 };
    case "trough":
      return { key: SPRITE_KEYS.trough, originX: 0.5, originY: 0.85, scale: (tileW * 1.35) / tw };
    case "reservoir":
      // TODO(A): dam about 10 m across (about 8 to 12 m).
      return { key: SPRITE_KEYS.reservoir, originX: 0.5, originY: 0.9, scale: scaleToSpanMetres(112, 10) };
    case "solar_pump":
      // TODO(A): a small array about 6 m across.
      return { key: SPRITE_KEYS.solarPump, originX: 0.5, originY: 0.94, scale: scaleToSpanMetres(112, 6) };
    case "crush":
      // TODO(A): crush reads about 5 m long beside the kraal.
      return { key: SPRITE_KEYS.crush, originX: 0.5, originY: 0.88, scale: scaleToSpanMetres(112, 5) };
    case "loading_ramp":
      // TODO(A): ramp reads about 7 m, facing the farm road.
      return { key: SPRITE_KEYS.loadingRamp, originX: 0.5, originY: 0.92, scale: scaleToSpanMetres(112, 7) };
    case "cattle_truck":
      // TODO(A): cab plus slatted livestock trailer about 16 m.
      return { key: SPRITE_KEYS.cattleTruck, originX: 0.22, originY: 0.9, scale: scaleToSpanMetres(420, 16) };
    case "lick_feeder":
      return { key: SPRITE_KEYS.lickFeeder, originX: 0.5, originY: 0.9, scale: (tileW * 1.1) / 112 };
    case "tree":
      return {
        key: treeSpriteKey(x, y),
        originX: 0.5,
        originY: 0.92,
        scale: ((tileW * 1.35) / tw) * featureScale,
      };
    case "bush":
      return {
        key: bushSpriteKey(x, y),
        originX: 0.5,
        originY: 0.88,
        scale: ((tileW * 0.85) / 160) * featureScale,
      };
    case "bakkie":
      return { key: SPRITE_KEYS.bakkie, originX: 0.5, originY: 0.88, scale: (tileW * 1.1) / 320 };
    default:
      return { key: SPRITE_KEYS.thornBush1, originX: 0.5, originY: 0.88, scale: 0.25 };
  }
}

/**
 * Visible cow width over the painted farmhouse width.
 * House footprint is 2.05 tiles (homesteadLayout). Cattle body fills ~131 of the 138px texture.
 * Target is the middle of 1/5 and 1/6.
 */
export function cattleDisplayScale(multiplier = 1): number {
  const tileW = CONFIG.view.tileWidth;
  const houseWidthPx = tileW * 2.05;
  const cowBodyPx = 131;
  const targetBody = houseWidthPx / 9.5;
  return (targetBody / cowBodyPx) * multiplier;
}

export type CowView = "left" | "right" | "toward" | "away";

const COW_VIEW_SUFFIX: Record<CowView, string> = {
  right: "r",
  left: "l",
  toward: "t",
  away: "a",
};

/** Screen-space direction. 0 is right, 2 is down the screen, 6 is away from the camera. */
export function cowOctantFromScreen(sx: number, sy: number): number {
  if (sx === 0 && sy === 0) return 0;
  const oct = Math.round(Math.atan2(sy, sx) / (Math.PI / 4));
  return ((oct % 8) + 8) % 8;
}

/** Tile-space step converted into the isometric screen octant. */
export function cowOctantFromTile(ux: number, uy: number): number {
  const sx = ux - uy;
  const sy = (ux + uy) * 0.5;
  return cowOctantFromScreen(sx, sy);
}

export function cowViewFromOctant(octant: number): CowView {
  const oct = ((octant % 8) + 8) % 8;
  if (oct === 2) return "toward";
  if (oct === 6) return "away";
  if (oct === 0 || oct === 1 || oct === 7) return "right";
  return "left";
}

/** Iso march direction → discrete sprite facing (no rotation). */
export function cowViewFromVector(ux: number, uy: number): CowView {
  return cowViewFromOctant(cowOctantFromTile(ux, uy));
}

export function cattleOctantKey(octant: number, calf = false): string {
  return `${calf ? "calf" : "cow"}-oct-${((octant % 8) + 8) % 8}`;
}

/**
 * TODO(A): the windmill painting includes its tank, so a true 1.45 m shoulder
 * reads as a speck beside it. This boost keeps a cow believable next to that sprite.
 */
export const COW_READABILITY_BOOST = 1.75;

export function cattleOctantScale(calf = false): number {
  const shoulderMetres = calf ? 0.95 : 1.45;
  const artShoulderPx = calf ? 34 : 46;
  return ((shoulderMetres * worldPxPerMetre()) / artShoulderPx) * COW_READABILITY_BOOST;
}

function paintOctantCow(octant: number, calf: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 104;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const oct = ((octant % 8) + 8) % 8;
  const angle = (oct * Math.PI) / 4;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const s = calf ? 0.72 : 1;
  const cx = 64;
  const cy = 50;
  const bodyLen = 34 * s;
  const bodyWid = 22 * s;
  const at = (along: number, across: number, lift = 0): { x: number; y: number } => ({
    x: cx + dx * bodyLen * along + px * bodyWid * across,
    y: cy + dy * bodyLen * along * 0.55 + py * bodyWid * across * 0.55 - lift,
  });

  ctx.fillStyle = "rgba(42, 30, 18, 0.32)";
  ctx.beginPath();
  ctx.ellipse(cx, 90, 30 * s, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5c5348";
  ctx.lineWidth = 5 * s;
  ctx.lineCap = "round";
  for (const [along, across] of [
    [-0.32, -0.42],
    [-0.32, 0.42],
    [0.28, -0.36],
    [0.28, 0.36],
  ] as const) {
    const hip = at(along, across, 0);
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(hip.x + px * across * 2, hip.y + 16 * s);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(dy * 0.55, dx));
  ctx.fillStyle = calf ? "#efe4d2" : "#e4d8c6";
  ctx.strokeStyle = "#3f362c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLen, bodyWid * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!calf) {
    ctx.fillStyle = "#d5c6b0";
    ctx.beginPath();
    ctx.ellipse(bodyLen * 0.22, -bodyWid * 0.62, 14, 9, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  const head = at(1.15, 0, 10 * s);
  ctx.fillStyle = "#f7f1e6";
  ctx.strokeStyle = "#3f362c";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, 10 * s + Math.max(0, dy) * 3, 9 * s, Math.atan2(dy, dx), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d9cbb6";
  for (const side of [-1, 1]) {
    const ear = at(0.92, side * 0.62, 12 * s);
    ctx.beginPath();
    ctx.ellipse(ear.x, ear.y, 6 * s, 3.2 * s, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (!calf && dy > -0.75) {
    ctx.strokeStyle = "#8a8072";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(head.x - 3 * s, head.y - 3 * s);
    ctx.quadraticCurveTo(head.x - 12 * s, head.y - 14 * s, head.x - 2 * s, head.y - 1 * s);
    ctx.moveTo(head.x + 3 * s, head.y - 3 * s);
    ctx.quadraticCurveTo(head.x + 12 * s, head.y - 14 * s, head.x + 2 * s, head.y - 1 * s);
    ctx.stroke();
  }
  if (dy > -0.15) {
    ctx.fillStyle = "#1b140e";
    ctx.beginPath();
    ctx.arc(head.x - 3.2 * s, head.y + 0.5, 1.35, 0, Math.PI * 2);
    ctx.arc(head.x + 3.2 * s, head.y + 0.5, 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c48b8b";
    ctx.beginPath();
    ctx.ellipse(head.x + dx * 6 * s, head.y + 2, 3.2 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (dy < 0.25) {
    const tail = at(-1.05, 0, 2);
    ctx.strokeStyle = "#5a5044";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.quadraticCurveTo(tail.x - dx * 8, tail.y + 10, tail.x - dx * 2, tail.y + 16);
    ctx.stroke();
    ctx.fillStyle = "#3f362c";
    ctx.beginPath();
    ctx.ellipse(tail.x - dx * 2, tail.y + 16, 3.5, 2.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function ensureCattleOctantTextures(scene: Phaser.Scene): void {
  for (const calf of [false, true]) {
    for (let octant = 0; octant < 8; octant += 1) {
      const key = cattleOctantKey(octant, calf);
      if (scene.textures.exists(key)) continue;
      scene.textures.addCanvas(key, paintOctantCow(octant, calf));
    }
  }
}

export function cattleTextureKeyForView(baseKey: string, view: CowView): string {
  return `${baseKey}-${COW_VIEW_SUFFIX[view]}`;
}

export function cattleTextureForView(coat: number, view: CowView): string {
  return cattleTextureKeyForView(cattleSpriteForCoat(coat), view);
}

export function cowPresentationScale(view: CowView, base: number): { x: number; y: number } {
  switch (view) {
    case "toward":
      return { x: base * 0.88, y: base * 1.06 };
    case "away":
      return { x: base * 0.82, y: base * 0.78 };
    default:
      return { x: base, y: base };
  }
}

/** Build toward/away variants from side-on breed PNGs (mirrors for left). */
export function ensureCowViewTextures(scene: Phaser.Scene): void {
  const breeds = [
    SPRITE_KEYS.cattleBrahman,
    SPRITE_KEYS.cattleBonsmara,
    SPRITE_KEYS.cattleSimmentaler,
    SPRITE_KEYS.cattleNguni,
    SPRITE_KEYS.cattleAngus,
  ];
  for (const base of breeds) {
    if (!scene.textures.exists(base)) continue;
    const source = scene.textures.get(base).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const w = source.width;
    const h = source.height;
  const rightKey = cattleTextureKeyForView(base, "right");
  if (!scene.textures.exists(rightKey)) {
    if (source instanceof HTMLCanvasElement) scene.textures.addCanvas(rightKey, source);
    else scene.textures.addImage(rightKey, source);
  }
  const leftKey = cattleTextureKeyForView(base, "left");
  if (!scene.textures.exists(leftKey)) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(source, 0, 0);
      scene.textures.addCanvas(leftKey, canvas);
    }
  }
    for (const variant of [
      { view: "toward" as const, sx: 0.86, sy: 1.08 },
      { view: "away" as const, sx: 0.8, sy: 0.76 },
    ]) {
      const { view, sx, sy } = variant;
      const key = cattleTextureKeyForView(base, view);
      if (scene.textures.exists(key)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * sx);
      canvas.height = Math.round(h * sy);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      if (view === "away") {
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "rgba(32, 22, 14, 0.08)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      scene.textures.addCanvas(key, canvas);
    }
  }
}

/** Dots only at full pinch-out (same band as min zoom). */
export const COW_LOD_ZOOM = 0.26;

export function ensureCowDotTexture(scene: Phaser.Scene): void {
  const key = SPRITE_KEYS.cowDot;
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x4a2818, 1);
  g.fillCircle(4, 4, 3.5);
  g.fillStyle(0xf0e6d4, 0.35);
  g.fillCircle(3, 3, 1.2);
  g.generateTexture(key, 8, 8);
  g.destroy();
}
