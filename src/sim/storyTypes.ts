import type { CalendarDate, TilePoint } from "./types";

export type StockClass =
  | "cow"
  | "bull"
  | "calf"
  | "heifer"
  | "pregnant_heifer"
  | "tolly"
  | "stoor"
  | "ox";

export type ClassLiveweights = {
  heifer: number;
  tolly: number;
  stoor: number;
  ox: number;
};

export type HerdComposition = Record<StockClass, number>;

export type StarvationTrack = {
  consecutivePoorFeedDays: number;
  warningLevel: 0 | 1 | 2 | 3;
  totalDeathsSeason: number;
};

export type DroughtChoiceId = "sell_down" | "buy_feed" | "move_herd";

export type DroughtState = {
  watchActive: boolean;
  choicePending: DroughtChoiceId | null;
  warnedAt: CalendarDate | null;
  forageMultiplier: number;
};

/** @deprecated Step 2 uses workGrid priorities; kept for save migration reads. */
export type FarmhandJob = "check_water" | "move_herd" | null;

export type WorkJobId = "check_water" | "fix_fences" | "fill_lick" | "move_herd_help";
export type WorkPriority = 0 | 1 | 2 | 3;
export type WorkGrid = Record<WorkJobId, WorkPriority>;

export type LickChoice = "summer_phosphate_p6" | "summer_phosphate_p12" | "winter_protein_urea";
export type PumpChoice = "diesel" | "solar" | "windmill";
export type MaintenanceMode = "maintain" | "defer";

export type CostLevers = {
  lick: LickChoice;
  pump: PumpChoice;
  bakkieRunsPerMonth: number;
  maintenance: MaintenanceMode;
  solarPaid: boolean;
};

export type InfrastructureWear = {
  fenceWear: number;
  pumpReliability: number;
  deferredMaintenanceMonths: number;
};

export type PersonPresence = {
  tileX: number;
  tileY: number;
  targetTileX: number;
  targetTileY: number;
  activeJob: WorkJobId | null;
  activityLabel: string;
  walkProgress: number;
  /** On a herd move (approach or drive). */
  onHerdingDuty?: boolean;
  /** At night, worker rests at assigned house. */
  atHome?: boolean;
};

/** @deprecated alias */
export type FarmhandPresence = PersonPresence;

export type HerdMoveQueue = {
  toCampId: number;
  reason: "no_herder" | "night";
  campName?: string;
};

export type MorningDecisionId = "lick_batch" | "water_round" | "fence_first";

export type DailyPlayState = {
  goalText: string;
  goalTarget: string;
  goalProgress: number;
  goalMet: boolean;
  morningDecisionId: MorningDecisionId | null;
  morningDecisionAnswered: boolean;
};

export type PlayerEventAction = { id: string; label: string; costNad: number };

export type PendingPlayerEvent = {
  id: string;
  kind: "pump_fault" | "jackal" | "buyer_offer";
  title: string;
  body: string;
  ignoreConsequence: string;
  actions: PlayerEventAction[];
  critical: boolean;
};

export type FarmhandState = {
  hired: boolean;
  /** @deprecated use workGrid */
  job: "check_water" | "move_herd" | null;
  daysUntilPayroll: number;
  wageCashNad: number;
};

export type SaleChannel = "auction" | "speculator" | "feedlot";

export type SaleLine = {
  stockClass: StockClass;
  count: number;
  channel: SaleChannel;
  pricePerKgLive: number;
  totalNad: number;
};

export type MonthLedger = {
  incomeNad: number;
  expenseNad: number;
  sales: SaleLine[];
  deathCount: number;
  notes: string[];
};

export type UiCard = {
  id: string;
  kind: "critical" | "warning" | "summary" | "drought" | "weekly" | "season";
  title: string;
  body: string;
  priority: number;
};

export type StoryState = {
  /** Player-chosen farmer name on the map (default Farmer). */
  playerDisplayName?: string;
  /** @deprecated use state.notifications; kept for migration reads only */
  legacyNotificationsMigrated?: boolean;
  composition: HerdComposition;
  /** Average liveweight per youngstock class for growth and weight gates. */
  classLiveweights: ClassLiveweights;
  starvation: StarvationTrack;
  drought: DroughtState;
  farmhand: FarmhandState;
  breedingPaused: boolean;
  supplementDaysLeft: number;
  lastMonthKey: string;
  ledger: MonthLedger;
  pendingCards: UiCard[];
  lastDailyNote: string | null;
  seasonEventsFired: string[];
  eatenYesterdayKg: number;
  demandYesterdayKg: number;
  /** Camp that already showed the move warning for this stay. */
  moveWarnCampId: number | null;
  /** Camp that already showed the water warning for this stay. */
  thirstWarnCampId: number | null;
  costLevers?: CostLevers;
  workGrid?: WorkGrid;
  infrastructure?: InfrastructureWear;
  farmhandPresence?: FarmhandPresence;
  farmerPresence?: PersonPresence;
  herdMoveQueue?: HerdMoveQueue | null;
  dailyPlay?: DailyPlayState;
  pendingPlayerEvent?: PendingPlayerEvent | null;
  monthDiary?: string[];
  drinkingTrip?: DrinkingTripState;
  saleConvoy?: SaleConvoyState | null;
  bakkieRun?: BakkieRunState;
  /** Visible bakkie trips this month (feeds diesel accounting hooks). */
  bakkieDieselLitresMonth?: number;
};

export type SellRequest = {
  stockClass: StockClass;
  count: number;
  channel: SaleChannel;
};

export type FarmWaterPoint = {
  id: string;
  tile: TilePoint;
  trough: TilePoint;
  pump: "windmill" | "solar";
  reservoir: boolean;
  servedCampIds: number[];
  lick: boolean;
};

export type DrinkingTripState = {
  active: boolean;
  troughTile: TilePoint | null;
  walkProgress: number;
  drinkingTicks: number;
  cowsAtTrough: number;
  lastSatisfiedDayKey: string;
};

export type SaleConvoyPhase =
  | "gather"
  | "drive_yard"
  | "kraal"
  | "crush"
  | "ramp"
  | "loading"
  | "truck_depart"
  | "done";

export type SaleConvoyState = {
  stockClass: StockClass;
  count: number;
  channel: SaleChannel;
  quoted: SaleLine;
  phase: SaleConvoyPhase;
  phaseProgress: number;
  paid: boolean;
  herder: "farmer" | "piet";
  toCampId: number;
  driveStarted?: boolean;
};

export type BakkieRunState = {
  active: boolean;
  job: WorkJobId | null;
  progress: number;
  dieselLitres: number;
  fromTile: TilePoint | null;
  toTile: TilePoint | null;
};
