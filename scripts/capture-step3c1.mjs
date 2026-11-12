import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { PNG } from "pngjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c1");
const beforeDir = path.join(repoRoot, "docs/screenshots/step3c");
const query = "capture=1&offer=otjozondjupa-ranch";

function stitchSideBySide(beforeBuf, afterBuf) {
  const before = PNG.sync.read(beforeBuf);
  const after = PNG.sync.read(afterBuf);
  const height = Math.min(before.height, after.height);
  const gutter = 16;
  const out = new PNG({ width: before.width + after.width + gutter, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < before.width; x += 1) {
      const src = (y * before.width + x) << 2;
      const dst = (y * out.width + x) << 2;
      out.data[dst] = before.data[src];
      out.data[dst + 1] = before.data[src + 1];
      out.data[dst + 2] = before.data[src + 2];
      out.data[dst + 3] = 255;
    }
    for (let x = 0; x < gutter; x += 1) {
      const dst = (y * out.width + before.width + x) << 2;
      out.data[dst] = 40;
      out.data[dst + 1] = 32;
      out.data[dst + 2] = 24;
      out.data[dst + 3] = 255;
    }
    for (let x = 0; x < after.width; x += 1) {
      const src = (y * after.width + x) << 2;
      const dst = (y * out.width + before.width + gutter + x) << 2;
      out.data[dst] = after.data[src];
      out.data[dst + 1] = after.data[src + 1];
      out.data[dst + 2] = after.data[src + 2];
      out.data[dst + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}

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

async function prepPage(page) {
  await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.namedSpritesInView, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__farmCapture?.prepareForScreenshot?.();
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
  });
  await page.waitForTimeout(400);
}

async function shot(page, file, prepare) {
  const ok = await page.evaluate(prepare);
  await page.waitForTimeout(350);
  if (!ok) {
    const debug = await page.evaluate(() => window.__farmCapture?.debugStep3c?.() ?? null);
    throw new Error(`${file} prepare failed ${JSON.stringify(debug)}`);
  }
  await page.screenshot({ path: file });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit", env: { ...process.env, VITE_BASE: "/" } });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  const preview = spawn("npm", ["run", "preview"], { cwd: repoRoot, stdio: "ignore", env: { ...process.env, VITE_BASE: "/" } });
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await prepPage(page);

      await shot(page, path.join(outDir, `${viewport.name}-homestead-close.png`), () => window.__farmCapture.prepareHomesteadCloseCapture());
      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.prepareTruckRampCapture);
      await page.evaluate(() => {
        window.__flowCapture?.skipTutorialForCapture?.();
        document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
      });
      await shot(page, path.join(outDir, `${viewport.name}-yard-truck.png`), () => window.__farmCapture.prepareTruckRampCapture());

      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.prepareCutOutCapture);
      await page.evaluate(() => {
        window.__flowCapture?.skipTutorialForCapture?.();
        document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
      });
      await shot(page, path.join(outDir, `${viewport.name}-worker-drive.png`), () => window.__farmCapture.prepareCutOutCapture());

      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.prepareHomesteadCapture);
      await page.evaluate(() => {
        window.__flowCapture?.skipTutorialForCapture?.();
        document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
      });
      await shot(page, path.join(outDir, `${viewport.name}-homestead.png`), () => window.__farmCapture.prepareHomesteadCapture());

      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.prepareHandlingCapture);
      await page.evaluate(() => {
        window.__flowCapture?.skipTutorialForCapture?.();
        document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
      });
      await shot(page, path.join(outDir, `${viewport.name}-yard.png`), () => window.__farmCapture.prepareHandlingCapture());

      await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__farmCapture?.prepareScaleReferenceCapture);
      await page.evaluate(() => {
        window.__flowCapture?.skipTutorialForCapture?.();
        document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
      });
      await shot(page, path.join(outDir, `${viewport.name}-scale-reference.png`), () => window.__farmCapture.prepareScaleReferenceCapture());

      if (viewport.name === "phone") {
        const fps = await page.evaluate(() => window.__farmCapture.gameFps());
        console.log(`phone viewport fps ${Number(fps).toFixed(1)}`);
      }
      await page.close();
    }
    await browser.close();

    for (const viewport of ["desktop", "phone"]) {
      const homesteadBefore = await readFile(path.join(beforeDir, `${viewport}-homestead.png`));
      const yardBefore = await readFile(path.join(beforeDir, `${viewport}-cattle-truck-ramp.png`));
      await writeFile(path.join(outDir, `${viewport}-homestead-before.png`), homesteadBefore);
      await writeFile(path.join(outDir, `${viewport}-yard-before.png`), yardBefore);
      await writeFile(
        path.join(outDir, `${viewport}-homestead-before-after.png`),
        stitchSideBySide(homesteadBefore, await readFile(path.join(outDir, `${viewport}-homestead.png`))),
      );
      await writeFile(
        path.join(outDir, `${viewport}-yard-before-after.png`),
        stitchSideBySide(yardBefore, await readFile(path.join(outDir, `${viewport}-yard-truck.png`))),
      );
    }
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
