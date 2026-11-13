import { CONFIG } from "../sim/config";
import type { FeatureKind } from "../sim/types";
import { V2_SPRITES, type V2SpriteMeta } from "./v2Manifest";

/**
 * People and cattle keep the on-screen size from step 3c. That size is the
 * anchor. Everything else is scaled in real metres around the cow.
 *
 * A standing person is 0.58 tiles tall. An adult cow's side view is 0.62
 * tiles nose to tail, and a calf is 0.68 of that. Those tile spans are the
 * sizes Jannes asked to keep. PIXELS_PER_METRE is the cow's length divided
 * into 2.4 m, so a bakkie, a house, or a windmill is the right number of
 * cow-lengths. Camp sides, fences, the road, travel and the HUD bar use this
 * same metre. World coordinates are metres, so one unit is 1 / 1000 km.
 *
 * Every row is grade A: a stated assumption, with the source of the number.
 */
/** Step 3c standing height, in tiles. Display height is this times the tile width. */
export const PERSON_HEIGHT_TILES = 0.58;
/** Step 3c adult side-view length, in tiles. */
export const COW_BODY_TILES = 0.62;
/** Step 3c calf length as a fraction of the adult side view. */
export const CALF_OF_COW = 0.68;

export function personDisplayPx(): number {
  return CONFIG.view.tileWidth * PERSON_HEIGHT_TILES;
}

export function cowDisplayPx(): number {
  return CONFIG.view.tileWidth * COW_BODY_TILES;
}

export function calfDisplayPx(): number {
  return cowDisplayPx() * CALF_OF_COW;
}

export const COW_LENGTH_METRES = 2.4;
/** Cow length on screen, divided into a 2.4 m beast. Buildings and vehicles use this. */
export const PIXELS_PER_METRE = (CONFIG.view.tileWidth * COW_BODY_TILES) / COW_LENGTH_METRES;

/**
 * HUD scale bar. Screen pixels divided by this constant are metres.
 * `barPx` is the bar on the screen. `zoom` is the camera zoom.
 */
export function scaleBarMetres(barPx: number, zoom: number): number {
  return barPx / (PIXELS_PER_METRE * Math.max(zoom, 0.000001));
}

/** Round distances for the HUD bar. The bar length matches the label. */
export const SCALE_BAR_STOPS_M = [5, 10, 20, 50, 100, 250, 500, 1000, 2000] as const;

export function chooseScaleBar(
  zoom: number,
  targetPx = 120,
): { metres: number; px: number; label: string } {
  const pxPerM = PIXELS_PER_METRE * Math.max(zoom, 0.000001);
  let best: number = SCALE_BAR_STOPS_M[0];
  let bestDist = Number.POSITIVE_INFINITY;
  let anyInRange = false;
  for (const metres of SCALE_BAR_STOPS_M) {
    const px = metres * pxPerM;
    const inRange = px >= 48 && px <= 200;
    if (inRange) anyInRange = true;
    if (anyInRange && !inRange) continue;
    const dist = Math.abs(px - targetPx);
    if (dist < bestDist) {
      bestDist = dist;
      best = metres;
    }
  }
  const px = Math.round(best * pxPerM);
  const label = best >= 1000 ? `${best / 1000} km` : `${best} m`;
  return { metres: best, px, label };
}

/** True when a projection tile width is the cow's metre, not the 64 px authoring tile. */
export function projectsMetres(tileW: number): boolean {
  return Math.abs(tileW - PIXELS_PER_METRE) < 1.5;
}

