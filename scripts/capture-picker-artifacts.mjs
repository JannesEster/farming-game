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

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  return name;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview", "--", "--port", "4174", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  const base = "http://127.0.0.1:4174";
  const report = { capturedAt: new Date().toISOString(), shots: [] };

  try {
    await waitForServer(`${base}/?capture=picker`);
    const browser = await chromium.launch();

    const portrait = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await portrait.goto(`${base}/?capture=picker`, { waitUntil: "networkidle" });
    await portrait.waitForFunction(() => window.__pickerCapture?.showStart);
    await portrait.waitForTimeout(400);
    report.shots.push(await shot(portrait, "picker-start-portrait.png"));

    const count = await portrait.evaluate(() => window.__pickerCapture.offerCount());
    for (let i = 0; i < count; i += 1) {
      await portrait.evaluate((ix) => window.__pickerCapture.showCard(ix), i);
      await portrait.waitForTimeout(250);
      const id = await portrait.evaluate(() => window.__pickerCapture.offerId());
      report.shots.push(await shot(portrait, `picker-card-${id}-390x844.png`));
    }

    const landscape = await browser.newPage({ viewport: { width: 844, height: 390 } });
    await landscape.goto(`${base}/?capture=picker`, { waitUntil: "networkidle" });
    await landscape.waitForFunction(() => window.__pickerCapture?.showCard);
    await landscape.evaluate(() => window.__pickerCapture.showStart());
    await landscape.waitForTimeout(300);
    report.shots.push(await shot(landscape, "picker-start-landscape.png"));
    for (let i = 0; i < count; i += 1) {
      await landscape.evaluate((ix) => window.__pickerCapture.showCard(ix), i);
      await landscape.waitForTimeout(250);
      const id = await landscape.evaluate(() => window.__pickerCapture.offerId());
      report.shots.push(await shot(landscape, `picker-card-${id}-844x390.png`));
    }
    await landscape.close();
    await portrait.close();

    for (const offerId of ["otjozondjupa-ranch", "omaheke-weaners"]) {
      const play = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await play.goto(`${base}/?capture=1&offer=${offerId}`, { waitUntil: "networkidle" });
      await play.waitForFunction(() => window.__farmCapture?.openingZoom);
      await play.waitForTimeout(500);
      report.shots.push(await shot(play, `farm-first-view-${offerId}-390x844.png`));
      const land = await browser.newPage({ viewport: { width: 844, height: 390 } });
      await land.goto(`${base}/?capture=1&offer=${offerId}`, { waitUntil: "networkidle" });
      await land.waitForFunction(() => window.__farmCapture?.openingZoom);
      await land.waitForTimeout(500);
      report.shots.push(await shot(land, `farm-first-view-${offerId}-844x390.png`));
      await land.close();
      await play.close();
    }

    await browser.close();
    await writeFile(path.join(outDir, "picker-capture-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
