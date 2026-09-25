// Combined site registry for the NullTrace Worker.
import { PART as PART1 } from "./sites_part1.js";
import { PART as PART2 } from "./sites_part2.js";

export const SITES = [...PART1, ...PART2].sort((a, b) => a.name.localeCompare(b.name));
