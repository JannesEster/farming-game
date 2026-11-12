import { CONFIG } from "../sim/config";
import type { FeatureKind } from "../sim/types";
import { V2_SPRITES, type V2SpriteMeta } from "./v2Manifest";

/**
 * One visual scale for every sprite.
 *
 * The travel map is a different scale: CONFIG.transit.kmPerTile (75 m per tile)
 * is for herding distance and the HUD scale bar. Using it for sprites would
 * draw a person at about a pixel. PIXELS_PER_METRE is the local scale, chosen
 * so a 15 m farmhouse and an 11 m windmill still fit on the 7×6 homestead
 * (their tiles are about 132 px apart on screen).
 *
 * Every row is grade A: a stated assumption, with the source of the number.
 */
export const PIXELS_PER_METRE = 8;

/**
 * People and cattle share this one enlargement so they stay readable.
 * It must stay at or under about 1.3. It is 1.05, not higher, because a
 * 1.8 m adult times 1.3 is 2.34 m and would stand taller than a 2.1 m door.
 * At 1.05 the person is 1.89 m, about a head under that door.
 * Buildings, vehicles, and vegetation do not get this factor.
 */
export const LIVESTOCK_READABILITY = 1.05;

export const PERSON_HEIGHT_METRES = 1.8;
export const COW_LENGTH_METRES = 2.4;
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

export function uniformScale(pixels: number, metres: number, livestock = false): number {
  if (pixels <= 0) return 1;
  const boost = livestock ? LIVESTOCK_READABILITY : 1;
  return (metres * boost * PIXELS_PER_METRE) / pixels;
}

/** Screen length of one isometric tile step, in pixels. */
export function isoStepPx(): number {
  return Math.hypot(CONFIG.view.tileWidth / 2, CONFIG.view.tileHeight / 2);
}

/** How many metres one tile step stands for at the sprite scale. Not the 75 m travel tile. */
export function metresPerTile(): number {
  return isoStepPx() / PIXELS_PER_METRE;
}

