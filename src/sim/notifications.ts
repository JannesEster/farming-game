import type { CalendarDate } from "./types";

export type NotificationTier = "critical" | "letter" | "message" | "alert";

export type NotificationKind =
  | "starvation_critical"
  | "drought_choice"
  | "death_risk"
  | "drought_watch"
  | "feed_warning"
  | "move_warning"
  | "water_warning"
  | "month_summary"
  | "season"
  | "weekly"
  | "camp_worn"
  | "generic";

export type NotificationItem = {
  id: string;
  tier: NotificationTier;
  kind: NotificationKind;
  title: string;
  body: string;
  priority: number;
  at: CalendarDate;
  read: boolean;
};

export type AlertEntry = {
  key: string;
  label: string;
  count: number;
};

export type NotificationState = {
  log: NotificationItem[];
  letters: NotificationItem[];
  alerts: AlertEntry[];
  /** Cooldown: kind -> last fired day key */
  lastFiredDayKey: Record<string, string>;
};

export const NOTIFICATION_LOG_CAP = 200;

const CRITICAL_KINDS = new Set<NotificationKind>([
  "starvation_critical",
  "drought_choice",
  "death_risk",
]);

export function defaultNotificationState(): NotificationState {
  return { log: [], letters: [], alerts: [], lastFiredDayKey: {} };
}

function dayKey(date: CalendarDate): string {
  return `${date.year}-${date.month}-${date.day}`;
}

type EmitInput = {
  id: string;
  tier: NotificationTier;
  kind: NotificationKind;
  title: string;
  body: string;
  priority: number;
  at: CalendarDate;
  /** Minimum whole game days before the same kind can fire again. */
  cooldownDays?: number;
  dedupeKey?: string;
  alertKey?: string;
  alertLabel?: string;
};

function pushLog(state: NotificationState, item: NotificationItem): void {
  state.log.unshift(item);
  if (state.log.length > NOTIFICATION_LOG_CAP) {
    state.log.length = NOTIFICATION_LOG_CAP;
  }
}

/**
 * Per type cooldown and dedupe. Returns the item when it was queued, or null when suppressed.
 */
export function emitNotification(
  state: NotificationState,
  input: EmitInput,
): NotificationItem | null {
  const dk = input.dedupeKey ?? input.kind;
  const today = dayKey(input.at);
  const last = state.lastFiredDayKey[dk];
  if (last && input.cooldownDays && input.cooldownDays > 0) {
    if (last === today) return null;
  }
  if (state.log.some((e) => e.id === input.id && !e.read)) return null;
  if (input.tier === "letter" && state.letters.some((e) => e.id === input.id)) return null;

  const item: NotificationItem = {
    id: input.id,
    tier: input.tier,
    kind: input.kind,
    title: input.title,
    body: input.body,
    priority: input.priority,
    at: { ...input.at },
    read: false,
  };

  state.lastFiredDayKey[dk] = today;
  pushLog(state, item);

  if (input.tier === "letter") {
    state.letters.unshift(item);
  }

  if (input.tier === "alert" && input.alertKey) {
    const existing = state.alerts.find((a) => a.key === input.alertKey);
    if (existing) existing.count += 1;
    else
      state.alerts.push({
        key: input.alertKey,
        label: input.alertLabel ?? input.title,
        count: 1,
      });
  }

  return item;
}

export function isCriticalKind(kind: NotificationKind): boolean {
  return CRITICAL_KINDS.has(kind);
}

export function readLetter(state: NotificationState, id: string): void {
  const letter = state.letters.find((l) => l.id === id);
  if (letter) letter.read = true;
  state.letters = state.letters.filter((l) => !l.read);
  const logItem = state.log.find((l) => l.id === id);
  if (logItem) logItem.read = true;
}

export function markAlertCleared(state: NotificationState, key: string): void {
  state.alerts = state.alerts.filter((a) => a.key !== key);
}

export function unreadLetterCount(state: NotificationState): number {
  return state.letters.length;
}
