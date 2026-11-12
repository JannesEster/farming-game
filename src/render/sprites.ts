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

export function ensureWorkerHouseTexture(scene: Phaser.Scene): void {
  const key = SPRITE_KEYS.workerHouse;
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xc9b59a, 1);
  g.fillRoundedRect(8, 36, 72, 52, 3);
  g.fillStyle(0x8b3a2a, 1);
  g.beginPath();
  g.moveTo(6, 38);
  g.lineTo(44, 8);
  g.lineTo(82, 38);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x4a3528, 1);
  g.fillRect(34, 58, 20, 30);
  g.fillStyle(0x6e8199, 1);
  g.fillRect(18, 52, 14, 12);
  g.fillRect(56, 52, 14, 12);
  g.generateTexture(key, 96, 96);
  g.destroy();
}

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

/** Homestead prop scale tuned for 64×32 iso tiles on phone zoom. */
export function propSpriteForKind(kind: string, x: number, y: number, featureScale: number): PropSpriteDef {
  const tileW = CONFIG.view.tileWidth;
  const tw = PAINTED_TILE_NATIVE_W;
  switch (kind) {
    case "house":
      return { key: SPRITE_KEYS.farmhouse, originX: 0.5, originY: 0.9, scale: (tileW * 2.45) / tw };
    case "windmill":
      return { key: SPRITE_KEYS.windmill, originX: 0.48, originY: 0.94, scale: (tileW * 2.2) / tw };
    case "shed":
      return { key: SPRITE_KEYS.shed, originX: 0.5, originY: 0.88, scale: (tileW * 2.2) / tw };
    case "kraal":
      return { key: SPRITE_KEYS.kraal, originX: 0.5, originY: 0.82, scale: (tileW * 2.6) / tw };
    case "trough":
      return { key: SPRITE_KEYS.trough, originX: 0.5, originY: 0.85, scale: (tileW * 1.35) / tw };
    case "reservoir":
      return { key: SPRITE_KEYS.windmill, originX: 0.5, originY: 0.94, scale: (tileW * 2.2) / tw };
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

/** Iso march direction → discrete sprite facing (no rotation). */
export function cowViewFromVector(ux: number, uy: number): CowView {
  const sx = ux - uy;
  const sy = ux + uy;
  if (Math.abs(sx) >= Math.abs(sy) * 0.55) return sx > 0 ? "right" : "left";
  return sy > 0 ? "toward" : "away";
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
