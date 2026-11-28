import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/fences-fix");
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
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("PAGE", msg.text());
  });
  page.on("pageerror", (error) => console.log("PAGEERROR", String(error)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__farmCapture && window.__farmCapture.driveCaptureStatus), null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__farmCapture.dismissCaptureBlockers());
  await page.waitForTimeout(700);
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (error) => report.errors.push(String(error)));
    await ready(page);

    const onlyFar = process.env.FENCE_SHOTS === "far";
    report.far = await page.evaluate(() => window.__farmCapture.prepareFarmMapCapture());
    await page.waitForTimeout(500);
    report.fpsFar = await page.evaluate(() => window.__farmCapture.sampleFps(45));
    report.shots.push(await shot(page, "fences-far.png"));

    report.zoom008 = await page.evaluate(() => window.__farmCapture.frameFarmAtZoom(0.08));
    await page.waitForTimeout(500);
    report.fpsZoom008 = await page.evaluate(() => window.__farmCapture.sampleFps(45));
    report.shots.push(await shot(page, "fences-zoom-008.png"));
    if (onlyFar) {
      await page.close();
      await browser.close();
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    report.mid = await page.evaluate(() => window.__farmCapture.prepareOneCampCapture());
    await page.waitForTimeout(500);
    report.shots.push(await shot(page, "fences-mid.png"));

    const gates = await page.evaluate(() => window.__farmCapture.listCampGates());
    report.gates = gates;
    const wanted = [
      [0, 2],
      [3, 7],
      [5, 6],
    ];
    const framed = [];
    for (const [a, b] of wanted) {
      const hit = gates.some((pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a));
      if (!hit) continue;
      const placed = await page.evaluate(([ca, cb]) => window.__farmCapture.frameCampGate(ca, cb), [a, b]);
      await page.waitForTimeout(400);
      const name = `fences-gate-${a}-${b}.png`;
      report.shots.push(await shot(page, name));
      framed.push(placed);
    }
    report.framedGates = framed;

    const closePair = framed[0] ? wanted[0] : null;
    if (closePair) {
      report.close = await page.evaluate(([ca, cb]) => window.__farmCapture.frameCampGate(ca, cb), closePair);
    } else {
      report.close = await page.evaluate(() => window.__farmCapture.prepareFenceLineCapture());
    }
    await page.waitForTimeout(400);
    report.shots.push(await shot(page, "fences-close.png"));

    report.panEdge = await page.evaluate(() => window.__farmCapture.nudgeCamera(200, 30));
    await page.waitForTimeout(350);
    report.shots.push(await shot(page, "fences-pan-edge.png"));

    const nudges = [
      [260, 20],
      [260, 20],
      [520, 80],
    ];
    for (let index = 0; index < nudges.length; index += 1) {
      const [dx, dy] = nudges[index];
      const moved = await page.evaluate(([x, y]) => window.__farmCapture.nudgeCamera(x, y), [dx, dy]);
      await page.waitForTimeout(350);
      const name = `fences-pan-${index + 1}.png`;
      report.shots.push(await shot(page, name));
      report[`pan${index + 1}`] = moved;
    }

    await page.close();
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
