import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/farm3x-truescale");
const artifactDir = "/opt/cursor/artifacts";
const url = "http://127.0.0.1:4173/?capture=1&farm=default&playtest=1";

function waitForServer(target, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(target);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) reject(new Error(`Server not ready: ${target}`));
      else setTimeout(tick, 250);
    };
    tick();
  });
}

async function ready(page) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__farmCapture?.driveCaptureStatus, { timeout: 90000 });
  await page.evaluate(() => window.__farmCapture.dismissCaptureBlockers());
  await page.waitForTimeout(600);
}

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  await copyFile(file, path.join(artifactDir, name));
  return name;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  const report = { capturedAt: new Date().toISOString(), shots: [], errors: [] };
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch({ args: ["--disable-gpu"] });
    const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    desk.on("pageerror", (error) => report.errors.push(String(error)));
    await ready(desk);

    const farmMap = await desk.evaluate(() => window.__farmCapture.prepareFarmMapCapture());
    await desk.waitForTimeout(400);
    report.shots.push(await shot(desk, "farm-map.png"));
    report.farmMap = farmMap;
    report.farmMapZoom = await desk.evaluate(() => window.__farmCapture.driveCaptureStatus());

    const camp = await desk.evaluate(() => window.__farmCapture.prepareOneCampCapture());
    await desk.waitForTimeout(400);
    report.shots.push(await shot(desk, "camp-water.png"));
    report.camp = camp;

    const homestead = await desk.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
    await desk.waitForTimeout(400);
    report.shots.push(await shot(desk, "homestead-start-zoom.png"));
    report.homestead = homestead;

    const drive = await desk.evaluate(() => {
      const started = window.__farmCapture.startNeighbourDriveCapture(10, 0);
      window.__farmCapture.setTransitProgress(0.45);
      window.__farmCapture.holdTransitProgress(0.45);
      const framed = window.__farmCapture.frameHerdForCapture(0.7);
      return { started, framed, status: window.__farmCapture.driveCaptureStatus() };
    });
    await desk.waitForTimeout(500);
    report.shots.push(await shot(desk, "herd-mid-drive.png"));
    report.drive = drive;

    const fence = await desk.evaluate(() => window.__farmCapture.prepareFenceLineCapture());
    await desk.waitForTimeout(500);
    report.shots.push(await shot(desk, "fence-gate.png"));
    report.fence = fence;
    await desk.close();

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    phone.on("pageerror", (error) => report.errors.push(String(error)));
    await ready(phone);
    await phone.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
    await phone.waitForTimeout(300);
    report.fpsStart = await phone.evaluate(() => window.__farmCapture.sampleFps(45));
    await phone.evaluate(() => window.__farmCapture.prepareFarmMapCapture());
    await phone.waitForTimeout(300);
    report.fpsFarmMap = await phone.evaluate(() => window.__farmCapture.sampleFps(45));
    const clockBefore = await phone.evaluate(() => {
      window.__farmCapture.setSpeed("x3");
      return window.__farmCapture.driveCaptureStatus();
    });
    await phone.waitForTimeout(3000);
    const clockAfter = await phone.evaluate(() => window.__farmCapture.driveCaptureStatus());
    report.clockMoved = clockBefore.clock !== clockAfter.clock;
    report.clock = { before: clockBefore.clock, after: clockAfter.clock };
    await phone.close();
    await browser.close();
    await writeFile(path.join(outDir, "capture.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
