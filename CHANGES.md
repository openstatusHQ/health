# Changelog

## Unreleased

- New `@openstatus/health-mysql` probe: `mysqlProbe({ client })` runs `select
  1` through a `mysql2/promise` pool or connection and fails the check when
  `query()` does not return a promise (the callback API). Critical by default;
  the client is typed structurally, so `mysql2` stays an optional peer for its
  types. Throws `ProbeConfigError` at construction when the client has no
  `query()`.
- New `@openstatus/health-postgres` probe: `postgresProbe({ client })` runs
  `select 1` through `client.query()` (`pg`, `@vercel/postgres`, Neon) or
  `sql.unsafe()` (postgres.js). Critical by default; the client is typed
  structurally, so `pg` and `postgres` stay optional peers for their types.
  Throws `ProbeConfigError` at construction when the client has neither
  method.

## 0.1.3

- New `@openstatus/health-clickhouse` probe: `clickhouseProbe({ client })`
  runs the official client's health check — `SELECT 1` by default, so the
  server verifies the credentials — and fails the check when `ping()`
  resolves with `{ success: false }` instead of throwing. Pass
  `select: false` for the cheaper `GET /ping` endpoint (Node.js only). The
  probe's `AbortSignal` is forwarded as `abort_signal`, so `timeoutMs`
  cancels the request in flight. Throws `ProbeConfigError` at construction
  when `client` has no `ping()`. Non-critical by default; the client is typed
  structurally, so `@clickhouse/client` (>= 1.12.0, where `ping()` gained
  its options) stays an optional peer for its types.
- `renderHealthResponse()` removes extension `checks` and `latencyMs` fields
  when `exposeChecks` is `false`. Other extension fields remain unchanged.
- `@openstatus/health`: `onReport` catches rejected promises from other JavaScript
  realms without an unhandled rejection.
- Health reports and responder fallbacks remain available when a rejected value
  cannot convert to a string. The error uses generic text without private fields.
- Health responses ignore a top-level `toJSON` from `extend` so JSON
  serialization cannot replace the report fields. Nested dates and custom
  JSON values keep their normal serialization.
- `createHealthHandler()` includes `cache-control: no-store` and JSON
  content-type headers on `404` and `405` responses.
- `@openstatus/health`: Probes no longer start work if an async `skip`
  returns `false` after the timeout. The completed timeout report stays unchanged.
- `@openstatus/health`: `runProbes()` ignores non-positive and non-finite
  `timeoutMs` / `deadlineMs` values instead of scheduling an instant timeout.
- `@openstatus/health`: `createHealthResponder().toResponse()` falls back to the
  report body when `extend` returns something `JSON.stringify` cannot
  serialize, and reports it through `onError`, so the endpoint still answers.
- `@openstatus/health`: `check.invalidate()` abandons an in-flight round, so a
  later `report()` starts a fresh run and the abandoned round cannot overwrite
  the cache.
- `@openstatus/health`: `readEnv()` falls back to `Deno.env.get()` when
  `process.env` is unavailable or throws.
- `@openstatus/health-upstash`: `upstashProbe()` rejects an empty `token` at
  construction.
- `@openstatus/health-supabase`: `supabaseProbe()` rejects a negative or
  non-finite `maxConnectionPercent` and treats a non-finite
  `connection_percent` as an unexpected response shape.
- Docs: corrected the Upstash env/skip example, clarified the TanStack Start
  `createFileRoute` example, and noted that Next.js has no `healthHandler`.
- Tooling: pinned `rolldown@1.0.0-beta.19` so the `tsdown` build no longer
  prints an invalid `define` option warning.
- Every package moves to 0.1.3; adapters and probes now declare
  `@openstatus/health` as a peer at `^0.1.3`.

## 0.1.2

