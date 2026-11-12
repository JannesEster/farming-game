import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step1");

function waitForServer(url, timeoutMs = 60000) {
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
      else setTimeout(tick, 300);
    };
    tick();
  });
}

/** Mean luminance of centre crop (matches in-browser canvas sampling). */
function pngMeanLuminance(filePath) {
  const buf = readFileSync(filePath);
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  const sampleW = Math.min(420, width);
  const sampleH = Math.min(360, height);
  const ox = Math.floor((width - sampleW) / 2);
  const oy = Math.floor((height - sampleH) / 2);
  let sum = 0;
  let n = 0;
  for (let y = oy; y < oy + sampleH; y += 1) {
    for (let x = ox; x < ox + sampleW; x += 1) {
      const i = (width * y + x) << 2;
      sum += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      n += 1;
    }
  }
  return sum / Math.max(1, n);
}

function assertHerdFramed(diag, label, opts = {}) {
  const minCows = opts.minCows ?? 30;
  const requireTransit = opts.requireTransit ?? true;
  const dx = diag.mobCenter.x - diag.cameraCenter.x;
  const dy = diag.mobCenter.y - diag.cameraCenter.y;
  const dist = Math.hypot(dx, dy);
  if (diag.cattleInView < minCows) {
    throw new Error(`${label}: only ${diag.cattleInView} cattle in camera view (need ${minCows})`);
  }
  if (dist > 480) {
    throw new Error(`${label}: camera off herd centroid by ${Math.round(dist)}px (mob ${JSON.stringify(diag.mobCenter)}, cam ${JSON.stringify(diag.cameraCenter)})`);
  }
  if (requireTransit && !diag.inTransit) {
    throw new Error(`${label}: herd not in transit at capture time (progress=${diag.transitProgress})`);
  }
}

async function waitForTransitMidpoint(page) {
  const started = await page.evaluate(() => window.__farmCapture?.triggerHerdMoveDemo?.());
  if (!started?.started) throw new Error(`Herd move did not start: ${JSON.stringify(started)}`);
  await page.evaluate(() => window.__farmCapture?.setSpeed?.("x3"));
  for (let i = 0; i < 160; i += 1) {
    const diag = await page.evaluate(() => window.__farmCapture?.captureDiagnostics?.());
    if (diag?.inTransit && diag.transitProgress >= 0.22 && diag.transitProgress <= 0.72) {
      await page.evaluate(
        (p) => window.__farmCapture?.holdTransitProgress?.(p),
        diag.transitProgress,
      );
      return diag.transitProgress;
    }
    await page.waitForTimeout(200);
  }
  const last = await page.evaluate(() => window.__farmCapture?.captureDiagnostics?.());
  throw new Error(`Herd never reached transit midpoint: ${JSON.stringify(last)}`);
}

async function waitForNightReady(page) {
  await page.waitForFunction(() => {
    const d = window.__farmCapture?.captureDiagnostics?.();
    return d && d.hour === 22 && d.nightAlpha >= 0.55 && (d.hudTime === "22:00" || d.hudTime?.includes("22"));
  });
  await page.waitForTimeout(350);
}

async function waitForCattleInView(page, min = 30) {
  await page.waitForFunction(
    (m) => (window.__farmCapture?.countCattleInView?.() ?? 0) >= m,
    min,
    { timeout: 15000 },
  );
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  const preview = spawn("npm", ["run", "preview"], { cwd: repoRoot, stdio: "ignore" });
  const checks = [];
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    let closeupDone = false;
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.goto("http://127.0.0.1:4173/?capture=1&offer=otjozondjupa-ranch", {
        waitUntil: "networkidle",
      });
      await page.waitForFunction(() => window.__farmCapture?.sampleFps);
      await page.evaluate(() => {
        window.__farmCapture?.prepareForScreenshot?.();
        window.__flowCapture?.skipTutorialForCapture?.();
        document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
        document.getElementById("event-card")?.setAttribute("hidden", "true");
      });
      await page.waitForTimeout(600);

      const dayPath = path.join(outDir, `${viewport.name}-day.png`);
      await page.screenshot({ path: dayPath });
      const dayLumaPng = pngMeanLuminance(dayPath);

      await page.evaluate(() => window.__farmCapture?.setNightForCapture?.());
      await waitForNightReady(page);
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const nightPath = path.join(outDir, `${viewport.name}-night.png`);
      await page.screenshot({ path: nightPath });
      const nightLumaPng = pngMeanLuminance(nightPath);
      const nightDiag = await page.evaluate(() => window.__farmCapture?.captureDiagnostics?.());
      const dayLuma = dayLumaPng;
      const nightLuma = nightLumaPng;
      if (nightLuma >= dayLuma * 0.6) {
        throw new Error(
          `${viewport.name} night too bright: night=${nightLuma.toFixed(1)} day=${dayLuma.toFixed(1)} hud=${nightDiag?.hudTime}`,
        );
      }
      checks.push(
        `${viewport.name}-night: luma ${nightLuma.toFixed(0)}/${dayLuma.toFixed(0)} hr=${nightDiag?.hour} hud=${nightDiag?.hudTime}`,
      );

      await page.evaluate(() => window.__farmCapture?.resetDaylightForCapture?.());
      await page.waitForTimeout(400);

      await page.evaluate(() => window.__farmCapture?.zoomGrassNearCapture?.());
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-grass-near.png`) });

      await page.evaluate(() => window.__farmCapture?.zoomGrassFarCapture?.());
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-grass-far.png`) });

      await page.screenshot({ path: path.join(outDir, `${viewport.name}-scale-bar.png`) });

      await waitForTransitMidpoint(page);
      await page.evaluate(() => window.__farmCapture?.zoomHerdWalkCapture?.());
      await waitForCattleInView(page, 30);
      await page.waitForTimeout(400);
      const walkDiag = await page.evaluate(() => window.__farmCapture?.captureDiagnostics?.());
      assertHerdFramed(walkDiag, `${viewport.name}-herd-walk`);
      const walkPath = path.join(outDir, `${viewport.name}-herd-walk.png`);
      await page.screenshot({ path: walkPath });
      checks.push(`${viewport.name}-herd-walk: ${walkDiag.cattleInView} cows, progress=${walkDiag.transitProgress}`);

      if (!closeupDone && viewport.name === "desktop") {
        await page.evaluate(() => window.__farmCapture?.zoomHerdCloseupCapture?.());
        await waitForCattleInView(page, 30);
        await page.waitForTimeout(400);
        const closeDiag = await page.evaluate(() => window.__farmCapture?.captureDiagnostics?.());
        assertHerdFramed(closeDiag, "desktop-herd-closeup", { minCows: 10, requireTransit: true });
        await page.screenshot({ path: path.join(outDir, "desktop-herd-closeup.png") });
        checks.push(`desktop-herd-closeup: ${closeDiag.cattleInView} cows`);
        closeupDone = true;
      }

      await page.evaluate(() => {
        window.__farmCapture?.resetDaylightForCapture?.();
        window.__farmCapture?.prepareForScreenshot?.();
      });
      await page.evaluate(() => window.__farmCapture?.openNotificationsDemo?.());
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-notifications.png`) });

      await page.evaluate(() => window.__farmCapture?.showMonthSummaryDemo?.());
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `${viewport.name}-month-card.png`) });

      await page.close();
    }
    await browser.close();
  } finally {
    preview.kill("SIGTERM");
  }
  console.log("Capture checks passed:\n" + checks.map((line) => `  - ${line}`).join("\n"));
  console.log("Saved step1 screenshots to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
