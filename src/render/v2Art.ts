import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import type { Feature, GameState } from "../sim/types";
import type { IsoLayout } from "./iso";
import { tileCenter } from "./iso";
import { cowOctantFromScreen, spritesBaseUrl } from "./sprites";
import { V2_SPRITES, type V2SpriteMeta } from "./v2Manifest";
import { renderPenFloor } from "./v2Ground";
import { FENCE_POST_SPACING_METRES } from "./fences";
import { displayScaleForFile, PIXELS_PER_METRE } from "./worldScale";
import { yardGeometry } from "./yardDraw";

const byFile = new Map(V2_SPRITES.map((sprite) => [sprite.file, sprite]));

const BREEDS = ["brahman", "bonsmara", "angus", "nguni", "brown", "simmentaler"] as const;
const OCTANT_FACING = ["e", "se", "s", "sw", "w", "nw", "n", "ne"] as const;

const TREES = [
  "tree-camelthorn-large.png",
  "tree-camelthorn-large-flip.png",
  "tree-camelthorn-small.png",
  "tree-camelthorn-small-flip.png",
  "tree-shepherds.png",
  "tree-shepherds-flip.png",
];
const BUSHES = [
  "bush-thorn-sparse.png",
  "bush-thorn-sparse.png",
  "bush-thorn-sparse-flip.png",
  "bush-thorn-sparse-flip.png",
  "bush-thorn-dense.png",
  "bush-thorn-dense-flip.png",
];
const ROCKS = ["rocks-cluster.png", "rocks-cluster-flip.png", "rock-flat.png", "rock-flat-flip.png"];
const LICKS = ["prop-lick-trough-roofed.png", "prop-lick-drum.png", "prop-lick-roofed-alt.png"];

export function v2Key(file: string): string {
  return `v2-${file.replace(/\.png$/, "")}`;
}

export function v2Ready(textures: Phaser.Textures.TextureManager): boolean {
  return textures.exists(v2Key("bldg-farmhouse.png")) && textures.exists(v2Key("cattle-bonsmara-e.png"));
}

export function preloadV2(loader: Phaser.Loader.LoaderPlugin): void {
  const prefix = `${spritesBaseUrl()}v2/`;
  for (const sprite of V2_SPRITES) loader.image(sprite.key, `${prefix}${sprite.file}`);
}

function meta(file: string): V2SpriteMeta | undefined {
  return byFile.get(file);
}

function worldScaleOf(file: string): number {
  return displayScaleForFile(file) ?? 1;
}

export type V2Pose = {
  key: string;
  originX: number;
  originY: number;
  scale: number;
};

export function referencePose(file: string): V2Pose | null {
  return pose(file);
}

function pose(file: string, scale = worldScaleOf(file)): V2Pose | null {
  const sprite = meta(file);
  if (!sprite) return null;
  return { key: sprite.key, originX: sprite.anchorX, originY: sprite.anchorY, scale };
}

export function facingFromOctant(octant: number): (typeof OCTANT_FACING)[number] {
  return OCTANT_FACING[((octant % 8) + 8) % 8];
}

/** Graze art only exists for the two toward-camera diagonals. */
export function grazeFacing(octant: number): "se" | "sw" {
  const oct = ((octant % 8) + 8) % 8;
  return oct === 3 || oct === 4 || oct === 5 || oct === 6 ? "sw" : "se";
}

export function cattleFile(octant: number, calf: boolean, coat: number, graze: boolean): string {
  const breed = calf ? "calf" : BREEDS[((coat % BREEDS.length) + BREEDS.length) % BREEDS.length];
  if (graze) return `cattle-${breed}-graze-${grazeFacing(octant)}.png`;
  return `cattle-${breed}-${facingFromOctant(octant)}.png`;
}

export function cattlePose(octant: number, calf: boolean, coat: number, graze: boolean): V2Pose | null {
  const file = cattleFile(octant, calf, coat, graze);
  return pose(file, worldScaleOf(file));
}

/** Side-view body length in tiles, from the world scale. */
export function cattleBodyTiles(calf: boolean): number {
  const file = calf ? "cattle-calf-e.png" : "cattle-bonsmara-e.png";
  const sprite = meta(file);
  if (!sprite) return 0;
  return (sprite.width * worldScaleOf(file)) / CONFIG.view.tileWidth;
}