function authoredScale(
  sprite: V2SpriteMeta,
  canonical: V2SpriteMeta,
  metres: number,
  axis: SizeAxis,
  livestock: boolean,
): number {
  const source = axis === "width" ? sprite.sourceWidth : sprite.sourceHeight;
  const canon = axis === "width" ? canonical.sourceWidth : canonical.sourceHeight;
  const web = axis === "width" ? sprite.width : sprite.height;
  if (canon <= 0 || web <= 0) return 1;
  const boost = livestock ? LIVESTOCK_READABILITY : 1;
  return (source * metres * boost * PIXELS_PER_METRE) / (canon * web);
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
  if (file.startsWith("cattle-")) {
    const calf = file.includes("calf");
    const canon = canonical(calf ? "cattle-calf-e.png" : "cattle-bonsmara-e.png");
    const metres = calf ? CALF_LENGTH_METRES : COW_LENGTH_METRES;
    if (!canon) return uniformScale(sprite.width, metres, true);
    return authoredScale(sprite, canon, metres, "width", true);
  }
  if (file.startsWith("person-")) return uniformScale(sprite.height, PERSON_HEIGHT_METRES, true);
  if (file.startsWith("vehicle-bakkie")) return uniformScale(sprite.width, BAKKIE_LENGTH_METRES, false);
  if (file.startsWith("vehicle-roadtrain")) return uniformScale(sprite.width, ROAD_TRAIN_METRES, false);
  if (file.startsWith("bldg-farmhouse")) return uniformScale(sprite.width, FARMHOUSE_WIDTH_METRES, false);
  if (file.startsWith("bldg-worker-cottage")) return uniformScale(sprite.width, COTTAGE_WIDTH_METRES, false);
  if (file.startsWith("bldg-shed")) return uniformScale(sprite.width, SHED_WIDTH_METRES, false);
  if (file.startsWith("prop-windmill")) return uniformScale(sprite.height, WINDMILL_HEIGHT_METRES, false);
  if (file.startsWith("prop-water-tank")) return uniformScale(sprite.height, WATER_TANK_HEIGHT_METRES, false);
  if (file.startsWith("prop-trough")) return uniformScale(sprite.width, TROUGH_LENGTH_METRES, false);
  if (file.startsWith("prop-solar")) return uniformScale(sprite.width, SOLAR_WIDTH_METRES, false);
  if (file.startsWith("prop-lick-drum")) return uniformScale(sprite.height, LICK_DRUM_HEIGHT_METRES, false);
  if (file.startsWith("prop-lick-trough")) return uniformScale(sprite.width, LICK_TROUGH_LENGTH_METRES, false);
  if (file.startsWith("prop-lick-roofed")) return uniformScale(sprite.width, LICK_FEEDER_LENGTH_METRES, false);
  if (file.startsWith("tree-camelthorn-large")) return uniformScale(sprite.height, CAMELTHORN_LARGE_METRES, false);
  if (file.startsWith("tree-camelthorn-small")) return uniformScale(sprite.height, CAMELTHORN_SMALL_METRES, false);
  if (file.startsWith("tree-shepherds")) return uniformScale(sprite.height, SHEPHERDS_TREE_METRES, false);
  if (file.startsWith("bush-thorn-dense")) return uniformScale(sprite.height, BUSH_DENSE_METRES, false);
  if (file.startsWith("bush-thorn-sparse")) return uniformScale(sprite.height, BUSH_SPARSE_METRES, false);
  if (file.startsWith("termite-mound")) return uniformScale(sprite.height, TERMITE_HEIGHT_METRES, false);
  if (file.startsWith("rocks-cluster")) return uniformScale(sprite.width, ROCK_CLUSTER_METRES, false);
  if (file.startsWith("rock-flat")) return uniformScale(sprite.width, ROCK_FLAT_METRES, false);
  if (file.startsWith("yard-panel") || file.startsWith("yard-race") || file.startsWith("yard-gate") || file.startsWith("yard-corner")) {
    return uniformScale(sprite.height, YARD_PANEL_HEIGHT_METRES, false);
  }
  if (file.startsWith("yard-crush")) return uniformScale(sprite.height, CRUSH_HEIGHT_METRES, false);
  if (file.startsWith("yard-loading-ramp")) return uniformScale(sprite.width, RAMP_LENGTH_METRES, false);
  if (file.startsWith("fence-strainer")) return uniformScale(sprite.height, FENCE_POST_HEIGHT_METRES, false);
  if (file.startsWith("fence-")) return uniformScale(sprite.height, FENCE_HEIGHT_METRES, false);
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
  const person = PERSON_HEIGHT_METRES * LIVESTOCK_READABILITY * PIXELS_PER_METRE;
  const cow = COW_LENGTH_METRES * LIVESTOCK_READABILITY * PIXELS_PER_METRE;
  const calf = CALF_LENGTH_METRES * LIVESTOCK_READABILITY * PIXELS_PER_METRE;
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
 * Centres are integer tiles. 11 m, 9 m and 8 m by 4.2 m deep:
 * 46 m², 38 m² and 34 m², about 25, 21 and 18 head at 1.8 m².
 * The long side is about 32 m, so a 22 m road train is shorter than the yard.
 */
export const HANDLING_YARD: readonly YardStamp[] = [
  { kind: "loading_ramp", into: 1, along: 2, scale: 1 },
  { kind: "race", into: 2, along: 3, scale: 1 },
  { kind: "crush", into: 2, along: 4, scale: 1 },
  { kind: "handling_roof", into: 2, along: 4, scale: 1 },
  { kind: "holding_pen", into: 4, along: 2, scale: PEN_ALONG_METRES[0] },
  { kind: "holding_pen", into: 4, along: 5, scale: PEN_ALONG_METRES[1] },
  { kind: "holding_pen", into: 4, along: 7, scale: PEN_ALONG_METRES[2] },
];

export const HANDLING_YARD_COMPACT: readonly YardStamp[] = [
  { kind: "loading_ramp", into: 1, along: 1, scale: 1 },
  { kind: "race", into: 2, along: 2, scale: 1 },
  { kind: "crush", into: 2, along: 3, scale: 1 },
  { kind: "handling_roof", into: 2, along: 3, scale: 1 },
  { kind: "holding_pen", into: 3, along: 2, scale: PEN_ALONG_METRES[0] },
  { kind: "holding_pen", into: 3, along: 5, scale: PEN_ALONG_METRES[1] },
  { kind: "holding_pen", into: 3, along: 7, scale: PEN_ALONG_METRES[2] },
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
