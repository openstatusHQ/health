# @openstatus/health-tcp

TCP probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Opens a socket to `host:port`, reports `ok` as soon as the connection is
established and closes it again — the check for every dependency that has
no client library or HTTP endpoint: an SMTP relay, a Memcached node, a
database behind a bastion, a legacy service on a bare port.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-tcp
npm install @openstatus/health @openstatus/health-tcp
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { tcpProbe } from "@openstatus/health-tcp";

Deno.serve(
  createHealthHandler({
    probes: [
      tcpProbe({ name: "smtp", host: "smtp.example.com", port: 587 }),
      tcpProbe({ name: "memcached", host: "10.0.0.5", port: 11211 }),
    ],
  }),
);
```

A successful connect proves the host resolves, the network path is open
and something is listening on the port; it does not prove that the
listener speaks the protocol you expect or would accept your credentials.
Refused and unreachable connections fail the check with the socket error,
and a `timeoutMs` destroys a socket that is still waiting for the
handshake. Give each probe a `name` when you mount more than one — they all
default to `tcp`, and duplicate names are rejected.

```ts
tcpProbe({
  host: "smtp.example.com",
  port: 587,
  // optional overrides from the Probe contract
  name: "smtp",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.SMTP_HOST == null,
});
```

Non-critical by default: a bare port check rarely maps to a dependency
requests cannot proceed without. Set `critical: true` when it does.

This probe uses `node:net`, so it runs on Node.js, Deno and Bun but not on
edge runtimes without a socket API. The connect function is typed
structurally, and `connect` can be replaced for tests.

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
