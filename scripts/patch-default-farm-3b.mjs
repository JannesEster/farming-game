/**
 * Patch default-farm.json for step 3b: shared water points, selective lick, homestead handling yard.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const farmPath = path.join(root, "public/farms/default-farm.json");

const WATER_POINTS = [
  {
    id: "wp-yard",
    tile: { x: 14, y: 12 },
    trough: { x: 15, y: 13 },
    pump: "windmill",
    reservoir: true,
    servedCampIds: [1, 2, 6],
    lick: true,
  },
  {
    id: "wp-ne",
    tile: { x: 57, y: 14 },
    trough: { x: 57, y: 14 },
    pump: "windmill",
    reservoir: true,
    servedCampIds: [0, 3, 7],
    lick: true,
  },
  {
    id: "wp-centre",
    tile: { x: 43, y: 31 },
    trough: { x: 43, y: 31 },
    pump: "solar",
    reservoir: true,
    servedCampIds: [4, 5, 9, 10],
    lick: false,
  },
  {
    id: "wp-sw",
    tile: { x: 22, y: 43 },
    trough: { x: 22, y: 43 },
    pump: "windmill",
    reservoir: false,
    servedCampIds: [8, 13],
    lick: true,
  },
  {
    id: "wp-s",
    tile: { x: 52, y: 61 },
    trough: { x: 52, y: 61 },
    pump: "solar",
    reservoir: true,
    servedCampIds: [11, 12, 14],
    lick: false,
  },
  {
    id: "wp-sw-far",
    tile: { x: 33, y: 66 },
    trough: { x: 33, y: 66 },
    pump: "solar",
    reservoir: false,
    servedCampIds: [15, 16, 17],
    lick: true,
  },
];

/** Camps with no direct trough; rely on shared point off camp. */
const NO_LOCAL_TROUGH = new Set([4, 8, 16]);

const LICK_CAMPS = new Set([0, 1, 2, 3, 6, 8, 11, 13, 15, 17]);

function infraForCamp(campId) {
  const served = WATER_POINTS.find((w) => w.servedCampIds.includes(campId));
  const water = Boolean(served);
  const trough = !NO_LOCAL_TROUGH.has(campId) && served;
  return {
    water,
    lick: LICK_CAMPS.has(campId),
    kraal: false,
    windmill: served?.pump === "windmill" && trough,
    solar: served?.pump === "solar" && trough,
    reservoir: Boolean(served?.reservoir && trough),
    trough: Boolean(trough),
  };
}

const raw = await readFile(farmPath, "utf8");
const farm = JSON.parse(raw);
farm.schemaVersion = 3;
farm.waterPoints = WATER_POINTS;

for (const camp of farm.camps) {
  camp.infrastructure = infraForCamp(camp.id);
}

const keepKinds = new Set(["tree", "bush", "house", "worker_house", "shed", "track"]);
farm.features = farm.features.filter((f) => keepKinds.has(f.kind));

const yard = [
  { kind: "house", x: 12, y: 12, scale: 1 },
  { kind: "worker_house", x: 10, y: 14, scale: 1 },
  { kind: "windmill", x: 14, y: 12, scale: 1 },
  { kind: "reservoir", x: 15, y: 12, scale: 1 },
  { kind: "kraal", x: 12, y: 14, scale: 1 },
  { kind: "crush", x: 13, y: 14, scale: 1 },
  { kind: "loading_ramp", x: 14, y: 15, scale: 1 },
  { kind: "shed", x: 16, y: 13, scale: 1 },
  { kind: "trough", x: 15, y: 13, scale: 1 },
];

for (const wp of WATER_POINTS) {
  if (wp.pump === "windmill") {
    yard.push({ kind: "windmill", x: wp.tile.x, y: wp.tile.y, scale: 1 });
  } else {
    yard.push({ kind: "solar_pump", x: wp.tile.x, y: wp.tile.y, scale: 1 });
  }
  if (wp.reservoir) {
    yard.push({ kind: "reservoir", x: wp.tile.x + 1, y: wp.tile.y, scale: 0.9 });
  }
  yard.push({ kind: "trough", x: wp.trough.x, y: wp.trough.y, scale: 1 });
  if (wp.lick) {
    yard.push({ kind: "lick_feeder", x: wp.trough.x - 1, y: wp.trough.y, scale: 0.85 });
  }
}

farm.features.push(...yard);

const existing = new Set(farm.features.map((f) => `${f.kind}:${f.x},${f.y}`));
for (const f of yard) {
  const key = `${f.kind}:${f.x},${f.y}`;
  if (!existing.has(key)) farm.features.push(f);
}

await writeFile(farmPath, `${JSON.stringify(farm)}\n`);
console.log("Patched default-farm.json for step 3b");
