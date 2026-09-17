# @openstatus/health-disk

Disk space probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Reads the free space of the filesystem holding `path` and fails the check
when it drops below a threshold — the input a readiness probe needs on
anything that writes to local disk: SQLite, uploads, logs, a build cache.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-disk
npm install @openstatus/health @openstatus/health-disk
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { diskProbe } from "@openstatus/health-disk";

Deno.serve(
  createHealthHandler({
    probes: [diskProbe({ path: "/data", minFreePercent: 10 })],
  }),
);
```

`path` can be any file or directory; the probe reports on the filesystem
that holds it, so `/data` and `/data/app.db` answer the same. Free space is
what an unprivileged process can still use (`bavail`), which is what your
writes see once root's reserved blocks are excluded. The check fails below
`minFreePercent` (10% by default) or below `minFreeBytes` when that is set
instead; pass both to enforce both. A threshold failure throws
`DiskSpaceError`, which carries the `usage`; a `statfs` error or an
unreadable result fails the check with that error instead.

```ts
diskProbe({
  path: "/var/lib/app",
  minFreeBytes: 2 * 1024 ** 3,
  // optional overrides from the Probe contract
  name: "data-volume",
  critical: true,
  timeoutMs: 500,
  skip: () => env.DATA_DIR == null,
});
```

Non-critical by default: a disk filling up degrades the report early enough
to act on before writes start failing. Set `critical: true` when the
instance should stop taking traffic instead — a database volume, for
instance.

This probe uses `fs.promises.statfs` from `node:fs`, so it runs on Node.js,
Deno and Bun but not on edge runtimes. `statfs` is typed structurally and
can be replaced for tests.

## About openstatus

[openstatus](https://www.openstatus.dev/) is the open-source uptime monitoring
and status page platform. This package is part of
[`@openstatus/health`](https://github.com/openstatusHQ/health), the `/health`
endpoints behind openstatus's own services, extracted so any JavaScript server
can expose one. Point an
[openstatus monitor](https://www.openstatus.dev/docs/reference/http-monitor)
at the endpoint and assert on `status` in the body to be alerted on
`degraded` before it becomes `unhealthy`.

Source: [github.com/openstatusHQ/health](https://github.com/openstatusHQ/health).
Issues and PRs welcome.

## License

[MIT](https://github.com/openstatusHQ/health/blob/main/LICENSE)
