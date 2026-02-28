import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildDatasetFromSources } from "../lib/data/buildDataset";

async function main() {
  const root = process.cwd();
  const dataDir = path.join(root, "data");
  const outputDir = path.join(root, "public", "generated");
  const airportsCsv = await readFile(path.join(dataDir, "airports.csv"), "utf8");
  const routesCsv = await readFile(path.join(dataDir, "routes.csv"), "utf8");
  const dataset = buildDatasetFromSources(airportsCsv, routesCsv);

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDir, "manifest.v1.json"),
      `${JSON.stringify(dataset.manifest, null, 2)}\n`
    ),
    writeFile(
      path.join(outputDir, "airports.v1.json"),
      `${JSON.stringify(dataset.airports, null, 2)}\n`
    ),
    writeFile(
      path.join(outputDir, "routes.v1.json"),
      `${JSON.stringify(dataset.routes, null, 2)}\n`
    ),
  ]);

  process.stdout.write(
    `Generated ${dataset.manifest.airportCount} airports and ${dataset.manifest.routeCount} routes.\n`
  );
}

main().catch((error: Error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
