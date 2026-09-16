import { dirname, join } from "@std/path";
import { build } from "esbuild";
import { workspaceMembers } from "./versions.ts";

interface Target {
  readonly symbol: string;
  readonly allowed: readonly string[];
}

const targets: Record<string, Target> = {
  "@openstatus/health": { symbol: "runProbes", allowed: [] },
  "@openstatus/health-hono": { symbol: "healthRoute", allowed: ["hono"] },
  "@openstatus/health-elysia": { symbol: "healthRoute", allowed: ["elysia"] },
  "@openstatus/health-express": {
    symbol: "healthRoute",
    allowed: ["express"],
  },
  "@openstatus/health-next": { symbol: "healthRoute", allowed: [] },
  "@openstatus/health-tanstack-start": {
    symbol: "healthRoute",
    allowed: [],
  },
  "@openstatus/health-fly": { symbol: "flyExtend", allowed: [] },
  "@openstatus/health-koyeb": { symbol: "koyebExtend", allowed: [] },
  "@openstatus/health-railway": { symbol: "railwayExtend", allowed: [] },
  "@openstatus/health-vercel": { symbol: "vercelExtend", allowed: [] },
  "@openstatus/health-cloudflare": {
    symbol: "cloudflareExtend",
    allowed: [],
  },
  "@openstatus/health-clickhouse": {
    symbol: "clickhouseProbe",
    allowed: [],
  },
  "@openstatus/health-tinybird": { symbol: "tinybirdProbe", allowed: [] },
  "@openstatus/health-drizzle": {
    symbol: "drizzleProbe",
    allowed: ["drizzle-orm"],
  },
  "@openstatus/health-turso": { symbol: "tursoProbe", allowed: [] },
  "@openstatus/health-turso-serverless": {
    symbol: "tursoServerlessProbe",
    allowed: [],
  },
  "@openstatus/health-supabase": { symbol: "supabaseProbe", allowed: [] },
  "@openstatus/health-unkey": { symbol: "unkeyProbe", allowed: [] },
  "@openstatus/health-upstash": { symbol: "upstashProbe", allowed: [] },
  "@openstatus/health-mysql": { symbol: "mysqlProbe", allowed: [] },
  "@openstatus/health-postgres": { symbol: "postgresProbe", allowed: [] },
  "@openstatus/health-neon": { symbol: "neonProbe", allowed: [] },
  "@openstatus/health-planetscale": { symbol: "planetscaleProbe", allowed: [] },
  "@openstatus/health-redis": { symbol: "redisProbe", allowed: [] },
  "@openstatus/health-mongodb": { symbol: "mongodbProbe", allowed: [] },
  "@openstatus/health-prisma": { symbol: "prismaProbe", allowed: [] },
};

const banned = [
  "hono",
  "elysia",
  "express",
  "next",
  "@tanstack/react-router",
  "@tanstack/react-start",
  "@tanstack/router-core",
  "drizzle-orm",
  "@libsql/client",
  "@tursodatabase/serverless",
  "@supabase/supabase-js",
  "@clickhouse/client",
  "mysql2",
  "pg",
  "postgres",
  "@neondatabase/serverless",
  "@planetscale/database",
  "redis",
  "ioredis",
  "mongodb",
  "@prisma/client",
];

const root: string = dirname(import.meta.dirname!);

interface Member {
  readonly name: string;
}

async function members(): Promise<Member[]> {
  const result: Member[] = [];
  for (const member of await workspaceMembers()) {
    const text = await Deno.readTextFile(join(root, member, "deno.json"));
    const data: { name: string } = JSON.parse(text);
    result.push({ name: data.name });
  }
  return result;
}

function isBanned(input: string, dependency: string): boolean {
  return input.includes(`node_modules/${dependency}/`) ||
    input.startsWith(`${dependency}/`);
}

const failures: string[] = [];
const all = await members();

for (const member of all) {
  const target = targets[member.name];
  if (target == null) {
    failures.push(`${member.name}: no tree-shake target configured`);
    continue;
  }
  const result = await build({
    stdin: {
      contents: `import { ${target.symbol} } from ${
        JSON.stringify(member.name)
      };\nconsole.log(${target.symbol});\n`,
      resolveDir: root,
      sourcefile: "treeshake-entry.js",
      loader: "js",
    },
    absWorkingDir: root,
    bundle: true,
    metafile: true,
    write: false,
    format: "esm",
    platform: "node",
    external: all.map((m) => m.name).filter((name) => name !== member.name),
    logLevel: "silent",
  });
  const inputs = Object.keys(result.metafile.inputs);
  if (!inputs.some((input) => input.includes("/dist/"))) {
    failures.push(`${member.name}: dist/ output was not bundled`);
  }
  for (const input of inputs) {
    for (const dependency of banned) {
      if (target.allowed.includes(dependency)) continue;
      if (isBanned(input, dependency)) {
        failures.push(
          `${member.name}: bundled unexpected dependency ${dependency} (${input})`,
        );
      }
    }
  }
  console.log(
    `${member.name}: ${inputs.length} modules, allowed: ${
      target.allowed.join(", ") || "none"
    }`,
  );
}

if (failures.length > 0) {
  console.error("Tree-shaking check failed:");
  for (const failure of failures) console.error(`  ${failure}`);
  Deno.exit(1);
}
console.log("Tree-shaking check passed");
