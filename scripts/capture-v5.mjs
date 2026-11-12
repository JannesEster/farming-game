import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "docs/screenshots/step3c1");
const port = 4175;
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

async function clipReport(page) {
  return page.evaluate(() => {
    const inspect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return { selector, missing: true };
      const style = getComputedStyle(el);
      if (el.hidden || style.display === "none") return { selector, hidden: true, text: el.textContent };
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      if (rects.length === 0) return { selector, empty: true, text: el.textContent };
      const top = Math.min(...rects.map((rect) => rect.top));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      const clips = [];
      let node = el.parentElement;
      while (node) {
        const parent = getComputedStyle(node);
        if (parent.overflowY !== "visible" || parent.overflowX !== "visible") {
          const box = node.getBoundingClientRect();
          const clipTop = box.top + (parseFloat(parent.paddingTop) || 0);
          const clipBottom = box.bottom - (parseFloat(parent.paddingBottom) || 0);
          const cutsThrough = top < clipTop - 0.6 && bottom > clipTop + 0.6 || bottom > clipBottom + 0.6 && top < clipBottom - 0.6;
          if (cutsThrough) {
            clips.push({
              id: node.id || node.className,
              overTop: Math.round((clipTop - top) * 10) / 10,
              overBottom: Math.round((bottom - clipBottom) * 10) / 10,
            });
          }
        }
        node = node.parentElement;
      }
      return {
        selector,
        text: el.textContent,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        clips,
      };
    };
    return [
      "#herd-name",
      "#sheet-line",
      "#animal-detail-title",
      "#market-title",
      "#ops-title",
      "#ops-heading-grid",
      "#ops-heading-levers",
      "#ops-event-title",
    ].map(inspect);
  });
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
  const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: repoRoot,
    stdio: "ignore",
    env: { ...process.env, VITE_BASE: "/" },
  });
  try {
    await waitForServer(`${base}/`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const problems = [];
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
    });
    await page.goto(`${base}/?capture=1&offer=otjozondjupa-ranch`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__farmCapture?.prepareRoadWideCapture, null, { timeout: 30000 });
    await page.evaluate(() => window.__farmCapture.prepareForScreenshot());
    const road = await page.evaluate(() => window.__farmCapture.prepareRoadWideCapture());
    if (!road) throw new Error("road frame failed");
    await page.waitForTimeout(400);
    const roadMeta = await page.evaluate(() => ({
      scale: document.getElementById("scale-label")?.textContent ?? "",
      zoom: window.__farmCapture.openingZoom ? null : null,
    }));
    const zoom = await page.evaluate(() => {
      window.__farmCapture.prepareRoadWideCapture();
      return document.getElementById("scale-label")?.textContent ?? "";
    });
    await page.screenshot({ path: path.join(outDir, "desktop-road-gate-to-yard-v5.png") });

    await page.evaluate(() => {
      window.__farmCapture.prepareForScreenshot();
      window.__farmCapture.setPlayClock(20, 30);
      window.__farmCapture.prepareHomesteadAtDefaultZoom();
      window.__farmCapture.selectHerd();
      const sheet = document.getElementById("herd-sheet");
      if (sheet?.dataset.expanded !== "true") document.getElementById("sheet-summary")?.click();
      const detail = document.getElementById("sheet-detail");
      if (detail) detail.scrollTop = 0;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, "desktop-night-v5.png") });
    const nightHeader = await clipReport(page);

    await page.evaluate(() => {
      const row = document.querySelector(".animal-row");
      row?.click();
    });
    await page.waitForTimeout(200);
    const animal = await clipReport(page);
    await page.screenshot({ path: "/tmp/v5-animal.png" });

    await page.evaluate(() => document.getElementById("market-open")?.click());
    await page.waitForTimeout(200);
    const market = await clipReport(page);
    await page.screenshot({ path: "/tmp/v5-market.png" });
    await page.evaluate(() => document.getElementById("market-close")?.click());

    await page.evaluate(() => document.getElementById("ranch-open")?.click());
    await page.waitForTimeout(200);
    const ops = await clipReport(page);
    await page.screenshot({ path: "/tmp/v5-ops.png" });

    console.log(JSON.stringify({ road, scale: roadMeta, zoomLabel: zoom, problems, nightHeader, animal, market, ops }, null, 2));
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
