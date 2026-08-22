import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const mapLibreDistDirectory = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const destinationDirectory = join(process.cwd(), "public", "maplibre");
const workerFiles = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

// Workerと共有モジュールを同じ公開ディレクトリへ配置し、Worker内の相対importを維持します。
mkdirSync(destinationDirectory, { recursive: true });

for (const workerFile of workerFiles) {
  copyFileSync(join(mapLibreDistDirectory, workerFile), join(destinationDirectory, workerFile));
}
