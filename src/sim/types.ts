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

export type HerdTransitPhase = "approach" | "drive" | "night";

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
  /** Set when dusk paused a drive. The next morning keeps this progress. */
  resumeDrive?: boolean;
};

/** Axis-aligned camp in world metres. The right and bottom edges are exclusive. */
export type CampRect = { x: number; y: number; w: number; h: number };

export type CampState = {
  id: number;
  name: string;
  hectares: number;
  peakDmKgPerHa: number;
  standingDmKgPerHa: number;
  soilMoistureMm: number;
  restDays: number;
  /** Sample points (corners and anchor). Membership for a metre camp is `rect`, not this list. */
  tiles: TilePoint[];
  anchor: TilePoint;
  rect?: CampRect;
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
  /** Centre line of the two-track, in metres. Drawn as a polyline, not one texture. */
  road?: TilePoint[];
  /**
   * Set when an old tile-grid save was replaced with a fresh farm.
   * The scene shows a note once, then clears it.
   */
  scaleReset?: boolean;
  /** Shared water installations from farm definition (wagon wheel layout). */
  farmWaterPoints?: FarmWaterPoint[];
  story?: StoryState;
  /** Save schema written by migrateState. Older saves omit it. */
  stateVersion?: number;
};

export type MoveResult =
  | { ok: true; campName: string; queued?: boolean; queueReason?: string }
  | { ok: false; reason: "same" | "missing" | "moving" };