const WALK_FACING: Record<string, string> = {
  e: "se",
  se: "se",
  s: "sw",
  sw: "sw",
  w: "sw",
  nw: "nw",
  n: "ne",
  ne: "ne",
};

export function personFile(role: "farmer" | "farmhand", dx: number, dy: number, moving: boolean): string {
  const who = role === "farmer" ? "farmer" : "piet";
  const face = facingFromOctant(cowOctantFromScreen(dx, dy));
  if (!moving && face === "s") return `person-${who}-stand-s.png`;
  if (!moving) return `person-${who}-walk-${WALK_FACING[face]}.png`;
  return `person-${who}-walk-${WALK_FACING[face]}.png`;
}

export function personPose(role: "farmer" | "farmhand", dx: number, dy: number, moving: boolean): V2Pose | null {
  const file = personFile(role, dx, dy, moving);
  return pose(file, worldScaleOf(file));
}

/** Same-sign screen steps are the NW–SE diagonal. Opposite signs are NE–SW. */
export function nwSeDiagonal(dx: number, dy: number): boolean {
  return dx * dy >= 0;
}

function hashFile(files: string[], x: number, y: number): string {
  const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  return files[Math.floor(n * files.length) % files.length];
}

function near(features: Feature[], kind: Feature["kind"], x: number, y: number, tiles: number): boolean {
  return features.some((feature) => feature.kind === kind && Math.hypot(feature.x - x, feature.y - y) < tiles);
}

export type PlacedV2 = {
  image: Phaser.GameObjects.Image;
  kind?: string;
  alsoKind?: string;
};

function addSprite(
  scene: Phaser.Scene,
  file: string,
  x: number,
  y: number,
  depth: number,
  scale = worldScaleOf(file),
): Phaser.GameObjects.Image | null {
  const placed = pose(file, scale);
  if (!placed || !scene.textures.exists(placed.key)) return null;
  return scene.add
    .image(x, y, placed.key)
    .setOrigin(placed.originX, placed.originY)
    .setScale(placed.scale)
    .setDepth(depth);
}

export function ensureSoftShadow(scene: Phaser.Scene): string {
  const key = "v2-soft-shadow";
  if (scene.textures.exists(key)) return key;
  const graphics = scene.make.graphics({ x: 0, y: 0 });
  graphics.fillStyle(0x1c140e, 1);
  graphics.fillEllipse(64, 22, 116, 32);
  graphics.generateTexture(key, 128, 44);
  graphics.destroy();
  return key;
}

/** Light is from the top left, so the shadow sits down and to the right. */
export function placeShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number,
  depth: number,
): Phaser.GameObjects.Image {
  const key = ensureSoftShadow(scene);
  return scene.add
    .image(x + 8, y + 4, key)
    .setOrigin(0.5, 0.5)
    .setScale(rx / 58, ry / 16)
    .setAlpha(alpha)
    .setDepth(depth);
}

function propFile(kind: string, x: number, y: number): string | null {
  switch (kind) {
    case "house":
      return "bldg-farmhouse.png";
    case "worker_house":
      return "bldg-worker-cottage.png";
    case "shed":
      return "bldg-shed.png";
    case "windmill":
      return "prop-windmill-reservoir.png";
    case "reservoir":
      return "prop-windmill-reservoir.png";
    case "solar_pump":
      return "prop-solar-pump.png";
    case "trough":
      return "prop-trough.png";
    case "lick_feeder":
      return hashFile(LICKS, x, y);
    case "tree":
      return hashFile(TREES, x, y);
    case "bush":
      return hashFile(BUSHES, x, y);
    default:
      return null;
  }
}

function propScale(file: string): number {
  return worldScaleOf(file);
}