export const PERSON_HEIGHT_METRES = 1.8;
export const COW_SHOULDER_METRES = 1.4;
/** About 0.6 of the adult, the proportion the calf sheet was drawn at. */
export const CALF_LENGTH_METRES = 1.45;
export const HORSE_WITHERS_METRES = 1.6;
export const HORSE_LENGTH_METRES = 2.4;
export const BAKKIE_LENGTH_METRES = 5.3;
export const ROAD_TRAIN_METRES = 22;
export const FARMHOUSE_WIDTH_METRES = 15;
export const DOOR_METRES = 2.1;
export const EAVES_METRES = 3.0;
export const COTTAGE_WIDTH_METRES = 8;
export const SHED_WIDTH_METRES = 10;
export const WINDMILL_HEIGHT_METRES = 11;
export const WHEEL_DIAMETER_METRES = 3.6;
export const RESERVOIR_DIAMETER_METRES = 4.6;
export const WATER_TANK_HEIGHT_METRES = 2.4;
export const TROUGH_LENGTH_METRES = 3.0;
export const SOLAR_WIDTH_METRES = 4.5;
export const LICK_DRUM_HEIGHT_METRES = 0.9;
export const LICK_TROUGH_LENGTH_METRES = 2.0;
export const LICK_FEEDER_LENGTH_METRES = 2.4;
export const YARD_PANEL_HEIGHT_METRES = 1.8;
export const CRUSH_HEIGHT_METRES = 2.2;
export const RAMP_LENGTH_METRES = 3.5;
/** Painted race sheet. The v2 race is scaled on the 1.8 m panel height instead. */
export const RACE_LENGTH_METRES = 8;
export const CAMELTHORN_LARGE_METRES = 12;
export const CAMELTHORN_SMALL_METRES = 6;
export const SHEPHERDS_TREE_METRES = 6;
export const BUSH_DENSE_METRES = 2.2;
export const BUSH_SPARSE_METRES = 1.4;
export const TERMITE_HEIGHT_METRES = 2.2;
export const ROCK_CLUSTER_METRES = 2.0;
export const ROCK_FLAT_METRES = 1.4;
export const FENCE_HEIGHT_METRES = 1.2;
export const FENCE_POST_HEIGHT_METRES = 1.5;
export const CAMP_GATE_METRES = 3.6;
export const GARDEN_WIDTH_METRES = 4;
export const KRAAL_WIDTH_METRES = 8;

/**
 * Holding space per beast. The design uses 1.8 m², inside the 1.5–2 m² band.
 * KZN DARD Cattle Handling Facilities: at least 2.3 m² per mature cow in a
 * holding pen and 1.67 m² in the forcing yard. FAO and National Stockyards:
 * about 1.4–1.6 m² for 300–500 kg cattle and 2.0 m² over 550 kg. Queensland
 * handling guidance: 1.5–2 m² forcing, 2–3 m² receiving. FutureBeef: about
 * 2 m² per head in a holding yard.
 */
export const HOLDING_M2_PER_HEAD = 1.8;
export const PEN_DEPTH_METRES = 4.2;
export const PEN_ALONG_METRES = [11, 9, 8] as const;
/** Head the largest pen is drawn for. 11 m × 4.2 m / 1.8 m² ≈ 25. */
export const SALE_DRAFT_HEAD = 24;

export type SizeAxis = "width" | "height";

export type SpriteSize = {
  id: string;
  /** Manifest file that carries this size. Null when the sprite is not drawn yet. */
  file: string | null;
  axis: SizeAxis;
  metres: number;
  /** People and cattle only. */
  livestock: boolean;
  grade: "A";
  note: string;
};

