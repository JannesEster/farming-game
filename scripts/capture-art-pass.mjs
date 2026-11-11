import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
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
  await page.evaluate(() => {
    window.__farmCapture?.prepareForScreenshot?.();
    window.__flowCapture?.skipTutorialForCapture?.();
    const tutorial = document.getElementById("flow-tutorial");
    if (tutorial) tutorial.hidden = true;
    const toast = document.getElementById("flow-toast");
    if (toast) toast.hidden = true;
    const eventCard = document.getElementById("event-card");
    if (eventCard) eventCard.hidden = true;
    const hudToast = document.getElementById("toast");
    if (hudToast) hudToast.hidden = true;
    const sheet = document.getElementById("sheet-summary");
    if (sheet?.closest(".sheet")) sheet.closest(".sheet").classList.remove("is-expanded");
  });
  await page.waitForTimeout(400);
}

async function sampleGroundPixelsFromPng(pngPath) {
  const buf = await readFile(pngPath);
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  const samples = [];
  for (let i = 0; i < 50; i += 1) {
    const x = Math.floor((0.1 + ((i * 19) % 72) / 100) * width);
    const y = Math.floor((0.15 + ((i * 29) % 55) / 100) * height);
    const idx = (width * y + x) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }
  let maxDist = 0;
  const ref = samples[0];
  for (const s of samples) {
    const dist = Math.hypot(s.r - ref.r, s.g - ref.g, s.b - ref.b);
    if (dist > maxDist) maxDist = dist;
  }
  const orangeDominated =
    maxDist < 12 &&
    samples.filter((s) => s.r > 150 && s.g > 60 && s.g < 130 && s.b < 90).length > 40;
  return {
    sampleCount: samples.length,
    first: ref,
    last: samples[49],
    maxRgbSpread: Math.round(maxDist * 10) / 10,
    allWithin10OfFirst: maxDist < 10,
    orangeFlat: orangeDominated,
    pass: maxDist >= 10 && !orangeDominated,
  };
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
    const report = { capturedAt: new Date().toISOString(), shots: [], fps: null, ground: null, frames: {} };

    async function shot(page, name) {
      const file = path.join(outDir, name);
      await page.screenshot({ path: file, fullPage: false });
      report.shots.push(name);
    }

    const portrait = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await ready(portrait);
    report.ground = {
      diagnose: await portrait.evaluate(() => window.__farmCapture.diagnoseGround()),
    };
    const openingFrame = await portrait.evaluate(() => window.__farmCapture.frameHomestead(false));
    report.frames.opening = openingFrame;
    await portrait.waitForTimeout(350);
    const openingPath = path.join(outDir, "art-portrait-opening-390x844.png");
    await portrait.screenshot({ path: openingPath, fullPage: false });
    report.shots.push("art-portrait-opening-390x844.png");
    report.ground.pixels = await sampleGroundPixelsFromPng(openingPath);
    const homesteadFrame = await portrait.evaluate(() => window.__farmCapture.frameHomestead(true));
    report.frames.homestead = homesteadFrame;
    await portrait.waitForTimeout(300);
    await shot(portrait, "art-portrait-homestead-zoom-390x844.png");
    const farZoom = await portrait.evaluate(() => window.__farmCapture.zoomFar());
    report.frames.far = { zoom: farZoom };
    await portrait.waitForTimeout(250);
    await shot(portrait, "art-portrait-far-zoom-390x844.png");
    report.fps = await portrait.evaluate(() => window.__farmCapture.sampleFps(120));
    await portrait.close();

    const landscape = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
    await ready(landscape);
    await landscape.evaluate(() => window.__farmCapture.frameHomestead(false));
    await landscape.waitForTimeout(200);
    await shot(landscape, "art-landscape-opening-844x390.png");
    await landscape.close();

    const gate = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await ready(gate);
    const dest = await gate.evaluate(() => window.__farmCapture.findMoveCampId());
    await gate.evaluate((campId) => window.__farmCapture.moveHerdTo(campId), dest);
    await gate.evaluate(() => window.__farmCapture.frameHomestead(true));
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

    if (!report.ground?.pixels?.pass) {
      console.error("Ground pixel check FAILED", report.ground);
      process.exitCode = 1;
    }
    if (!report.frames?.opening?.farmhouseInView || !report.frames?.opening?.herdInView) {
      console.error("Opening frame missing farmhouse or herd", report.frames?.opening);
      process.exitCode = 1;
    }
    if (!report.frames?.homestead?.farmhouseInView) {
      console.error("Farmhouse not in view for homestead frame", report.frames?.homestead);
      process.exitCode = 1;
    }

    await writeFile(path.join(outDir, "art-pass-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (process.exitCode) process.exit(process.exitCode);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