function placeRun(
  scene: Phaser.Scene,
  file: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth: number,
  images: Phaser.GameObjects.Image[],
  scaleMul = 1,
): void {
  const sprite = meta(file);
  if (!sprite) return;
  const scale = worldScaleOf(file) * scaleMul;
  const anchorPxX = sprite.anchorX * sprite.width;
  const anchorPxY = sprite.anchorY * sprite.height;
  const farPxX = sprite.anchorX < 0.5 ? sprite.width - 3 : 3;
  const farPxY = 3;
  const ox = (farPxX - anchorPxX) * scale;
  const oy = (farPxY - anchorPxY) * scale;
  const artLen = Math.hypot(ox, oy) || 1;
  let sx = x1;
  let sy = y1;
  let ex = x2;
  let ey = y2;
  if (ox * (ex - sx) + oy * (ey - sy) < 0) {
    sx = x2;
    sy = y2;
    ex = x1;
    ey = y1;
  }
  const segLen = Math.hypot(ex - sx, ey - sy);
  const ux = segLen > 0 ? (ex - sx) / segLen : 0;
  const uy = segLen > 0 ? (ey - sy) / segLen : 0;
  const step = Math.max(8, artLen * 0.66);
  const count = Math.max(1, Math.ceil(Math.max(segLen, 1) / step));
  for (let i = 0; i < count; i += 1) {
    const dist = count === 1 ? 0 : Math.min(i * step, Math.max(0, segLen - artLen));
    const atEnd = i === count - 1 && segLen >= artLen * 0.5;
    const image = addSprite(
      scene,
      file,
      atEnd ? ex - ox : sx + ux * dist,
      atEnd ? ey - oy : sy + uy * dist,
      depth,
      scale,
    );
    if (image) images.push(image);
  }
}

/** Drop world-scale rails along a path. Height stays the real panel height. */
function placeAlongPath(
  scene: Phaser.Scene,
  points: { x: number; y: number }[],
  fileFor: (dx: number, dy: number) => string,
  depth: number,
  images: Phaser.GameObjects.Image[],
  out: PlacedV2[],
  kind: string,
): void {
  if (points.length < 2) return;
  const sample = meta(fileFor(1, 1));
  const scale = sample ? worldScaleOf(sample.file) : 1;
  const step = Math.max(10, (sample?.width ?? 40) * scale * 0.8);
  let carry = step;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    let dist = carry;
    while (dist <= len) {
      const t = dist / len;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const file = fileFor(b.x - a.x, b.y - a.y);
      const piece = addSprite(scene, file, x, y, depth, worldScaleOf(file));
      if (piece) {
        piece.setData("featureKind", kind);
        images.push(piece);
        out.push({ image: piece, kind });
      }
      dist += step;
    }
    carry = dist - len;
  }
}