export const SPRITE_SIZES: readonly SpriteSize[] = [
  {
    id: "person",
    file: "person-farmer-stand-s.png",
    axis: "height",
    metres: PERSON_HEIGHT_METRES,
    livestock: true,
    grade: "A",
    note: "Adult man, about 1.8 m. The same height is used for the farmer and for Piet.",
  },
  {
    id: "cow",
    file: "cattle-bonsmara-e.png",
    axis: "width",
    metres: COW_LENGTH_METRES,
    livestock: true,
    grade: "A",
    note: "Mature beef cow, nose to tail. The brief's band is 2.2–2.5 m; 2.4 m is the middle. Shoulder height is 1.4 m (band 1.3–1.45 m) and is not the sprite axis.",
  },
  {
    id: "calf",
    file: "cattle-calf-e.png",
    axis: "width",
    metres: CALF_LENGTH_METRES,
    livestock: true,
    grade: "A",
    note: "Proportional weaner, about 0.6 of the adult. The v2 calf sheet was drawn at 144 px beside a 240 px cow (docs/reference/art-v2/README.md).",
  },
  {
    id: "horse",
    file: null,
    axis: "height",
    metres: HORSE_WITHERS_METRES,
    livestock: false,
    grade: "A",
    note: "Riding horse, about 1.6 m at the withers and 2.4 m nose to tail. No sprite yet; the row is here so a later horse uses this table.",
  },
  {
    id: "bakkie",
    file: "vehicle-bakkie-se.png",
    axis: "width",
    metres: BAKKIE_LENGTH_METRES,
    livestock: false,
    grade: "A",
    note: "Toyota Hilux double cab, overall length 5 320 mm (Toyota specification sheet). Rounded to 5.3 m.",
  },
  {
    id: "roadtrain",
    file: "vehicle-roadtrain-e.png",
    axis: "width",
    metres: ROAD_TRAIN_METRES,
    livestock: false,
    grade: "A",
    note: "22 m. South African National Road Traffic Regulations, regulation 221, cap a drawing vehicle with one or two trailers at 22 m overall. Namibia's Road Traffic and Transport Regulations under the 1999 Act use the same 22 m combination limit. The sprite is a rigid cab plus two stock trailers, the usual Namibian livestock road train, taken at that legal length.",
  },
  {
    id: "farmhouse",
    file: "bldg-farmhouse.png",
    axis: "width",
    metres: FARMHOUSE_WIDTH_METRES,
    livestock: false,
    grade: "A",
    note: "Single-storey farmhouse, footprint in the middle of 12–18 m including the stoep. The door is 2.1 m and the wall plate (eaves) is 3.0 m; the ridge is higher. The sprite is scaled on the 15 m width.",
  },
  {
    id: "cottage",
    file: "bldg-worker-cottage.png",
    axis: "width",
    metres: COTTAGE_WIDTH_METRES,
    livestock: false,
    grade: "A",
    note: "Worker cottage, smaller than the farmhouse. 8 m across the front.",
  },
  {
    id: "shed",
    file: "bldg-shed.png",
    axis: "width",
    metres: SHED_WIDTH_METRES,
    livestock: false,
    grade: "A",
    note: "Implement shed, 10 m across the front.",
  },
  {
    id: "windmill",
    file: "prop-windmill-reservoir.png",
    axis: "height",
    metres: WINDMILL_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Southern Cross lists tower heights of 20, 25, 30, 40, 50 and 60 ft (6.1–18.3 m) and recommends at least 30 ft (9.1 m) for an 8–10 ft wheel and 40 ft (12.2 m) for a 12–14 ft wheel (southerncrosswindmills.com.au). The same mills are built in Bloemfontein. 11 m is the whole sprite, tower plus wheel, so the tower itself lands near 9–10 m. A 12 ft wheel is 3.6 m. The round reservoir in the same painting is several metres across; Sandy Speedy's stock reservoirs (Farmers Weekly, Vryburg–Kuruman) are about 4.6 m in diameter.",
  },
  {
    id: "water-tank",
    file: "prop-water-tank.png",
    axis: "height",
    metres: WATER_TANK_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Vertical farm tank, about a 5 000–10 000 L JoJo, 2.4 m high.",
  },
  {
    id: "trough",
    file: "prop-trough.png",
    axis: "width",
    metres: TROUGH_LENGTH_METRES,
    livestock: false,
    grade: "A",
    note: "Concrete cattle trough, 3 m long. Speedy's steel troughs are 4 m × 0.3 m × 0.2 m; 3 m is a shorter yard trough.",
  },
  {
    id: "solar",
    file: "prop-solar-pump.png",
    axis: "width",
    metres: SOLAR_WIDTH_METRES,
    livestock: false,
    grade: "A",
    note: "Small borehole solar array, 4.5 m across the panels.",
  },
  {
    id: "lick-drum",
    file: "prop-lick-drum.png",
    axis: "height",
    metres: LICK_DRUM_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "A 210 L lick drum, about 0.9 m tall.",
  },
  {
    id: "lick-trough",
    file: "prop-lick-trough-roofed.png",
    axis: "width",
    metres: LICK_TROUGH_LENGTH_METRES,
    livestock: false,
    grade: "A",
    note: "Small roofed lick trough, 2 m long.",
  },
  {
    id: "lick-feeder",
    file: "prop-lick-roofed-alt.png",
    axis: "width",
    metres: LICK_FEEDER_LENGTH_METRES,
    livestock: false,
    grade: "A",
    note: "Larger roofed lick feeder, 2.4 m long.",
  },
  {
    id: "yard-panel",
    file: "yard-panel-straight.png",
    axis: "height",
    metres: YARD_PANEL_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Cattle yard panel, 1.8 m high. At that height the 210×176 sheet is about 2.15 m long, a normal bay.",
  },
  {
    id: "crush",
    file: "yard-crush-roofed.png",
    axis: "height",
    metres: CRUSH_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Roofed crush, about 2.2 m to the roof.",
  },
  {
    id: "ramp",
    file: "yard-loading-ramp.png",
    axis: "width",
    metres: RAMP_LENGTH_METRES,
    livestock: false,
    grade: "A",
    note: "Loading ramp, 3.5 m long.",
  },
  {
    id: "camelthorn-large",
    file: "tree-camelthorn-large.png",
    axis: "height",
    metres: CAMELTHORN_LARGE_METRES,
    livestock: false,
    grade: "A",
    note: "Camelthorn (Vachellia erioloba). The brief's band is 5–15 m; old trees reach about 20 m (SANBI / Wikipedia). The large sprite is a 12 m tree.",
  },
  {
    id: "camelthorn-small",
    file: "tree-camelthorn-small.png",
    axis: "height",
    metres: CAMELTHORN_SMALL_METRES,
    livestock: false,
    grade: "A",
    note: "Younger camelthorn, 6 m, inside the 5–15 m band.",
  },
  {
    id: "shepherds",
    file: "tree-shepherds.png",
    axis: "height",
    metres: SHEPHERDS_TREE_METRES,
    livestock: false,
    grade: "A",
    note: "Shepherd's tree (Boscia albitrunca), commonly around 6 m.",
  },
  {
    id: "bush-dense",
    file: "bush-thorn-dense.png",
    axis: "height",
    metres: BUSH_DENSE_METRES,
    livestock: false,
    grade: "A",
    note: "Dense thorn bush, 2.2 m.",
  },
  {
    id: "bush-sparse",
    file: "bush-thorn-sparse.png",
    axis: "height",
    metres: BUSH_SPARSE_METRES,
    livestock: false,
    grade: "A",
    note: "Sparse thorn bush, 1.4 m.",
  },
  {
    id: "termite",
    file: "termite-mound.png",
    axis: "height",
    metres: TERMITE_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Macrotermes mound. Kalahari mounds are often 1–4 m; 2.2 m is a typical one.",
  },
  {
    id: "rocks",
    file: "rocks-cluster.png",
    axis: "width",
    metres: ROCK_CLUSTER_METRES,
    livestock: false,
    grade: "A",
    note: "Loose rock cluster, 2 m across.",
  },
  {
    id: "rock-flat",
    file: "rock-flat.png",
    axis: "width",
    metres: ROCK_FLAT_METRES,
    livestock: false,
    grade: "A",
    note: "Flat surface rock, 1.4 m across.",
  },
  {
    id: "fence",
    file: "fence-wire-ne.png",
    axis: "height",
    metres: FENCE_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Cattle wire, 1.2 m high. The run length follows the camp edge so one sprite still closes the side; the height is this measurement.",
  },
  {
    id: "fence-post",
    file: "fence-strainer-post.png",
    axis: "height",
    metres: FENCE_POST_HEIGHT_METRES,
    livestock: false,
    grade: "A",
    note: "Strainer post, 1.5 m, a little taller than the wires.",
  },
];

