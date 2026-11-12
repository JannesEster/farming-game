import type { RanchClockState } from "./clock";
import type { NotificationState } from "./notifications";
import type { FarmWaterPoint, StoryState } from "./storyTypes";

export const TILE_HOMESTEAD = -1;
export const TILE_OUTSIDE = -2;

export type TilePoint = { x: number; y: number };

export type CalendarDate = { year: number; month: number; day: number; hour: number };

export type FeatureKind =
  | "tree"
  | "bush"
  | "house"
  | "worker_house"
  | "windmill"
  | "solar_pump"
  | "reservoir"
  | "kraal"
  | "holding_pen"
  | "race"
  | "crush"
  | "handling_roof"
  | "loading_ramp"
  | "cattle_truck"
  | "shed"
  | "trough"
  | "lick_feeder"
  | "track";

export type Feature = {
  kind: FeatureKind;
  x: number;
  y: number;
  scale: number;
};

export type HerdTransitPhase = "approach" | "drive";

export type HerderId = "farmer" | "piet";

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
  phase?: HerdTransitPhase;
  herder?: HerderId;
  /** 0..1 walk from where the herder actually is to the back of the mob. */
  approachProgress?: number;
  approachPath?: TilePoint[];
  approachKm?: number;
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
  /** Ranch real time clock and days per month settings. */
  clock?: RanchClockState;
  /** Notification log, letters, and persistent alerts. */
  notifications?: NotificationState;
  seasonRainMm: number;
  todayRainMm: number;
  cashNad: number;
  width: number;
  height: number;
  campIds: number[];
  camps: CampState[];
  herd: HerdState;
  features: Feature[];
  /** Shared water installations from farm definition (wagon wheel layout). */
  farmWaterPoints?: FarmWaterPoint[];
  story?: StoryState;
  /** Save schema written by migrateState. Older saves omit it. */
  stateVersion?: number;
};

export type MoveResult =
  | { ok: true; campName: string; queued?: boolean; queueReason?: string }
  | { ok: false; reason: "same" | "missing" | "moving" };
