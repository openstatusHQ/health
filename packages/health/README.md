# @openstatus/health

Framework-agnostic core for health endpoints: a probe runner, a cached
checker, response rendering, and a Fetch-API handler. Zero dependencies; runs
on Deno, Node ≥ 22, Bun and edge runtimes. Built and used in production by
[openstatus](https://www.openstatus.dev/), the open-source uptime monitoring
and status page platform.

The core is one package in a family — thin adapters mount it on your
framework, thin probes know how to ping one dependency each, and hosting
packages say which replica answered:

- Adapters: [`@openstatus/health-hono`](https://jsr.io/@openstatus/health-hono),
  [`@openstatus/health-elysia`](https://jsr.io/@openstatus/health-elysia),
  [`@openstatus/health-express`](https://jsr.io/@openstatus/health-express),
  [`@openstatus/health-next`](https://jsr.io/@openstatus/health-next),
  [`@openstatus/health-tanstack-start`](https://jsr.io/@openstatus/health-tanstack-start).
- Probes: [`@openstatus/health-drizzle`](https://jsr.io/@openstatus/health-drizzle),
  [`@openstatus/health-supabase`](https://jsr.io/@openstatus/health-supabase),
  [`@openstatus/health-tinybird`](https://jsr.io/@openstatus/health-tinybird),
  [`@openstatus/health-turso`](https://jsr.io/@openstatus/health-turso),
  [`@openstatus/health-turso-serverless`](https://jsr.io/@openstatus/health-turso-serverless),
  [`@openstatus/health-unkey`](https://jsr.io/@openstatus/health-unkey),
  [`@openstatus/health-upstash`](https://jsr.io/@openstatus/health-upstash).
- Hosting: [`@openstatus/health-fly`](https://jsr.io/@openstatus/health-fly),
  [`@openstatus/health-koyeb`](https://jsr.io/@openstatus/health-koyeb),
  [`@openstatus/health-railway`](https://jsr.io/@openstatus/health-railway),
  [`@openstatus/health-vercel`](https://jsr.io/@openstatus/health-vercel),
  [`@openstatus/health-cloudflare`](https://jsr.io/@openstatus/health-cloudflare).

The full package table, with quick starts for every adapter, is in the
[repository README](https://github.com/openstatusHQ/health#packages).

## Install

```sh
deno add jsr:@openstatus/health
npm install @openstatus/health
```

## Usage

```ts
import { createHealthHandler, httpProbe, readEnv } from "@openstatus/health";

const handler = createHealthHandler({
  path: "/health",
  probes: [
    {
      name: "database",
      critical: true,
      run: () => db.run(sql`select 1`),
    },
    {
      name: "redis",
      skip: () => readEnv("UPSTASH_REDIS_REST_URL") == null,
      run: () => redis.ping(),
    },
    httpProbe({ name: "unkey", url: "https://api.unkey.com/v2/liveness" }),
  ],
});

Deno.serve(handler);
```

`GET /health` answers:

```json
{
  "status": "degraded",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "latencyMs": 41,
  "checks": [
    { "name": "database", "status": "ok", "critical": true, "latencyMs": 3 },
    { "name": "redis", "status": "skipped", "critical": false, "latencyMs": 0 },
    { "name": "unkey", "status": "timeout", "critical": false, "latencyMs": 5000, "error": "timed out after 5000ms" }
  ]
}
```

`HEAD` returns the same status code with no body. Other methods get `405`
with an `allow: GET, HEAD` header. Without `path` the handler answers on
every URL; with it, anything else gets `404` (a trailing slash is tolerated
either way). Every response carries `content-type: application/json` and
`cache-control: no-store`.

Errors are masked by default — a failing probe reports `"error": "failed"`.
Pass `formatError: "message"` to see the real message while developing, or
read on for the trade-off.

## Probes

```ts
interface Probe {
  name: string;
  critical?: boolean;                 // default false
  timeoutMs?: number;                 // default 5000
  skip?: () => boolean | Promise<boolean>;
  run: (signal: AbortSignal, ctx: ProbeContext) => ProbeResult | Promise<ProbeResult>;
}

interface ProbeContext {
  name: string;
  critical: boolean;
  timeoutMs: number;                  // the effective timeout for this run
}
```

A probe is healthy when `run` resolves and failed when it rejects or throws.
The `signal` aborts when `timeoutMs` elapses; pass it to `fetch` and other
cancellable calls. `ctx` tells the probe its own name and effective timeout,
so it can set a shorter internal deadline or log which check it is.

`skip` runs first, inside the same timeout window. `true` reports the check as
`skipped` without calling `run` — use it for optional dependencies that are
not configured in every environment. It may be async, so feature flags and
secret lookups work too.

`probe(options)` is an identity helper that gives you autocomplete on `run`'s
parameters without an explicit `: Probe` annotation:

```ts
const redis = probe({
  name: "redis",
  run: (signal, ctx) => fetch(`${url}/ping`, { signal }),
});
```

`readEnv(name, source?)` reads one variable through `process.env` under Node,
Bun, Deno and Workers with `nodejs_compat`, and answers `undefined` instead of
throwing where env access is denied — Deno without `--allow-env` throws on both
`process.env` and `Deno.env.get`. Pass `source` to supply the values yourself,
which is how tests avoid mutating the environment.

Status aggregation:

| Result | Report status |
| ------ | ------------- |
| every probe ok or skipped | `ok` |
| a non-critical probe failed or timed out | `degraded` |
| a critical probe failed or timed out | `unhealthy` |

Probe names must be unique; duplicates throw a `DuplicateProbeError` when the
endpoint is created.

A probe that ignores `signal` and settles after its deadline is still reported
as `timeout`; the late result is discarded and can never surface as an
unhandled rejection.

The probe packages listed above follow the same contract: every factory takes
a client or URL (never the environment), accepts `name`, `critical`,
`timeoutMs` and `skip` overrides, and validates its options at construction —
a missing or malformed URL throws a `ProbeConfigError` naming the probe and
the field.

## Options

The options are layered so that each function only accepts what it uses:

| Type | Accepted by | Fields |
| ---- | ----------- | ------ |
| `RunProbesOptions` | `runProbes()` | `timeoutMs`, `deadlineMs`, `formatError` |
| `HealthCheckOptions` | `createHealthCheck()` | the above plus `probes`, `cacheMs`, `cacheFailuresMs`, `staleMs`, `onReport` |
| `HealthResponseOptions` | `renderHealthResponse()` | `exposeChecks` (boolean), `unhealthyStatusCode`, `degradedStatusCode` |
| `HealthResponderOptions<Ctx>` | — | `exposeChecks` (boolean or function), `unhealthyStatusCode`, `degradedStatusCode`, `extend`, `onError` |
| `HealthHandlerOptions<Ctx>` | `createHealthResponder()`, adapter `healthHandler()`, Next.js and TanStack Start `healthRoute()` | `HealthResponderOptions` plus either `HealthCheckOptions` or `{ check }` |
| `HealthRouteOptions<Ctx>` | `createHealthHandler()`, `createLazyHealthHandler()`, adapter `healthRoute()` | the above plus `path` |

An object typed as `HealthRouteOptions` works everywhere. From
`HealthHandlerOptions` up, you pass either `probes` (and the check options) or
a prebuilt `check` — the `HealthSource` union makes passing both a type error.

| Option | Default | Description |
| ------ | ------- | ----------- |
| `probes` | — | Probes to run, concurrently, on every uncached request. |
| `check` | — | A `HealthCheck` from `createHealthCheck()` to use instead of `probes`. Share one between routes so the probes run once per cache window, and keep a handle to `invalidate()`. |
| `path` | `"/health"` | Route the adapter mounts. On `createHealthHandler` there is no default: unset answers every URL, set returns `404` elsewhere. Ignored by Next.js and TanStack Start, where the file is the route. |
| `cacheMs` | `5000` | Reuse the last `ok` report for this long; concurrent callers share one round. `0` disables. |
| `cacheFailuresMs` | `cacheMs` | Same, for `degraded` and `unhealthy` reports. Set `0` so a readiness poller sees recovery on its next tick instead of waiting out the cache. |
| `staleMs` | `0` | Stale-while-revalidate: after the cache expires, keep answering with the last report for this long while one refresh runs in the background. The prober never waits on a probe. |
| `timeoutMs` | `5000` | Default per-probe timeout; a hung probe reports `timeout`. |
| `deadlineMs` | — | Upper bound for the whole round: every probe's timeout is capped to it, so the response is ready within `deadlineMs` no matter what hangs. Set it below your prober's own timeout — Kubernetes defaults to `1s`. |
| `exposeChecks` | `true` | Include `latencyMs`, `checks` and `extend` output in the body. `false` returns only `status` and `checkedAt` — for public endpoints. A function `(ctx) => boolean \| Promise<boolean>` decides per request, so one route can be terse for anonymous callers and detailed for trusted ones. |
| `unhealthyStatusCode` | `503` | HTTP status for `unhealthy`. Set `200` to always answer 200 and let callers read `status`. |
| `degradedStatusCode` | `200` | HTTP status for `degraded`. |
| `extend` | — | `(report, ctx) => object` merged into the body: request id, vitals, or a `server` object from a hosting package. `ctx` is the framework request context. May be async. Anything `JSON.stringify` accepts is fine — `interface` types and `Date`s included. `status`, `checkedAt`, `latencyMs` and `checks` always win; put your data under your own keys. Only runs when checks are exposed. If it throws, the report is served without it and the error goes to `onError`. |
| `formatError` | `"generic"` | What goes in a check's `error` field. `"generic"` reports `"failed"` / `"timed out after Nms"` and never leaks messages. `"message"` reports `error.message`. Or supply `(error: Error) => string`. |
| `onReport` | — | `(report) => void` called once per uncached round, after the probes finish. Log it, emit a metric, page on `unhealthy`. Errors thrown or rejected inside are swallowed. |
| `onError` | `console.error` | `(error, ctx) => void` called when `extend` or a function-form `exposeChecks` throws. The endpoint still answers — with no extension, or with checks hidden. |

The defaults are exported as `defaultTimeoutMs`, `defaultCacheMs`,
`defaultUnhealthyStatusCode` and `defaultDegradedStatusCode`.

## Helpers

- `httpProbe({ name, url, method?, headers?, expectStatus?, fetch?, critical?, timeoutMs?, skip? })` — reachability probe for any HTTP endpoint. `method` is `GET` (default) or `HEAD`; `expectStatus` replaces the 2xx check with one exact status; `fetch` swaps the implementation for tests.
- `expectOk(response, expectStatus?)` — rejects unless the response is 2xx (or the given status), and cancels the body either way.
- `probe(options)` — identity function for authoring probes with inference.
- `runProbes(probes, { timeoutMs?, deadlineMs?, formatError? })` — one round, no caching.
- `createHealthCheck(options)` — `{ report(), invalidate() }` with caching and in-flight de-duplication.
- `renderHealthResponse(report, options, extended?)` — `{ status, headers, body }` from a report you already have.
- `createHealthResponder<Ctx>(options)` — `{ check, respond(ctx), toResponse(ctx, method?) }`: everything between "a request arrived" and "here is the response", for any framework. `respond` returns `{ status, headers, body }`; `toResponse` builds a `Response` and drops the body on `HEAD`. This is what every adapter is built on — see [Custom adapters](#custom-adapters).
- `resolveHealthCheck(options)` — the `check` you passed, or one built from `probes`.
- `createHealthHandler(options)` — `(request: Request) => Promise<Response>`.
- `createLazyHealthHandler((env, request) => options)` — the same handler, built once on the first request. For runtimes where configuration only exists per request, such as Cloudflare Workers' `fetch(request, env)`:

  ```ts
  export default {
    fetch: createLazyHealthHandler<Request, Env>((env) => ({
      probes: [tursoProbe({ client: createClient(env.DATABASE_URL) })],
    })),
  };
  ```

- `readEnv(name, source?)` — portable environment lookup that never throws.
- `probeUrl({ probe, field, value, path? })` — parse a URL option at construction and throw a `ProbeConfigError` that names the probe and the field (`upstashProbe: "url" must be an absolute URL, got undefined`) instead of a bare `Invalid URL` from inside the library. Use it in your own probe factories.

## Errors

- `ProbeTimeoutError` — the `signal.reason` a probe receives when its timeout fires, and the error behind a `timeout` check. Carries `timeoutMs`.
- `DuplicateProbeError` — thrown by `createHealthCheck()` and everything built on it when two probes share a `name`. Carries `probeName`.
- `ProbeConfigError` — thrown by probe factories for an invalid option. Carries `probe` and `field`.
- `genericFormatError` / `messageFormatError` — the two built-in `formatError` implementations, exported so a custom formatter can fall back to them.

## Custom adapters

An adapter for a framework not listed here is a few lines over
`createHealthResponder`. Give it the framework's request context as `Ctx` so
`extend` and `exposeChecks` receive it typed:

```ts
import { createHealthResponder, type HealthHandlerOptions } from "@openstatus/health";
import type { FastifyReply, FastifyRequest } from "fastify";

export function healthHandler(options: HealthHandlerOptions<FastifyRequest>) {
  const responder = createHealthResponder<FastifyRequest>(options);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const { status, headers, body } = await responder.respond(req);
    reply.status(status).headers(headers);
    return req.method === "HEAD" ? reply.send() : reply.send(JSON.stringify(body));
  };
}
```

Frameworks that already speak `(Request) => Response` — SvelteKit `+server.ts`,
Astro endpoints, React Router resource routes, Nitro, Fresh, `Bun.serve` —
need no adapter: `export const GET = createHealthHandler({ probes })`.

## Testing

`@openstatus/health/testing` ships the doubles the packages test themselves
with, so you can test your own probes and adapters without a network:

```ts
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch, okProbe, failingProbe, hangingProbe } from "@openstatus/health/testing";

const report = await runProbes([
  okProbe("a"),
  failingProbe("b", true),
  myProbe({ fetch: fakeFetch({ status: 503 }) }),
]);
```

- `fakeFetch({ status?, body?, onFetch? })` — a `fetch` that answers immediately and reports each call's `url`, `method`, `headers` and `signal`.
- `hangFetch(track?)` — a `fetch` that never resolves; sets `track.aborted` when the signal fires.
- `okProbe(name, critical?)`, `failingProbe(name, critical?, error?)`, `hangingProbe(name, critical?, timeoutMs?)` — probes with a known outcome.

## About openstatus

[openstatus](https://www.openstatus.dev/) monitors endpoints from regions
around the world and turns the results into status pages and alerts. These
packages are the `/health` endpoints behind openstatus's own services,
extracted so any JavaScript server can expose one — and so a monitor has
something more useful to poll than `200 OK`. Point an
[openstatus monitor](https://www.openstatus.dev/docs/reference/http-monitor)
at the endpoint and assert on `status` in the body to be alerted on
`degraded` before it becomes `unhealthy`.

Source: [github.com/openstatusHQ/health](https://github.com/openstatusHQ/health).
Issues and PRs welcome.

## License

[MIT](https://github.com/openstatusHQ/health/blob/main/LICENSE)