function densify(points: { x: number; y: number }[], step: number): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    for (let s = 1; s <= n; s += 1) {
      const t = s / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function placeYard(
  scene: Phaser.Scene,
  state: GameState,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
  images: Phaser.GameObjects.Image[],
  out: PlacedV2[],
): void {
  const geometry = yardGeometry(state.features, layout, tileW, tileH);
  if (!geometry) return;
  geometry.pens.forEach((pen, index) => {
    const floor = renderPenFloor(scene, layout, [pen.corners], `pen-${index}`);
    if (!floor) return;
    floor.setData("featureKind", "holding_pen");
    floor.setData("tileX", pen.tileX);
    floor.setData("tileY", pen.tileY);
    images.push(floor);
    out.push({ image: floor, kind: "holding_pen" });
  });
  for (const edge of geometry.edges) {
    const nw = nwSeDiagonal(edge.x2 - edge.x1, edge.y2 - edge.y1);
    const depth = 8 + ((edge.y1 + edge.y2) / 2) * 0.04 + 0.15;
    if (edge.gate) {
      const gate = nw ? "yard-gate-nw-se.png" : "yard-gate.png";
      const mid = addSprite(scene, gate, (edge.x1 + edge.x2) / 2, (edge.y1 + edge.y2) / 2, depth);
      if (mid) images.push(mid);
      placeRun(scene, nw ? "yard-panel-straight-nw-se.png" : "yard-panel-straight.png", edge.x1, edge.y1, edge.x1 + (edge.x2 - edge.x1) * 0.38, edge.y1 + (edge.y2 - edge.y1) * 0.38, depth, images);
      placeRun(scene, nw ? "yard-panel-straight-nw-se.png" : "yard-panel-straight.png", edge.x1 + (edge.x2 - edge.x1) * 0.62, edge.y1 + (edge.y2 - edge.y1) * 0.62, edge.x2, edge.y2, depth, images);
    } else {
      placeRun(scene, nw ? "yard-panel-straight-nw-se.png" : "yard-panel-straight.png", edge.x1, edge.y1, edge.x2, edge.y2, depth, images);
    }
    placeShadow(scene, (edge.x1 + edge.x2) / 2, (edge.y1 + edge.y2) / 2, 28, 8, 0.22, depth - 0.05);
  }
  geometry.corners.forEach((corner, index) => {
    const file = index % 2 === 0 ? "yard-corner.png" : "yard-corner-flipped.png";
    const image = addSprite(scene, file, corner.x, corner.y, 8 + corner.y * 0.04 + 0.2);
    if (image) images.push(image);
  });
  placeAlongPath(
    scene,
    densify(geometry.race, 14),
    (dx, dy) => (nwSeDiagonal(dx, dy) ? "yard-race-nw-se.png" : "yard-race.png"),
    8.2,
    images,
    out,
    "race",
  );
  if (geometry.crush) {
    const file = nwSeDiagonal(geometry.ramp?.intoX ?? 1, geometry.ramp?.intoY ?? 1)
      ? "yard-crush-roofed-nw-se.png"
      : "yard-crush-roofed.png";
    const image = addSprite(scene, file, geometry.crush.x, geometry.crush.y, 8 + geometry.crush.y * 0.04 + 0.55);
    if (image) {
      image.setData("featureKind", "crush");
      image.setData("alsoKind", "handling_roof");
      image.setData("tileX", geometry.crush.tileX);
      image.setData("tileY", geometry.crush.tileY);
      images.push(image);
      out.push({ image, kind: "crush", alsoKind: "handling_roof" });
      placeShadow(scene, geometry.crush.x, geometry.crush.y, 36, 12, 0.28, image.depth - 0.4);
    }
  }
  if (geometry.ramp) {
    const file = geometry.ramp.intoX >= 0 ? "yard-loading-ramp.png" : "yard-loading-ramp-up-nw.png";
    const image = addSprite(scene, file, geometry.ramp.x, geometry.ramp.y, 8 + geometry.ramp.y * 0.04 + 0.2);
    if (image) {
      image.setData("featureKind", "loading_ramp");
      image.setData("tileX", geometry.ramp.tileX);
      image.setData("tileY", geometry.ramp.tileY);
      images.push(image);
      out.push({ image, kind: "loading_ramp" });
      placeShadow(scene, geometry.ramp.x, geometry.ramp.y, 34, 11, 0.26, image.depth - 0.3);
    }
  }
}

export type V2PropResult = {
  images: Phaser.GameObjects.Image[];
  bakkie?: Phaser.GameObjects.Image;
  bakkieParked?: { x: number; y: number };
  homesteadLight?: { x: number; y: number };
  cottages: Phaser.GameObjects.Image[];
};

/** Buildings, props, vegetation, and the handling yard, all from the v2 cut-outs. */
export function placeV2Props(scene: Phaser.Scene, state: GameState, layout: IsoLayout): V2PropResult {
  const tileW = CONFIG.view.tileWidth;
  const tileH = CONFIG.view.tileHeight;
  const images: Phaser.GameObjects.Image[] = [];
  const placed: PlacedV2[] = [];
  const cottages: Phaser.GameObjects.Image[] = [];
  let bakkie: Phaser.GameObjects.Image | undefined;
  let bakkieParked: { x: number; y: number } | undefined;
  let homesteadLight: { x: number; y: number } | undefined;

  const skipReservoir = (feature: Feature) =>
    feature.kind === "reservoir" && near(state.features, "windmill", feature.x, feature.y, 6);

  for (const feature of state.features) {
    if (feature.kind === "track" || feature.kind === "holding_pen" || feature.kind === "race" || feature.kind === "crush" || feature.kind === "handling_roof" || feature.kind === "loading_ramp" || feature.kind === "kraal") {
      continue;
    }
    if (skipReservoir(feature)) continue;
    const file = propFile(feature.kind, feature.x, feature.y);
    if (!file) continue;
    const center = tileCenter(feature.x, feature.y, layout, tileW, tileH);
    const depth = 8 + center.y * 0.04;
    const image = addSprite(scene, file, center.x, center.y, depth, propScale(file));
    if (!image) continue;
    image.setData("featureKind", feature.kind);
    image.setData("tileX", feature.x);
    image.setData("tileY", feature.y);
    images.push(image);
    if (feature.kind === "house") {
      homesteadLight = { x: center.x, y: center.y - tileH * 0.55 };
    }
    if (feature.kind === "worker_house") cottages.push(image);
    if (feature.kind === "windmill") {
      placeShadow(scene, center.x, center.y, image.displayWidth * 0.42, image.displayHeight * 0.08, 0.3, depth - 0.2);
    }
  }

  const house = state.features.find((feature) => feature.kind === "house");
  if (house) {
    const park = tileCenter(house.x + 2, house.y, layout, tileW, tileH);
    const file = "vehicle-bakkie-se.png";
    const image = addSprite(scene, file, park.x, park.y + 4, 8 + park.y * 0.04, worldScaleOf(file));
    if (image) {
      image.setData("featureKind", "bakkie");
      image.setData("tileX", house.x + 2);
      image.setData("tileY", house.y);
      bakkie = image;
      bakkieParked = { x: image.x, y: image.y };
      images.push(image);
      placeShadow(scene, image.x, image.y, 30, 10, 0.28, image.depth - 0.2);
    }
    const tankTile = tileCenter(house.x + 1, house.y + 2, layout, tileW, tileH);
    const tank = addSprite(scene, "prop-water-tank.png", tankTile.x, tankTile.y, 8 + tankTile.y * 0.04);
    if (tank) {
      tank.setData("featureKind", "water_tank");
      images.push(tank);
      placeShadow(scene, tank.x, tank.y, 18, 7, 0.22, tank.depth - 0.1);
    }
  }

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const id = state.campIds[y * state.width + x];
      if (id < 0 || trackHas(state, x, y)) continue;
      const roll = Math.abs(Math.sin(x * 5.17 + y * 11.3 + 1.9) * 43758.5453) % 1;
      let file: string | null = null;
      if (roll > 0.992) file = "termite-mound.png";
      else if (Math.abs(Math.sin(x * 7.1 + y * 19.3 + 2.7) * 43758.5453) % 1 > 0.986) file = hashFile(ROCKS, x, y);
      if (!file) continue;
      const center = tileCenter(x, y, layout, tileW, tileH);
      const image = addSprite(scene, file, center.x, center.y, 7 + center.y * 0.04);
      if (image) images.push(image);
    }
  }

  placeYard(scene, state, layout, tileW, tileH, images, placed);
  return { images, bakkie, bakkieParked, homesteadLight, cottages };
}

