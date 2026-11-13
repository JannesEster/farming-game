import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/farm3x");
const url = "http://127.0.0.1:4173/?capture=1&farm=default&playtest=1";

function waitForServer(target, timeoutMs = 45000) {
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
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.driveCaptureStatus, { timeout: 45000 });
  await page.evaluate(() => window.__farmCapture.dismissCaptureBlockers());
  await page.waitForTimeout(400);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "preview", "--", "--port", "4173", "--host", "127.0.0.1"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  const report = { capturedAt: new Date().toISOString(), shots: [], selfPlay: null, fps: null };
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();

    const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    desk.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(desk);

    await desk.evaluate(() => window.__farmCapture.zoomFar());
    await desk.waitForTimeout(500);
    const whole = path.join(outDir, "whole-farm.png");
    await desk.screenshot({ path: whole });
    report.shots.push("whole-farm.png");

    const homesteadOk = await desk.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
    await desk.waitForTimeout(300);
    await desk.screenshot({ path: path.join(outDir, "homestead-start-zoom.png") });
    report.shots.push("homestead-start-zoom.png");
    report.homesteadInView = homesteadOk;

    const drive = await desk.evaluate(() => {
      const started = window.__farmCapture.startNeighbourDriveCapture(10, 0);
      const placed = window.__farmCapture.setTransitProgress(0.5);
      window.__farmCapture.holdTransitProgress(0.5);
      window.__farmCapture.frameHerdForCapture(0.72);
      return { started, placed, status: window.__farmCapture.driveCaptureStatus() };
    });
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: path.join(outDir, "herd-mid-move.png") });
    report.shots.push("herd-mid-move.png");
    report.drive = drive;

    const roadOk = await desk.evaluate(() => window.__farmCapture.prepareRoadWideCapture());
    await desk.waitForTimeout(300);
    await desk.screenshot({ path: path.join(outDir, "handling-yard-road.png") });
    report.shots.push("handling-yard-road.png");
    report.roadOk = roadOk;

    await desk.close();

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    phone.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(phone);
    await phone.evaluate(() => window.__farmCapture.openingZoom());
    const startFps = await phone.evaluate(() => window.__farmCapture.sampleFps(60));
    await phone.evaluate(() => window.__farmCapture.zoomFar());
    const farFps = await phone.evaluate(() => window.__farmCapture.sampleFps(40));
    report.fps = { viewport: "390x844", startZoom: startFps, zoomedOut: farFps };

    await phone.evaluate(() => window.__farmCapture.dismissCaptureBlockers());
    await phone.evaluate(() => window.__farmCapture.setSpeed("x3"));
    const start = await phone.evaluate(() => window.__farmCapture.driveCaptureStatus());
    const samples = [start];
    let daysAdvanced = 0;
    let lastDay = start.day;
    let lastMonth = null;
    const begun = Date.now();
    let stuckForMs = 0;
    let lastClock = start.clock;
    let lastChange = begun;
    while (daysAdvanced < 2 && Date.now() - begun < 300000) {
      await phone.waitForTimeout(2000);
      const status = await phone.evaluate(() => window.__farmCapture.driveCaptureStatus());
      samples.push({ clock: status.clock, hour: status.hour, day: status.day, speed: status.speed, phase: status.phase });
      if (status.clock !== lastClock) {
        lastClock = status.clock;
        lastChange = Date.now();
        stuckForMs = 0;
      } else {
        stuckForMs = Date.now() - lastChange;
      }
      if (stuckForMs > 30000) break;
      if (status.day !== lastDay) {
        daysAdvanced += 1;
        lastDay = status.day;
        lastMonth = status.day;
      }
    }
    const end = await phone.evaluate(() => window.__farmCapture.driveCaptureStatus());
    report.selfPlay = {
      start,
      end,
      daysAdvanced,
      elapsedMs: Date.now() - begun,
      stuckForMs,
      pageErrors,
      samples: samples.filter((_, index) => index % 5 === 0),
    };
    await writeFile(path.join(outDir, "self-play.json"), JSON.stringify(report, null, 2));
    await browser.close();
    if (daysAdvanced < 2 || pageErrors.length > 0 || stuckForMs > 30000) {
      console.error(JSON.stringify(report.selfPlay, null, 2));
      throw new Error("Self play did not finish two game days");
    }
    console.log(JSON.stringify({ shots: report.shots, fps: report.fps, selfPlay: { daysAdvanced, elapsedMs: report.selfPlay.elapsedMs, start, end } }, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
