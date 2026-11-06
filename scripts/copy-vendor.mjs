import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(rootDir, "node_modules/chart.js/dist/chart.umd.min.js");
const destDir = join(rootDir, "src/public/vendor");
const dest = join(destDir, "chart.js");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`vendor: copied ${src} -> ${dest}`);
