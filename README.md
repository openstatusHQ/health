<div align="center">
  <h1>@openstatus/health</h1>
  <p><strong>Health endpoints for JavaScript servers that say <em>which</em> dependency is down.</strong></p>

[![CI](https://github.com/openstatusHQ/health/actions/workflows/main.yaml/badge.svg)](https://github.com/openstatusHQ/health/actions/workflows/main.yaml)
[![JSR](https://jsr.io/badges/@openstatus/health)](https://jsr.io/@openstatus/health)
[![npm](https://img.shields.io/npm/v/@openstatus/health)](https://www.npmjs.com/package/@openstatus/health)
[![npm downloads](https://img.shields.io/npm/dm/@openstatus/health)](https://www.npmjs.com/package/@openstatus/health)
[![Discord](https://img.shields.io/badge/Discord-join%20the%20chat-5865F2?logo=discord&logoColor=white)](https://discord.gg/openstatus)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

  <a href="packages/health#readme">Documentation</a> •
  <a href="#packages">Packages</a> •
  <a href="examples">Examples</a> •
  <a href="https://discord.gg/openstatus">Discord</a> •
  <a href="https://www.openstatus.dev/">openstatus</a>
</div>

---

A dependency-free core runs *probes* against your database, cache and
upstream APIs and renders `ok | degraded | unhealthy`. Thin adapters mount it
as `GET /health` on Hono, Elysia, Express, Next.js, TanStack Start or any
Fetch-API server. Thin probe packages know how to ping one dependency each.

Runs on Deno, Node ≥ 22, Bun and edge runtimes. Published to JSR and npm.
These are the `/health` endpoints behind [openstatus](https://www.openstatus.dev/)'s
own services, extracted so any server can expose one.

## Quick start

Install the core, one adapter and the probes you need:

```sh
npm install @openstatus/health @openstatus/health-hono @openstatus/health-turso
# or
deno add jsr:@openstatus/health jsr:@openstatus/health-hono jsr:@openstatus/health-turso
```

Mount the route:

```ts
import { Hono } from "hono";
import { createClient } from "@libsql/client";
import { healthRoute } from "@openstatus/health-hono";
import { tursoProbe } from "@openstatus/health-turso";
import { unkeyProbe } from "@openstatus/health-unkey";

const client = createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN });

const app = new Hono();
app.route("/", healthRoute({ probes: [tursoProbe({ client }), unkeyProbe()] }));

export default app;
```

`GET /health` answers with the aggregate status and one entry per probe:

```json
{
  "status": "degraded",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "latencyMs": 41,
  "checks": [
    { "name": "database", "status": "ok",      "critical": true,  "latencyMs": 3 },
    { "name": "redis",    "status": "skipped", "critical": false, "latencyMs": 0 },
    { "name": "unkey",    "status": "timeout", "critical": false, "latencyMs": 5000, "error": "timed out after 5000ms" }
  ]
}
```

`ok` and `degraded` answer `200`, `unhealthy` answers `503`; both codes are
configurable. A failing or timed-out **critical** probe makes the report
`unhealthy`, a failing non-critical probe makes it `degraded`, and `skipped`
probes never affect it. Responses are sent with `Cache-Control: no-store`.

## Why @openstatus/health

- **Zero dependencies in the core.** The probe runner, cache and renderer have
  no runtime dependencies, so the endpoint you add is the endpoint you audit.
- **One package per concern, tree-shakable by construction.** Import
  `@openstatus/health-hono` without pulling Express; import
  `@openstatus/health-unkey` without pulling Drizzle. CI bundles a one-line
  consumer of every package and fails if an unrelated library lands in the
  output.
- **Same behaviour on every framework.** Adapters contain no response logic;
  they mount one core, so status codes, caching and rendering are identical
  whether you run Hono on Bun or Express on Node.
- **Probes never read your environment.** A probe takes a client or a URL, so
  it is testable and shareable; optional dependencies report `skipped` instead
  of failing when they are not configured.
- **Built for real infrastructure.** Per-probe timeouts, a whole-round
  `deadlineMs`, caching, stale-while-revalidate, and separate liveness and
  readiness routes.
- **Know which replica answered.** Hosting packages add `region`,
  `instanceId`, `service` and `version` under `server` through the `extend`
  hook.

## Adapters

Every adapter exports `healthRoute(options)`, the batteries-included form
that mounts `GET` and `HEAD` on `options.path` (default `/health`). All but
Next.js also export `healthHandler(options)` — a plain handler for that
framework — for when you want to pick the path, stack your own middleware in
front, or register it the way you register everything else.

<details open>
<summary><strong>Hono</strong></summary>

```ts
import { Hono } from "hono";
import { healthHandler, healthRoute } from "@openstatus/health-hono";
import { tursoProbe } from "@openstatus/health-turso";
import { unkeyProbe } from "@openstatus/health-unkey";

const app = new Hono();

app.route("/", healthRoute({
  probes: [tursoProbe({ client }), unkeyProbe()],
  extend: (_report, c) => ({ requestId: c.get("requestId") }),
}));

// or, on a route of your own:
app.on(["GET", "HEAD"], "/health", healthHandler({ probes: [unkeyProbe()] }));
```

</details>

<details>
<summary><strong>Elysia</strong></summary>

```ts
import { Elysia } from "elysia";
import { healthRoute } from "@openstatus/health-elysia";
import { tinybirdProbe } from "@openstatus/health-tinybird";

new Elysia().use(healthRoute({ probes: [tinybirdProbe()] })).listen(3000);
```

</details>

<details>
<summary><strong>Express</strong></summary>

```ts
import express from "express";
import { healthRoute } from "@openstatus/health-express";
import { drizzleProbe } from "@openstatus/health-drizzle";

const app = express();
app.use(healthRoute({ probes: [drizzleProbe({ db })] }));
```

</details>

<details>
<summary><strong>Next.js (App Router)</strong></summary>

```ts
// app/health/route.ts
import { healthRoute } from "@openstatus/health-next";
import { supabaseProbe } from "@openstatus/health-supabase";

// required: keeps Next.js from statically caching the route
export const dynamic = "force-dynamic";

export const { GET, HEAD } = healthRoute({ probes: [supabaseProbe({ client })] });
```

</details>

<details>
<summary><strong>TanStack Start</strong></summary>

```ts
// src/routes/api/health.ts
import { createFileRoute } from "@tanstack/react-router";
import { healthRoute } from "@openstatus/health-tanstack-start";
import { supabaseProbe } from "@openstatus/health-supabase";

export const Route = createFileRoute("/api/health")({
  server: { handlers: healthRoute({ probes: [supabaseProbe({ client })] }) },
});
```

</details>

<details>
<summary><strong>Anything with a Fetch API</strong> (<code>Deno.serve</code>, <code>Bun.serve</code>, Workers)</summary>

```ts
import { createHealthHandler } from "@openstatus/health";

Deno.serve(createHealthHandler({ path: "/health", probes: [/* ... */] }));
```

</details>

Runnable projects for each adapter live in [`examples/`](examples).

## Packages

### Core

| Package | JSR | npm | Description |
| ------- | --- | --- | ----------- |
| [`@openstatus/health`](packages/health) | [![JSR](https://jsr.io/badges/@openstatus/health)](https://jsr.io/@openstatus/health) | [![npm](https://img.shields.io/npm/v/@openstatus/health)](https://www.npmjs.com/package/@openstatus/health) | Probe runner, caching, response rendering, Fetch-API handler |

### Server adapters

| Package | JSR | npm | Description |
| ------- | --- | --- | ----------- |
| [`@openstatus/health-hono`](packages/hono) | [![JSR](https://jsr.io/badges/@openstatus/health-hono)](https://jsr.io/@openstatus/health-hono) | [![npm](https://img.shields.io/npm/v/@openstatus/health-hono)](https://www.npmjs.com/package/@openstatus/health-hono) | Hono adapter |
| [`@openstatus/health-elysia`](packages/elysia) | [![JSR](https://jsr.io/badges/@openstatus/health-elysia)](https://jsr.io/@openstatus/health-elysia) | [![npm](https://img.shields.io/npm/v/@openstatus/health-elysia)](https://www.npmjs.com/package/@openstatus/health-elysia) | Elysia adapter |
| [`@openstatus/health-express`](packages/express) | [![JSR](https://jsr.io/badges/@openstatus/health-express)](https://jsr.io/@openstatus/health-express) | [![npm](https://img.shields.io/npm/v/@openstatus/health-express)](https://www.npmjs.com/package/@openstatus/health-express) | Express 4 / 5 adapter |
| [`@openstatus/health-next`](packages/next) | [![JSR](https://jsr.io/badges/@openstatus/health-next)](https://jsr.io/@openstatus/health-next) | [![npm](https://img.shields.io/npm/v/@openstatus/health-next)](https://www.npmjs.com/package/@openstatus/health-next) | Next.js App Router adapter |
| [`@openstatus/health-tanstack-start`](packages/tanstack-start) | [![JSR](https://jsr.io/badges/@openstatus/health-tanstack-start)](https://jsr.io/@openstatus/health-tanstack-start) | [![npm](https://img.shields.io/npm/v/@openstatus/health-tanstack-start)](https://www.npmjs.com/package/@openstatus/health-tanstack-start) | TanStack Start adapter |

### Probes

| Package | JSR | npm | Description |
| ------- | --- | --- | ----------- |
| [`@openstatus/health-bullmq`](packages/bullmq) | [![JSR](https://jsr.io/badges/@openstatus/health-bullmq)](https://jsr.io/@openstatus/health-bullmq) | [![npm](https://img.shields.io/npm/v/@openstatus/health-bullmq)](https://www.npmjs.com/package/@openstatus/health-bullmq) | BullMQ waiting-count / backlog probe (`bullmq`) |
| [`@openstatus/health-clerk`](packages/clerk) | [![JSR](https://jsr.io/badges/@openstatus/health-clerk)](https://jsr.io/@openstatus/health-clerk) | [![npm](https://img.shields.io/npm/v/@openstatus/health-clerk)](https://www.npmjs.com/package/@openstatus/health-clerk) | Clerk Backend API reachability probe |
| [`@openstatus/health-clickhouse`](packages/clickhouse) | [![JSR](https://jsr.io/badges/@openstatus/health-clickhouse)](https://jsr.io/@openstatus/health-clickhouse) | [![npm](https://img.shields.io/npm/v/@openstatus/health-clickhouse)](https://www.npmjs.com/package/@openstatus/health-clickhouse) | ClickHouse `ping` / `SELECT 1` probe (`@clickhouse/client`) |
| [`@openstatus/health-cloudflare-d1`](packages/cloudflare-d1) | [![JSR](https://jsr.io/badges/@openstatus/health-cloudflare-d1)](https://jsr.io/@openstatus/health-cloudflare-d1) | [![npm](https://img.shields.io/npm/v/@openstatus/health-cloudflare-d1)](https://www.npmjs.com/package/@openstatus/health-cloudflare-d1) | Cloudflare D1 `select 1` probe over the Workers binding |
| [`@openstatus/health-cloudflare-kv`](packages/cloudflare-kv) | [![JSR](https://jsr.io/badges/@openstatus/health-cloudflare-kv)](https://jsr.io/@openstatus/health-cloudflare-kv) | [![npm](https://img.shields.io/npm/v/@openstatus/health-cloudflare-kv)](https://www.npmjs.com/package/@openstatus/health-cloudflare-kv) | Cloudflare Workers KV read probe over the Workers binding |
| [`@openstatus/health-cloudflare-r2`](packages/cloudflare-r2) | [![JSR](https://jsr.io/badges/@openstatus/health-cloudflare-r2)](https://jsr.io/@openstatus/health-cloudflare-r2) | [![npm](https://img.shields.io/npm/v/@openstatus/health-cloudflare-r2)](https://www.npmjs.com/package/@openstatus/health-cloudflare-r2) | Cloudflare R2 `HEAD` probe over the Workers binding |
| [`@openstatus/health-drizzle`](packages/drizzle) | [![JSR](https://jsr.io/badges/@openstatus/health-drizzle)](https://jsr.io/@openstatus/health-drizzle) | [![npm](https://img.shields.io/npm/v/@openstatus/health-drizzle)](https://www.npmjs.com/package/@openstatus/health-drizzle) | Drizzle ORM `select 1` probe |
| [`@openstatus/health-mysql`](packages/mysql) | [![JSR](https://jsr.io/badges/@openstatus/health-mysql)](https://jsr.io/@openstatus/health-mysql) | [![npm](https://img.shields.io/npm/v/@openstatus/health-mysql)](https://www.npmjs.com/package/@openstatus/health-mysql) | MySQL / MariaDB `select 1` probe (`mysql2/promise`) |
| [`@openstatus/health-postgres`](packages/postgres) | [![JSR](https://jsr.io/badges/@openstatus/health-postgres)](https://jsr.io/@openstatus/health-postgres) | [![npm](https://img.shields.io/npm/v/@openstatus/health-postgres)](https://www.npmjs.com/package/@openstatus/health-postgres) | Postgres `select 1` probe (`pg`, postgres.js, Neon, Vercel Postgres) |
| [`@openstatus/health-neon`](packages/neon) | [![JSR](https://jsr.io/badges/@openstatus/health-neon)](https://jsr.io/@openstatus/health-neon) | [![npm](https://img.shields.io/npm/v/@openstatus/health-neon)](https://www.npmjs.com/package/@openstatus/health-neon) | Neon serverless Postgres `select 1` probe (`@neondatabase/serverless`) |
| [`@openstatus/health-planetscale`](packages/planetscale) | [![JSR](https://jsr.io/badges/@openstatus/health-planetscale)](https://jsr.io/@openstatus/health-planetscale) | [![npm](https://img.shields.io/npm/v/@openstatus/health-planetscale)](https://www.npmjs.com/package/@openstatus/health-planetscale) | PlanetScale `select 1` probe over the serverless driver (`@planetscale/database`) |
| [`@openstatus/health-redis`](packages/redis) | [![JSR](https://jsr.io/badges/@openstatus/health-redis)](https://jsr.io/@openstatus/health-redis) | [![npm](https://img.shields.io/npm/v/@openstatus/health-redis)](https://www.npmjs.com/package/@openstatus/health-redis) | Redis / Valkey `PING` probe (node-redis, ioredis, `@upstash/redis`) |
| [`@openstatus/health-mongodb`](packages/mongodb) | [![JSR](https://jsr.io/badges/@openstatus/health-mongodb)](https://jsr.io/@openstatus/health-mongodb) | [![npm](https://img.shields.io/npm/v/@openstatus/health-mongodb)](https://www.npmjs.com/package/@openstatus/health-mongodb) | MongoDB `ping` command probe (`mongodb`) |
| [`@openstatus/health-prisma`](packages/prisma) | [![JSR](https://jsr.io/badges/@openstatus/health-prisma)](https://jsr.io/@openstatus/health-prisma) | [![npm](https://img.shields.io/npm/v/@openstatus/health-prisma)](https://www.npmjs.com/package/@openstatus/health-prisma) | Prisma `select 1` / `ping` probe (`@prisma/client`) |
| [`@openstatus/health-s3`](packages/s3) | [![JSR](https://jsr.io/badges/@openstatus/health-s3)](https://jsr.io/@openstatus/health-s3) | [![npm](https://img.shields.io/npm/v/@openstatus/health-s3)](https://www.npmjs.com/package/@openstatus/health-s3) | S3 `HeadBucket` probe (`@aws-sdk/client-s3`; AWS, R2, Tigris, MinIO) |
| [`@openstatus/health-qstash`](packages/qstash) | [![JSR](https://jsr.io/badges/@openstatus/health-qstash)](https://jsr.io/@openstatus/health-qstash) | [![npm](https://img.shields.io/npm/v/@openstatus/health-qstash)](https://www.npmjs.com/package/@openstatus/health-qstash) | Upstash QStash reachability probe over REST |
| [`@openstatus/health-inngest`](packages/inngest) | [![JSR](https://jsr.io/badges/@openstatus/health-inngest)](https://jsr.io/@openstatus/health-inngest) | [![npm](https://img.shields.io/npm/v/@openstatus/health-inngest)](https://www.npmjs.com/package/@openstatus/health-inngest) | Inngest REST API reachability probe |
| [`@openstatus/health-nats`](packages/nats) | [![JSR](https://jsr.io/badges/@openstatus/health-nats)](https://jsr.io/@openstatus/health-nats) | [![npm](https://img.shields.io/npm/v/@openstatus/health-nats)](https://www.npmjs.com/package/@openstatus/health-nats) | NATS `flush()` round-trip probe (`@nats-io/*`, `nats`) |
| [`@openstatus/health-kafka`](packages/kafka) | [![JSR](https://jsr.io/badges/@openstatus/health-kafka)](https://jsr.io/@openstatus/health-kafka) | [![npm](https://img.shields.io/npm/v/@openstatus/health-kafka)](https://www.npmjs.com/package/@openstatus/health-kafka) | Kafka `describeCluster()` probe (`kafkajs`) |
| [`@openstatus/health-stripe`](packages/stripe) | [![JSR](https://jsr.io/badges/@openstatus/health-stripe)](https://jsr.io/@openstatus/health-stripe) | [![npm](https://img.shields.io/npm/v/@openstatus/health-stripe)](https://www.npmjs.com/package/@openstatus/health-stripe) | Stripe API reachability probe |
| [`@openstatus/health-resend`](packages/resend) | [![JSR](https://jsr.io/badges/@openstatus/health-resend)](https://jsr.io/@openstatus/health-resend) | [![npm](https://img.shields.io/npm/v/@openstatus/health-resend)](https://www.npmjs.com/package/@openstatus/health-resend) | Resend API reachability probe |
| [`@openstatus/health-supabase`](packages/supabase) | [![JSR](https://jsr.io/badges/@openstatus/health-supabase)](https://jsr.io/@openstatus/health-supabase) | [![npm](https://img.shields.io/npm/v/@openstatus/health-supabase)](https://www.npmjs.com/package/@openstatus/health-supabase) | Supabase connection-pressure probe |
| [`@openstatus/health-tinybird`](packages/tinybird) | [![JSR](https://jsr.io/badges/@openstatus/health-tinybird)](https://jsr.io/@openstatus/health-tinybird) | [![npm](https://img.shields.io/npm/v/@openstatus/health-tinybird)](https://www.npmjs.com/package/@openstatus/health-tinybird) | Tinybird reachability probe |
| [`@openstatus/health-trigger-dev`](packages/trigger-dev) | [![JSR](https://jsr.io/badges/@openstatus/health-trigger-dev)](https://jsr.io/@openstatus/health-trigger-dev) | [![npm](https://img.shields.io/npm/v/@openstatus/health-trigger-dev)](https://www.npmjs.com/package/@openstatus/health-trigger-dev) | Trigger.dev API reachability probe |
| [`@openstatus/health-turso`](packages/turso) | [![JSR](https://jsr.io/badges/@openstatus/health-turso)](https://jsr.io/@openstatus/health-turso) | [![npm](https://img.shields.io/npm/v/@openstatus/health-turso)](https://www.npmjs.com/package/@openstatus/health-turso) | Turso libSQL `select 1` probe (`@libsql/client`) |
| [`@openstatus/health-turso-serverless`](packages/turso-serverless) | [![JSR](https://jsr.io/badges/@openstatus/health-turso-serverless)](https://jsr.io/@openstatus/health-turso-serverless) | [![npm](https://img.shields.io/npm/v/@openstatus/health-turso-serverless)](https://www.npmjs.com/package/@openstatus/health-turso-serverless) | Turso `select 1` probe over the serverless driver (`@tursodatabase/serverless`) |
| [`@openstatus/health-unkey`](packages/unkey) | [![JSR](https://jsr.io/badges/@openstatus/health-unkey)](https://jsr.io/@openstatus/health-unkey) | [![npm](https://img.shields.io/npm/v/@openstatus/health-unkey)](https://www.npmjs.com/package/@openstatus/health-unkey) | Unkey liveness probe |
| [`@openstatus/health-upstash`](packages/upstash) | [![JSR](https://jsr.io/badges/@openstatus/health-upstash)](https://jsr.io/@openstatus/health-upstash) | [![npm](https://img.shields.io/npm/v/@openstatus/health-upstash)](https://www.npmjs.com/package/@openstatus/health-upstash) | Upstash Redis `PING` probe over REST |

### Hosting metadata

| Package | JSR | npm | Description |
| ------- | --- | --- | ----------- |
| [`@openstatus/health-fly`](packages/fly) | [![JSR](https://jsr.io/badges/@openstatus/health-fly)](https://jsr.io/@openstatus/health-fly) | [![npm](https://img.shields.io/npm/v/@openstatus/health-fly)](https://www.npmjs.com/package/@openstatus/health-fly) | Fly.io region, machine and deployment |
| [`@openstatus/health-koyeb`](packages/koyeb) | [![JSR](https://jsr.io/badges/@openstatus/health-koyeb)](https://jsr.io/@openstatus/health-koyeb) | [![npm](https://img.shields.io/npm/v/@openstatus/health-koyeb)](https://www.npmjs.com/package/@openstatus/health-koyeb) | Koyeb region, instance and deployment |
| [`@openstatus/health-railway`](packages/railway) | [![JSR](https://jsr.io/badges/@openstatus/health-railway)](https://jsr.io/@openstatus/health-railway) | [![npm](https://img.shields.io/npm/v/@openstatus/health-railway)](https://www.npmjs.com/package/@openstatus/health-railway) | Railway region, replica, environment and deployment |
| [`@openstatus/health-vercel`](packages/vercel) | [![JSR](https://jsr.io/badges/@openstatus/health-vercel)](https://jsr.io/@openstatus/health-vercel) | [![npm](https://img.shields.io/npm/v/@openstatus/health-vercel)](https://www.npmjs.com/package/@openstatus/health-vercel) | Vercel region, environment and deployment |
| [`@openstatus/health-cloudflare`](packages/cloudflare) | [![JSR](https://jsr.io/badges/@openstatus/health-cloudflare)](https://jsr.io/@openstatus/health-cloudflare) | [![npm](https://img.shields.io/npm/v/@openstatus/health-cloudflare)](https://www.npmjs.com/package/@openstatus/health-cloudflare) | Cloudflare Workers colo and version metadata |

Missing a framework or a dependency? Adapters and probes are small —
[open an issue](https://github.com/openstatusHQ/health/issues/new) or send a
PR; [`AGENTS.md`](AGENTS.md) walks through adding a package.

## Probes

| Probe | Default name | Critical | Checks |
| ----- | ------------ | -------- | ------ |
| `tinybirdProbe({ baseUrl? })` | `tinybird` | no | `GET {baseUrl}/v0/health` |
| `unkeyProbe({ baseUrl? })` | `unkey` | no | `GET {baseUrl}/v2/liveness` |
| `clickhouseProbe({ client, select? })` | `clickhouse` | no | `client.ping({ select: true })` on a `@clickhouse/client` client |
| `tursoProbe({ client })` | `database` | yes | `client.execute("select 1")` on a Turso libSQL client |
| `tursoServerlessProbe({ connection })` | `database` | yes | `connection.get("select 1")` on a Turso serverless `Connection` |
| `drizzleProbe({ db })` | `database` | yes | `db.execute(sql\`select 1\`)` or `db.run(...)` |
| `supabaseProbe({ client, maxConnectionPercent? })` | `supabase` | no | `rpc("health_connection_pressure")` ≤ threshold |
| `upstashProbe({ url, token })` | `redis` | no | `GET {url}/ping` with the REST token |
| `mysqlProbe({ client })` | `database` | yes | `client.query("select 1")` on a `mysql2/promise` pool or connection |
| `postgresProbe({ client })` | `database` | yes | `client.query("select 1")` on a `pg` pool, or `sql.unsafe("select 1")` on postgres.js |
| `neonProbe({ client })` | `database` | yes | `client.query("select 1")` on `neon()`, or a Neon `Pool` / `Client` |
| `planetscaleProbe({ connection })` | `database` | yes | `connection.execute("select 1")` on a `@planetscale/database` connection |
| `redisProbe({ client })` | `redis` | no | `client.ping()` answers `PONG` on a node-redis, ioredis or Upstash client |
| `mongodbProbe({ client, db? })` | `database` | yes | `client.db("admin").command({ ping: 1 })` on a `MongoClient` |
| `prismaProbe({ client })` | `database` | yes | `client.$queryRawUnsafe("select 1")`, or `client.$runCommandRaw({ ping: 1 })` on MongoDB |
| `d1Probe({ db })` | `database` | yes | `db.prepare("select 1").first()` on a Workers `D1Database` binding |
| `kvProbe({ namespace, key? })` | `kv` | no | `namespace.get("health")` on a Workers `KVNamespace` binding |
| `r2Probe({ bucket, key? })` | `storage` | no | `bucket.head(key ?? "health")` on a Workers `R2Bucket` binding |
| `s3Probe({ client, bucket })` | `storage` | no | `client.send(new HeadBucketCommand({ Bucket }))` on an `S3Client` |
| `qstashProbe({ token, baseUrl? })` | `qstash` | no | `GET {baseUrl}/v2/queues` with the token |
| `inngestProbe({ signingKey, baseUrl? })` | `inngest` | no | `GET {baseUrl}/v1/events?limit=1` with the signing key |
| `triggerDevProbe({ secretKey, baseUrl? })` | `trigger` | no | `GET {baseUrl}/api/v1/runs?page[size]=1` with the secret key |
| `bullmqProbe({ queue, maxWaiting? })` | `queue` | no | `queue.getWaitingCount()` on a BullMQ `Queue`, ≤ threshold |
| `natsProbe({ connection })` | `nats` | no | `connection.flush()` on an open `NatsConnection` |
| `kafkaProbe({ admin })` | `kafka` | no | `admin.describeCluster()` lists ≥ 1 broker on a connected KafkaJS `Admin` |
| `stripeProbe({ secretKey, baseUrl? })` | `stripe` | no | `GET {baseUrl}/v1/balance` with the secret key |
| `resendProbe({ apiKey, baseUrl? })` | `resend` | no | `GET {baseUrl}/domains` with the API key |
| `clerkProbe({ secretKey, baseUrl? })` | `clerk` | no | `GET {baseUrl}/v1/users?limit=1` with the secret key |

Every probe factory accepts `name`, `critical`, `timeoutMs` and `skip`
overrides. Probes take a client instance or a base URL — they never read
`process.env` themselves.

### Writing your own probe

A probe is a plain object. Resolve for healthy, reject or throw for failed,
and honour the `AbortSignal` so a timeout actually cancels the work:

```ts
import { httpProbe, probe } from "@openstatus/health";

const queue = probe({
  name: "queue",
  critical: true,
  timeoutMs: 1000,
  skip: () => !env.QUEUE_URL,
  run: async (signal, ctx) => {
    const res = await fetch(`${env.QUEUE_URL}/depth`, { signal });
    if (!res.ok) throw new Error(`${ctx.name} answered ${res.status}`);
    const { depth } = await res.json();
    if (depth > 10_000) throw new Error(`queue depth ${depth}`);
  },
});

const docs = httpProbe({ name: "docs", url: "https://docs.example.com", method: "HEAD" });
```

`skip` runs on every request, may be async, and reports the check as
`skipped` without running it — use it for optional dependencies that are not
configured in every environment. `ctx` carries the probe's `name`, `critical`
flag and effective `timeoutMs`.

`@openstatus/health/testing` exports `fakeFetch`, `hangFetch` and ready-made
`okProbe` / `failingProbe` / `hangingProbe` fixtures for testing probes and
adapters of your own.

## Options

Every entry point takes the same options — `probes` (or a shared `check`),
`path`, `cacheMs`, `cacheFailuresMs`, `staleMs`, `timeoutMs`, `deadlineMs`,
`exposeChecks`, `unhealthyStatusCode`, `degradedStatusCode`, `extend`,
`formatError`, `onReport`, `onError` — documented once in
[`packages/health`](packages/health#options).

Errors are masked as `"failed"` unless you opt in with
`formatError: "message"`.

## Liveness, readiness, public and internal

Liveness is "the process answers"; readiness is "the process can serve".
Mount the same adapter twice — an empty probe list is always `ok`:

```ts
app.route("/", healthRoute({ path: "/livez", probes: [] }));
app.route("/", healthRoute({ path: "/readyz", probes, deadlineMs: 800, cacheFailuresMs: 0 }));
```

`deadlineMs` caps the whole round so a hung dependency cannot outlast a
Kubernetes probe's `timeoutSeconds`; `cacheFailuresMs: 0` lets the next poll
see a recovery immediately. Set `staleMs` to keep answering from the last
report while a refresh runs in the background.

One `/health` can serve the load balancer and your on-call engineer:
`exposeChecks` takes a function of the request, and `extend` output is only
rendered when checks are exposed. If you would rather serve two routes, build
the check once and share it so the probes run once per cache window:

```ts
import { createHealthCheck } from "@openstatus/health";

const check = createHealthCheck({ probes, cacheMs: 5000, onReport: log });

app.route("/", healthRoute({ check, exposeChecks: false }));
app.route("/", healthRoute({ check, path: "/_health", extend: flyExtend() }));
// or, one route:
app.route("/", healthRoute({
  check,
  exposeChecks: (c) => c.req.header("x-health-token") === env.HEALTH_TOKEN,
  extend: flyExtend(),
}));
```

`check.invalidate()` drops the cache — call it after a reconnect or a config
reload.

## Server metadata

The hosting packages answer a different question from the probes: not "is the
database up" but "which replica is telling me that". Each reads its platform's
own environment — or, on Workers, the request — and renders it under `server`
through the same `extend` hook:

```ts
import { healthRoute } from "@openstatus/health-hono";
import { flyExtend } from "@openstatus/health-fly";

app.route("/", healthRoute({ probes, extend: flyExtend() }));
```

```json
{
  "status": "ok",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "latencyMs": 41,
  "checks": [{ "name": "database", "status": "ok", "critical": true, "latencyMs": 3 }],
  "server": {
    "platform": "fly",
    "region": "ams",
    "instanceId": "148e21ebd47089",
    "service": "openstatus-api",
    "version": "registry.fly.io/openstatus-api:deployment-01H9RK9EYO9PGNBYAKGXSHV0PH",
    "primaryRegion": "cdg"
  }
}
```

`platform`, `region`, `instanceId`, `service`, `version` and `environment` mean
the same thing on every platform; anything else is named as that platform names
it. A field is absent rather than guessed when the platform has no equivalent —
Vercel exposes no instance identity, so there is no `instanceId` there. Values
are passed through exactly as the platform sets them, so `region` is `ams` on
Fly and `DFW` on Cloudflare.

Each package also exports the data on its own — `flyServer()`, `vercelServer()`
— so you can compose it with your own fields, or chain platforms if one build
deploys to several. `extend` may return anything `JSON.stringify` accepts;
the report's own fields always take precedence over keys of the same name:

```ts
extend: (_report, c) => ({
  server: flyServer() ?? vercelServer(),
  requestId: c.get("requestId"),
}),
```

Off-platform they return `undefined` and nothing is rendered, so the same build
runs unchanged on your laptop. `extend` follows `exposeChecks`: when the checks
are hidden, so is everything `extend` adds.

## Monitoring the endpoint

A `/health` that reports `degraded` is only useful if something reads it.
Point an [openstatus HTTP monitor](https://www.openstatus.dev/docs/reference/http-monitor)
at the endpoint and assert on `status` in the body to be alerted on
`degraded` before it becomes `unhealthy`. Any poller that checks the HTTP
status code — Kubernetes, Fly, Railway, a load balancer — gets `503` on
`unhealthy` without further configuration.

## Development

```sh
deno task check            # type-check, lint, fmt, version consistency
deno task test             # node:test suites under Deno
deno task build            # tsdown -> dist/ for every package
deno task test:node        # the same suites under Node against dist/
deno task check:treeshake  # no package bundles another framework/client
deno task test-all         # all of the above
```

See [`AGENTS.md`](AGENTS.md) for layout and conventions,
[`CHANGES.md`](CHANGES.md) for the changelog and
[`RELEASING.md`](RELEASING.md) for the release checklist.

## Contributing

Issues and PRs are welcome — a bug, a new adapter or probe, or a docs fix.

- Read [`AGENTS.md`](AGENTS.md) for the layout and conventions.
- Run `deno task test-all` before opening a PR.
- Join the [Discord](https://discord.gg/openstatus) to ask questions.

## About openstatus

[openstatus](https://www.openstatus.dev/) is an open-source uptime monitoring
and status page platform. It monitors endpoints from regions around the world
and turns the results into status pages and alerts. These packages are the
`/health` endpoints behind openstatus's own services, extracted so any
JavaScript server can expose one — and so a monitor has something more useful
to poll than `200 OK`.

## License

[MIT](LICENSE)