const byFile = new Map(V2_SPRITES.map((sprite) => [sprite.file, sprite]));

export function uniformScale(pixels: number, metres: number): number {
  if (pixels <= 0) return 1;
  return (metres * PIXELS_PER_METRE) / pixels;
}

/** Screen length of one isometric tile step, in pixels. */
export function isoStepPx(): number {
  return Math.hypot(CONFIG.view.tileWidth / 2, CONFIG.view.tileHeight / 2);
}

/** How many metres one tile step stands for at the sprite scale. Not the 75 m travel tile. */
export function metresPerTile(): number {
  return isoStepPx() / PIXELS_PER_METRE;
}

/** Step 3c authoring scale: the adult side view stays COW_BODY_TILES long when the cow turns. */
function lockedCattleScale(sprite: V2SpriteMeta, calf: boolean): number {
  const adult = canonical("cattle-bonsmara-e.png");
  const adultSource = adult?.sourceWidth ?? 245;
  const authoring = cowDisplayPx() / adultSource;
  let scale = authoring * (sprite.sourceWidth / sprite.width);
  if (calf) {
    const calfSheet = canonical("cattle-calf-e.png");
    const calfSource = calfSheet?.sourceWidth ?? sprite.sourceWidth;
    scale *= (CALF_OF_COW * adultSource) / calfSource;
  }
  return scale;
}

function lockedPersonScale(sprite: V2SpriteMeta): number {
  return personDisplayPx() / sprite.height;
}

function canonical(file: string): V2SpriteMeta | undefined {
  return byFile.get(file);
}

/**
 * Display scale for one manifest sprite.
 * Cattle share the side-view authoring scale, so a cow does not change length when it turns.
 * A road train's long axis is 22 m on every facing. A bakkie's long axis is 5.3 m.
 */
