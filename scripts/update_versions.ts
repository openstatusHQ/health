import { readFile, writeFile } from "node:fs/promises";
import { versionedFiles } from "./versions.ts";

const version = process.argv[2];
if (version == null || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: vp run update-versions <x.y.z>");
  process.exit(1);
}

for (const file of await versionedFiles()) {
  const text = await readFile(file.path, "utf8");
  const updated = text
    .replace(/"version":\s*"[^"]+"/, `"version": "${version}"`)
    .replace(
      /"@openstatus\/health":\s*"\^[^"]+"/g,
      `"@openstatus/health": "^${version}"`,
    );
  await writeFile(file.path, updated);
  console.log(`${file.path}: ${file.version} -> ${version}`);
}
