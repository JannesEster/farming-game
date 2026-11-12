import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c1");
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
  await page.waitForFunction(() => window.__farmCapture?.startNeighbourDriveCapture, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
    window.__farmCapture.armDriveCapture();
  });
}

async function status(page) {
  return page.evaluate(() => window.__farmCapture.driveCaptureStatus());
}

async function dismissCards(page) {
  await page.evaluate(() => window.__farmCapture.dismissCaptureBlockers());
}

async function frame(page) {
  await page.evaluate(() => window.__farmCapture.frameHerdForCapture(1.15));
}

async function waitUntil(page, label, predicate, timeoutMs) {
  const start = Date.now();
  let last = null;
  let still = 0;
  while (Date.now() - start < timeoutMs) {
    const next = await status(page);
    if (last && next.clock === last.clock && next.approach === last.approach && next.progress === last.progress) still += 1;
    else still = 0;
    if (still >= 6) await dismissCards(page);
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

    if (process.env.DUSK_ONLY === "1" || process.env.SALE_ONLY === "1") {
      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await boot(page);
    } else {
    const started = await page.evaluate(() => window.__farmCapture.startNeighbourDriveCapture(10, 0));
    log.push({ step: "neighbour-start", started });
    if (!started.ok || !started.shared) throw new Error(`neighbour move did not start ${JSON.stringify(started)}`);

    const leaving = await waitUntil(
      page,
      "herder leaving",
      (s) => (s.phase === "approach" && (s.approach ?? 0) > 0.2) || s.phase === "drive",
      45000,
    );
    await frame(page);
    await page.screenshot({ path: path.join(outDir, "neighbour-leave.png") });
    log.push({ step: "leave", ...leaving });

    const mid = await waitUntil(
      page,
      "mid drive",
      (s) => s.phase === "drive" && (s.progress ?? 0) > 0.5 && (s.progress ?? 0) < 0.92,
      90000,
    );
    await frame(page);
    await page.screenshot({ path: path.join(outDir, "neighbour-mid.png") });
    log.push({ step: "mid", ...mid });

    const arrived = await waitUntil(page, "arrival", (s) => s.phase === null, 90000);
    await frame(page);
    await page.screenshot({ path: path.join(outDir, "neighbour-arrive.png") });
    log.push({ step: "arrive", ...arrived });

    const spreadHour = (arrived.hour + 1) % 24;
    const spread = await waitUntil(page, "spread", (s) => s.hour === spreadHour, 40000);
    await page.waitForTimeout(2000);
    const spreadNow = await status(page);
    await frame(page);
    await page.screenshot({ path: path.join(outDir, "neighbour-spread.png") });
    log.push({ step: "spread", ...spreadNow, firstChange: spread.clock });
    }

    if (process.env.SALE_ONLY !== "1") {
    await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
    await boot(page);
    const late = await page.evaluate(() => window.__farmCapture.startNeighbourDriveCapture(16, 30));
    log.push({ step: "dusk-start", late });
    if (!late.ok) throw new Error(`16:30 drive did not start ${JSON.stringify(late)}`);
    const clocks = [];
    const duskStart = Date.now();
    let dusk = null;
    const duskBudget = process.env.DUSK_ONLY === "1" ? 150000 : 150000;
    while (Date.now() - duskStart < duskBudget) {
      dusk = await status(page);
      clocks.push(`${dusk.clock} a${dusk.approach ?? "-"} p${dusk.progress ?? "-"} ${dusk.phase ?? "done"}`);
      if (clocks.length % 8 === 1) console.log("sample", clocks[clocks.length - 1], dusk.freeze, dusk.speed);
      if (dusk.phase === null) await dismissCards(page);
      dusk = await status(page);
      if (dusk.phase === null && (dusk.hour >= 18 || dusk.hour < 6)) break;
      await page.waitForTimeout(400);
    }
    if (!dusk || dusk.phase !== null || !(dusk.hour >= 18 || dusk.hour < 6)) {
      throw new Error(`past dusk timed out ${JSON.stringify(dusk)}`);
    }
    await frame(page);
    await page.screenshot({ path: path.join(outDir, "dusk-1630.png") });
    log.push({ step: "dusk", ...dusk, clocks: [...new Set(clocks)] });
    if (!/^\d\d:\d\d$/.test(dusk.clock)) throw new Error(`clock not HH:MM: ${dusk.clock}`);

    await page.screenshot({ path: path.join(outDir, "clock-hhmm.png") });
    }

    await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
    await boot(page);
    const beforeSale = await status(page);
    const sale = await page.evaluate(() => window.__farmCapture.startHeiferSaleCapture());
    log.push({ step: "sale-start", sale, beforeCash: beforeSale.cash, beforeHead: beforeSale.head });
    if (!sale.ok) throw new Error(`sale did not start ${JSON.stringify(sale)}`);
    const paid = await waitUntil(page, "sale paid", (s) => s.paid || s.cash > beforeSale.cash, 180000);
    await page.evaluate(() => window.__farmCapture.refreshCapturePanels());
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, "sale-paid.png") });
    log.push({ step: "sale-paid", ...paid });
    if (!(paid.cash > beforeSale.cash)) throw new Error(`cash did not rise ${beforeSale.cash} -> ${paid.cash}`);

    await browser.close();
    await writeFile(path.join(outDir, "drive-polish-log.json"), JSON.stringify(log, null, 2));
    console.log(JSON.stringify(log, null, 2));
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