export function displayScaleForSprite(sprite: V2SpriteMeta): number | null {
  if (sprite.category === "ground-tile") return null;
  const file = sprite.file;
  if (file.startsWith("cattle-")) return lockedCattleScale(sprite, file.includes("calf"));
  if (file.startsWith("person-")) return lockedPersonScale(sprite);
  if (file.startsWith("vehicle-bakkie")) return uniformScale(sprite.width, BAKKIE_LENGTH_METRES);
  if (file.startsWith("vehicle-roadtrain")) return uniformScale(sprite.width, ROAD_TRAIN_METRES);
  if (file.startsWith("bldg-farmhouse")) return uniformScale(sprite.width, FARMHOUSE_WIDTH_METRES);
  if (file.startsWith("bldg-worker-cottage")) return uniformScale(sprite.width, COTTAGE_WIDTH_METRES);
  if (file.startsWith("bldg-shed")) return uniformScale(sprite.width, SHED_WIDTH_METRES);
  if (file.startsWith("prop-windmill")) return uniformScale(sprite.height, WINDMILL_HEIGHT_METRES);
  if (file.startsWith("prop-water-tank")) return uniformScale(sprite.height, WATER_TANK_HEIGHT_METRES);
  if (file.startsWith("prop-trough")) return uniformScale(sprite.width, TROUGH_LENGTH_METRES);
  if (file.startsWith("prop-solar")) return uniformScale(sprite.width, SOLAR_WIDTH_METRES);
  if (file.startsWith("prop-lick-drum")) return uniformScale(sprite.height, LICK_DRUM_HEIGHT_METRES);
  if (file.startsWith("prop-lick-trough")) return uniformScale(sprite.width, LICK_TROUGH_LENGTH_METRES);
  if (file.startsWith("prop-lick-roofed")) return uniformScale(sprite.width, LICK_FEEDER_LENGTH_METRES);
  if (file.startsWith("tree-camelthorn-large")) return uniformScale(sprite.height, CAMELTHORN_LARGE_METRES);
  if (file.startsWith("tree-camelthorn-small")) return uniformScale(sprite.height, CAMELTHORN_SMALL_METRES);
  if (file.startsWith("tree-shepherds")) return uniformScale(sprite.height, SHEPHERDS_TREE_METRES);
  if (file.startsWith("bush-thorn-dense")) return uniformScale(sprite.height, BUSH_DENSE_METRES);
  if (file.startsWith("bush-thorn-sparse")) return uniformScale(sprite.height, BUSH_SPARSE_METRES);
  if (file.startsWith("termite-mound")) return uniformScale(sprite.height, TERMITE_HEIGHT_METRES);
  if (file.startsWith("rocks-cluster")) return uniformScale(sprite.width, ROCK_CLUSTER_METRES);
  if (file.startsWith("rock-flat")) return uniformScale(sprite.width, ROCK_FLAT_METRES);
  if (file.startsWith("yard-panel") || file.startsWith("yard-race") || file.startsWith("yard-gate") || file.startsWith("yard-corner")) {
    return uniformScale(sprite.height, YARD_PANEL_HEIGHT_METRES);
  }
  if (file.startsWith("yard-crush")) return uniformScale(sprite.height, CRUSH_HEIGHT_METRES);
  if (file.startsWith("yard-loading-ramp")) return uniformScale(sprite.width, RAMP_LENGTH_METRES);
  if (file.startsWith("fence-strainer")) return uniformScale(sprite.height, FENCE_POST_HEIGHT_METRES);
  if (file.startsWith("fence-")) return uniformScale(sprite.height, FENCE_HEIGHT_METRES);
  return null;
}

export function displayScaleForFile(file: string): number | null {
  const sprite = byFile.get(file);
  if (!sprite) return null;
  return displayScaleForSprite(sprite);
}

/** On-screen pixels of the size axis after the world scale is applied. */
export function displayPx(file: string): number | null {
  const sprite = byFile.get(file);
  const scale = displayScaleForFile(file);
  if (!sprite || scale === null) return null;
  const axis = sizeAxisForFile(file);
  const pixels = axis === "height" ? sprite.height : sprite.width;
  return pixels * scale;
}

function sizeAxisForFile(file: string): SizeAxis {
  if (file.startsWith("person-") || file.startsWith("prop-windmill") || file.startsWith("prop-water-tank")) return "height";
  if (file.startsWith("prop-lick-drum") || file.startsWith("tree-") || file.startsWith("bush-") || file.startsWith("termite-")) return "height";
  if (file.startsWith("yard-panel") || file.startsWith("yard-race") || file.startsWith("yard-gate") || file.startsWith("yard-corner")) return "height";
  if (file.startsWith("yard-crush") || file.startsWith("fence-")) return "height";
  return "width";
}

