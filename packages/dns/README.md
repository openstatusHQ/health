# @openstatus/health-dns

DNS probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Resolves a hostname through the runtime's resolver and fails the check
when the name does not resolve — the early warning for an expired domain,
a broken record change or a resolver outage on the host, before the first
request to that dependency fails.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-dns
npm install @openstatus/health @openstatus/health-dns
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { dnsProbe } from "@openstatus/health-dns";

Deno.serve(
  createHealthHandler({
    probes: [dnsProbe({ hostname: "api.stripe.com" })],
  }),
);
```

The probe calls `dns.promises.lookup(hostname)`, which uses the same path
your `fetch` and sockets use — the OS resolver, `/etc/hosts` and the
runtime's cache — so it answers "would a connection to this name find an
address" rather than "what do the authoritative servers say". Pass
`lookup` to resolve through something else, such as `dns.promises.resolve4`
bound to a specific resolver, and give each probe a `name` when you mount
more than one.

```ts
import { Resolver } from "node:dns/promises";

const resolver = new Resolver();
resolver.setServers(["1.1.1.1"]);

dnsProbe({
  hostname: "api.example.com",
  lookup: async (hostname) =>
    (await resolver.resolve4(hostname)).map((address) => ({ address })),
  // optional overrides from the Probe contract
  name: "upstream-dns",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.UPSTREAM_HOST == null,
});
```

Non-critical by default: a name that stops resolving is worth alerting on,
but the dependency behind it usually has a probe of its own that decides
whether the service can still serve. Set `critical: true` when it cannot.

This probe uses `node:dns`, so it runs on Node.js, Deno and Bun but not on
edge runtimes without a resolver API.

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
