import type { GameState } from "../sim/types";
import { LEGACY_SAVE_KEY, LEGACY_SINGLE_V2_KEY } from "../sim/saveKeys";
import { migrateState, parseLegacySaved } from "../sim/stateMigrate";
import type { FlowMeta } from "./types";
import { defaultFlowMeta } from "./metaDefaults";

export const SAVE_FORMAT_VERSION = 3;
export const SLOT_COUNT = 3;
const SLOT_PREFIX = "farming-game-slot-";
const ACTIVE_SLOT_KEY = "farming-game-active-slot";

export type SavedSlotPayload = {
  version: typeof SAVE_FORMAT_VERSION;
  savedAt: string;
  slotId: number;
  meta: FlowMeta;
  state: GameState;
};

export type SlotSummary = {
  slotId: number;
  occupied: boolean;
  savedAt: string | null;
  farmName: string | null;
  dateLabel: string | null;
};

function slotKey(slotId: number): string {
  return `${SLOT_PREFIX}${slotId}`;
}

export function getActiveSlotId(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
  const id = raw ? Number(raw) : 0;
  return Number.isFinite(id) && id >= 0 && id < SLOT_COUNT ? id : 0;
}

export function setActiveSlotId(slotId: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
}

function migrateLegacySave(): SavedSlotPayload | null {
  if (typeof localStorage === "undefined") return null;
  const keys = [LEGACY_SINGLE_V2_KEY, LEGACY_SAVE_KEY];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const state = parseLegacySaved(raw);
    if (!state) continue;
    const payload: SavedSlotPayload = {
      version: SAVE_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      slotId: 0,
      meta: defaultFlowMeta(),
      state,
    };
    writeSlot(0, payload);
    localStorage.removeItem(key);
    if (key === LEGACY_SAVE_KEY) localStorage.removeItem(LEGACY_SINGLE_V2_KEY);
    return payload;
  }
  return null;
}

export function anySlotOccupied(): boolean {
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    if (typeof localStorage !== "undefined" && localStorage.getItem(slotKey(i))) return true;
  }
  if (typeof localStorage === "undefined") return false;
  return Boolean(localStorage.getItem(LEGACY_SINGLE_V2_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
}

export function parseSlotPayload(raw: string): SavedSlotPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<SavedSlotPayload> & { version?: number; state?: GameState };
    if (data.version === 1 as number) {
      const state = data.state;
      if (!state) return null;
      return {
        version: SAVE_FORMAT_VERSION,
        savedAt: (data as { savedAt?: string }).savedAt ?? new Date().toISOString(),
        slotId: 0,
        meta: defaultFlowMeta(),
        state,
      };
    }
    if (data.version !== SAVE_FORMAT_VERSION || !data.state || !data.meta) return null;
    if (!data.meta.tutorial || !data.meta.milestones) return null;
    data.state = migrateState(data.state);
    return data as SavedSlotPayload;
  } catch {
    return null;
  }
}

export function readSlot(slotId: number): SavedSlotPayload | null {
  if (typeof localStorage === "undefined") return null;
  if (slotId === 0) {
    const migrated = migrateLegacySave();
    if (migrated) return migrated;
  }
  const raw = localStorage.getItem(slotKey(slotId));
  if (!raw) return null;
  return parseSlotPayload(raw);
}

export function writeSlot(slotId: number, payload: SavedSlotPayload): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(slotKey(slotId), JSON.stringify({ ...payload, slotId }));
  setActiveSlotId(slotId);
}

export function clearSlot(slotId: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(slotKey(slotId));
}

export function listSlotSummaries(): SlotSummary[] {
  const out: SlotSummary[] = [];
  for (let slotId = 0; slotId < SLOT_COUNT; slotId += 1) {
    const slot = readSlot(slotId);
    out.push({
      slotId,
      occupied: Boolean(slot),
      savedAt: slot?.savedAt ?? null,
      farmName: slot ? "Your farm" : null,
      dateLabel: slot
        ? `${slot.state.date.day}/${slot.state.date.month}/${slot.state.date.year}`
        : null,
    });
  }
  return out;
}

export function serializeSlot(slotId: number, meta: FlowMeta, state: GameState): string {
  const payload: SavedSlotPayload = {
    version: SAVE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    slotId,
    meta,
    state,
  };
  return JSON.stringify(payload);
}
