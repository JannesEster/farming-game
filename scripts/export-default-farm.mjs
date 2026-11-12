import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const { CONFIG } = await import(path.join(repoRoot, "src/sim/config.ts"));
  const { createGame } = await import(path.join(repoRoot, "src/sim/simulation.ts"));
  const { farmDefinitionFromState } = await import(path.join(repoRoot, "src/sim/farmDefinition.ts"));
  const state = createGame(CONFIG.worldSeed);
  state.seed = CONFIG.worldSeed;
  const def = farmDefinitionFromState(state);
  const out = path.join(repoRoot, "public/farms/default-farm.json");
  writeFileSync(out, JSON.stringify(def));
  console.log("Wrote", out, "bytes", JSON.stringify(def).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
