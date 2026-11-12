import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3a");

function waitForServer(url, timeoutMs = 60000) {
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
  const unique = new Set(values);
  if (unique.size !== values.length) {
    const dupes = Object.entries(hashes)
      .filter(([, h], _i, arr) => arr.filter(([, hh]) => hh === h).length > 1)
      .map(([name]) => name);
    throw new Error(`${label}: screenshots not distinct (duplicate: ${dupes.join(", ")})`);
  }
}

async function prepPage(page) {
  await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__farmCapture?.sampleFps);
  await page.evaluate(() => {
    window.__farmCapture?.prepareForScreenshot?.();
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
  });
  await page.waitForTimeout(600);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  const preview = spawn("npm", ["run", "preview"], { cwd: repoRoot, stdio: "ignore" });
  const checks = [];
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await prepPage(page);
      const hashes = {};

      const farmerOk = await page.evaluate(() => window.__farmCapture?.frameFarmerAtHouse?.());
      if (!farmerOk) throw new Error(`${viewport.name}: farmer-house frame failed (worker house visibility?)`);
      await page.waitForTimeout(400);
      const farmerMeta = await page.evaluate(() => ({
        inView: window.__farmCapture?.countFarmerInView?.() ?? 0,
        heightPx: window.__farmCapture?.farmerScreenHeightPx?.() ?? 0,
        workerHouse: window.__farmCapture?.workerCottageSpriteBoundsInView?.() ?? false,
      }));
      if (farmerMeta.inView < 1) throw new Error(`${viewport.name}: farmer not in view`);
      if (farmerMeta.heightPx < 30) {
        throw new Error(`${viewport.name}: farmer too small (${farmerMeta.heightPx.toFixed(1)}px)`);
      }
      if (!farmerMeta.workerHouse) throw new Error(`${viewport.name}: worker cottage not in farmer-house shot`);
      const farmerPath = path.join(outDir, `${viewport.name}-farmer-house.png`);
      await page.screenshot({ path: farmerPath });
      hashes.farmer = await fileHash(farmerPath);
      checks.push(`${viewport.name}-farmer-house: ${farmerMeta.heightPx.toFixed(0)}px tall`);

      const driveOk = await page.evaluate(() => window.__farmCapture?.prepareHerdDriveCapture?.());
      if (!driveOk) throw new Error(`${viewport.name}: herd drive capture setup failed`);
      await page.waitForTimeout(500);
      const driveMeta = await page.evaluate(() => ({
        cattle: window.__farmCapture?.countCattleInView?.() ?? 0,
        herder: (window.__farmCapture?.countFarmerInView?.() ?? 0) + (window.__farmCapture?.countFarmhandInView?.() ?? 0),
        herderPx: window.__farmCapture?.herderHerdScreenDistancePx?.() ?? 9999,
        herderBehind: window.__farmCapture?.herderBehindHerdOnDrive?.() ?? false,
      }));
      if (driveMeta.cattle < 1 || driveMeta.herder < 1) {
        throw new Error(`${viewport.name}: herd drive needs herd and herder in view`);
      }
      if (driveMeta.herderPx > 80) {
        throw new Error(`${viewport.name}: herder too far from herd (${driveMeta.herderPx.toFixed(1)}px)`);
      }
      if (!driveMeta.herderBehind) throw new Error(`${viewport.name}: herder must trail behind the herd tail`);
      const drivePath = path.join(outDir, `${viewport.name}-herd-drive-gate.png`);
      await page.screenshot({ path: drivePath });
      hashes.drive = await fileHash(drivePath);
      checks.push(`${viewport.name}-herd-drive-gate: cattle ${driveMeta.cattle}, herder ${driveMeta.herder}`);

      await prepPage(page);
      const nightOk = await page.evaluate(() => window.__farmCapture?.prepareNightWorkersHomeCapture?.());
      if (!nightOk) throw new Error(`${viewport.name}: night workers capture setup failed`);
      await page.waitForTimeout(400);
      const nightMeta = await page.evaluate(() => ({
        piet: window.__farmCapture?.countFarmhandInView?.() ?? 0,
        ...window.__farmCapture?.nightWorkersCaptureMeta?.(),
      }));
      if (nightMeta.piet < 1) throw new Error(`${viewport.name}: Piet not visible at night`);
      if (!(nightMeta.hour >= 19 || nightMeta.hour <= 5)) {
        throw new Error(`${viewport.name}: HUD hour should be night (got ${nightMeta.hour})`);
      }
      if (!nightMeta.workerAtHome) throw new Error(`${viewport.name}: Piet not at cottage tile at night`);
      const cottageOnScreen = await page.evaluate(
        () => window.__farmCapture?.workerCottageSpriteBoundsInView?.() ?? false,
      );
      if (!nightMeta.workerHouseVisible || !cottageOnScreen) {
        throw new Error(`${viewport.name}: worker cottage sprite bounds not in night shot`);
      }
      const nightPath = path.join(outDir, `${viewport.name}-workers-night.png`);
      await page.screenshot({ path: nightPath });
      hashes.night = await fileHash(nightPath);
      checks.push(`${viewport.name}-workers-night: Piet at house`);

      if (viewport.name === "phone") {
        await prepPage(page);
        const topMeta = await page.evaluate(() => window.__farmCapture?.measureTopbarMetrics?.());
        if (!topMeta) throw new Error("phone top bar metrics missing");
        if (!topMeta.textOverflowOk) {
          throw new Error(`phone top bar text overflow: ${topMeta.textOverflowOffenders?.join(", ")}`);
        }
        const topPath = path.join(outDir, `${viewport.name}-topbar.png`);
        const topbarH = Math.max(56, Math.ceil(topMeta?.topbarPx ?? 56));
        await page.screenshot({ path: topPath, clip: { x: 0, y: 0, width: 390, height: topbarH } });
        hashes.topbar = await fileHash(topPath);
        checks.push(`phone top bar ${topMeta.topbarPx.toFixed(0)}px tall, no text overflow`);
      }

      await prepPage(page);
      await page.evaluate(() => window.__farmCapture?.prepareHireBlockedCapture?.());
      await page.waitForSelector("#ops-hire-btn:disabled", { state: "visible" });
      const hirePath = path.join(outDir, `${viewport.name}-hire-blocked.png`);
      await page.screenshot({ path: hirePath });
      hashes.hire = await fileHash(hirePath);
      checks.push(`${viewport.name}-hire-blocked: no worker house`);

      assertDistinct(hashes, viewport.name);
      await page.close();
    }
    await browser.close();
  } finally {
    preview.kill("SIGTERM");
  }
  console.log("Capture checks passed:\n" + checks.map((line) => `  - ${line}`).join("\n"));
  console.log("Saved step3a screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
