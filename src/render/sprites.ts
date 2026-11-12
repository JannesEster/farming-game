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
  holdingPen: "spr-holding-pen",
  race: "spr-race",
  handlingRoof: "spr-handling-roof",
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
  const lean = frame === 1 ? 3 : -1;
  g.fillStyle(0x3a2a18, 0.35);
  g.fillEllipse(32, 92, 26, 7);
  g.fillStyle(0x3d342c, 1);
  g.fillRoundedRect(20 + lean, 62, 9, 24, 3);
  g.fillRoundedRect(35 + lean, 62, 9, 24, 3);
  g.fillStyle(0x241c14, 1);
  g.fillRoundedRect(18 + lean, 82, 13, 7, 2);
  g.fillRoundedRect(34 + lean, 82, 13, 7, 2);
  g.fillStyle(shirt, 1);
  g.fillRoundedRect(18 + lean, 34, 28, 32, 6);
  g.lineStyle(2, 0x2a241c, 1);
  g.strokeRoundedRect(18 + lean, 34, 28, 32, 6);
  g.lineStyle(5, 0xd7b394, 1);
  g.beginPath();
  g.moveTo(20 + lean, 40);
  g.lineTo(11 + lean, 58);
  g.moveTo(44 + lean, 40);
  g.lineTo(53 + lean, 56);
  g.strokePath();
  g.fillStyle(0xe2b48a, 1);
  g.fillCircle(32 + lean, 24, 10);
  g.lineStyle(2, 0x2a241c, 1);
  g.strokeCircle(32 + lean, 24, 10);
  g.fillStyle(hat, 1);
  g.fillRoundedRect(24 + lean, 8, 16, 10, 3);
  g.fillEllipse(32 + lean, 16, 28, 8);
  if (dir !== "n") {
    g.fillStyle(0x1a140e, 1);
    g.fillCircle(28 + lean, 25, 1.3);
    g.fillCircle(36 + lean, 25, 1.3);
  }
}

