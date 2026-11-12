import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c1");
const query = "capture=1&offer=otjozondjupa-ranch";
const driveZoom = 1.3;

function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 404) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) reject(new Error(`Server not ready: ${url}`));
      else setTimeout(tick, 300);
    };
    tick();
  });
}

async function boot(page) {
  await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.startNeighbourDriveCapture, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
    window.__farmCapture.armDriveCapture();
    window.__farmCapture.dismissCaptureBlockers();
  });
}

async function status(page) {
  return page.evaluate(() => window.__farmCapture.driveCaptureStatus());
}

async function frameDrive(page) {
  const framed = await page.evaluate((zoom) => window.__farmCapture.frameReviewDrive(zoom), driveZoom);
  if (!framed.herderVisible || !framed.labelVisible) {
    throw new Error(`herder not in frame ${JSON.stringify(framed)}`);
  }
  return framed;
}

async function waitUntil(page, label, predicate, timeoutMs) {
  const start = Date.now();
  let last = null;
  let still = 0;
  while (Date.now() - start < timeoutMs) {
    const next = await status(page);
    if (last && next.clock === last.clock && next.approach === last.approach && next.progress === last.progress) still += 1;
    else still = 0;
    if (still >= 6) await page.evaluate(() => window.__farmCapture.dismissCaptureBlockers());
    last = next;
    if (predicate(last)) return last;
    await page.waitForTimeout(400);
  }
  throw new Error(`${label} timed out ${JSON.stringify(last)}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  if (process.env.SKIP_BUILD !== "1") {
    const build = spawn("npm", ["run", "build"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_BASE: "/" },
    });
    const buildCode = await new Promise((resolve) => build.on("close", resolve));
    if (buildCode !== 0) process.exit(buildCode ?? 1);
  }

  const preview = spawn("npm", ["run", "preview"], {
    cwd: repoRoot,
    stdio: "ignore",
    env: { ...process.env, VITE_BASE: "/" },
  });
  const log = [];
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (err) => console.log("PAGE", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("CONSOLE", msg.text());
    });
    await boot(page);

    if (process.env.STILL === "1") {
      const home = await page.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
      if (!home) throw new Error("homestead frame failed");
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, "desktop-homestead-v3.png") });
      const yard = await page.evaluate(() => window.__farmCapture.prepareTruckRampCapture());
      if (!yard) throw new Error("yard frame failed");
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, "desktop-yard-truck-v3.png") });
      const road = await page.evaluate(() => window.__farmCapture.prepareRoadWideCapture());
      if (!road) throw new Error("road frame failed");
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, "desktop-road-gate-to-yard-v3.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await boot(page);
      const phone = await page.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
      if (!phone) throw new Error("phone homestead frame failed");
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, "phone-homestead-v3.png") });
      console.log(JSON.stringify({ home, yard, road, phone }));
      await browser.close();
      return;
    }

    if (process.env.YARD_ONLY === "1") {
      const yard = await page.evaluate(() => window.__farmCapture.prepareTruckRampCapture());
      if (!yard) throw new Error("yard frame failed");
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, "desktop-yard-truck-v3.png") });
      console.log(JSON.stringify({ step: "desktop-yard-truck-v3", yard }));
      await browser.close();
      return;
    }

    const started = await page.evaluate(() => window.__farmCapture.startNeighbourDriveCapture(10, 0));
    log.push({ step: "neighbour-start", started });
    if (!started.ok || !started.shared) throw new Error(`neighbour move did not start ${JSON.stringify(started)}`);

    const shots = [
      ["neighbour-leave-v3.png", "drive started", (s) => s.phase === "drive" && (s.progress ?? 0) > 0.06 && (s.progress ?? 0) < 0.28, 300000],
      ["neighbour-mid-v3.png", "mid drive", (s) => s.phase === "drive" && (s.progress ?? 0) > 0.45 && (s.progress ?? 0) < 0.75, 300000],
      ["neighbour-arrive-v3.png", "arriving", (s) => s.phase === "drive" && (s.progress ?? 0) > 0.86, 300000],
    ];
    let arrived = null;
    let zoom = null;
    for (const [name, label, predicate, timeout] of shots) {
      const now = await waitUntil(page, label, predicate, timeout);
      const framed = await frameDrive(page);
      if (zoom === null) zoom = framed.zoom;
      else if (Math.abs(framed.zoom - zoom) > 0.01) throw new Error(`zoom changed ${zoom} -> ${framed.zoom}`);
      await page.screenshot({ path: path.join(outDir, name) });
      log.push({ step: name, zoom: framed.zoom, herderVisible: framed.herderVisible, ...now });
      arrived = now;
    }

    await waitUntil(page, "spread", (s) => s.phase === null, 120000);
    await page.waitForTimeout(1800);
    const spreadNow = await status(page);
    const spreadFrame = await frameDrive(page);
    if (spreadFrame.zoom > zoom + 0.02) throw new Error(`spread zoomed in ${zoom} -> ${spreadFrame.zoom}`);
    await page.screenshot({ path: path.join(outDir, "neighbour-spread-v3.png") });
    log.push({ step: "neighbour-spread-v3.png", zoom: spreadFrame.zoom, ...spreadNow });

    if (process.env.DRIVE_ONLY === "1") {
      console.log(JSON.stringify(log, null, 2));
      await browser.close();
      return;
    }

    await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
    await boot(page);
    const home = await page.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
    if (!home) throw new Error("homestead frame failed");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "desktop-homestead-v3.png") });
    log.push({ step: "desktop-homestead-v3" });

    const yard = await page.evaluate(() => window.__farmCapture.prepareTruckRampCapture());
    if (!yard) throw new Error("yard frame failed");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "desktop-yard-truck-v3.png") });
    log.push({ step: "desktop-yard-truck-v3", yard });

    const road = await page.evaluate(() => window.__farmCapture.prepareRoadWideCapture());
    if (!road) throw new Error("road frame failed");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "desktop-road-gate-to-yard-v3.png") });
    log.push({ step: "desktop-road-gate-to-yard-v3", road });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
    await boot(page);
    const phone = await page.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
    if (!phone) throw new Error("phone homestead frame failed");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "phone-homestead-v3.png") });
    log.push({ step: "phone-homestead-v3" });

    await browser.close();
    console.log(JSON.stringify(log, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
