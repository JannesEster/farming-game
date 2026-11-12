import { appendFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c1");
const port = 4174;
const base = `http://127.0.0.1:${port}`;

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

function attach(page, problems) {
  page.on("pageerror", (err) => {
    problems.push(`pageerror: ${err.message}`);
    console.log("PAGE", err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      problems.push(`console: ${msg.text()}`);
      console.log("CONSOLE", msg.text());
    }
  });
}

async function dismiss(page) {
  for (const id of ["flow-tutorial-skip", "event-dismiss", "flow-yearend-continue"]) {
    const button = page.locator(`#${id}`);
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }
}

async function status(page) {
  return page.evaluate(() => window.__farmCapture?.driveCaptureStatus?.() ?? null);
}

async function shots(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = [];
  attach(page, problems);
  await page.goto(`${base}/?capture=1&offer=otjozondjupa-ranch`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.prepareHomesteadAtDefaultZoom, null, { timeout: 30000 });
  await page.evaluate(() => window.__farmCapture.armDriveCapture());
  const home = await page.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
  if (!home) throw new Error("homestead frame failed");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "desktop-homestead-v4.png") });

  const road = await page.evaluate(() => window.__farmCapture.prepareRoadWideCapture());
  if (!road) throw new Error("road frame failed");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "desktop-road-gate-to-yard-v4.png") });

  const started = await page.evaluate(() => window.__farmCapture.startNeighbourDriveCapture(10, 0));
  if (!started.ok || !started.shared) throw new Error(`neighbour move did not start ${JSON.stringify(started)}`);
  const start = Date.now();
  let mid = null;
  while (Date.now() - start < 180000) {
    mid = await status(page);
    if (mid?.phase === "drive" && mid.progress > 0.45 && mid.progress < 0.75) break;
    await page.waitForTimeout(300);
  }
  if (!mid || mid.phase !== "drive") throw new Error(`mid drive missed ${JSON.stringify(mid)}`);
  const framed = await page.evaluate((zoom) => window.__farmCapture.frameReviewDrive(zoom), 1.3);
  if (!framed.herderVisible || !framed.labelVisible) {
    throw new Error(`herder not in the mid frame ${JSON.stringify(framed)}`);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, "neighbour-mid-v4.png") });
  await page.close();
  return { home, road, mid, framed, problems };
}

async function clickTile(page, tile) {
  const point = await page.evaluate((spot) => window.__farmCapture.panToTile(spot.x, spot.y), tile);
  await page.waitForTimeout(150);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(250);
}

