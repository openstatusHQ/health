# @openstatus/health — development guidelines

## Layout

- `packages/<name>/` — one npm/JSR package per concern. `health` is the
  zero-dependency core; `hono`, `elysia`, `express`, `next`, `tanstack-start`
  are server adapters; `bullmq`, `clickhouse`, `cloudflare-d1`,
  `cloudflare-kv`, `cloudflare-r2`, `drizzle`, `inngest`, `kafka`, `mongodb`,
  `mysql`, `nats`, `neon`, `planetscale`, `postgres`, `prisma`, `qstash`,
  `redis`, `s3`, `stripe`, `supabase`, `tinybird`, `trigger-dev`, `turso`,
  `turso-serverless`, `unkey`, `upstash` are probes; `fly`, `koyeb`,
  `railway`, `vercel`, `cloudflare` render hosting metadata under `server` via
  the `extend` hook.
- Each package has `deno.json` (`exports: ./src/mod.ts`), `package.json`
  (`exports -> dist/`, `sideEffects: false`), `tsdown.config.ts`, `README.md`
  and `src/` with `mod.ts`, implementation files and one `*.test.ts` per file.
  `health` also exports `src/testing.ts` as `@openstatus/health/testing`;
  probe and adapter tests use its doubles instead of local copies.
- `examples/` are type-checked in CI and never published.
- `scripts/` hold workspace maintenance scripts.

## Adding a package

1. Create `packages/<name>` with the files above.
2. Add it to `workspace` in the root `deno.json`.
3. Add its allowed dependencies to `scripts/check_treeshake.ts`.
4. Add a row to the root `README.md` package table.

## Conventions

- Deno only: `deno task check`, `deno task test`, `deno task build`,
  `deno task test:node`, `deno task check:treeshake`.
- Strict TypeScript. Never use `any` or `unknown`; spell out the union you
  mean or use a structural interface. The one exception is the loose adapter
  context defaults (`LooseEnv`, `ExpressLocals`) and the Express
  `Request`/`Response` generics, where `unknown` satisfies the framework's
  constraint; keep it there and nowhere else. The one exception is the loose adapter
  context defaults (`LooseEnv`, `ExpressLocals`) and the Express
  `Request`/`Response` generics, where `unknown` satisfies the framework's
  constraint; keep it there and nowhere else.
- Explicit return types on every exported function (JSR rejects slow types).
- Every server adapter exports `healthRoute(options)` (mounts `path`) and
  `healthHandler(options)` (a bare handler for that framework; Next.js has
  only `healthRoute`, the file is the route; TanStack Start's `healthRoute`
  returns `{ GET, HEAD }` for `server.handlers`). Adapters are built on
  `createHealthResponder` from the core and contain no response logic of
  their own. Options are layered: `RunProbesOptions` ⊂ `HealthCheckOptions`
  ⊂ `HealthHandlerOptions` ⊂ `HealthRouteOptions`; a function only accepts
  the layer it uses. From `HealthHandlerOptions` up, `check` may replace
  `probes`.
- Adapters are generic over the framework's context type (Hono `Env`,
  Elysia singleton, Express locals) with a loose default, so untyped usage
  compiles and typed usage catches typos.
- Probes take a client or URL; they never read the environment themselves.
  Factories validate their options at construction and throw
  `ProbeConfigError` naming the probe and field; use `probeUrl()` for URLs.
- Every entrypoint (`mod.ts`, `testing.ts`) starts with a `/** ... @module */`
  block, and every exported symbol — including interface members, class
  members and constructors — carries a one-line JSDoc summary. JSR scores
  both; `deno doc --lint packages/<name>/src/mod.ts` must report no
  `missing-jsdoc` (its `private-type-ref` errors on cross-package imports are
  a single-file false positive). No other comments unless they explain
  something the code cannot.
- Client libraries are imported with `import type` only. Runtime imports are
  limited to what is actually called.
- No top-level side effects in any `src/*.ts`.
- Tests use `node:test` and `node:assert/strict` so they run unchanged under
  `deno test` and `node --test`.
- All packages share one version; `deno task check:versions` enforces it and
  `deno task update-versions x.y.z` bumps it.
- `tsdown` stays on `0.12.x`; the root `package.json` pins
  `rolldown@1.0.0-beta.19` to match it, because newer rolldown rejects the
  `define` option tsdown passes and prints a warning on every build. Do not
  bump either without re-checking `deno task build` output.
- `tsdown` stays on `0.12.x`; the root `package.json` pins
  `rolldown@1.0.0-beta.19` to match it, because newer rolldown rejects the
  `define` option tsdown passes and prints a warning on every build. Do not
  bump either without re-checking `deno task build` output.

## Releasing

Publishing is manual; see `RELEASING.md`.
