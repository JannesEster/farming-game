import type { CalendarDate, HerderId, TilePoint } from "./types";

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
  /** Walk home after a drive. The herd has already arrived. */
  returnWalk?: { path: TilePoint[]; progress: number; distanceKm: number; who: HerderId } | null;
  /** Cattle drift out from the gate over the next couple of game hours. */
  grazeIn?: { campId: number; startedHour: number } | null;
  dailyPlay?: DailyPlayState;
  pendingPlayerEvent?: PendingPlayerEvent | null;
  monthDiary?: string[];
  drinkingTrip?: DrinkingTripState;
  saleConvoy?: SaleConvoyState | null;
  bakkieRun?: BakkieRunState;
  /** Visible bakkie trips this month (feeds diesel accounting hooks). */
  bakkieDieselLitresMonth?: number;
  /** One record per head. Missing on older saves until migration. */
  animals?: AnimalRecord[];
  /** Next ear tag to hand out. */
  nextAnimalTag?: number;
  /** Animals the player has tapped or filtered. */
  selectedAnimalIds?: string[];
  /** Animal shown on the detail card. */
  focusedAnimalId?: string | null;
  /** Separate a few animals and drive them. Null when idle. */
  cutOut?: CutOutOrder | null;
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
  /** Set when a cut-out group is sold. Each line is one class. */
  lines?: SaleLine[];
  /** Animals loaded on this truck. Removed when the truck is paid. */
  animalIds?: string[];
  phase: SaleConvoyPhase;
  phaseProgress: number;
  paid: boolean;
  herder: "farmer" | "piet";
  toCampId: number;
  driveStarted?: boolean;
};

export type AnimalWhereabouts = "in_camp" | "escaped" | "neighbour" | "cut_out" | "sold";

export type AnimalRecord = {
  /** Internal. Never show this in player text. */
  id: string;
  /** Ear tag the player sees, for example 142. */
  tag: string;
  stockClass: StockClass;
  weightKg: number;
  condition: number;
  campId: number;
  whereabouts: AnimalWhereabouts;
  tileX: number;
  tileY: number;
  /** 0 to 7, screen facing while moving. */
  facing: number;
  activity: "idle" | "graze" | "walk";
  escapeHours: number;
  escapeReason: "broken_fence" | "open_gate" | null;
  neighbourCharged: boolean;
  /** True once this animal has been driven to a different camp from the main herd. */
  split: boolean;
};

export type CutOutDestination = { kind: "camp"; campId: number } | { kind: "kraal" };

export type CutOutPhase = "queued" | "approach" | "drive" | "done";

export type CutOutOrder = {
  animalIds: string[];
  destination: CutOutDestination;
  channel: SaleChannel | null;
  herder: "farmer" | "piet" | null;
  phase: CutOutPhase;
  queueReason?: "night" | "no_herder";
  path: TilePoint[];
  approachPath?: TilePoint[];
  approachKm?: number;
  progress: number;
  approachProgress: number;
  distanceKm: number;
  walkGameHours: number;
  hoursApplied: number;
};

export type BakkieRunState = {
  active: boolean;
  job: WorkJobId | null;
  progress: number;
  dieselLitres: number;
  fromTile: TilePoint | null;
  toTile: TilePoint | null;
};