async function play(browser, problems) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  attach(page, problems);
  const log = [];
  const record = (entry) => {
    log.push(entry);
    appendFileSync("/tmp/play-v4.jsonl", `${JSON.stringify({ t: Date.now(), ...entry })}\n`);
    return entry;
  };
  await page.goto(`${base}/?playtest=1`, { waitUntil: "networkidle" });
  await page.locator('[data-action="new"]').click();
  await page.waitForSelector('[data-action="buy"]');
  const offerId = await page.locator(".picker-card").getAttribute("data-offer-id");
  if (offerId !== "otjozondjupa-ranch") {
    await page.locator('[data-dot="2"]').click();
  }
  const bought = await page.locator(".picker-card").getAttribute("data-offer-id");
  if (bought !== "otjozondjupa-ranch") throw new Error(`expected Otjozondjupa, got ${bought}`);
  await page.locator('[data-action="buy"]').click();
  await page.locator("#picker-farmer-name").fill("Jannes");
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.__farmCapture?.driveCaptureStatus, null, { timeout: 30000 });
  await page.locator("#speed-x1").click();
  if (await page.locator("#flow-tutorial-skip").isVisible().catch(() => false)) {
    await page.locator("#flow-tutorial-skip").click();
  }
  record({ step: "started", offer: bought, ...(await status(page)) });

  const neighbour = await page.evaluate(() => window.__farmCapture.nearestNeighbourId());
  const herd = await page.evaluate(() => window.__farmCapture.herdTile());
  await clickTile(page, herd);
  const camp = await page.evaluate((id) => window.__farmCapture.campAnchor(id), neighbour);
  await clickTile(page, camp);
  let confirm = page.locator("#move-confirm-btn");
  if (!(await confirm.isVisible().catch(() => false))) {
    const armed = await page.evaluate((id) => window.__farmCapture.armCampMove(id), neighbour);
    record({ step: "neighbour-click-missed", neighbour, camp, armed });
  }
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  } else {
    await page.evaluate((id) => {
      const button = document.getElementById("move-confirm-btn");
      if (button && !button.hidden) button.click();
      else window.__farmCapture.startNeighbourDriveCapture(10, 0);
    }, neighbour);
  }
  record({ step: "neighbour-go", ...(await status(page)) });

  const notes = [];
  let last = null;
  let stillMs = 0;
  let lastHerd = null;
  let herderStillMs = 0;
  let nights = 0;
  let sawNight = false;
  let nightShot = false;
  let neighbourDone = false;
  let farStarted = false;
  let farDone = false;
  let cutStarted = false;
  let saleStarted = false;
  const startedAt = Date.now();
  const limitMs = 14 * 60 * 1000;
  while (Date.now() - startedAt < limitMs) {
    await dismiss(page);
    const now = await status(page);
    if (!now) {
      await page.waitForTimeout(400);
      continue;
    }
    if (!/^\d\d:\d\d$/.test(now.clock)) problems.push(`odd clock ${now.clock}`);
    const modal =
      (await page.locator("#flow-tutorial").isVisible().catch(() => false)) ||
      (await page.locator("#event-card").isVisible().catch(() => false)) ||
      (await page.locator("#flow-yearend").isVisible().catch(() => false)) ||
      (await page.locator("#flow-gameover").isVisible().catch(() => false)) ||
      (await page.locator("#market-sheet").isVisible().catch(() => false));
    const same =
      last &&
      now.clock === last.clock &&
      now.phase === last.phase &&
      now.progress === last.progress &&
      now.approach === last.approach &&
      now.cutPhase === last.cutPhase &&
      now.sale === last.sale;
    if (!modal && now.speed === "x1" && same) stillMs += 500;
    else stillMs = 0;
    if (stillMs >= 8000) {
      problems.push(`clock stuck at ${now.clock} phase ${now.phase} for ${stillMs}ms`);
      stillMs = 0;
    }
    if ((now.phase === "drive" || now.phase === "approach") && last?.herderX != null && now.herderX != null) {
      const step = Math.hypot(now.herderX - last.herderX, now.herderY - last.herderY);
      if (step > 8) problems.push(`herder jumped ${step.toFixed(2)} tiles at ${now.clock}`);
      if (step < 0.05 && now.progress === last.progress && now.approach === last.approach) herderStillMs += 500;
      else herderStillMs = 0;
      if (herderStillMs >= 6000) {
        problems.push(`herder stuck at ${now.herderX.toFixed(1)},${now.herderY.toFixed(1)} during ${now.phase} ${now.clock}`);
        herderStillMs = 0;
      }
    } else herderStillMs = 0;
    if (now.hour >= 20 || now.hour < 5) {
      if (!sawNight) nights += 1;
      sawNight = true;
      if (!nightShot && now.phase == null) {
        const framedNight = await page.evaluate(() => window.__farmCapture.prepareHomesteadAtDefaultZoom());
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, "desktop-night-v4.png") });
        nightShot = true;
        record({ step: "night", framed: framedNight, clock: now.clock, day: now.day });
      }
    } else sawNight = false;

    if (!neighbourDone && now.phase == null && now.campId !== log[0]?.campId && log.some((item) => item.step === "neighbour-go")) {
      neighbourDone = true;
      record({ step: "neighbour-done", ...now });
    }
    if (neighbourDone && !farStarted && now.phase == null && now.cutPhase == null && now.sale == null) {
      if (now.hour < 15 || now.hour >= 18) {
        const clock = await page.evaluate(() => window.__farmCapture.setPlayClock(15, 30));
        record({ step: "set-1530", clock });
      }
      const distant = await page.evaluate(() => window.__farmCapture.pickDistantMoveCamp());
      const anchor = await page.evaluate((id) => window.__farmCapture.campAnchor(id), distant);
      await clickTile(page, await page.evaluate(() => window.__farmCapture.herdTile()));
      await clickTile(page, anchor);
      if (!(await page.locator("#move-confirm-btn").isVisible().catch(() => false))) {
        const armed = await page.evaluate((id) => window.__farmCapture.armCampMove(id), distant);
        record({ step: "far-click-missed", distant, anchor, armed });
      }
      if (await page.locator("#move-confirm-btn").isVisible().catch(() => false)) {
        await page.locator("#move-confirm-btn").click();
      }
      farStarted = true;
      record({ step: "far-go", distant, ...(await status(page)) });
    }
    if (farStarted && !farDone && (await status(page))?.phase == null && (await status(page))?.queue == null) {
      const after = await status(page);
      if (after.campId !== log.find((item) => item.step === "far-go")?.campId && after.hour >= 6 && after.hour < 18) {
        farDone = true;
        record({ step: "far-done", ...after });
      }
    }
    if (farDone && !cutStarted && now.phase == null) {
      try {
        await page.evaluate(() => {
          window.__farmCapture.selectHerd();
          const sheet = document.getElementById("herd-sheet");
          if (sheet?.dataset.expanded !== "true") document.getElementById("sheet-summary")?.click();
        });
        await page.waitForTimeout(300);
        const picked = await page.evaluate(() => {
          const rows = [...document.querySelectorAll(".animal-row")].slice(0, 3);
          for (const row of rows) row.click();
          const button = document.getElementById("animal-to-kraal");
          if (rows.length > 0 && button) button.click();
          return rows.length;
        });
        cutStarted = true;
        record({ step: "cut", rows: picked, ...(await status(page)) });
      } catch (error) {
        cutStarted = true;
        problems.push(`cut-out click failed: ${error.message}`);
        record({ step: "cut-failed", message: error.message });
      }
    }
    if (cutStarted && !saleStarted && (now.cutPhase == null || now.cutPhase === "done")) {
      try {
        await page.locator("#menu-overflow").click();
        await page.locator("#market-open").click();
        await page.locator("#market-count").fill("3");
        await page.locator("#market-sell-btn").click();
        await page.waitForTimeout(400);
        const marketNote = await page.locator("#market-status").textContent().catch(() => "");
        await page.locator("#market-close").click().catch(() => {});
        saleStarted = true;
        record({ step: "sale", marketNote, ...(await status(page)) });
      } catch (error) {
        saleStarted = true;
        problems.push(`sale click failed: ${error.message}`);
        record({ step: "sale-failed", message: error.message });
      }
    }
    if (nightShot && neighbourDone && farDone && saleStarted && nights >= 2) break;
    last = now;
    if (now.phase === "drive") lastHerd = { x: now.herderX, y: now.herderY };
    if (Date.now() - startedAt > 0 && Math.floor((Date.now() - startedAt) / 20000) !== Math.floor((Date.now() - startedAt - 500) / 20000)) {
      console.log("play", now.clock, "day", now.day, "phase", now.phase, "nights", nights);
    }
    await page.waitForTimeout(500);
  }
  const end = await status(page);
  record({ step: "end", nights, nightShot, neighbourDone, farDone, cutStarted, saleStarted, ...end, lastHerd });
  await page.close();
  return log;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, VITE_BASE: "/" },
  });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);
  const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: repoRoot,
    stdio: "ignore",
    env: { ...process.env, VITE_BASE: "/" },
  });
  const problems = [];
  try {
    await waitForServer(`${base}/`);
    const browser = await chromium.launch();
    const shot = await shots(browser);
    console.log("SHOTS", JSON.stringify({ mid: shot.mid, framed: shot.framed, problems: shot.problems }));
    problems.push(...shot.problems);
    if (process.env.SHOTS_ONLY === "1") {
      await browser.close();
      return;
    }
    const played = await play(browser, problems);
    console.log("PLAY", JSON.stringify(played, null, 2));
    console.log("PROBLEMS", JSON.stringify(problems, null, 2));
    await browser.close();
    if (problems.length > 0) process.exitCode = 2;
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
