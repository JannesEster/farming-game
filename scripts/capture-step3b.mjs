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

async function prepPage(page) {
  await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", { waitUntil: "networkidle" });
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

      await page.evaluate(() => window.__farmCapture?.prepareDrinkingCapture?.());
      await page.waitForTimeout(500);
      const drinkSprites = await spriteHeightOk(page, "windmill");
      if (!drinkSprites.ok) throw new Error(`${viewport.name}: windmill/trough too small (${drinkSprites.maxH}px)`);
      const drinkPath = path.join(outDir, `${viewport.name}-cows-drinking-windmill.png`);
      await page.screenshot({ path: drinkPath });
      hashes.drink = await fileHash(drinkPath);

      await page.evaluate(() => window.__farmCapture?.prepareNoWaterCampCapture?.());
      await page.waitForTimeout(400);
      const noWaterPath = path.join(outDir, `${viewport.name}-camp-no-water.png`);
      await page.screenshot({ path: noWaterPath });
      hashes.noWater = await fileHash(noWaterPath);

      await page.evaluate(() => window.__farmCapture?.prepareSaleKraalCapture?.());
      await page.waitForTimeout(500);
      const kraalSprites = await spriteHeightOk(page, "kraal");
      if (!kraalSprites.ok) throw new Error(`${viewport.name}: kraal/truck too small (${kraalSprites.maxH}px)`);
      const kraalPath = path.join(outDir, `${viewport.name}-herd-kraal-truck.png`);
      await page.screenshot({ path: kraalPath });
      hashes.kraal = await fileHash(kraalPath);

      await page.evaluate(() => window.__farmCapture?.prepareTruckLeavingCapture?.());
      await page.waitForTimeout(400);
      const truckPath = path.join(outDir, `${viewport.name}-truck-departing.png`);
      await page.screenshot({ path: truckPath });
      hashes.truck = await fileHash(truckPath);

      await page.evaluate(() => window.__farmCapture?.prepareBakkieDustCapture?.());
      await page.waitForTimeout(450);
      const bakkieSprites = await spriteHeightOk(page, "bakkie");
      if (!bakkieSprites.ok) throw new Error(`${viewport.name}: bakkie too small (${bakkieSprites.maxH}px)`);
      const bakkiePath = path.join(outDir, `${viewport.name}-bakkie-dust.png`);
      await page.screenshot({ path: bakkiePath });
      hashes.bakkie = await fileHash(bakkiePath);

      await page.evaluate(() => window.__farmCapture?.frameFarmerAtHouse?.());
      await page.waitForTimeout(400);
      const pietPath = path.join(outDir, `${viewport.name}-piet-cottage-yard.png`);
      await page.screenshot({ path: pietPath });
      hashes.piet = await fileHash(pietPath);

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
