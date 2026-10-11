import { versionedFiles } from "./versions.ts";

const expected = process.argv[2];
const files = await versionedFiles();
const versions = new Set(files.map((f) => f.version));
const version = [...versions][0];

if (versions.size > 1) {
  console.error("Versions are inconsistent:");
  for (const file of files) console.error(`  ${file.path}: ${file.version}`);
  process.exit(1);
}

if (expected != null && expected !== version) {
  console.error(`Manifests are at ${version}, expected ${expected}`);
  process.exit(1);
}

const stalePeers = files.filter(
  (f) => f.corePeerRange != null && f.corePeerRange !== `^${version}`,
);
if (stalePeers.length > 0) {
  console.error(`@openstatus/health peer ranges do not match ^${version}:`);
  for (const file of stalePeers) {
    console.error(`  ${file.path}: ${file.corePeerRange}`);
  }
  process.exit(1);
}
console.log(`All ${files.length} manifests are at ${version}`);
