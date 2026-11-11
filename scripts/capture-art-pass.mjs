import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts";
const refSrc =
  process.env.ART_REFERENCE ??
  "/home/ubuntu/.cursor/projects/agent-repos-farming-game/assets/look-02-isometric-sim.png";

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
  await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__farmCapture?.sampleFps);
  await page.waitForTimeout(400);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  try {
    await copyFile(refSrc, path.join(outDir, "look-02-reference.png"));
  } catch (error) {
    console.warn("Could not copy reference image:", error.message);
  }

  const preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  try {
    await waitForServer("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch");
    const browser = await chromium.launch();
    const report = { capturedAt: new Date().toISOString(), shots: [], fps: null };

    async function shot(page, name) {
      const file = path.join(outDir, name);
      await page.screenshot({ path: file, fullPage: false });
      report.shots.push(name);
    }

    const portrait = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await ready(portrait);
    await portrait.evaluate(() => window.__farmCapture.frameHomestead(false));
    await portrait.waitForTimeout(250);
    await shot(portrait, "art-portrait-opening-390x844.png");
    await portrait.evaluate(() => window.__farmCapture.frameHomestead(true));
    await portrait.waitForTimeout(200);
    await shot(portrait, "art-portrait-homestead-zoom-390x844.png");
    report.fps = await portrait.evaluate(() => window.__farmCapture.sampleFps(120));
    await portrait.close();

    const landscape = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
    await ready(landscape);
    await landscape.evaluate(() => window.__farmCapture.frameHomestead(false));
    await landscape.waitForTimeout(200);
    await shot(landscape, "art-landscape-opening-844x390.png");
    await landscape.evaluate(() => window.__farmCapture.frameHomestead(true));
    await landscape.waitForTimeout(200);
    await shot(landscape, "art-landscape-homestead-zoom-844x390.png");
    const farZoom = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await ready(farZoom);
    await farZoom.evaluate(() => window.__farmCapture.zoomFar());
    await farZoom.waitForTimeout(250);
    await shot(farZoom, "art-portrait-far-zoom-390x844.png");
    await farZoom.close();

    await landscape.close();

    const gate = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await ready(gate);
    const dest = await gate.evaluate(() => window.__farmCapture.findMoveCampId());
    await gate.evaluate((campId) => window.__farmCapture.moveHerdTo(campId), dest);
    await gate.waitForTimeout(300);
    const progresses = [0.38, 0.5, 0.62];
    for (let i = 0; i < progresses.length; i += 1) {
      await gate.evaluate((p) => {
        window.__farmCapture.setTransitProgress(p);
        window.__farmCapture.centerOnHerd();
      }, progresses[i]);
      await gate.waitForTimeout(180);
      await shot(gate, `art-herd-gate-${i + 1}.png`);
    }
    await gate.close();
    await browser.close();

    await writeFile(path.join(outDir, "art-pass-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
