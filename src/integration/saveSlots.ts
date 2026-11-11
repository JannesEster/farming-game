import type { GameState } from "../sim/types";
import { parseSaved as parseLegacyV1, SAVE_KEY as LEGACY_KEY } from "../sim/persist";
import type { FlowMeta } from "./types";
import { defaultFlowMeta } from "./metaDefaults";

export const SAVE_FORMAT_VERSION = 2;
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
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  const state = parseLegacyV1(raw);
  if (!state) return null;
  const payload: SavedSlotPayload = {
    version: SAVE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    slotId: 0,
    meta: defaultFlowMeta(),
    state,
  };
  writeSlot(0, payload);
  localStorage.removeItem(LEGACY_KEY);
  return payload;
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
