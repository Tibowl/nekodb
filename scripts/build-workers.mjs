#!/usr/bin/env node
/**
 * Turbopack/Next export emits `Worker(new URL("*.ts"))` as raw assets — bundle workers with esbuild.
 */
import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const workers = [
  ["utils/yardOptimizer/mementoYardSim.worker.ts", "public/workers/memento-yard-sim.worker.js"],
  [
    "utils/yardOptimizer/yardFitnessBatch.worker.ts",
    "public/workers/yard-fitness-batch.worker.js",
  ],
]

await mkdir(join(root, "public/workers"), { recursive: true })

for (const [entry, outRel] of workers) {
  const outfile = join(root, outRel)
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2020",
    outfile,
    logLevel: "info",
  })
  if (result.errors.length > 0) process.exit(1)
  console.log("[build-workers] wrote", outfile)
}
