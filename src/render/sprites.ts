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
} as const;

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
      return { key: SPRITE_KEYS.farmhouse, originX: 0.5, originY: 0.9, scale: (tileW * 3.1) / tw };
    case "windmill":
      return { key: SPRITE_KEYS.windmill, originX: 0.48, originY: 0.94, scale: (tileW * 2.8) / tw };
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

/** Readable cattle scale (~1.8 m animal on 75 m tile, boosted for phone). */
export function cattleDisplayScale(multiplier = 1): number {
  const tileW = CONFIG.view.tileWidth;
  const readable = (tileW * 0.34) / 138;
  return readable * multiplier;
}

export const COW_LOD_ZOOM = 0.44;

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
