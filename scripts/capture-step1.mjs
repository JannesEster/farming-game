import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step1");

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

async function waitForTransitMidpoint(page) {
  await page.evaluate(() => window.__farmCapture?.setSpeed?.("x3"));
  for (let i = 0; i < 80; i += 1) {
    const progress = await page.evaluate(() => {
      const scene = window.__farmCapture;
      return scene?.herdTransitProgress?.() ?? 0;
    });
    const walking = await page.evaluate(
      () => Boolean(window.__farmCapture?.herdTransitProgress?.() !== undefined),
    );
    if (walking && progress >= 0.28 && progress <= 0.68) return progress;
    await page.waitForTimeout(250);
  }
  return 0;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview"], { cwd: repoRoot, stdio: "ignore" });
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    let closeupDone = false;
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
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
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-day.png`) });

      await page.evaluate(() => window.__farmCapture?.setNightForCapture?.());
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-night.png`) });

      await page.evaluate(() => window.__farmCapture?.resetDaylightForCapture?.());
      await page.waitForTimeout(400);

      await page.evaluate(() => window.__farmCapture?.zoomGrassNearCapture?.());
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-grass-near.png`) });

      await page.evaluate(() => window.__farmCapture?.zoomGrassFarCapture?.());
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-grass-far.png`) });

      await page.screenshot({ path: path.join(outDir, `${viewport.name}-scale-bar.png`) });

      await page.evaluate(() => window.__farmCapture?.triggerHerdMoveDemo?.());
      await waitForTransitMidpoint(page);
      await page.evaluate(() => window.__farmCapture?.zoomHerdWalkCapture?.());
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-herd-walk.png`) });

      if (!closeupDone && viewport.name === "desktop") {
        await page.evaluate(() => window.__farmCapture?.zoomHerdCloseupCapture?.());
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outDir, "desktop-herd-closeup.png") });
        closeupDone = true;
      }

      await page.evaluate(() => window.__farmCapture?.resetDaylightForCapture?.());
      await page.evaluate(() => window.__farmCapture?.openNotificationsDemo?.());
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-notifications.png`) });

      await page.evaluate(() => window.__farmCapture?.showMonthSummaryDemo?.());
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-month-card.png`) });

      await page.close();
    }
    await browser.close();
  } finally {
    preview.kill("SIGTERM");
  }
  console.log("Saved step1 screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
