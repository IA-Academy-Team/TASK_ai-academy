import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

cpSync(join(rootDir, "src/views"), join(rootDir, "dist/views"), { recursive: true });
cpSync(join(rootDir, "src/public"), join(rootDir, "dist/public"), { recursive: true });

console.log("assets: copied src/views and src/public -> dist/");
