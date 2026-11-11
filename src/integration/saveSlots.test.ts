import { beforeEach, describe, expect, it } from "vitest";
import { createGame } from "../sim/simulation";
import { defaultFlowMeta } from "./metaDefaults";
import {
  SAVE_FORMAT_VERSION,
  clearSlot,
  parseSlotPayload,
  readSlot,
  serializeSlot,
  writeSlot,
} from "./saveSlots";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  const store = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
});

// Legacy key export from sim/persist
import { SAVE_KEY } from "../sim/persist";
const LEGACY = SAVE_KEY;

describe("save slots and migration", () => {
  it("round-trips slot v2 payload", () => {
    const state = createGame(1);
    const meta = defaultFlowMeta();
    const raw = serializeSlot(0, meta, state);
    const parsed = parseSlotPayload(raw);
    expect(parsed?.version).toBe(SAVE_FORMAT_VERSION);
    expect(parsed?.state.seed).toBe(state.seed);
    expect(parsed?.meta.farmYear).toBe(1);
  });

  it("migrates legacy single-key save into slot 0", () => {
    const state = createGame(5);
    memory.set(
      LEGACY,
      JSON.stringify({ version: 1, savedAt: "2026-01-01", state }),
    );
    const slot = readSlot(0);
    expect(slot?.state.seed).toBe(5);
    expect(memory.has(LEGACY)).toBe(false);
  });

  it("clears a slot", () => {
    const state = createGame(2);
    writeSlot(1, {
      version: SAVE_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      slotId: 1,
      meta: defaultFlowMeta(),
      state,
    });
    clearSlot(1);
    expect(readSlot(1)).toBeNull();
  });
});
