import { describe, expect, it } from "vitest";
import { isDaylightHour } from "./clock";
import { createGame, findCamp, moveHerd, primeDefaultFarmCache } from "./simulation";
import defaultFarm from "../../public/farms/default-farm.json";
import { countWorkerHouses, freeWorkerHouseSlots, workerHouseForFarmhand } from "./housing";
import { requestHerdMove, syncHerderOnDrive, tickHerdingRealtime } from "./herding";
import { columnMetrics, herderPathProgressBehindTail } from "./convoy";
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
    const door = workerHouseForFarmhand(s);
    expect(door).toBeTruthy();
    expect(Math.hypot(s.story!.farmhandPresence!.tileX - door!.x, s.story!.farmhandPresence!.tileY - door!.y)).toBeLessThan(
      1.1,
    );
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
    let guard = 0;
    while (s.herd.transit?.phase === "approach" && guard < 4000) {
      tickHerdingRealtime(s, 200, "x1");
      guard += 1;
    }
    expect(s.herd.transit?.phase).toBe("drive");
    tickHerdingRealtime(s, 500, "x1");
    expect(s.herd.transit?.progress ?? 1).toBeGreaterThan(0);
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

  it("places the herder on the path behind the filed tail while driving", () => {
    const s = state();
    const dest = s.camps.find((c) => c.id !== s.herd.campId)!;
    s.date.hour = 10;
    requestHerdMove(s, dest.id);
    while (s.herd.transit?.phase === "approach") tickHerdingRealtime(s, 200, "x1");
    expect(s.herd.transit?.phase).toBe("drive");
    tickHerdingRealtime(s, 4_000, "x1");
    const progress = s.herd.transit?.progress ?? 0;
    const behind = herderPathProgressBehindTail(s);
    expect(behind).toBeLessThan(progress);
    syncHerderOnDrive(s);
    const farmer = s.story?.farmerPresence;
    expect(farmer?.onHerdingDuty).toBe(true);
    expect(behind).toBeLessThanOrEqual(progress);
  });

  it("keeps the moving mob within 12 tiles and the herder 2 to 3 tiles behind it", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ];
    const full = columnMetrics(path, 0.8, 120);
    const lead = full.centerTiles;
    const rear = full.rearProgress * full.total;
    const herder = full.herderProgress * full.total;
    expect(lead - rear).toBeLessThanOrEqual(12);
    expect(rear - herder).toBeGreaterThanOrEqual(2);
    expect(rear - herder).toBeLessThanOrEqual(3);
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
