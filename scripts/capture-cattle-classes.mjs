import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts";

function waitForServer(url, timeoutMs = 45000) {
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
      else setTimeout(tick, 250);
    };
    tick();
  });
}

async function ready(page) {
  await page.goto("http://127.0.0.1:4173/?capture=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.selectHerd);
  await page.waitForTimeout(300);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  try {
    await waitForServer("http://127.0.0.1:4173/?capture=1");
    const browser = await chromium.launch();
    const shots = [];

    async function capture(viewport, tag) {
      const page = await browser.newPage({ viewport });
      await ready(page);
      await page.evaluate(() => {
        window.__farmCapture.selectHerd();
        window.__farmCapture.expandSheet();
      });
      await page.waitForTimeout(400);
      const herdName = `herd-card-${tag}.png`;
      await page.screenshot({ path: path.join(outDir, herdName), fullPage: false });
      shots.push(herdName);
      await page.evaluate(() => window.__farmCapture.openMarket());
      await page.waitForTimeout(400);
      const marketName = `sell-flow-${tag}.png`;
      await page.screenshot({ path: path.join(outDir, marketName), fullPage: false });
      shots.push(marketName);
      await page.close();
    }

    await capture({ width: 1280, height: 800 }, "desktop-1280x800");
    await capture({ width: 390, height: 844 }, "mobile-390x844");

    const tutorialPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await tutorialPage.goto("http://127.0.0.1:4173/?capture=1&flowCapture=tutorial", {
      waitUntil: "networkidle",
    });
    await tutorialPage.waitForFunction(() => window.__farmCapture?.showTutorialStep1);
    await tutorialPage.evaluate(() => window.__farmCapture.showTutorialStep1());
    await tutorialPage.waitForTimeout(450);
    const tutorialName = "tutorial-tip-mobile-390x844.png";
    await tutorialPage.screenshot({ path: path.join(outDir, tutorialName), fullPage: false });
    shots.push(tutorialName);
    await tutorialPage.close();

    await browser.close();
    console.log(JSON.stringify({ outDir, shots }, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
