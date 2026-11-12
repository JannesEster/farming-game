import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3b");

function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) reject(new Error(`Server not ready: ${url}`));
      else setTimeout(tick, 300);
    };
    tick();
  });
}

async function fileHash(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function assertDistinct(hashes, label) {
  const values = Object.values(hashes);
  if (new Set(values).size !== values.length) {
    throw new Error(`${label}: screenshots not distinct`);
  }
}

async function spriteHeightOk(page, needle) {
  return page.evaluate((n) => {
    const h = window.__farmCapture?.maxPropTextureHeightInView?.(n) ?? 0;
    return { ok: h >= 20, maxH: h };
  }, needle);
}

async function prepPage(page, query = "capture=1&farm=default") {
  await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.sampleFps);
  await page.evaluate(() => {
    window.__farmCapture?.prepareForScreenshot?.();
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
  });
  await page.waitForTimeout(500);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  const preview = spawn("npm", ["run", "preview"], { cwd: repoRoot, stdio: "ignore" });
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    const allHashes = {};
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await prepPage(page);
      const hashes = {};

      const drinkOk = await page.evaluate(() => window.__farmCapture?.prepareDrinkingCapture?.());
      await page.waitForTimeout(400);
      const drinkAudit = await page.evaluate(() => ({
        windmill: window.__farmCapture.auditKind("windmill"),
        reservoir: window.__farmCapture.auditKind("reservoir"),
        trough: window.__farmCapture.auditKind("trough"),
        lick: window.__farmCapture.auditKind("lick_feeder"),
        drinks: window.__farmCapture.drinkCowsNearTrough(),
      }));
      for (const kind of ["windmill", "reservoir", "trough", "lick"]) {
        const row = drinkAudit[kind];
        if (!drinkOk || row.inView < 1 || row.maxScreenPx < 20) {
          throw new Error(`${viewport.name}: ${kind} not in drinking shot ${JSON.stringify(row)}`);
        }
      }
      if (drinkAudit.drinks < 3) {
        const why = await page.evaluate(() => window.__farmCapture.drinkDebug?.() ?? null);
        throw new Error(`${viewport.name}: expected 3 drinking cows, got ${drinkAudit.drinks} ${JSON.stringify(why)}`);
      }
      const drinkPath = path.join(outDir, `${viewport.name}-cows-drinking-windmill.png`);
      await page.screenshot({ path: drinkPath });
      hashes.drink = await fileHash(drinkPath);

      const noWaterOk = await page.evaluate(() => window.__farmCapture?.prepareNoWaterCampCapture?.());
      if (!noWaterOk) throw new Error(`${viewport.name}: no-water label missing`);
      await page.waitForTimeout(300);
      const noWaterPath = path.join(outDir, `${viewport.name}-camp-no-water.png`);
      await page.screenshot({ path: noWaterPath });
      hashes.noWater = await fileHash(noWaterPath);

      const kraalOk = await page.evaluate(() => window.__farmCapture?.prepareSaleKraalCapture?.());
      await page.waitForTimeout(400);
      const kraalAudit = await page.evaluate(() => ({
        kraal: window.__farmCapture.auditKind("kraal"),
        crush: window.__farmCapture.auditKind("crush"),
        ramp: window.__farmCapture.auditKind("loading_ramp"),
        truck: window.__farmCapture.auditKind("cattle_truck"),
        cattle: window.__farmCapture.countCattleInView(),
      }));
      for (const kind of ["kraal", "crush", "ramp", "truck"]) {
        const row = kraalAudit[kind];
        if (!kraalOk || row.inView < 1 || row.maxScreenPx < 20) {
          throw new Error(`${viewport.name}: ${kind} missing at kraal ${JSON.stringify(kraalAudit)}`);
        }
      }
      if (kraalAudit.cattle < 3) throw new Error(`${viewport.name}: herd not in kraal view`);
      const kraalPath = path.join(outDir, `${viewport.name}-herd-kraal-truck.png`);
      await page.screenshot({ path: kraalPath });
      hashes.kraal = await fileHash(kraalPath);

      const leaveOk = await page.evaluate(() => window.__farmCapture?.prepareTruckLeavingCapture?.());
      await page.waitForTimeout(300);
      const truckMeta = await page.evaluate(() => window.__farmCapture.truckOnRoad());
      if (!leaveOk || truckMeta.awayTiles < 4 || truckMeta.screenPx < 20) {
        throw new Error(`${viewport.name}: truck not on the road ${JSON.stringify(truckMeta)}`);
      }
      const truckPath = path.join(outDir, `${viewport.name}-truck-departing.png`);
      await page.screenshot({ path: truckPath });
      hashes.truck = await fileHash(truckPath);

      const bakkieOk = await page.evaluate(() => window.__farmCapture?.prepareBakkieDustCapture?.());
      await page.waitForTimeout(300);
      const bakkieMeta = await page.evaluate(() => window.__farmCapture.bakkieOnTrack());
      if (!bakkieOk || bakkieMeta.tilesFromHouse < 4 || bakkieMeta.screenPx < 20 || !bakkieMeta.dust) {
        throw new Error(`${viewport.name}: bakkie not driving ${JSON.stringify(bakkieMeta)}`);
      }
      const bakkiePath = path.join(outDir, `${viewport.name}-bakkie-dust.png`);
      await page.screenshot({ path: bakkiePath });
      hashes.bakkie = await fileHash(bakkiePath);

      const cottageOk = await page.evaluate(() => window.__farmCapture?.frameFarmerAtHouse?.());
      await page.waitForTimeout(200);
      const cottageAudit = await page.evaluate(() => ({
        onYard: window.__farmCapture.cottageOnYard(),
        house: window.__farmCapture.auditKind("worker_house"),
      }));
      if (!cottageOk || !cottageAudit.onYard || cottageAudit.house.inView < 1 || cottageAudit.house.maxScreenPx < 20) {
        throw new Error(`${viewport.name}: cottage not on the yard ${JSON.stringify(cottageAudit)}`);
      }
      await page.waitForTimeout(300);
      const pietPath = path.join(outDir, `${viewport.name}-piet-cottage-yard.png`);
      await page.screenshot({ path: pietPath });
      hashes.piet = await fileHash(pietPath);

      if (viewport.name === "desktop") {
        await prepPage(page, "capture=1&offer=otjozondjupa-ranch");
        const pickerOk = await page.evaluate(() => window.__farmCapture?.preparePickerWaterCapture?.());
        await page.waitForTimeout(400);
        const pickerAudit = await page.evaluate(() => ({
          windmill: window.__farmCapture.auditKind("windmill"),
          solar: window.__farmCapture.auditKind("solar_pump"),
          reservoir: window.__farmCapture.auditKind("reservoir"),
          trough: window.__farmCapture.auditKind("trough"),
          drinks: window.__farmCapture.drinkCowsNearTrough(),
        }));
        const pump = Math.max(pickerAudit.windmill.inView, pickerAudit.solar.inView);
        const pumpPx = Math.max(pickerAudit.windmill.maxScreenPx, pickerAudit.solar.maxScreenPx);
        if (!pickerOk || pump < 1 || pumpPx < 20 || pickerAudit.reservoir.inView < 1 || pickerAudit.reservoir.maxScreenPx < 20) {
          throw new Error(`desktop: picker water not in view ${JSON.stringify(pickerAudit)}`);
        }
        if (pickerAudit.trough.inView < 1 || pickerAudit.trough.maxScreenPx < 20 || pickerAudit.drinks < 3) {
          throw new Error(`desktop: picker trough or cows missing ${JSON.stringify(pickerAudit)}`);
        }
        const pickerPath = path.join(outDir, "desktop-picker-farm-water.png");
        await page.screenshot({ path: pickerPath });
        hashes.picker = await fileHash(pickerPath);
      }

      assertDistinct(hashes, viewport.name);
      Object.assign(allHashes, Object.fromEntries(Object.entries(hashes).map(([k, v]) => [`${viewport.name}-${k}`, v])));
    }
    await browser.close();
    console.log("step3b captures ok", Object.keys(allHashes).length, "files");
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
