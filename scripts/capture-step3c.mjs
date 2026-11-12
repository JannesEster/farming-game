import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c");
const query = "capture=1&offer=otjozondjupa-ranch";

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

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
  const audit = await page.evaluate(() => window.__farmCapture?.pictureAudit?.() ?? null);
  throw new Error(`${viewport}: ${label} ${JSON.stringify({ extra, audit, debug })}`);
}

async function assertHerdPicture(page, viewport, label) {
  const audit = await page.evaluate(() => window.__farmCapture.pictureAudit());
  if (audit.overlapFraction > 0.18 || audit.herdOverlapFraction > 0.18 || audit.herdCoversHomestead) {
    await fail(page, viewport, `${label} herd picture`, audit);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const build = spawn("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  const buildCode = await new Promise((resolve) => build.on("close", resolve));
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  const beforeArt = {};
  for (const name of ["desktop", "phone"]) {
    const saved = path.join(outDir, "art-before", `${name}-animal-detail.png`);
    const live = path.join(outDir, `${name}-animal-detail.png`);
    beforeArt[name] = await readFile(await fileExists(saved) ? saved : live);
  }

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
      await assertHerdPicture(page, viewport.name, "escaped");
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
      await assertHerdPicture(page, viewport.name, "detail");
      const detailPath = path.join(outDir, `${viewport.name}-animal-detail.png`);
      await page.screenshot({ path: detailPath });
      hashes.detail = await fileHash(detailPath);
      const comparePath = path.join(outDir, `${viewport.name}-art-before-after.png`);
      await writeFile(comparePath, stitchSideBySide(beforeArt[viewport.name], await readFile(detailPath)));
      hashes.compare = await fileHash(comparePath);

      const selectOk = await page.evaluate(() => window.__farmCapture.prepareMultiSelectCapture());
      await page.waitForTimeout(200);
      const selected = await page.evaluate(() => ({
        rows: window.__farmCapture.selectedAnimalCount(),
        herd: window.__farmCapture.namedSpritesInView("herd-animal"),
      }));
      if (!selectOk || selected.rows < 2 || selected.herd.count < 2) {
        await fail(page, viewport.name, "multi-select missing", selected);
      }
      await assertHerdPicture(page, viewport.name, "multi-select");
      const selectPath = path.join(outDir, `${viewport.name}-multi-select.png`);
      await page.screenshot({ path: selectPath });
      hashes.select = await fileHash(selectPath);

      const cutOk = await page.evaluate(() => window.__farmCapture.prepareCutOutCapture());
      await page.waitForTimeout(250);
      const cut = await page.evaluate(() => window.__farmCapture.namedSpritesInView("cut-out-animal"));
      if (!cutOk || cut.count < 3 || cut.maxScreenPx < 16) {
        await fail(page, viewport.name, "cut-out group not in view", cut);
      }
      await assertHerdPicture(page, viewport.name, "cut-out");
      const cutPath = path.join(outDir, `${viewport.name}-cut-out-drive.png`);
      await page.screenshot({ path: cutPath });
      hashes.cut = await fileHash(cutPath);

      const facingOk = await page.evaluate(() => window.__farmCapture.prepareFacingCapture());
      await page.waitForTimeout(250);
      const facing = await page.evaluate(() => window.__farmCapture.namedSpritesInView("cut-out-animal"));
      if (!facingOk || facing.count < 4 || facing.octants.length < 3 || facing.maxScreenPx < 12) {
        await fail(page, viewport.name, "cows not facing several directions", facing);
      }
      await assertHerdPicture(page, viewport.name, "facing");
      const facingPath = path.join(outDir, `${viewport.name}-cows-facing.png`);
      await page.screenshot({ path: facingPath });
      hashes.facing = await fileHash(facingPath);

      const truckOk = await page.evaluate(() => window.__farmCapture.prepareTruckRampCapture());
      await page.waitForTimeout(250);
      const truck = await page.evaluate(() => window.__farmCapture.namedSpritesInView("cattle-truck"));
      if (!truckOk || truck.count < 1 || truck.maxScreenPx < 24) {
        await fail(page, viewport.name, "cattle truck not at the ramp", truck);
      }
      const sale = await page.evaluate(() => window.__farmCapture.namedSpritesInView("cut-out-animal"));
      if (sale.count < 2) await fail(page, viewport.name, "sale animals not at the yards", sale);
      await assertHerdPicture(page, viewport.name, "truck");
      const truckPath = path.join(outDir, `${viewport.name}-cattle-truck-ramp.png`);
      await page.screenshot({ path: truckPath });
      hashes.truck = await fileHash(truckPath);

      const handlingOk = await page.evaluate(() => window.__farmCapture.prepareHandlingCapture());
      await page.waitForTimeout(250);
      const handling = await page.evaluate(() => ({
        pens: window.__farmCapture.auditKind("holding_pen"),
        crush: window.__farmCapture.auditKind("crush"),
        ramp: window.__farmCapture.auditKind("loading_ramp"),
        truck: window.__farmCapture.namedSpritesInView("cattle-truck"),
        sale: window.__farmCapture.namedSpritesInView("cut-out-animal"),
      }));
      if (
        !handlingOk ||
        handling.pens.inView < 2 ||
        handling.crush.inView < 1 ||
        handling.ramp.inView < 1 ||
        handling.truck.count < 1 ||
        handling.sale.count < 2
      ) {
        await fail(page, viewport.name, "handling yard not in view", handling);
      }
      await assertHerdPicture(page, viewport.name, "handling");
      const handlingPath = path.join(outDir, `${viewport.name}-cattle-handling.png`);
      await page.screenshot({ path: handlingPath });
      hashes.handling = await fileHash(handlingPath);

      const overviewOk = await page.evaluate(() => window.__farmCapture.prepareOverviewCapture());
      await page.waitForTimeout(200);
      if (!overviewOk) await fail(page, viewport.name, "homestead and handling yard not both in view", {});
      await assertHerdPicture(page, viewport.name, "overview");
      const overviewPath = path.join(outDir, `${viewport.name}-farm-overview.png`);
      await page.screenshot({ path: overviewPath });
      hashes.overview = await fileHash(overviewPath);

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