function trackHas(state: GameState, x: number, y: number): boolean {
  return state.features.some((feature) => feature.kind === "track" && feature.x === x && feature.y === y);
}

/** Trailer door and cab, as fractions of the texture. The door is the end that backs onto the ramp. */
const ROADTRAIN_ENDS: Record<string, { rearX: number; rearY: number; cabX: number; cabY: number }> = {
  "vehicle-roadtrain-se.png": { rearX: 13 / 240, rearY: 35 / 139, cabX: 229 / 240, cabY: 118 / 139 },
  "vehicle-roadtrain-sw.png": { rearX: 226 / 240, rearY: 35 / 139, cabX: 10 / 240, cabY: 118 / 139 },
  "vehicle-roadtrain-e.png": { rearX: 16 / 480, rearY: 33 / 75, cabX: 462 / 480, cabY: 55 / 75 },
  "vehicle-roadtrain-w.png": { rearX: 463 / 480, rearY: 33 / 75, cabX: 17 / 480, cabY: 55 / 75 },
};

export function roadtrainFile(dx: number, dy: number): string {
  if (Math.abs(dy) < Math.abs(dx) * 0.25) return dx >= 0 ? "vehicle-roadtrain-e.png" : "vehicle-roadtrain-w.png";
  return dx * dy >= 0 ? "vehicle-roadtrain-se.png" : "vehicle-roadtrain-sw.png";
}