export type KeyRatios = {
  person: number;
  door: number;
  eaves: number;
  cow: number;
  calf: number;
  bakkie: number;
  truck: number;
  windmill: number;
  farmhouse: number;
  personOverDoor: number;
  personOverEaves: number;
  personOverCow: number;
  cowOverBakkie: number;
  bakkieOverTruck: number;
  windmillOverBakkie: number;
  farmhouseOverPerson: number;
};

export function keyRatios(): KeyRatios {
  const person = personDisplayPx();
  const cow = cowDisplayPx();
  const calf = calfDisplayPx();
  const door = DOOR_METRES * PIXELS_PER_METRE;
  const eaves = EAVES_METRES * PIXELS_PER_METRE;
  const bakkie = BAKKIE_LENGTH_METRES * PIXELS_PER_METRE;
  const truck = ROAD_TRAIN_METRES * PIXELS_PER_METRE;
  const windmill = WINDMILL_HEIGHT_METRES * PIXELS_PER_METRE;
  const farmhouse = FARMHOUSE_WIDTH_METRES * PIXELS_PER_METRE;
  return {
    person,
    door,
    eaves,
    cow,
    calf,
    bakkie,
    truck,
    windmill,
    farmhouse,
    personOverDoor: person / door,
    personOverEaves: person / eaves,
    personOverCow: person / cow,
    cowOverBakkie: cow / bakkie,
    bakkieOverTruck: bakkie / truck,
    windmillOverBakkie: windmill / bakkie,
    farmhouseOverPerson: farmhouse / person,
  };
}

export type YardStamp = { kind: FeatureKind; into: number; along: number; scale: number };

/**
 * Pens in metres (stored on feature.scale) so the drawing uses the same numbers.
 * Centres are integer tiles chosen so the metre boxes sit side by side
 * once a tile is about 2.2 m (the cow's metre). 11 m, 9 m and 8 m by 4.2 m
 * deep: about 25, 21 and 18 head at 1.8 m². The long side stays longer
 * than the 22 m road train.
 */
export const HANDLING_YARD: readonly YardStamp[] = [
  { kind: "loading_ramp", into: 1, along: 2, scale: 1 },
  { kind: "race", into: 2, along: 5, scale: 1 },
  { kind: "crush", into: 2, along: 7, scale: 1 },
  { kind: "handling_roof", into: 2, along: 7, scale: 1 },
  { kind: "holding_pen", into: 3, along: 4, scale: PEN_ALONG_METRES[0] },
  { kind: "holding_pen", into: 3, along: 9, scale: PEN_ALONG_METRES[1] },
  { kind: "holding_pen", into: 3, along: 13, scale: PEN_ALONG_METRES[2] },
];

export const HANDLING_YARD_COMPACT: readonly YardStamp[] = [
  { kind: "loading_ramp", into: 1, along: 2, scale: 1 },
  { kind: "race", into: 2, along: 5, scale: 1 },
  { kind: "crush", into: 2, along: 7, scale: 1 },
  { kind: "handling_roof", into: 2, along: 7, scale: 1 },
  { kind: "holding_pen", into: 3, along: 4, scale: PEN_ALONG_METRES[0] },
  { kind: "holding_pen", into: 3, along: 9, scale: PEN_ALONG_METRES[1] },
  { kind: "holding_pen", into: 3, along: 13, scale: PEN_ALONG_METRES[2] },
];

export function yardLongSideMetres(stamps: readonly YardStamp[] = HANDLING_YARD): number {
  const metres = metresPerTile();
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const pen of stamps) {
    if (pen.kind !== "holding_pen") continue;
    const center = pen.along * metres;
    const half = pen.scale / 2;
    min = Math.min(min, center - half);
    max = Math.max(max, center + half);
  }
  return max - min;
}

export function truckToYardRatio(stamps: readonly YardStamp[] = HANDLING_YARD): number {
  return ROAD_TRAIN_METRES / yardLongSideMetres(stamps);
}

/** Tiles of straight road the parked road train needs, plus a margin. */
export function truckBayTiles(): number {
  return Math.ceil(ROAD_TRAIN_METRES / metresPerTile()) + 3;
}

export function largestPenAreaM2(): number {
  return Math.max(...PEN_ALONG_METRES) * PEN_DEPTH_METRES;
}

export function largestPenM2PerHead(): number {
  return largestPenAreaM2() / SALE_DRAFT_HEAD;
}
