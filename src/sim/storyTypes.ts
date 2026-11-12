import type { CalendarDate } from "./types";

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

export type FarmhandJob = "check_water" | "move_herd" | null;

export type FarmhandState = {
  hired: boolean;
  job: FarmhandJob;
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
  kind: "warning" | "summary" | "drought" | "weekly" | "season";
  title: string;
  body: string;
  priority: number;
};

export type StoryState = {
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
};

export type SellRequest = {
  stockClass: StockClass;
  count: number;
  channel: SaleChannel;
};
