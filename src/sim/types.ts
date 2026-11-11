export const TILE_HOMESTEAD = -1;
export const TILE_OUTSIDE = -2;

export type TilePoint = { x: number; y: number };

export type CalendarDate = { year: number; month: number; day: number; hour: number };

export type FeatureKind =
  | "tree"
  | "bush"
  | "house"
  | "windmill"
  | "reservoir"
  | "kraal"
  | "shed"
  | "trough"
  | "track";

export type Feature = {
  kind: FeatureKind;
  x: number;
  y: number;
  scale: number;
};

export type HerdTransit = {
  toCampId: number;
  progress: number;
  distanceKm: number;
  /** Game hours this walk should cost on the ranch clock. */
  walkGameHours: number;
  /** Hours already applied to state.date during the walk. */
  hoursApplied: number;
  /** Whole path as tile points, including anchors. */
  path: TilePoint[];
};

export type CampState = {
  id: number;
  name: string;
  hectares: number;
  peakDmKgPerHa: number;
  standingDmKgPerHa: number;
  soilMoistureMm: number;
  restDays: number;
  tiles: TilePoint[];
  anchor: TilePoint;
};

export type HerdState = {
  name: string;
  headCount: number;
  averageLiveweightKg: number;
  condition: number;
  campId: number;
  daysInCamp: number;
  transit: HerdTransit | null;
};

export type FarmMeta = {
  offerId: string;
  regionKey: string;
  regionLabel: string;
  hectares: number;
  rainfallMm: number;
  campCount: number;
  fenceCondition: "good" | "fair" | "poor";
  water: { boreholes: number; windmills: number; solar: number };
};

export type GameState = {
  seed: number;
  rngState: number;
  farmMeta?: FarmMeta;
  date: CalendarDate;
  seasonRainMm: number;
  todayRainMm: number;
  cashNad: number;
  width: number;
  height: number;
  campIds: number[];
  camps: CampState[];
  herd: HerdState;
  features: Feature[];
};

export type MoveResult =
  | { ok: true; campName: string }
  | { ok: false; reason: "same" | "missing" | "moving" };
