# @openstatus/health

[![main](https://github.com/openstatusHQ/health/actions/workflows/main.yaml/badge.svg)](https://github.com/openstatusHQ/health/actions/workflows/main.yaml)
[![JSR](https://jsr.io/badges/@openstatus/health)](https://jsr.io/@openstatus/health)
[![npm](https://img.shields.io/npm/v/@openstatus/health)](https://www.npmjs.com/package/@openstatus/health)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Tree-shakable health endpoints for JavaScript servers. A dependency-free core
runs *probes* against your dependencies and renders `ok | degraded |
unhealthy`; thin adapters mount it as `GET /health` on your framework; thin
probe packages know how to ping one dependency each.

Runs on Deno, Node ≥ 22, Bun and edge runtimes. Published to JSR and npm.
Built and used in production by [openstatus](https://www.openstatus.dev/),
the open-source uptime monitoring and status page platform.

```json
{
  "status": "degraded",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "latencyMs": 41,
  "checks": [
    { "name": "database", "status": "ok",      "critical": true,  "latencyMs": 3 },
    { "name": "redis",    "status": "skipped", "critical": false, "latencyMs": 0 },
    { "name": "tinybird", "status": "timeout", "critical": false, "latencyMs": 5000, "error": "timed out after 5000ms" }
  ]
}
```

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

### Providers

| Package | JSR | npm | Description |
| ------- | --- | --- | ----------- |
| [`@openstatus/health-clickhouse`](packages/clickhouse) | [![JSR](https://jsr.io/badges/@openstatus/health-clickhouse)](https://jsr.io/@openstatus/health-clickhouse) | [![npm](https://img.shields.io/npm/v/@openstatus/health-clickhouse)](https://www.npmjs.com/package/@openstatus/health-clickhouse) | ClickHouse `ping` / `SELECT 1` probe (`@clickhouse/client`) |
| [`@openstatus/health-drizzle`](packages/drizzle) | [![JSR](https://jsr.io/badges/@openstatus/health-drizzle)](https://jsr.io/@openstatus/health-drizzle) | [![npm](https://img.shields.io/npm/v/@openstatus/health-drizzle)](https://www.npmjs.com/package/@openstatus/health-drizzle) | Drizzle ORM `select 1` probe |
| [`@openstatus/health-supabase`](packages/supabase) | [![JSR](https://jsr.io/badges/@openstatus/health-supabase)](https://jsr.io/@openstatus/health-supabase) | [![npm](https://img.shields.io/npm/v/@openstatus/health-supabase)](https://www.npmjs.com/package/@openstatus/health-supabase) | Supabase connection-pressure probe |
| [`@openstatus/health-tinybird`](packages/tinybird) | [![JSR](https://jsr.io/badges/@openstatus/health-tinybird)](https://jsr.io/@openstatus/health-tinybird) | [![npm](https://img.shields.io/npm/v/@openstatus/health-tinybird)](https://www.npmjs.com/package/@openstatus/health-tinybird) | Tinybird reachability probe |
| [`@openstatus/health-turso`](packages/turso) | [![JSR](https://jsr.io/badges/@openstatus/health-turso)](https://jsr.io/@openstatus/health-turso) | [![npm](https://img.shields.io/npm/v/@openstatus/health-turso)](https://www.npmjs.com/package/@openstatus/health-turso) | Turso libSQL `select 1` probe (`@libsql/client`) |
| [`@openstatus/health-turso-serverless`](packages/turso-serverless) | [![JSR](https://jsr.io/badges/@openstatus/health-turso-serverless)](https://jsr.io/@openstatus/health-turso-serverless) | [![npm](https://img.shields.io/npm/v/@openstatus/health-turso-serverless)](https://www.npmjs.com/package/@openstatus/health-turso-serverless) | Turso `select 1` probe over the serverless driver (`@tursodatabase/serverless`) |
| [`@openstatus/health-unkey`](packages/unkey) | [![JSR](https://jsr.io/badges/@openstatus/health-unkey)](https://jsr.io/@openstatus/health-unkey) | [![npm](https://img.shields.io/npm/v/@openstatus/health-unkey)](https://www.npmjs.com/package/@openstatus/health-unkey) | Unkey liveness probe |
| [`@openstatus/health-upstash`](packages/upstash) | [![JSR](https://jsr.io/badges/@openstatus/health-upstash)](https://jsr.io/@openstatus/health-upstash) | [![npm](https://img.shields.io/npm/v/@openstatus/health-upstash)](https://www.npmjs.com/package/@openstatus/health-upstash) | Upstash Redis `PING` probe over REST |

### Hosting

| Package | JSR | npm | Description |
| ------- | --- | --- | ----------- |
| [`@openstatus/health-fly`](packages/fly) | [![JSR](https://jsr.io/badges/@openstatus/health-fly)](https://jsr.io/@openstatus/health-fly) | [![npm](https://img.shields.io/npm/v/@openstatus/health-fly)](https://www.npmjs.com/package/@openstatus/health-fly) | Fly.io region, machine and deployment |
| [`@openstatus/health-koyeb`](packages/koyeb) | [![JSR](https://jsr.io/badges/@openstatus/health-koyeb)](https://jsr.io/@openstatus/health-koyeb) | [![npm](https://img.shields.io/npm/v/@openstatus/health-koyeb)](https://www.npmjs.com/package/@openstatus/health-koyeb) | Koyeb region, instance and deployment |
| [`@openstatus/health-railway`](packages/railway) | [![JSR](https://jsr.io/badges/@openstatus/health-railway)](https://jsr.io/@openstatus/health-railway) | [![npm](https://img.shields.io/npm/v/@openstatus/health-railway)](https://www.npmjs.com/package/@openstatus/health-railway) | Railway region, replica, environment and deployment |
| [`@openstatus/health-vercel`](packages/vercel) | [![JSR](https://jsr.io/badges/@openstatus/health-vercel)](https://jsr.io/@openstatus/health-vercel) | [![npm](https://img.shields.io/npm/v/@openstatus/health-vercel)](https://www.npmjs.com/package/@openstatus/health-vercel) | Vercel region, environment and deployment |
| [`@openstatus/health-cloudflare`](packages/cloudflare) | [![JSR](https://jsr.io/badges/@openstatus/health-cloudflare)](https://jsr.io/@openstatus/health-cloudflare) | [![npm](https://img.shields.io/npm/v/@openstatus/health-cloudflare)](https://www.npmjs.com/package/@openstatus/health-cloudflare) | Cloudflare Workers colo and version metadata |

Each package is its own concern with its own peer dependencies: importing
`@openstatus/health-hono` never pulls Express, and importing
`@openstatus/health-unkey` never pulls Drizzle. CI bundles a one-line consumer
of every package and fails if any other framework or client library lands in
the output.

## Quick start

Install the core plus one adapter and the probes you need:

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-hono jsr:@openstatus/health-turso
npm install @openstatus/health @openstatus/health-hono @openstatus/health-turso
```

Every adapter exports the same two functions. `healthRoute(options)` is the
batteries-included form: it mounts `GET` and `HEAD` on `options.path`
(default `/health`). `healthHandler(options)` is the primitive underneath — a
plain handler for that framework — for when you want to pick the path, stack
your own middleware in front, or register it the way you register everything
else.

### Hono

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

### Elysia

```ts
import { Elysia } from "elysia";
import { healthRoute } from "@openstatus/health-elysia";
import { tinybirdProbe } from "@openstatus/health-tinybird";

new Elysia().use(healthRoute({ probes: [tinybirdProbe()] })).listen(3000);
```

### Express

```ts
import express from "express";
import { healthRoute } from "@openstatus/health-express";
import { drizzleProbe } from "@openstatus/health-drizzle";

const app = express();
app.use(healthRoute({ probes: [drizzleProbe({ db })] }));
```

### Next.js (App Router)

```ts
// app/health/route.ts
import { healthRoute } from "@openstatus/health-next";
import { supabaseProbe } from "@openstatus/health-supabase";

// required: keeps Next.js from statically caching the route
export const dynamic = "force-dynamic";

export const { GET, HEAD } = healthRoute({ probes: [supabaseProbe({ client })] });
```

### TanStack Start

```ts
// src/routes/api/health.ts
import { createFileRoute } from "@tanstack/react-router";
import { healthRoute } from "@openstatus/health-tanstack-start";
import { supabaseProbe } from "@openstatus/health-supabase";

export const Route = createFileRoute("/api/health")({
  server: { handlers: healthRoute({ probes: [supabaseProbe({ client })] }) },
});
```

### Anything with a Fetch API (`Deno.serve`, `Bun.serve`, Workers)

```ts
import { createHealthHandler } from "@openstatus/health";

Deno.serve(createHealthHandler({ path: "/health", probes: [/* ... */] }));
```

## Options

Every entry point takes the same options — `probes` (or a shared `check`),
`path`, `cacheMs`, `staleMs`, `timeoutMs`, `deadlineMs`, `exposeChecks`,
`unhealthyStatusCode`, `degradedStatusCode`, `extend`, `formatError`,
`onReport`, `onError` — documented once in
[`packages/health`](packages/health#options).

Aggregation: a failing or timed-out **critical** probe makes the report
`unhealthy`; a failing non-critical probe makes it `degraded`; `skipped`
probes never affect it. Errors are masked as `"failed"` unless you opt in
with `formatError: "message"`.

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

Every probe factory accepts `name`, `critical`, `timeoutMs` and `skip`
overrides. Probes take a client instance or a base URL — they never read
`process.env` themselves.

## Writing your own probe

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

## Development

```sh
deno task check            # type-check, lint, fmt, version consistency
deno task test             # node:test suites under Deno
deno task build            # tsdown -> dist/ for every package
deno task test:node        # the same suites under Node against dist/
deno task check:treeshake  # no package bundles another framework/client
deno task test-all         # all of the above
```

See [`AGENTS.md`](AGENTS.md) for conventions and [`RELEASING.md`](RELEASING.md)
for the release checklist.

## About openstatus

[openstatus](https://www.openstatus.dev/) monitors endpoints from regions
around the world and turns the results into status pages and alerts. These
packages are the `/health` endpoints behind openstatus's own services,
extracted so any JavaScript server can expose one — and so a monitor has
something more useful to poll than `200 OK`. Point an
[openstatus monitor](https://www.openstatus.dev/docs/reference/http-monitor) at the endpoint and assert
on `status` in the body to be alerted on `degraded` before it becomes
`unhealthy`.

Source: [github.com/openstatusHQ/health](https://github.com/openstatusHQ/health).
Issues and PRs welcome.

## License

[MIT](LICENSE)
