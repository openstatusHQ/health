import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface Manifest {
  name: string;
  version?: string;
  peerDependencies?: Record<string, string>;
}

export interface Member {
  readonly name: string;
  readonly dir: string;
}

export interface VersionedFile {
  readonly path: string;
  readonly version: string;
  readonly corePeerRange?: string;
}

export const root: string = dirname(import.meta.dirname);

async function readManifest(path: string): Promise<Manifest> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function workspaceMembers(): Promise<Member[]> {
  const entries = await readdir(join(root, "packages"), {
    withFileTypes: true,
  });
  const members: Member[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, "packages", entry.name);
    const manifest = await readManifest(join(dir, "package.json"));
    members.push({ name: manifest.name, dir });
  }
  return members.sort((a, b) => a.dir.localeCompare(b.dir));
}

export async function versionedFiles(): Promise<VersionedFile[]> {
  const files: VersionedFile[] = [];
  for (const member of await workspaceMembers()) {
    const path = join(member.dir, "package.json");
    const manifest = await readManifest(path);
    if (manifest.version == null) continue;
    files.push({
      path,
      version: manifest.version,
      corePeerRange: manifest.peerDependencies?.["@openstatus/health"],
    });
  }
  return files;
}
