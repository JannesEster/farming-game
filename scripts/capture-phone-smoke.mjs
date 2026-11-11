import { mkdir, writeFile } from "node:fs/promises";
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

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  return name;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  const report = { capturedAt: new Date().toISOString(), shots: [] };
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();

    const portrait = async (suffix, fn) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await fn(page);
      report.shots.push(await shot(page, `smoke-${suffix}-390x844.png`));
      await page.close();
    };

    const landscape = async (suffix, fn) => {
      const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
      await fn(page);
      report.shots.push(await shot(page, `smoke-${suffix}-844x390.png`));
      await page.close();
    };

    await portrait("01-start", async (page) => {
      await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-test="start-screen"]', { timeout: 15000 });
    });

    await portrait("02-picker", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=picker", { waitUntil: "networkidle" });
      await page.waitForSelector('[data-test="farm-picker"]', { timeout: 15000 });
    });

    await portrait("03-after-buy", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", {
        waitUntil: "networkidle",
      });
      await page.waitForFunction(() => window.__farmCapture?.measureChips, { timeout: 45000 });
      await page.waitForTimeout(300);
    });

    await portrait("04-tutorial-step1", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&flowCapture=tutorial", { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.showTutorialStep1);
      await page.evaluate(() => window.__farmCapture.showTutorialStep1());
      await page.waitForTimeout(350);
    });

    await portrait("05-herd-gate", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.moveHerdTo);
      const dest = await page.evaluate(() => window.__farmCapture.findMoveCampId());
      await page.evaluate((id) => {
        window.__farmCapture.selectHerd();
        window.__farmCapture.setPendingMove(id);
        window.__farmCapture.moveHerdTo(id);
        window.__farmCapture.centerOnHerd();
      }, dest);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        window.__farmCapture.setTransitProgress(0.48);
        window.__farmCapture.centerOnHerd();
      });
      await page.waitForTimeout(200);
    });

    await portrait("06-feed-warning", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.showFeedWarning);
      await page.evaluate(() => window.__farmCapture.showFeedWarning());
      await page.waitForTimeout(250);
    });

    await portrait("07-sell-sheet", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.openMarket);
      await page.evaluate(() => window.__farmCapture.openMarket());
      await page.waitForTimeout(400);
    });

    await portrait("08-month-end", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.showMonthSummary);
      await page.evaluate(() => window.__farmCapture.showMonthSummary());
      await page.waitForTimeout(300);
    });

    await portrait("09-drought-choice", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.showDroughtChoice);
      await page.evaluate(() => window.__farmCapture.showDroughtChoice());
      await page.waitForTimeout(400);
    });

    await portrait("10-year-end", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&flowCapture=yearend", { waitUntil: "networkidle" });
      await page.waitForSelector("#flow-yearend", { state: "visible", timeout: 15000 }).catch(async () => {
        await page.evaluate(() => window.__farmCapture?.showYearEndReview?.());
      });
      await page.waitForTimeout(400);
    });

    await landscape("10-year-end", async (page) => {
      await page.goto("http://127.0.0.1:4173/?capture=1&flowCapture=yearend", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
    });

    await browser.close();
    await writeFile(path.join(outDir, "smoke-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
