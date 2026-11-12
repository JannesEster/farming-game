import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step2");

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

      await page.evaluate(() => window.__farmCapture?.prepareFarmhandWalkCapture?.());
      await page.waitForTimeout(500);
      const farmMeta = await page.evaluate(() => ({
        inView: window.__farmCapture?.countFarmhandInView?.() ?? 0,
        heightPx: window.__farmCapture?.farmhandScreenHeightPx?.() ?? 0,
      }));
      if (farmMeta.inView < 1) throw new Error(`${viewport.name}: farmhand not in camera view`);
      if (farmMeta.heightPx < 30) {
        throw new Error(`${viewport.name}: farmhand too small (${farmMeta.heightPx.toFixed(1)}px, need >= 30)`);
      }
      const farmPath = path.join(outDir, `${viewport.name}-farmhand-walking.png`);
      await page.screenshot({ path: farmPath });
      hashes.farmhand = await fileHash(farmPath);
      checks.push(`${viewport.name}-farmhand-walking: ${farmMeta.heightPx.toFixed(0)}px tall`);

      await page.evaluate(() => {
        document.getElementById("ops-sheet")?.setAttribute("hidden", "true");
        window.__farmCapture?.openOpsWorkGridCapture?.();
      });
      await page.waitForSelector("#work-grid select", { state: "visible" });
      const gridPath = path.join(outDir, `${viewport.name}-work-grid.png`);
      await page.screenshot({ path: gridPath });
      hashes.grid = await fileHash(gridPath);
      checks.push(`${viewport.name}-work-grid: distinct capture`);

      await page.evaluate(() => window.__farmCapture?.openOpsLeversCapture?.());
      await page.waitForSelector("#ops-heading-levers", { state: "visible" });
      await page.evaluate(() => document.getElementById("ops-heading-levers")?.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(200);
      const leverPath = path.join(outDir, `${viewport.name}-lever-choices.png`);
      await page.screenshot({ path: leverPath });
      const leverHeading = await page.isVisible("#ops-heading-levers");
      const lickVisible = await page.isVisible("#lever-lick");
      if (!leverHeading || !lickVisible) throw new Error(`${viewport.name}: levers not in view`);
      hashes.levers = await fileHash(leverPath);
      checks.push(`${viewport.name}-lever-choices: cost levers scrolled in view`);

      await page.evaluate(() => window.__farmCapture?.queueDemoPlayerEvent?.());
      await page.waitForSelector("#ops-event-actions button", { state: "visible" });
      const eventTitle = await page.textContent("#ops-event-title");
      if (!eventTitle?.includes("Pump")) throw new Error(`${viewport.name}: pump event title missing`);
      const eventPath = path.join(outDir, `${viewport.name}-player-event.png`);
      await page.screenshot({ path: eventPath });
      const actionLabels = await page.locator("#ops-event-actions button").allTextContents();
      if (actionLabels.length < 2 || !actionLabels.some((t) => t.includes("N$"))) {
        throw new Error(`${viewport.name}: event actions with costs not shown`);
      }
      hashes.event = await fileHash(eventPath);
      checks.push(`${viewport.name}-player-event: ${actionLabels.join(" · ")}`);

      await page.evaluate(() => {
        document.getElementById("ops-sheet")?.setAttribute("hidden", "true");
        window.__farmCapture?.showMonthDiaryDemo?.();
      });
      await page.waitForSelector("#event-card:not([hidden])", { state: "visible" });
      const diaryPath = path.join(outDir, `${viewport.name}-month-diary.png`);
      await page.screenshot({ path: diaryPath });
      const title = await page.textContent("#event-title");
      if (!title?.includes("Farm diary")) throw new Error(`${viewport.name}: month diary title wrong`);
      hashes.diary = await fileHash(diaryPath);
      checks.push(`${viewport.name}-month-diary: ${title}`);

      assertDistinct(hashes, viewport.name);

      await page.close();
    }
    await browser.close();
  } finally {
    preview.kill("SIGTERM");
  }
  console.log("Capture checks passed:\n" + checks.map((line) => `  - ${line}`).join("\n"));
  console.log("Saved step2 screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
