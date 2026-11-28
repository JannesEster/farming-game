import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/batch1-year");

const MODES = ["storm", "rainbook", "wet", "flush", "dry", "contrast", "may", "rest", "season", "drought"];

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

async function shot(page, mode) {
  const result = await page.evaluate((name) => window.__farmCapture?.prepareYearFeelCapture?.(name), mode);
  if (!result?.ok) throw new Error(`${mode} capture failed: ${JSON.stringify(result)}`);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(280);
  return result;
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
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", {
        waitUntil: "networkidle",
      });
      await page.waitForFunction(() => window.__farmCapture?.prepareYearFeelCapture);
      await page.evaluate(() => {
        window.__farmCapture?.prepareForScreenshot?.();
        window.__flowCapture?.skipTutorialForCapture?.();
      });
      await page.waitForTimeout(400);
      for (const level of ["close", "mid", "far"]) {
        const zoomShot = await page.evaluate((name) => window.__farmCapture?.prepareZoomReadCapture?.(name), level);
        if (!zoomShot?.ok) throw new Error(`${viewport.name} zoom ${level} failed: ${JSON.stringify(zoomShot)}`);
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            }),
        );
        await page.waitForTimeout(350);
        const file = path.join(outDir, `zoom-${viewport.name}-${level}.png`);
        await page.screenshot({ path: file });
        console.log(`${viewport.name}-zoom-${level}: zoom=${Number(zoomShot.zoom).toFixed(4)}`);
      }
      for (const mode of MODES) {
        const result = await shot(page, mode);
        const file = path.join(outDir, `${viewport.name}-${mode}.png`);
        await page.screenshot({ path: file });
        const text = await page.evaluate(() => ({
          year: document.getElementById("year-line")?.textContent ?? "",
          rain: document.getElementById("stat-rain")?.textContent ?? "",
          book: document.getElementById("rain-book")?.hidden === false,
          yesterday: document.getElementById("rain-book-yesterday")?.textContent ?? "",
          reading: document.getElementById("reading-card")?.hidden === false,
          readingTitle: document.getElementById("reading-title")?.textContent ?? "",
          readingBody: document.getElementById("reading-body")?.textContent ?? "",
          eventHidden: document.getElementById("event-card")?.hidden !== false,
        }));
        if (mode === "storm" && !/Storm today/.test(text.year)) {
          throw new Error(`${viewport.name} storm year line: ${text.year}`);
        }
        if (mode === "rainbook" && (!text.book || !/Yesterday/.test(text.yesterday))) {
          throw new Error(`${viewport.name} rain book: ${JSON.stringify(text)}`);
        }
        if (mode === "dry" && (!/Late dry/.test(text.year) || !/No rain since/.test(text.year))) {
          throw new Error(`${viewport.name} dry year line: ${text.year}`);
        }
        if (mode === "season" && !/First storms/.test(text.year)) {
          throw new Error(`${viewport.name} season year line: ${text.year}`);
        }
        if (mode === "may" && (!text.reading || !/3 percent/.test(text.readingBody))) {
          throw new Error(`${viewport.name} May card: ${text.readingBody}`);
        }
        if (mode === "rest" && (!text.reading || !/six weeks/.test(text.readingBody))) {
          throw new Error(`${viewport.name} rest card: ${text.readingBody}`);
        }
        if (mode === "drought" && (!text.reading || !text.eventHidden || !/days of grass/.test(text.readingBody))) {
          throw new Error(`${viewport.name} drought letter: ${JSON.stringify(text)}`);
        }
        console.log(`${viewport.name}-${mode}: ${result.line}`);
      }
      await page.close();
    }
    await browser.close();
  } finally {
    preview.kill("SIGTERM");
  }
  console.log("Saved year screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