export function ensurePersonWalkTextures(scene: Phaser.Scene, role: "farmer" | "farmhand"): void {
  const shirt = role === "farmer" ? 0x2d6a4f : 0xc4843c;
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

/** White cab and two slatted livestock trailers, the road train in the yard photos. */
export function paintLivestockTruck(): HTMLCanvasElement {
  const w = 640;
  const h = 180;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "rgba(30, 20, 12, 0.28)";
  ctx.beginPath();
  ctx.ellipse(320, 158, 280, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const trailer = (x: number, width: number) => {
    const grad = ctx.createLinearGradient(x, 40, x, 120);
    grad.addColorStop(0, "#8a6a4a");
    grad.addColorStop(0.45, "#6e5438");
    grad.addColorStop(1, "#4a3424");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 48, width, 70);
    ctx.strokeStyle = "#2c241c";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 48, width, 70);
    ctx.strokeStyle = "#3a2a1c";
    ctx.beginPath();
    ctx.moveTo(x + 6, 72);
    ctx.lineTo(x + width - 6, 72);
    ctx.moveTo(x + 6, 92);
    ctx.lineTo(x + width - 6, 92);
    ctx.stroke();
    ctx.fillStyle = "#1a120c";
    const slats = Math.floor(width / 28);
    for (let i = 0; i < slats; i += 1) ctx.fillRect(x + 10 + i * 28, 54, 8, 58);
    ctx.fillStyle = "#c4b8a4";
    ctx.fillRect(x + width - 14, 64, 6, 24);
  };
  trailer(150, 230);
  trailer(392, 220);

  ctx.fillStyle = "#e7e2d6";
  ctx.beginPath();
  ctx.moveTo(18, 86);
  ctx.lineTo(46, 74);
  ctx.lineTo(86, 74);
  ctx.lineTo(118, 58);
  ctx.lineTo(148, 58);
  ctx.lineTo(148, 120);
  ctx.lineTo(18, 120);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(24, 78, 70, 16);
  ctx.fillStyle = "#8ec4e4";
  ctx.beginPath();
  ctx.moveTo(52, 68);
  ctx.lineTo(112, 56);
  ctx.lineTo(124, 76);
  ctx.lineTo(54, 86);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9fd0ea";
  ctx.fillRect(28, 96, 22, 16);
  ctx.fillStyle = "#2c3440";
  ctx.fillRect(14, 104, 16, 8);
  ctx.fillStyle = "#f2e7a4";
  ctx.fillRect(16, 106, 8, 4);

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
  wheel(48, 132, 16);
  wheel(92, 132, 16);
  wheel(210, 134, 17);
  wheel(250, 134, 17);
  wheel(330, 134, 17);
  wheel(450, 134, 17);
  wheel(530, 134, 17);
  wheel(580, 134, 17);
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
    g.fillStyle(0x3a2a18, 0.28);
    g.fillEllipse(56, 86, 70, 12);
    g.fillStyle(0x8a9298, 1);
    g.fillRect(22, 28, 8, 52);
    g.fillRect(82, 28, 8, 52);
    g.fillStyle(0xb7c0c8, 1);
    g.fillRect(22, 28, 68, 6);
    g.fillRect(22, 46, 68, 5);
    g.fillRect(22, 62, 68, 5);
    g.lineStyle(2, 0x2c3440, 1);
    g.strokeRect(22, 28, 68, 52);
    g.generateTexture(SPRITE_KEYS.crush, 112, 96);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.holdingPen)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x3a2a18, 0.3);
    g.fillEllipse(80, 100, 90, 16);
    g.fillStyle(0x6a5438, 1);
    g.fillEllipse(80, 78, 78, 28);
    g.fillStyle(0x8a9298, 1);
    g.fillRect(28, 36, 7, 48);
    g.fillRect(124, 36, 7, 48);
    g.fillRect(76, 30, 7, 52);
    g.fillStyle(0xd5dde4, 1);
    g.fillRect(28, 40, 103, 4);
    g.fillRect(28, 56, 103, 4);
    g.fillRect(28, 70, 103, 4);
    g.generateTexture(SPRITE_KEYS.holdingPen, 160, 120);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.race)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x3a2a18, 0.28);
    g.fillEllipse(70, 100, 70, 12);
    g.lineStyle(5, 0x8a9298, 1);
    g.beginPath();
    g.moveTo(24, 80);
    g.lineTo(48, 48);
    g.lineTo(90, 28);
    g.moveTo(48, 88);
    g.lineTo(78, 62);
    g.lineTo(110, 46);
    g.strokePath();
    g.fillStyle(0xd5dde4, 1);
    g.fillCircle(24, 80, 4);
    g.fillCircle(90, 28, 4);
    g.fillCircle(48, 88, 4);
    g.fillCircle(110, 46, 4);
    g.generateTexture(SPRITE_KEYS.race, 140, 110);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.handlingRoof)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x3a2a18, 0.25);
    g.fillEllipse(90, 100, 100, 16);
    g.fillStyle(0x6a7278, 1);
    g.fillRect(36, 62, 6, 32);
    g.fillRect(138, 62, 6, 32);
    g.fillStyle(0xf4f1ea, 1);
    g.beginPath();
    g.moveTo(18, 62);
    g.lineTo(90, 28);
    g.lineTo(162, 62);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xd9d3c8, 1);
    g.fillTriangle(90, 28, 162, 62, 162, 70);
    g.lineStyle(2, 0x2c3440, 1);
    g.strokeTriangle(18, 62, 90, 28, 162, 62);
    g.generateTexture(SPRITE_KEYS.handlingRoof, 180, 110);
    g.destroy();
  }
  if (!scene.textures.exists(SPRITE_KEYS.loadingRamp)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x3a2a18, 0.3);
    g.fillEllipse(56, 86, 70, 12);
    g.fillStyle(0x8d8070, 1);
    g.fillTriangle(18, 78, 96, 78, 70, 34);
    g.fillStyle(0xb7c0c8, 1);
    g.lineStyle(4, 0x8a9298, 1);
    g.beginPath();
    g.moveTo(28, 74);
    g.lineTo(62, 40);
    g.moveTo(48, 78);
    g.lineTo(78, 46);
    g.strokePath();
    g.fillStyle(0x6a7278, 1);
    g.fillRect(16, 70, 8, 16);
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
      return { key: SPRITE_KEYS.crush, originX: 0.5, originY: 0.88, scale: scaleToSpanMetres(112, 5) };
    case "holding_pen":
      return {
        key: SPRITE_KEYS.holdingPen,
        originX: 0.5,
        originY: 0.82,
        scale: ((tileW * 1.35) / 160) * featureScale,
      };
    case "race":
      return { key: SPRITE_KEYS.race, originX: 0.5, originY: 0.84, scale: (tileW * 1.15) / 140 };
    case "handling_roof":
      return { key: SPRITE_KEYS.handlingRoof, originX: 0.5, originY: 0.72, scale: (tileW * 2.1) / 180 };
    case "loading_ramp":
      return { key: SPRITE_KEYS.loadingRamp, originX: 0.5, originY: 0.92, scale: scaleToSpanMetres(112, 7) };
    case "cattle_truck":
      // Cab plus two slatted trailers. Length is a visual stand-in for the road train in the photos.
      return { key: SPRITE_KEYS.cattleTruck, originX: 0.12, originY: 0.9, scale: scaleToSpanMetres(640, 22) };
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

