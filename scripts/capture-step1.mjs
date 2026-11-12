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

async function main() {
  await mkdir(outDir, { recursive: true });
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
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-night.png`) });

      await page.evaluate(() => window.__farmCapture?.zoomGrassReadability?.());
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-grass-near.png`) });

      await page.evaluate(() => window.__farmCapture?.zoomFullFarm?.());
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-grass-far.png`) });

      await page.screenshot({ path: path.join(outDir, `${viewport.name}-scale-bar.png`) });

      await page.evaluate(() => window.__farmCapture?.triggerHerdMoveDemo?.());
      for (let i = 0; i < 12; i += 1) {
        await page.waitForTimeout(500);
        if (i === 6) {
          await page.screenshot({ path: path.join(outDir, `${viewport.name}-herd-walk.png`) });
        }
      }

      await page.evaluate(() => window.__farmCapture?.openNotificationsDemo?.());
      await page.waitForTimeout(400);
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
