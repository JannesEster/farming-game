import defaultFarm from "../../public/farms/default-farm.json";
import { CONFIG } from "../sim/config";
import { primeDefaultFarmCache } from "../sim/simulation";

primeDefaultFarmCache(defaultFarm as import("../sim/farmDefinition").FarmDefinition, CONFIG);
