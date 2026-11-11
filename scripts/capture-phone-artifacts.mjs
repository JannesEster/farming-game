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

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  const base = "http://127.0.0.1:4173/?capture=1";
  try {
    await waitForServer(base);
    const browser = await chromium.launch();
    const captureViewport = async (width, height, name) => {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.measureHud);
      await page.evaluate(() => window.__farmCapture.selectHerd());
      await page.waitForTimeout(400);
      const heights = await page.evaluate(() => window.__farmCapture.measureHud());
      const shot = path.join(outDir, name);
      await page.screenshot({ path: shot, fullPage: false });
      await page.close();
      return heights;
    };

    const portraitHeights = await captureViewport(390, 844, "hud-portrait-390x844.png");
    const landscapeHeights = await captureViewport(844, 390, "hud-landscape-844x390.png");

    const gatePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await gatePage.goto(base, { waitUntil: "networkidle" });
    await gatePage.waitForFunction(() => window.__farmCapture?.measureHud);
    const destId = await gatePage.evaluate(() => window.__farmCapture.findMoveCampId());
    await gatePage.evaluate((campId) => {
      window.__farmCapture.selectHerd();
      window.__farmCapture.moveHerdTo(campId);
    }, destId);
    await gatePage.waitForTimeout(500);
    const progresses = [0.36, 0.48, 0.58];
    for (let i = 0; i < progresses.length; i += 1) {
      await gatePage.evaluate((p) => {
        window.__farmCapture.setTransitProgress(p);
      }, progresses[i]);
      await gatePage.waitForTimeout(120);
      await gatePage.screenshot({ path: path.join(outDir, `herd-gate-walk-${i + 1}.png`) });
    }
    await gatePage.close();
    await browser.close();

    const report = {
      portraitHeights,
      landscapeHeights,
      capturedAt: new Date().toISOString(),
    };
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