type CattleCoat = {
  body: string;
  dark: string;
  belly: string;
  hump: boolean;
  patches: boolean;
  /** White face, used for Simmentaler. */
  face?: string;
};

/** Beef breeds only: Brahman grey, Bonsmara red, Angus black, Nguni fawn, brown, Simmentaler. */
const CATTLE_COATS: readonly CattleCoat[] = [
  { body: "#c4beb2", dark: "#6a6458", belly: "#e4ddd0", hump: true, patches: false },
  { body: "#b55238", dark: "#6a2c1c", belly: "#d47858", hump: false, patches: false },
  { body: "#2c2624", dark: "#100e0d", belly: "#4a403c", hump: false, patches: false },
  { body: "#b08a52", dark: "#3a342c", belly: "#d4b88a", hump: true, patches: true },
  { body: "#8d5a34", dark: "#4e3018", belly: "#c48a56", hump: false, patches: false },
  { body: "#c45a32", dark: "#7a341c", belly: "#e6c4a4", hump: false, patches: false, face: "#f6f1e6" },
];

export const CATTLE_COAT_COUNT = CATTLE_COATS.length;

export function cattleCoatIndex(tag: string): number {
  let n = 0;
  for (const ch of tag) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return n % CATTLE_COAT_COUNT;
}

export function cattleOctantKey(octant: number, calf = false, coat = 0): string {
  const oct = ((octant % 8) + 8) % 8;
  const c = ((coat % CATTLE_COAT_COUNT) + CATTLE_COAT_COUNT) % CATTLE_COAT_COUNT;
  return `${calf ? "calf" : "cow"}-oct-${oct}-c${c}`;
}

/**
 * Nose-to-tail length painted in the octant canvas.
 * A cow is drawn at about 0.62 tiles: shorter than the bakkie (1.05 tiles)
 * and clearly smaller than the worker cottage (1.55 tiles).
 * TODO(A): visual size chosen against those sprites, not a measured shoulder.
 */
export const COW_ART_BODY_PX = 80;
export const COW_BODY_TILES = 0.62;

export function cattleOctantScale(calf = false): number {
  const bodyPx = calf ? COW_ART_BODY_PX * 0.68 : COW_ART_BODY_PX;
  const tiles = calf ? COW_BODY_TILES * 0.62 : COW_BODY_TILES;
  return (CONFIG.view.tileWidth * tiles) / bodyPx;
}

function paintOctantCow(octant: number, calf: boolean, coatIndex: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 112;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const coat = CATTLE_COATS[coatIndex % CATTLE_COAT_COUNT];
  const oct = ((octant % 8) + 8) % 8;
  ctx.save();
  if (calf) {
    ctx.translate(56, 48);
    ctx.scale(0.72, 0.72);
    ctx.translate(-56, -48);
  }
  const mirror = oct === 3 || oct === 4 || oct === 5;
  if (mirror) {
    ctx.translate(112, 0);
    ctx.scale(-1, 1);
  }
  if (oct === 2) drawCowFront(ctx, coat);
  else if (oct === 6) drawCowBack(ctx, coat);
  else drawCowSide(ctx, coat, oct === 1 || oct === 7 || oct === 3 || oct === 5);
  ctx.restore();
  return canvas;
}

function drawLeg(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 1, y + h);
  ctx.stroke();
  ctx.strokeStyle = "#2a2118";
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(x - 1, y + h - 2);
  ctx.lineTo(x + 4, y + h);
  ctx.stroke();
}

