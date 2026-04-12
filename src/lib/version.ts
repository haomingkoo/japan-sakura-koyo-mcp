import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Single source of truth — reads package.json at process start.
// Import this instead of hardcoding a version anywhere.
const __dir = dirname(fileURLToPath(import.meta.url));
export const VERSION: string = (
  JSON.parse(readFileSync(join(__dir, "../../package.json"), "utf-8")) as { version: string }
).version;
