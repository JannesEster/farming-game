import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const server = await createServer({
    root: repoRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const { CONFIG } = await server.ssrLoadModule("/src/sim/config.ts");
    const { generateFarm } = await server.ssrLoadModule("/src/sim/generate.ts");
    const { farmDefinitionFromState } = await server.ssrLoadModule("/src/sim/farmDefinition.ts");
    const state = generateFarm(CONFIG.worldSeed);
    state.seed = CONFIG.worldSeed;
    const def = farmDefinitionFromState(state);
    const out = path.join(repoRoot, "public/farms/default-farm.json");
    writeFileSync(out, JSON.stringify(def));
    const pens = def.features.filter((feature) => feature.kind === "holding_pen").length;
    console.log("Wrote", out, "bytes", JSON.stringify(def).length, "pens", pens);
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