- Every hosting package (`fly`, `koyeb`, `railway`, `vercel`, `cloudflare`)
  accepts a typed `omit` list on its `*Server()` / `*Extend()` options, so a
  public endpoint can hide individual fields:
  `vercelExtend({ omit: ["projectId", "commitSha"] })`. The keys are checked
  against the package's `*ServerInfo` type, and `platform` can be omitted too
  (#5).
- `@openstatus/health` exports `omitFields(value, keys?)`, the shallow-copy
  helper the hosting packages use to implement `omit`.
- Every package README ends with an "About openstatus" section and a link to
  the MIT license (#4).
- Every package moves to 0.1.2; adapters and probes now declare
  `@openstatus/health` as a peer at `^0.1.2`.

## 0.1.1

- New `@openstatus/health-tanstack-start` adapter: `healthRoute()` returns
  `{ GET, HEAD }` for a file route's `server.handlers`; `healthHandler()` is
  the bare handler for use with `createHandlers` when a method needs its own
  middleware. `extend()` receives the Start handler context
  (`{ request, params, context }`), generic over the router context type.
- `@openstatus/health-drizzle`: `drizzleProbe()` called `db.execute` / `db.run`
  detached from the drizzle instance, so every check failed with
  `Cannot read properties of undefined (reading 'resultKind')`. Both the
  pg/mysql and sqlite/libsql paths are fixed and covered by regression tests
  (#1).
- Every package moves to 0.1.1; adapters and probes now declare
  `@openstatus/health` as a peer at `^0.1.1`.

## 0.1.0

Initial release.

- `@openstatus/health`: dependency-free core — `runProbes()`,
  `createHealthCheck()` (TTL cache + in-flight de-duplication, separate
  `cacheFailuresMs` for non-ok reports, `onReport` hook),
  `renderHealthResponse()`, Fetch-API `createHealthHandler()` (honours `path`
  when set) and `createLazyHealthHandler()` for per-request environments such
  as Workers, the `httpProbe()` / `expectOk()` / `probe()` helpers, and
  `readEnv()` for environment lookups that work the same under Node, Bun,
  Deno and Workers. Reports aggregate to `ok | degraded | unhealthy`; timeouts
  count as failures; error text is generic unless `formatError` is
  `"message"` or a function. Probes receive `(signal, { name, critical,
  timeoutMs })`; `skip` may be async and runs inside the timeout. `extend`
  accepts anything `JSON.stringify` does. Options are layered
  (`RunProbesOptions` ⊂ `HealthCheckOptions` ⊂ `HealthHandlerOptions` ⊂
  `HealthRouteOptions`) so each function only accepts what it uses.
  `@openstatus/health/testing` ships `fakeFetch`, `hangFetch` and probe
  fixtures.
- Server adapters: `@openstatus/health-hono`, `@openstatus/health-elysia`,
  `@openstatus/health-express` and `@openstatus/health-next` each export
  `healthRoute()` (mounts `GET` and `HEAD` on `path`); the first three also
  export `healthHandler()`, a bare handler for the framework. Every adapter
  honours `exposeChecks`, `unhealthyStatusCode`, `degradedStatusCode` and
  passes its full framework context (Hono `Context`, Elysia `Context`,
  Express `Request`, `NextRequest`) to `extend()`.
- Probes: `@openstatus/health-tinybird` (`GET /v0/health`),
  `@openstatus/health-unkey` (`GET /v2/liveness`),
  `@openstatus/health-upstash` (`GET /ping` on the Upstash REST API),
  `@openstatus/health-turso` (`select 1` on a libSQL client),
  `@openstatus/health-turso-serverless` (`select 1` on a
  `@tursodatabase/serverless` connection), `@openstatus/health-drizzle`
  (`select 1` via `execute` or `run`), `@openstatus/health-supabase`
  (`health_connection_pressure()` RPC with a `maxConnectionPercent`
  threshold).
- Hosting packages: `@openstatus/health-fly`, `@openstatus/health-koyeb`,
  `@openstatus/health-railway`, `@openstatus/health-vercel` and
  `@openstatus/health-cloudflare` render the region, instance and deployment
  that produced the response under a `server` key, through `extend`. Each
  exports `xServer()` for the object and `xExtend()` for the wrapper;
  `platform`, `region`, `instanceId`, `service`, `version` and `environment`
  mean the same thing on every platform, values are passed through exactly as
  the platform sets them, and nothing is rendered off-platform. The Cloudflare
  package reads `request.cf.colo` instead of the environment and never renders
  client geolocation.
- Published to JSR and npm (ESM + CJS, `sideEffects: false`, one output
  module per source file); a CI job asserts that importing one package never
  bundles another framework or client library.
- `@openstatus/health`: `createHealthResponder(options)` — `{ check,
  respond(ctx), toResponse(ctx, method?) }` — is the single implementation
  every adapter sits on, and the way to write one for another framework.
  `HealthHandlerOptions` accepts a prebuilt `check` instead of `probes`, so
  two routes can share one cache and callers keep a handle to
  `invalidate()`. `exposeChecks` may be a function of the framework context,
  and `extend` output follows it: nothing from `extend` is rendered when
  checks are hidden. An `extend` or `exposeChecks` that throws does not take
  the endpoint down — the report is served without the extension (or with
  checks hidden) and the error goes to the `onError` hook, which defaults to
  `console.error`. `deadlineMs` caps every probe's timeout so a round
  finishes inside a prober's own timeout; `staleMs` serves the last report
  while a refresh runs in the background. `probeUrl()` and
  `ProbeConfigError` give probe factories construction-time errors that name
  the probe and the field; `DuplicateProbeError` suggests the fix.
- `@openstatus/health-hono`, `@openstatus/health-elysia`,
  `@openstatus/health-express`: `healthHandler` (and `healthRoute` on Hono)
  take the framework's context type — `Env`, singleton, `res.locals` — so
  `extend` and `exposeChecks` are typed like the rest of the app. Without a
  type argument the context is loosely typed and untyped usage compiles.
- `@openstatus/health-upstash`, `-tinybird`, `-unkey`, `-drizzle`: a missing
  or relative URL and an unsupported drizzle instance throw
  `ProbeConfigError` at construction with the probe and field named.
- README: liveness/readiness, Kubernetes and load-balancer timeouts, public
  vs. internal bodies, and custom adapters are documented.
