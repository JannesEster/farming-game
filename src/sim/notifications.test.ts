import { describe, expect, it } from "vitest";
import { defaultNotificationState, emitNotification } from "./notifications";

describe("notifications", () => {
  const at = { year: 2026, month: 8, day: 2, hour: 9 };

  it("dedupes same day with cooldown", () => {
    const state = defaultNotificationState();
    const first = emitNotification(state, {
      id: "a1",
      tier: "letter",
      kind: "drought_watch",
      title: "Late rains",
      body: "Dry start",
      priority: 1,
      at,
      cooldownDays: 3,
      dedupeKey: "drought_watch",
    });
    const second = emitNotification(state, {
      id: "a2",
      tier: "letter",
      kind: "drought_watch",
      title: "Late rains",
      body: "Still dry",
      priority: 1,
      at,
      cooldownDays: 3,
      dedupeKey: "drought_watch",
    });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(state.log.length).toBe(1);
  });
});
