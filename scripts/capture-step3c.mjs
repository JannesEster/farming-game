import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c");
const query = "capture=1&offer=otjozondjupa-ranch";

function waitForServer(url, timeoutMs = 90000) {
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

async function fileHash(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function assertDistinct(hashes, label) {
  const values = Object.values(hashes);
  if (new Set(values).size !== values.length) {
    throw new Error(`${label}: screenshots not distinct`);
  }
}

async function prepPage(page) {
  await page.goto(`http://127.0.0.1:4173/?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__farmCapture?.namedSpritesInView);
  await page.evaluate(() => {
    window.__farmCapture?.prepareForScreenshot?.();
    window.__flowCapture?.skipTutorialForCapture?.();
    document.getElementById("flow-tutorial")?.setAttribute("hidden", "true");
    document.getElementById("event-card")?.setAttribute("hidden", "true");
  });
  await page.waitForTimeout(400);
}

async function fail(page, viewport, label, extra) {
  const debug = await page.evaluate(() => window.__farmCapture?.debugStep3c?.() ?? null);
  throw new Error(`${viewport}: ${label} ${JSON.stringify({ extra, debug })}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  const preview = spawn("npm", ["run", "preview"], { cwd: repoRoot, stdio: "ignore" });
  try {
    await waitForServer("http://127.0.0.1:4173/");
    const browser = await chromium.launch();
    const allHashes = {};
    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await prepPage(page);
      const hashes = {};

      const escapedOk = await page.evaluate(() => window.__farmCapture.prepareEscapeCapture());
      await page.waitForTimeout(250);
      const escaped = await page.evaluate(() => window.__farmCapture.namedSpritesInView("escaped-animal"));
      if (!escapedOk || escaped.count < 1 || escaped.maxScreenPx < 18) {
        await fail(page, viewport.name, "escaped animal not outside the fence", escaped);
      }
      const escapedPath = path.join(outDir, `${viewport.name}-escaped-animal.png`);
      await page.screenshot({ path: escapedPath });
      hashes.escaped = await fileHash(escapedPath);

      const detailOk = await page.evaluate(() => window.__farmCapture.prepareAnimalDetailCapture());
      await page.waitForTimeout(200);
      const detail = await page.evaluate(() => ({
        text: window.__farmCapture.animalDetailText(),
        herd: window.__farmCapture.namedSpritesInView("herd-animal"),
        escaped: window.__farmCapture.namedSpritesInView("escaped-animal"),
      }));
      const detailSprites = detail.herd.count >= 1 ? detail.herd : detail.escaped;
      const detailClean = !/\b(id|campId|stockClass)\b/i.test(`${detail.text.title} ${detail.text.body}`);
      if (!detailOk || !detail.text.title.startsWith("Tag ") || !detailClean || detailSprites.count < 1 || detailSprites.maxScreenPx < 16) {
        await fail(page, viewport.name, "animal detail missing", detail);
      }
      const detailPath = path.join(outDir, `${viewport.name}-animal-detail.png`);
      await page.screenshot({ path: detailPath });
      hashes.detail = await fileHash(detailPath);

      const selectOk = await page.evaluate(() => window.__farmCapture.prepareMultiSelectCapture());
      await page.waitForTimeout(200);
      const selected = await page.evaluate(() => ({
        rows: window.__farmCapture.selectedAnimalCount(),
        herd: window.__farmCapture.namedSpritesInView("herd-animal"),
      }));
      if (!selectOk || selected.rows < 2 || selected.herd.count < 2) {
        await fail(page, viewport.name, "multi-select missing", selected);
      }
      const selectPath = path.join(outDir, `${viewport.name}-multi-select.png`);
      await page.screenshot({ path: selectPath });
      hashes.select = await fileHash(selectPath);

      const cutOk = await page.evaluate(() => window.__farmCapture.prepareCutOutCapture());
      await page.waitForTimeout(250);
      const cut = await page.evaluate(() => window.__farmCapture.namedSpritesInView("cut-out-animal"));
      if (!cutOk || cut.count < 3 || cut.maxScreenPx < 16) {
        await fail(page, viewport.name, "cut-out group not in view", cut);
      }
      const cutPath = path.join(outDir, `${viewport.name}-cut-out-drive.png`);
      await page.screenshot({ path: cutPath });
      hashes.cut = await fileHash(cutPath);

      const facingOk = await page.evaluate(() => window.__farmCapture.prepareFacingCapture());
      await page.waitForTimeout(250);
      const facing = await page.evaluate(() => window.__farmCapture.namedSpritesInView("herd-animal"));
      if (!facingOk || facing.count < 4 || facing.octants.length < 3 || facing.maxScreenPx < 12) {
        await fail(page, viewport.name, "cows not facing several directions", facing);
      }
      const facingPath = path.join(outDir, `${viewport.name}-cows-facing.png`);
      await page.screenshot({ path: facingPath });
      hashes.facing = await fileHash(facingPath);

      const truckOk = await page.evaluate(() => window.__farmCapture.prepareTruckRampCapture());
      await page.waitForTimeout(250);
      const truck = await page.evaluate(() => window.__farmCapture.namedSpritesInView("cattle-truck"));
      if (!truckOk || truck.count < 1 || truck.maxScreenPx < 24) {
        await fail(page, viewport.name, "cattle truck not at the ramp", truck);
      }
      const truckPath = path.join(outDir, `${viewport.name}-cattle-truck-ramp.png`);
      await page.screenshot({ path: truckPath });
      hashes.truck = await fileHash(truckPath);

      assertDistinct(hashes, viewport.name);
      Object.assign(allHashes, Object.fromEntries(Object.entries(hashes).map(([key, value]) => [`${viewport.name}-${key}`, value])));
      await page.close();
    }
    await browser.close();
    console.log("step3c captures ok", Object.keys(allHashes).length, "files");
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