function fillBody(ctx: CanvasRenderingContext2D, coat: CattleCoat, path: () => void): void {
  path();
  ctx.fillStyle = coat.body;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  const shade = ctx.createLinearGradient(18, 12, 78, 64);
  shade.addColorStop(0, "rgba(255,255,255,0.32)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(40,24,12,0.32)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 112, 80);
  ctx.restore();
  if (coat.patches) {
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(36, 40, 5, 3.5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(52, 46, 4, 3, 0.5, 0, Math.PI * 2);
    ctx.ellipse(44, 34, 3.5, 2.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  path();
  ctx.strokeStyle = "#2c241c";
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

function drawCowSide(ctx: CanvasRenderingContext2D, coat: CattleCoat, threeQuarter: boolean): void {
  ctx.fillStyle = "rgba(40, 26, 14, 0.28)";
  ctx.beginPath();
  ctx.ellipse(58, 70, 28, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawLeg(ctx, 32, 50, 18, coat.dark);
  drawLeg(ctx, 66, 50, 18, coat.dark);
  const squash = threeQuarter ? 0.86 : 1;
  ctx.save();
  ctx.translate(56, 42);
  ctx.scale(squash, 1);
  ctx.translate(-56, -42);
  fillBody(ctx, coat, () => {
    ctx.beginPath();
    ctx.moveTo(24, 48);
    ctx.quadraticCurveTo(16, 36, 28, 30);
    ctx.quadraticCurveTo(42, coat.hump ? 12 : 24, 58, coat.hump ? 16 : 26);
    ctx.quadraticCurveTo(74, 20, 80, 32);
    ctx.quadraticCurveTo(76, 50, 64, 54);
    ctx.quadraticCurveTo(44, 60, 28, 54);
    ctx.closePath();
  });
  if (coat.hump) {
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(52, 20, 12, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2c241c";
    ctx.stroke();
  }
  ctx.fillStyle = coat.face ?? coat.body;
  ctx.strokeStyle = "#2c241c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(88, 34, 13, 11, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = coat.belly;
  ctx.beginPath();
  ctx.ellipse(100, 40, 7, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = coat.dark;
  ctx.beginPath();
  ctx.ellipse(78, 28, 8, 3.5, -0.9, 0, Math.PI * 2);
  ctx.fill();
  if (!coat.hump) {
    ctx.strokeStyle = "#c8b48a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(84, 24);
    ctx.quadraticCurveTo(76, 10, 70, 18);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#b7a88a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(86, 24);
    ctx.quadraticCurveTo(92, 12, 84, 16);
    ctx.stroke();
  }
  ctx.fillStyle = "#1a120e";
  ctx.beginPath();
  ctx.arc(94, 32, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = coat.dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 36);
  ctx.quadraticCurveTo(12, 44, 16, 58);
  ctx.stroke();
  ctx.fillStyle = coat.dark;
  ctx.beginPath();
  ctx.ellipse(16, 58, 4, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();
  drawLeg(ctx, 40, 52, 16, coat.body);
  drawLeg(ctx, 72, 50, 18, coat.body);
  ctx.restore();
}

function drawCowFront(ctx: CanvasRenderingContext2D, coat: CattleCoat): void {
  ctx.fillStyle = "rgba(40, 26, 14, 0.28)";
  ctx.beginPath();
  ctx.ellipse(56, 70, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawLeg(ctx, 42, 50, 18, coat.dark);
  drawLeg(ctx, 66, 50, 18, coat.dark);
  ctx.fillStyle = coat.body;
  ctx.strokeStyle = "#2c241c";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(56, 48, 18, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (coat.hump) {
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(56, 30, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  ctx.ellipse(56, 28, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = coat.belly;
  ctx.beginPath();
  ctx.ellipse(56, 36, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = coat.dark;
  ctx.beginPath();
  ctx.ellipse(40, 26, 7, 3.5, -0.6, 0, Math.PI * 2);
  ctx.ellipse(72, 26, 7, 3.5, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = coat.hump ? "#b7a88a" : "#c8b48a";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(44, 18);
  ctx.quadraticCurveTo(36, 6, 48, 14);
  ctx.moveTo(68, 18);
  ctx.quadraticCurveTo(76, 6, 64, 14);
  ctx.stroke();
  ctx.fillStyle = "#1a120e";
  ctx.beginPath();
  ctx.arc(50, 28, 1.8, 0, Math.PI * 2);
  ctx.arc(62, 28, 1.8, 0, Math.PI * 2);
  ctx.fill();
  if (coat.patches) {
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(48, 46, 6, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCowBack(ctx: CanvasRenderingContext2D, coat: CattleCoat): void {
  ctx.fillStyle = "rgba(40, 26, 14, 0.28)";
  ctx.beginPath();
  ctx.ellipse(56, 70, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawLeg(ctx, 40, 50, 18, coat.dark);
  drawLeg(ctx, 68, 50, 18, coat.dark);
  ctx.fillStyle = coat.body;
  ctx.strokeStyle = "#2c241c";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(56, 46, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (coat.hump) {
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(56, 30, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (coat.patches) {
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(48, 44, 7, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(64, 50, 5, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = coat.dark;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(56, 36);
  ctx.quadraticCurveTo(64, 48, 56, 64);
  ctx.stroke();
  ctx.fillStyle = coat.dark;
  ctx.beginPath();
  ctx.ellipse(56, 64, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = coat.dark;
  ctx.beginPath();
  ctx.ellipse(40, 34, 5, 3, -0.8, 0, Math.PI * 2);
  ctx.ellipse(72, 34, 5, 3, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

export function ensureCattleOctantTextures(scene: Phaser.Scene): void {
  for (const calf of [false, true]) {
    for (let octant = 0; octant < 8; octant += 1) {
      for (let coat = 0; coat < CATTLE_COAT_COUNT; coat += 1) {
        const key = cattleOctantKey(octant, calf, coat);
        if (scene.textures.exists(key)) continue;
        scene.textures.addCanvas(key, paintOctantCow(octant, calf, coat));
      }
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
