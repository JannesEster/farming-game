import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/herd-move-graze");
const query = "capture=1&offer=otjozondjupa-ranch";

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
  await page.waitForFunction(() => window.__farmCapture?.placeHerdCamp, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
    window.__farmCapture.dismissCaptureBlockers();
    window.__farmCapture.armDriveCapture();
  });
}

async function status(page) {
  return page.evaluate(() => window.__farmCapture.driveCaptureStatus());
}

async function frame(page, zoom = 1.2) {
  await page.evaluate((z) => {
    window.__farmCapture.bumpHerdCaptureZoom(z);
    const tile = window.__farmCapture.herdTile();
    window.__farmCapture.panToTile(tile.x, tile.y);
  }, zoom);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name) });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const notes = [];
  const preview = spawn("npm", ["run", "preview"], {
    cwd: repoRoot,
    stdio: "ignore",
    env: { ...process.env, VITE_BASE: "/" },
  });
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();

    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await boot(phone);
    await phone.waitForTimeout(2500);
    const fpsSamples = [];
    for (let i = 0; i < 8; i += 1) {
      await phone.waitForTimeout(400);
      const fps = await phone.evaluate(() => window.__farmCapture.gameFps());
      fpsSamples.push(fps);
    }
    const phoneFps = fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length;
    notes.push({ phoneFps: Math.round(phoneFps * 10) / 10, fpsSamples: fpsSamples.map((value) => Math.round(value)) });
    await phone.close();

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (err) => console.log("PAGE", err.message));
    await boot(page);

    await page.evaluate(() => {
      window.__farmCapture.placeHerdCamp(5);
      window.__farmCapture.setSpeed("x1");
    });
    await page.waitForTimeout(400);
    await frame(page, 1.15);
    await shot(page, "graze-t0.png");
    await page.waitForTimeout(1200);
    await shot(page, "graze-t5min.png");
    await page.waitForTimeout(5600);
    await shot(page, "graze-t30min.png");

    await boot(page);
    await page.evaluate(() => {
      window.__farmCapture.dismissCaptureBlockers();
      window.__farmCapture.placeHerdCamp(5);
      window.__farmCapture.moveHerdTo(2);
    });
    const started = await status(page);
    notes.push({ started });
    if (!started.phase) throw new Error(`drive did not start ${JSON.stringify(started)}`);

    let sawDrive = false;
    let sawGate = false;
    let sawDusk = false;
    let sawArrive = false;
    let frames = 0;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 90000) {
      const now = await status(page);
      if (now.phase === "drive" && !sawDrive && (now.progress ?? 0) < 0.08) {
        sawDrive = true;
        await frame(page, 1.25);
        await shot(page, "drive-00s.png");
        notes.push({ drive00: now });
      }
      if (!sawGate && now.phase === "drive") {
        const near = await page.evaluate(() => window.__farmCapture.cowsNearGate(5, 2));
        if (near.count >= 6 && near.closest !== null && near.closest < 18) {
          sawGate = true;
          const framed = await page.evaluate(() => window.__farmCapture.frameHerdGate(5, 2, 1.35));
          await page.waitForTimeout(200);
          await shot(page, "drive-gate.png");
          notes.push({ gate: now, near, framed });
        }
      }
      if (sawGate && !sawDusk && now.phase === "drive") {
        sawDusk = true;
        const dusk = [];
        for (const [index, hour] of [
          [1, 17.92],
          [2, 18.28],
          [3, 18.7],
          [4, 19.15],
        ]) {
          const clock = await page.evaluate(async (nextHour) => {
            window.__farmCapture.setCaptureHour(nextHour);
            window.__farmCapture.bumpHerdCaptureZoom(1.2);
            const tile = window.__farmCapture.herdTile();
            window.__farmCapture.panToTile(tile.x, tile.y);
            return window.__farmCapture.driveCaptureStatus();
          }, hour);
          await page.waitForTimeout(350);
          await shot(page, `drive-dusk-${String(index).padStart(2, "0")}.png`);
          dusk.push(clock);
        }
        notes.push({ dusk });
        await page.evaluate(() => window.__farmCapture.setCaptureHour(10));
      }
      if (now.phase === "drive" && !sawArrive && (now.progress ?? 0) >= 0.9) {
        sawArrive = true;
        await frame(page, 1.25);
        await shot(page, "drive-arrive-minus1.png");
        notes.push({ arriveMinus: now });
      }
      if (!now.phase && sawArrive) {
        await frame(page, 1.25);
        await shot(page, "drive-arrive-plus1.png");
        notes.push({ arrivePlus: now });
        break;
      }
      if (frames < 8 && now.phase) {
        frames += 1;
        await frame(page, 1.2);
        await shot(page, `drive-frame-${String(frames).padStart(2, "0")}.png`);
      }
      await page.waitForTimeout(450);
    }
    if (!sawDrive || !sawGate || !sawDusk || !sawArrive) {
      throw new Error(`missed drive beats ${JSON.stringify(notes)}`);
    }

    await boot(page);
    const trough = await page.evaluate(() => window.__farmCapture.prepareDrinkingCapture());
    notes.push({ trough });
    await page.waitForTimeout(400);
    await shot(page, "graze-trough.png");

    await writeFile(path.join(outDir, "capture-notes.json"), `${JSON.stringify(notes, null, 2)}\n`);
    await browser.close();
    console.log(JSON.stringify(notes, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
