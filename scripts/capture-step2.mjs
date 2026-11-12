import { mkdir } from "node:fs/promises";
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

      await page.evaluate(() => window.__farmCapture?.prepareFarmhandWalkCapture?.());
      await page.waitForTimeout(500);
      const farmhandOk = await page.evaluate(() => (window.__farmCapture?.countFarmhandInView?.() ?? 0) >= 1);
      if (!farmhandOk) throw new Error(`${viewport.name}: farmhand sprite not in camera view`);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-farmhand-walking.png`) });
      checks.push(`${viewport.name}-farmhand-walking: sprite in view`);

      await page.evaluate(() => window.__farmCapture?.openOps?.());
      await page.waitForSelector("#work-grid select", { state: "visible" });
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-work-grid.png`) });
      const gridRows = await page.locator(".work-grid-row").count();
      if (gridRows < 4) throw new Error(`${viewport.name}: work grid missing rows`);
      checks.push(`${viewport.name}-work-grid: ${gridRows} jobs`);

      await page.waitForSelector("#lever-lick", { state: "visible" });
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-lever-choices.png`) });
      checks.push(`${viewport.name}-lever-choices: levers visible`);

      await page.evaluate(() => window.__farmCapture?.queueDemoPlayerEvent?.());
      await page.waitForSelector("#ops-event-actions button", { state: "visible" });
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-player-event.png`) });
      const actionCount = await page.locator("#ops-event-actions button").count();
      if (actionCount < 2) throw new Error(`${viewport.name}: event actions missing`);
      checks.push(`${viewport.name}-player-event: ${actionCount} actions`);

      await page.evaluate(() => {
        document.getElementById("ops-sheet")?.setAttribute("hidden", "true");
        window.__farmCapture?.showMonthDiaryDemo?.();
      });
      await page.waitForSelector("#event-card:not([hidden])", { state: "visible" });
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-month-diary.png`) });
      const title = await page.textContent("#event-title");
      if (!title?.includes("Farm diary")) throw new Error(`${viewport.name}: month diary title wrong`);
      checks.push(`${viewport.name}-month-diary: ${title}`);

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
