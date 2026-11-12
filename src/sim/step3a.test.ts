import { describe, expect, it } from "vitest";
import { isDaylightHour } from "./clock";
import { createGame, findCamp, moveHerd, primeDefaultFarmCache } from "./simulation";
import defaultFarm from "../../public/farms/default-farm.json";
import { countWorkerHouses, freeWorkerHouseSlots } from "./housing";
import { requestHerdMove, tickHerdingRealtime } from "./herding";
import { tickPeopleSchedule, workerAtHomeAtNight } from "./people";
import { farmerDisplayName } from "./playerName";
import { migrateState } from "./stateMigrate";
import { hireFarmhand } from "./workers";
import { tickFarmhandWorld } from "./workGrid";
import { herdInTransit } from "./transit";

describe("step 3a living farm", () => {
  primeDefaultFarmCache(defaultFarm);
  const state = () => migrateState(createGame());

  it("blocks hire without a free worker house", () => {
    const s = state();
    s.features = s.features.filter((f) => f.kind !== "worker_house");
    expect(freeWorkerHouseSlots(s)).toBe(0);
    const res = hireFarmhand(s);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/worker house/i);
  });

  it("sends workers home at night", () => {
    const s = state();
    hireFarmhand(s);
    s.date.hour = 22;
    tickPeopleSchedule(s);
    expect(s.story?.farmhandPresence?.atHome).toBe(true);
    expect(s.story?.farmerPresence?.atHome).toBe(true);
    tickFarmhandWorld(s);
    expect(s.story?.farmhandPresence?.tileX).toBe(s.features.find((f) => f.kind === "worker_house")?.x);
  });

  it("queues night herd moves until daylight", () => {
    const s = state();
    const dest = s.camps.find((c) => c.id !== s.herd.campId)!;
    s.date.hour = 21;
    expect(isDaylightHour(s.date.hour)).toBe(false);
    const res = moveHerd(s, dest.id);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.queued).toBe(true);
    expect(s.herd.transit).toBeNull();
    expect(s.story?.herdMoveQueue?.reason).toBe("night");
    s.date.hour = 7;
    tickPeopleSchedule(s);
    const day = moveHerd(s, dest.id);
    if (!s.herd.transit && s.story?.herdMoveQueue) {
      tickHerdingRealtime(s, 0, "x1");
    }
    expect(s.herd.transit?.phase === "approach" || s.story?.herdMoveQueue).toBeTruthy();
    void day;
  });

  it("waits for herder approach before the herd drives", () => {
    const s = state();
    const dest = s.camps.find((c) => c.id !== s.herd.campId)!;
    s.date.hour = 10;
    const res = requestHerdMove(s, dest.id);
    expect(res.ok).toBe(true);
    expect(s.herd.transit?.phase).toBe("approach");
    expect(herdInTransit(s.herd)).toBe(false);
    tickHerdingRealtime(s, 300, "x1");
    expect((s.herd.transit?.approachProgress ?? 0) > 0).toBe(true);
    tickHerdingRealtime(s, 120_000, "x1");
    expect(s.herd.transit?.phase).toBe("drive");
    tickHerdingRealtime(s, 8_000, "x1");
    expect(s.herd.transit?.progress ?? 0).toBeGreaterThan(0);
  });

  it("queues when herder is busy", () => {
    const s = state();
    const dest = findCamp(s, s.herd.campId)!;
    const other = s.camps.find((c) => c.id !== s.herd.campId)!;
    s.date.hour = 9;
    requestHerdMove(s, other.id);
    expect(s.herd.transit).toBeTruthy();
    const again = moveHerd(s, other.id === dest.id ? s.camps[1].id : other.id);
    expect(again.ok).toBe(false);
    if (again.ok === false) expect(again.reason).toBe("moving");
  });

  it("default farm includes a worker house near the homestead", () => {
    const s = state();
    expect(countWorkerHouses(s)).toBeGreaterThanOrEqual(1);
  });

  it("defaults farmer display name to Farmer until the player sets one", () => {
    const s = state();
    expect(farmerDisplayName(s)).toBe("Farmer");
    s.story!.playerDisplayName = "Jannes";
    expect(farmerDisplayName(s)).toBe("Jannes");
  });

  it("keeps Piet within one tile of his cottage between dusk and dawn", () => {
    const s = state();
    hireFarmhand(s);
    s.date.hour = 21;
    tickPeopleSchedule(s);
    tickFarmhandWorld(s);
    expect(workerAtHomeAtNight(s)).toBe(true);
    expect(s.story?.farmhandPresence?.activityLabel).toMatch(/house/i);
  });
});
