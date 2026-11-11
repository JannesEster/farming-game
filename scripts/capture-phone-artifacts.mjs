import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts";

function waitForServer(url, timeoutMs = 30000) {
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
  await page.waitForFunction(() => window.__farmCapture?.measureChips);
  await page.waitForTimeout(350);
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
    const report = { capturedAt: new Date().toISOString(), shots: [], chips: {}, tips: {} };

    async function shot(page, name) {
      const file = path.join(outDir, name);
      await page.screenshot({ path: file, fullPage: false });
      report.shots.push(name);
    }

    const portrait = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await ready(portrait);
    await shot(portrait, "hud-portrait-none-selected.png");

    const tutorialPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await tutorialPage.goto("http://127.0.0.1:4173/?capture=1&flowCapture=tutorial", {
      waitUntil: "networkidle",
    });
    await tutorialPage.waitForFunction(() => window.__farmCapture?.showTutorialStep1);
    await tutorialPage.evaluate(() => window.__farmCapture.showTutorialStep1());
    await tutorialPage.waitForTimeout(400);
    await shot(tutorialPage, "flow-tutorial-step-1.png");
    await tutorialPage.close();

    const yearEndPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await yearEndPage.goto("http://127.0.0.1:4173/?capture=1&flowCapture=yearend", {
      waitUntil: "networkidle",
    });
    await yearEndPage.waitForFunction(() => window.__farmCapture?.showYearEndReview);
    await yearEndPage.waitForTimeout(450);
    await shot(yearEndPage, "flow-year-end-review.png");
    await yearEndPage.close();
    await portrait.evaluate(() => window.__farmCapture.selectHerd());
    await portrait.waitForTimeout(200);
    await shot(portrait, "hud-portrait-herd-collapsed.png");
    report.chips.collapsed = await portrait.evaluate(() => window.__farmCapture.measureChips());
    const destId = await portrait.evaluate(() => window.__farmCapture.findMoveCampId());
    await portrait.evaluate((id) => window.__farmCapture.setPendingMove(id), destId);
    await portrait.waitForTimeout(200);
    await shot(portrait, "hud-portrait-herd-move-confirm.png");
    const openingZoom = await portrait.evaluate(() => window.__farmCapture.openingZoom());
    await portrait.evaluate(() => {
      window.__farmCapture.panToTip("north", null);
    });
    await portrait.waitForTimeout(150);
    await shot(portrait, "hud-portrait-north-tip.png");
    report.tips.portraitNorth = await portrait.evaluate(() => window.__farmCapture.tipAtScreen());
    await portrait.close();

    const narrow360 = await browser.newPage({ viewport: { width: 360, height: 780 } });
    await ready(narrow360);
    await shot(narrow360, "hud-360x780-topbar.png");
    report.narrow360 = await narrow360.evaluate(() => window.__farmCapture.measureTopbarMetrics());
    await narrow360.close();

    const narrow375 = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await ready(narrow375);
    report.narrow375 = await narrow375.evaluate(() => window.__farmCapture.measureTopbarMetrics());
    await narrow375.close();

    const ref390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await ready(ref390);
    report.ref390 = await ref390.evaluate(() => window.__farmCapture.measureTopbarMetrics());
    await ref390.close();

    const landscape = await browser.newPage({ viewport: { width: 844, height: 390 } });
    await ready(landscape);
    await landscape.evaluate(() => {
      window.__farmCapture.selectHerd();
      window.__farmCapture.showHint("Hints sit above the herd card.");
    });
    await landscape.waitForTimeout(350);
    await shot(landscape, "hud-landscape-toast-collapsed.png");
    report.toastLandscapeCollapsed = await landscape.evaluate(() => window.__farmCapture.measureToast());
    await landscape.evaluate(() => window.__farmCapture.expandSheet());
    await landscape.waitForTimeout(250);
    await shot(landscape, "hud-landscape-toast-expanded.png");
    report.toastLandscapeExpanded = await landscape.evaluate(() => window.__farmCapture.measureToast());
    await landscape.close();

    const walk = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await ready(walk);
    const herdDest = await walk.evaluate(() => window.__farmCapture.findMoveCampId());
    const zoom = await walk.evaluate(() => window.__farmCapture.openingZoom());
    await walk.evaluate(
      (campId) => {
        window.__farmCapture.moveHerdTo(campId);
        window.__farmCapture.centerOnHerd();
      },
      herdDest,
    );
    await walk.waitForTimeout(400);
    const progresses = [0.36, 0.48, 0.58];
    for (let i = 0; i < progresses.length; i += 1) {
      await walk.evaluate((p) => {
        window.__farmCapture.setTransitProgress(p);
        window.__farmCapture.centerOnHerd();
      }, progresses[i]);
      await walk.waitForTimeout(150);
      await shot(walk, `herd-gate-walk-${i + 1}.png`);
    }
    report.herdWalk = { openingZoom: zoom, progresses };
    await walk.close();
    await browser.close();

    report.heights = await (async () => {
      const p = await chromium.launch();
      const page = await p.newPage({ viewport: { width: 390, height: 844 } });
      await ready(page);
      const h = await page.evaluate(() => window.__farmCapture.measureHud());
      const c = await page.evaluate(() => window.__farmCapture.measureChips());
      await p.close();
      return { hud: h, chips: c };
    })();

    await writeFile(path.join(outDir, "hud-measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