/** World offset from the sprite anchor to the trailer door and the cab. */
export function roadtrainEndOffsets(
  file: string,
  scale: number,
): { rearX: number; rearY: number; cabX: number; cabY: number } | null {
  const sprite = meta(file);
  const ends = ROADTRAIN_ENDS[file];
  if (!sprite || !ends) return null;
  const ax = sprite.anchorX * sprite.width;
  const ay = sprite.anchorY * sprite.height;
  const at = (fx: number, fy: number) => ({
    x: (fx * sprite.width - ax) * scale,
    y: (fy * sprite.height - ay) * scale,
  });
  const rear = at(ends.rearX, ends.rearY);
  const cab = at(ends.cabX, ends.cabY);
  return { rearX: rear.x, rearY: rear.y, cabX: cab.x, cabY: cab.y };
}

export function vehiclePose(kind: "bakkie" | "roadtrain", dx: number, dy: number): V2Pose | null {
  let file: string;
  if (kind === "bakkie") {
    if (dx >= 0 && dy >= 0) file = "vehicle-bakkie-se.png";
    else if (dx < 0 && dy >= 0) file = "vehicle-bakkie-sw.png";
    else if (dx < 0) file = "vehicle-bakkie-nw.png";
    else file = "vehicle-bakkie-ne.png";
  } else {
    file = roadtrainFile(dx, dy);
  }
  return pose(file, worldScaleOf(file));
}

export type FenceArt = { wires: Phaser.GameObjects.Image[]; posts: Phaser.GameObjects.Image[] };

type FenceSeg = { x1: number; y1: number; x2: number; y2: number; kind: "boundary" | "selected" | "inner"; gate: boolean };

/**
 * Posts every few metres along each straight run, plus a gate in the opening.
 * The wire itself is the straight line drawn by drawFences, so a run does not
 * stair-step from one tile-edge sprite to the next.
 */
export function placeV2Fences(scene: Phaser.Scene, segments: FenceSeg[]): Phaser.GameObjects.Image[] {
  const images: Phaser.GameObjects.Image[] = [];
  const spacing = FENCE_POST_SPACING_METRES * PIXELS_PER_METRE;
  const seen = new Set<string>();
  for (const segment of segments) {
    if (segment.gate) continue;
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const count = Math.max(1, Math.round(length / spacing));
    const file = dx >= 0 ? "fence-strainer-post-flip.png" : "fence-strainer-post.png";
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = segment.x1 + dx * t;
      const y = segment.y1 + dy * t;
      if (coveredByGate(x, y, segments)) continue;
      const key = `${Math.round(x)}:${Math.round(y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const image = addSprite(scene, file, x, y, 5 + y * 0.01);
      if (image) images.push(image);
    }
  }
  for (const segment of segments) {
    if (!segment.gate) continue;
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const file = nwSeDiagonal(dx, dy) ? "fence-gate-nw-se.png" : "fence-gate.png";
    const sprite = meta(file);
    if (!sprite || !scene.textures.exists(sprite.key)) continue;
    const length = Math.hypot(dx, dy) || 1;
    const scale = length / sprite.width;
    const midX = (segment.x1 + segment.x2) / 2;
    const midY = (segment.y1 + segment.y2) / 2;
    const depth = 5.4 + midY * 0.01;
    const image = scene.add
      .image(midX + (sprite.anchorX - 0.5) * sprite.width * scale, midY, sprite.key)
      .setOrigin(sprite.anchorX, sprite.anchorY)
      .setScale(scale)
      .setDepth(depth);
    images.push(image);
  }
  return images;
}

function coveredByGate(x: number, y: number, segments: FenceSeg[]): boolean {
  for (const gate of segments) {
    if (!gate.gate) continue;
    const dx = gate.x2 - gate.x1;
    const dy = gate.y2 - gate.y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = ((x - gate.x1) * dx + (y - gate.y1) * dy) / len2;
    if (t < -0.08 || t > 1.08) continue;
    const px = gate.x1 + dx * t;
    const py = gate.y1 + dy * t;
    if (Math.hypot(x - px, y - py) < 10) return true;
  }
  return false;
}
